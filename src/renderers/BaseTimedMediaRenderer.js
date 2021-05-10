import BaseRenderer, { RENDERER_PHASES } from './BaseRenderer';
import logger from '../logger';

import { MediaFormats } from '../browserCapabilities';
import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
import { VIDEO, AUDIO } from '../utils';

export default class BaseTimedMediaRenderer extends BaseRenderer {
    constructor(
        representation,
        assetCollectionFetcher,
        fetchMedia,
        player,
        analytics,
        controller,
    ) {
        super(
            representation,
            assetCollectionFetcher,
            fetchMedia,
            player,
            analytics,
            controller,
        );

        this._inTime = 0;
        this._outTime = undefined;

        // During loading (intial load or chunk load after a seek) the player
        // reports underfined as it's current time. We latch the previous
        // returned currentTime and return that rather than undefined.
        this._latchedMediaTime = undefined;
        this._accumulatedMediaTime = 0;
        this._stalledMediaTime = 0;

        this._inspectMediaPlaybackTime = 10;
        this._inspectMediaPlayback = this._inspectMediaPlayback.bind(this);

        this._shouldShowScrubBar = true;
    }

    getIsLooping() {
        return this._playoutEngine.checkIsLooping(this._rendererId);
    }

    getDuration() {
        let duration = super.getDuration();

        if (duration === Infinity) {
            if (this._outTime >= 0) {
                duration = this._outTime;
            } else if (!this.getIsLooping()) {
                duration =
                    this._playoutEngine.getDuration(this._rendererId) ??
                    duration;
            }

            duration -= this._inTime;
        }

        return duration;
    }

    getCurrentTime() {
        const duration = this.getDuration();
        const currentTime = this.getIsLooping() ?
            this._accumulatedMediaTime :
            this._latchedMediaTime - this._inTime;

        return {
            duration,
            currentTime,
            timeBased: duration !== Infinity,
            remainingTime: duration - currentTime,
        };
    }

    setCurrentTime(time) {
        // Calculate bounded time w.r.t. what was requested.
        const { duration } = this.getCurrentTime();

        // Duration of an HTMLMediaElement is not always reported accurately;
        // and if we seek past the actual duration, behaviour is undefined, so
        // instead seek to the duration minus guard time.
        let targetTime = time;
        targetTime = Math.min(targetTime, duration - 0.01)
        targetTime = Math.max(0, targetTime)

        const choiceTime = this.getChoiceTime();
        if (choiceTime >= 0 && choiceTime < targetTime) {
            targetTime = choiceTime;
        }

        // Account for trimmed video.
        targetTime += this._inTime;

        // Ensure that targetTime is valid.
        if (targetTime === Infinity || Number.isNaN(targetTime)) {
            logger.warn(`Ignoring setCurrentTime (${time} for ${targetTime}).`);
            return;
        }

        this._playoutEngine.setCurrentTime(this._rendererId, targetTime);
    }

    _inspectMediaPlayback() {
        const duration = this.getDuration();
        const isLooping = this.getIsLooping();
        const isPlaying = this._playoutEngine.isPlaying();

        const oldTime = this._latchedMediaTime;
        this._latchedMediaTime =
            this._playoutEngine.getCurrentTime(this._rendererId) ??
            this._latchedMediaTime;

        const diffTime = this._latchedMediaTime - oldTime;
        if (diffTime > 0) this._accumulatedMediaTime += diffTime;

        // Transcoded media _may_ cause stalls close to the reported end of the
        // media. No ended value is set on the media element. The only way to
        // detect this is to check if the media element play head is not moving
        // while the playout engine believes it is.
        const mediaDuration = this._playoutEngine.getDuration(this._rendererId);
        if (
            this._latchedMediaTime > mediaDuration - 1 &&
            diffTime === 0 &&
            isPlaying
        ) {
            this._stalledMediaTime += this._inspectMediaPlaybackTime / 1000;
        } else {
            this._stalledMediaTime = 0;
        }

        const isEnded =
            this._playoutEngine.checkIsEnded(this._rendererId) ||
            this._latchedMediaTime > this._outTime ||
            this._stalledMediaTime > 2;

        if (isLooping && isEnded) {
            this.setCurrentTime(0);
            this.play();
        }

        if (
            (!isLooping && isEnded) ||
            (isLooping && this._accumulatedMediaTime >= duration)
        ) {
            // Some players fallback to first frame--force showing ending frame.
            this._playoutEngine.setCurrentTime(this._rendererId, duration-0.1);

            // Seeking past end on some players will cause end to trigger even
            // when paused. Cycle Play-Pause for consistent player state.
            if(!isPlaying) {
                this._playoutEngine.play();
                this._playoutEngine.pause();
            } else {
                // if we have non-looping trimmed media, we need to pause it in
                // case of end link behaviours
                if (this._outTime) this._playoutEngine.pause();
                clearInterval(this._inspectMediaPlaybackInterval);
                this._setPhase(RENDERER_PHASES.MEDIA_FINISHED);
                super.complete();
            }
        }
    }

