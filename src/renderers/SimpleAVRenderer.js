// @flow

import Player from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';


import logger from '../logger';

export type HTMLTrackElement = HTMLElement & {
    kind: string,
    label: string,
    srclang: string,
    src: string,
    mode: string,
    default: boolean,
}

export default class SimpleAVRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _videoTrack: HTMLTrackElement;

    _applyBlurBehaviour: Function;

    _handlePlayPauseButtonClicked: Function;

    _lastSetTime: number;

    _inTime: number;

    _outTime: number;

    _endedEventListener: Function;

    _outTimeEventListener: Function;

    _seekEventHandler: Function;

    _testEndStallTimeout: TimeoutID;

    _setOutTime: Function;

    _setInTime: Function;

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
        this._outTimeEventListener = this._outTimeEventListener.bind(this);
        this._seekEventHandler = this._seekEventHandler.bind(this);
        this._setInTime = this._setInTime.bind(this);
        this._setOutTime = this._setOutTime.bind(this);

        this._inTime = 0;
        this._outTime = -1;

        this.renderVideoElement();

        this._applyBlurBehaviour = this._applyBlurBehaviour.bind(this);

        // eslint-disable-next-line max-len
        this._behaviourRendererMap['urn:x-object-based-media:representation-behaviour:blur/v1.0'] = this._applyBlurBehaviour;

        this._lastSetTime = 0;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_AV,
            playPauseHandler: this._handlePlayPauseButtonClicked,
        });
    }

    _endedEventListener() {
        if (!this._hasEnded) {
            super.complete();
        }
    }

    _seekEventHandler() {
        super.seekEventHandler(this._inTime);
    }

    _outTimeEventListener() {
        const currentTime = this._playoutEngine.getCurrentTime(this._rendererId);
        let duration = this._playoutEngine.getDuration(this._rendererId);
        if(!duration) {
            duration = Infinity;
        }
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (currentTime) {
            if (this._outTime > 0 && currentTime >= this._outTime) {
                // TODO Is this needed?
                // AJ 14/10/19 Yes
                if(this.checkIsLooping()) {
                    this.setCurrentTime(0);
                } else {
                    if(videoElement) {
                        videoElement.pause();
                    }
                    this._endedEventListener();
                }
            }
            if (currentTime > (duration - 1)) {
                // if we are looping then return to start
                const nowTime = currentTime;
                if (this._playoutEngine.isPlaying() && !this._testEndStallTimeout) {
                    this._testEndStallTimeout = setTimeout(() => {
                        const time = this._playoutEngine.getCurrentTime(this._rendererId);
                        if (time && !this._hasEnded) {
                            // eslint-disable-next-line max-len
                            logger.info(`Checked video end for stall, run for 2s at ${nowTime}, reached ${time}`);
                            if (time >= nowTime && time <= nowTime + 1.9) {
                                logger.warn('Video end checker failed stall test');
                                clearTimeout(this._testEndStallTimeout);
                                // if we are looping just go back to start
                                if(this.checkIsLooping()) {
                                    this.setCurrentTime(0);
                                } else {
                                    // otherwise carry on to next element
                                    this._endedEventListener();
                                }
                            }
                        }
                    }, 2000);

                }
            }
        }
    }

    start() {
        super.start();
        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.on(this._rendererId, 'seeked', this._seekEventHandler);
        this._playoutEngine.setPlayoutActive(this._rendererId);

        logger.info(`Started: ${this._representation.id}`);

        // set time to last set time (relative to click start)
        this.setCurrentTime(this._lastSetTime);
    }

    end() {
        super.end();
        this._lastSetTime = 0;
        this._playoutEngine.setPlayoutInactive(this._rendererId);

        logger.info(`Ended: ${this._representation.id}`);

        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.off(this._rendererId, 'seeked', this._seekEventHandler);

        try {
            this._clearBehaviourElements();
        } catch (e) {
            logger.info(e);
        }
    }

    // allow for clip trimming
    addTimeEventListener(listenerId: string, time: number, callback: Function) {
        super.addTimeEventListener(listenerId, (time + this._inTime), callback);
    }

    renderVideoElement() {
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    console.log('ASSET', fg);
                    if (fg.assets.av_src) {
                        if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                            this._setInTime(parseFloat(fg.meta.romper.in));
                        }
                        if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                            this._setOutTime(parseFloat(fg.meta.romper.out));
                        }
                        this._fetchMedia(fg.assets.av_src)
                            .then((mediaUrl) => {
                                let appendedUrl = mediaUrl;
                                if (this._inTime > 0 || this._outTime > 0) {
                                    let mediaFragment = `#t=${this._inTime}`;
                                    if (this._outTime > 0) {
                                        mediaFragment = `${mediaFragment},${this._outTime}`;
                                    }
                                    appendedUrl = `${mediaUrl}${mediaFragment}`;
                                }
                                this.populateVideoElement(appendedUrl, fg.loop, fg.id);

                                this._playoutEngine.setTimings(this._rendererId, {
                                    inTime: this._inTime,
                                    outTime: this._outTime,
                                });
                            })
                            .catch((err) => {
                                logger.error(err, 'Video not found');
                            });
                    }
                    if (fg.assets.sub_src) {
                        this._fetchMedia(fg.assets.sub_src)
                            .then((mediaUrl) => {
                                this.populateVideoSubs(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Subs not found');
                            });
                    }
                });
        }
    }

    populateVideoElement(mediaUrl: string, loop :?boolean, id: ?string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                url: mediaUrl,
                loop,
                id
            });
        }
    }

    populateVideoSubs(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                subs_url: mediaUrl,
            });
        }
    }

    _applyBlurBehaviour(behaviour: Object, callback: () => mixed) {
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (videoElement) {
            const { blur } = behaviour;
            videoElement.style.filter = `blur(${blur}px)`;
        }
        callback();
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
        } else {
            // convert to time into segment
            videoTime -= this._inTime;
        }
        let duration = this._playoutEngine.getDuration(this._rendererId)
        if (duration === undefined) {
            duration = Infinity;
        }
        let remaining = duration;
        if (this._outTime > 0) {
            remaining = this._outTime;
        }
        remaining -= videoTime;
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
            remainingTime: remaining,
        };
        return timeObject;
    }

    // set how far into the segment this video should be (relative to in-point)
    setCurrentTime(time: number) {
        let targetTime = time;
        const choiceTime = this.getChoiceTime();
        if (choiceTime >= 0 && choiceTime < time) {
            targetTime = choiceTime;
        }
        // convert to absolute time into video
        this._lastSetTime = targetTime; // time into segment
        this._playoutEngine.setCurrentTime(this._rendererId, targetTime + this._inTime);
    }

    _setInTime(time: number) {
        this._inTime = time;
        this.setCurrentTime(0);
    }

    _setOutTime(time: number) {
        this._outTime = time;
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    _clearBehaviourElements() {
        super._clearBehaviourElements();
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (videoElement) {
            videoElement.style.filter = '';
        }
    }

    destroy() {
        this.end();

        this._playoutEngine.unqueuePlayout(this._rendererId);

        super.destroy();
    }
}
