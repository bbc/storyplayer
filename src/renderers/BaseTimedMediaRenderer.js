import BaseRenderer, { RENDERER_PHASES } from './BaseRenderer';
import logger from '../logger';

import { MediaFormats } from '../browserCapabilities';
import SMPPlayoutEngine from '../playoutEngines/SMPPlayoutEngine'
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
        // During loading (intial load or chunk load after a seek) the player
        // reports underfined as it's current time. We latch the previous
        // returned currentTime and return that rather than undefined.
        this._latchedCurrentTime = undefined;
        this._accumulatedTime = 0;
        this._shouldShowScrubBar = true;

        this._endedEventListener = this._endedEventListener.bind(this);
        this._outTimeEventListener = this._outTimeEventListener.bind(this);
        this._seekEventHandler = this._seekEventHandler.bind(this);
    }

    getCurrentTime() {
        const duration = this.getDuration();
        const oldTime = this._latchedCurrentTime;
        this._latchedCurrentTime =
            this._playoutEngine.getCurrentTime(this._rendererId) ||
            this._latchedCurrentTime ||
            this._inTime;

        let currentTime;
        // If we are looping use the total amount of time player has been
        // running, rather than current play head position. Otherwise; use the
        // latched play head time and account for in-time.
        if (this.checkIsLooping()) {
            const diffTime = this._latchedCurrentTime - oldTime
            if (diffTime > 0) this._accumulatedTime += diffTime;
            currentTime = this._accumulatedTime;
        } else {
            currentTime = this._latchedCurrentTime - this._inTime;
        }

        return {
            duration,
            currentTime,
            timeBased: duration !== Infinity,
            remainingTime: duration - this._latchedCurrentTime,
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

    async _queueMedia(mediaObjOverride, assetKey, subtitleKey = "sub_src") {
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(
                this._representation.asset_collections.foreground_id,
            );
            this._testShowScrubBar(fg);
            if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                this._setInTime(parseFloat(fg.meta.romper.in));
            }
            if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                this._setOutTime(parseFloat(fg.meta.romper.out));
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

    _endedEventListener() {
        clearTimeout(this._testEndStallTimeout);

        // Race Condition: ended and timeupdate events firing at same time from
        // a playoutEngine cause this function to be run twice, resulting in two
        // NE skips. Only allow function to run if in MAIN phase.
        if(this.phase !== RENDERER_PHASES.MAIN) {
            return
        }

        const { duration } = this.getCurrentTime()

        // We must not end if paused. Firefox specific issue: Seeking to end
        // on Firefox will cause end event to trigger. So if this happens
        // we back MediaPlayer off a bit from end.
        // Reset SMP back to the ending frame.
        this._playoutEngine.setCurrentTime(this._rendererId, duration - 0.1)
        if(!this._playoutEngine.isPlaying()) {
            // Play/Pause cycle to reset SMP to not be in a unstarted state
            this._playoutEngine.play()
            this._playoutEngine.pause()
            return
        }

        if (this.checkIsLooping()) {
            // eslint-disable-next-line max-len
            logger.warn(`received ended event for looping media on rep ${ this._rendererId} - need to loop manually`);
            this.setCurrentTime(0);
            this.play();
            return;
        }

        this._setPhase(RENDERER_PHASES.MEDIA_FINISHED);
        super.complete();
    }

    _seekEventHandler() {
        super.seekEventHandler(this._inTime);
    }

    _outTimeEventListener() {
        const { duration, currentTime } = this.getCurrentTime();
        if (
            currentTime >= duration ||
            (this._outTime > 0 && currentTime >= this._outTime)
        ) {
            if (this.checkIsLooping()) {
                this.setCurrentTime(0);
                this._playoutEngine.playRenderer(this._rendererId);
            } else {
                this._playoutEngine.pauseRenderer(this._rendererId);
                this._endedEventListener();
            }
        }

        // Stall Detection
        // Only needed for non SMPPlayoutEngine
        if (
            !(this._playoutEngine instanceof SMPPlayoutEngine) &&
            currentTime > (duration - 1)
        ) {
            if (this._playoutEngine.isPlaying() && !this._testEndStallTimeout) {
                const startTime = currentTime;
                this._testEndStallTimeout = setTimeout(() => {
                    // eslint-disable-next-line no-shadow
                    const { currentTime } = this.getCurrentTime();
                    // eslint-disable-next-line max-len
                    logger.info(`Checked video end for stall, run for 2s at ${startTime}, reached ${currentTime}`);
                    if (currentTime >= startTime && currentTime <= startTime + 1.9) {
                        logger.warn('Video end checker failed stall test');
                        clearTimeout(this._testEndStallTimeout);
                        // one more loop check
                        if(this.checkIsLooping()) {
                            this.setCurrentTime(0);
                            this._playoutEngine.playRenderer(this._rendererId);
                        } else {
                            this._playoutEngine.pauseRenderer(this._rendererId);
                            this._endedEventListener();
                        }
                    }
                }, 2000);
            }
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

        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.on(this._rendererId, 'seeked', this._seekEventHandler);
        this._playoutEngine.setPlayoutActive(this._rendererId);
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

        this._latchedCurrentTime = undefined;
        this._accumulatedTime = 0;
        this.setCurrentTime(0);

        clearTimeout(this._testEndStallTimeout);

        logger.info(`Ended: ${this._representation.id}`);
        this._playoutEngine.setPlayoutInactive(this._rendererId);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.off(this._rendererId, 'seeked', this._seekEventHandler);

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