    async _queueMedia(mediaObjOverride, assetKey, subtitleKey = "sub_src") {
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(
                this._representation.asset_collections.foreground_id,
            );
            this._testShowScrubBar(fg);
            if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                this._inTime = parseFloat(fg.meta.romper.in);
            }
            if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                this._outTime = parseFloat(fg.meta.romper.out);
            }
            if (fg.assets[assetKey]) {
                const mediaObj = {
                    type: undefined,
                    loop: fg.loop,
                    id: fg.id,
                    inTime: this._inTime,
                    outTime: this._outTime,
                    ...mediaObjOverride
                }
                let mediaType;
                switch(mediaObj.type){
                case MEDIA_TYPES.FOREGROUND_AV:
                    mediaType = VIDEO
                    break;
                case MEDIA_TYPES.FOREGROUND_A:
                    mediaType = AUDIO
                    break
                default:
                    throw new Error("Invalid MDIA_TYPE")
                }
                const options = { mediaFormat: MediaFormats.getFormat(), mediaType };
                const mediaUrl = await this._fetchMedia(fg.assets[assetKey], options);
                if (fg.assets[subtitleKey]) {
                    const subsUrl = await this._fetchMedia(fg.assets[subtitleKey]);
                    mediaObj.subs_url = subsUrl
                }
                if (this._destroyed) {
                    logger.warn('trying to populate video element that has been destroyed');
                } else {
                    mediaObj.url = mediaUrl
                    this._playoutEngine.queuePlayout(this._rendererId, mediaObj);
                }
            } else {
                throw new Error('No av source for video');
            }
        } else {
            throw new Error('No foreground asset id for video');
        }
    }

    // given the forground asset collection, determine whether or not
    // scrub bar should be shown
    _testShowScrubBar(foregroundAssetCollection) {
        if (!foregroundAssetCollection.loop) {
            // non-looping - enable
            this._shouldShowScrubBar = true;
        } else if (this._representation.duration
            && this._representation.duration > 0) {
            // looping but with duration - enable
            this._shouldShowScrubBar = true;
        } else {
            // looping with no duration - disable
            this._shouldShowScrubBar = false;
        }
    }

    start() {
        super.start();
        this._playoutEngine.setPlayoutActive(this._rendererId);

        clearInterval(this._inspectMediaPlaybackInterval);
        this._inspectMediaPlaybackInterval = setInterval(
            this._inspectMediaPlayback,
            this._inspectMediaPlaybackTime,
        );

        logger.info(`Started: ${this._representation.id}`);

        // // set time to last set time (relative to click start)
        this._player.enablePlayButton();
        this._player.showSeekButtons();

        // show/hide scrub bar
        if (this._shouldShowScrubBar) {
            this._player.enableScrubBar();
        } else {
            this._player.disableScrubBar();
        }
    }

    play() {
        this._playoutEngine.play();
    }

    pause() {
        this._playoutEngine.pause();
    }

    end() {
        const needToEnd = super.end();
        if (!needToEnd) return false;

        clearInterval(this._inspectMediaPlaybackInterval);
        this._latchedMediaTime = undefined;
        this._accumulatedMediaTime = 0;
        this._stalledMediaTime = 0;
        this.setCurrentTime(0);

        logger.info(`Ended: ${this._representation.id}`);
        this._playoutEngine.setPlayoutInactive(this._rendererId);

        return true;
    }

    destroy() {
        const needToDestroy = super.destroy();
        if(needToDestroy) {
            this._playoutEngine.unqueuePlayout(this._rendererId);
        }
        return needToDestroy;
    }
}
