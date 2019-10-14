// @flow

import Player from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';

// import MediaManager from '../MediaManager';
// import MediaInstance from '../MediaInstance';

import Controller from '../Controller';

import logger from '../logger';

export type HTMLTrackElement = HTMLElement & {
    kind: string,
    label: string,
    srclang: string,
    src: string,
    mode: string,
    default: boolean,
}

export default class SimpleAudioRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _audioTrack: HTMLTrackElement;

    _handlePlayPauseButtonClicked: Function;

    _lastSetTime: number

    _inTime: number;

    _outTime: number;

    _endedEventListener: Function;

    _seekEventHandler: Function;

    _hasEnded: boolean;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
        controller: Controller,
    ) {
        super(
            representation,
            assetCollectionFetcher,
            fetchMedia,
            player,
            analytics,
            controller,
        );
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);

        this._endedEventListener = this._endedEventListener.bind(this);
        this._seekEventHandler = this._seekEventHandler.bind(this);

        this.renderAudioElement();

        this._lastSetTime = 0;

        this._inTime = 0;
        this._outTime = -1;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_A,
            playPauseHandler: this._handlePlayPauseButtonClicked,
        });
    }

    _endedEventListener() {
        if (!this._hasEnded) {
            this._hasEnded = true;
            super.complete();
        }
    }

    _seekEventHandler() {
        super.seekEventHandler(this._inTime);
    }

    start() {
        super.start();
        this._hasEnded = false;
        this._playoutEngine.setPlayoutActive(this._rendererId);

        logger.info(`Started: ${this._representation.id}`);

        this.setCurrentTime(0);

        // automatically move on at audio end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'seeked', this._seekEventHandler);

        const mediaElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (mediaElement) {
            mediaElement.classList.add('romper-audio-element');
        }
    }

    end() {
        super.end();
        this._lastSetTime = 0;
        this._playoutEngine.setPlayoutInactive(this._rendererId);

        logger.info(`Ended: ${this._representation.id}`);

        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'seeked', this._seekEventHandler);

        try {
            this._clearBehaviourElements();
        } catch (e) {
            //
        }

        const mediaElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (mediaElement) {
            mediaElement.classList.remove('romper-audio-element');
        }
    }

    renderAudioElement() {
        // set audio source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.audio_src) {
                        this._fetchMedia(fg.assets.audio_src)
                            .then((mediaUrl) => {
                                this.populateAudioElement(mediaUrl, fg.loop);
                                this._playoutEngine.setTimings(this._rendererId, {
                                    inTime: this._inTime,
                                    outTime: this._outTime,
                                });
                            })
                            .catch((err) => {
                                logger.error(err, 'audio not found');
                            });
                    }
                    if (fg.assets.sub_src) {
                        this._fetchMedia(fg.assets.sub_src)
                            .then((mediaUrl) => {
                                this.populateAudioSubs(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Subs not found');
                                // this._subtitlesExist = false;
                            });
                    } else {
                        // this._subtitlesExist = false;
                    }
                });
        }
    }

    populateAudioElement(mediaUrl: string, loop: ?boolean) {
        if (this._destroyed) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                url: mediaUrl,
                loop,
            });
        }
    }

    // eslint-disable-next-line
    populateAudioSubs(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                subs_url: mediaUrl,
            });
        }
    }

    _handlePlayPauseButtonClicked(): void {
        if(this._playoutEngine.getPlayoutActive(this._rendererId)) {
            if (this._playoutEngine.isPlaying()) {
                this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            } else {
                this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            }
        }
    }

    getCurrentTime(): Object {
        let videoTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if (videoTime === undefined) {
            videoTime = this._lastSetTime;
        }
        let duration = this._playoutEngine.getDuration(this._rendererId)
        if (duration === undefined) {
            duration = Infinity;
        }
        const remainingTime = duration - videoTime;
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
            remainingTime,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        let targetTime = time;
        const choiceTime = this.getChoiceTime();
        if (choiceTime >= 0 && choiceTime < time) {
            targetTime = choiceTime;
        }
        // convert to absolute time into video
        this._lastSetTime = targetTime; // time into segment
        this._playoutEngine.setCurrentTime(this._rendererId, targetTime);
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    destroy() {
        this.end();

        this._playoutEngine.unqueuePlayout(this._rendererId);

        super.destroy();
    }
}
