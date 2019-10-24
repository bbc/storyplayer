// @flow

import Player from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
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

    _endedEventListener: Function;

    _outTimeEventListener: Function;

    _seekEventHandler: Function;

    _testEndStallTimeout: TimeoutID;

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
        this._endedEventListener = this._endedEventListener.bind(this);
        this._outTimeEventListener = this._outTimeEventListener.bind(this);
        this._seekEventHandler = this._seekEventHandler.bind(this);

        this.renderVideoElement();

        this._applyBlurBehaviour = this._applyBlurBehaviour.bind(this);

        // eslint-disable-next-line max-len
        this._behaviourRendererMap['urn:x-object-based-media:representation-behaviour:blur/v1.0'] = this._applyBlurBehaviour;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_AV,
        });
    }

    _endedEventListener() {
        this._timer.pause();
        if (!this._hasEnded) {
            super.complete();
        }
    }

    _seekEventHandler() {
        super.seekEventHandler(this._inTime);
    }

    _outTimeEventListener() {
        const { duration } = this.getCurrentTime();
        let { currentTime } = this.getCurrentTime();
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        const playheadTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if (!this.checkIsLooping()) {
            // if not looping use video time to allow for buffering delays
            currentTime = playheadTime - this._inTime;
            // and sync timer
            this._timer.setTime(currentTime);
        } else if (this._outTime > 0 && videoElement) {
            // if looping, use timer
            // if looping with in/out points, need to manually re-initiate loop
            if (playheadTime >= this._outTime) {
                videoElement.currentTime = this._inTime;
                videoElement.play();
            }
        }
        // have we reached the end?
        // either timer past specified duration (for looping) 
        // or video time past out time
        if (currentTime > duration) {
            if (videoElement) {
                videoElement.pause();
            }
            this._endedEventListener();
        }
        if (currentTime > (duration - 1)) {
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
                            // one more loop check
                            if(this.checkIsLooping()) {
                                this.setCurrentTime(this._inTime);
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

    start() {
        super.start();
        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.on(this._rendererId, 'seeked', this._seekEventHandler);
        this._playoutEngine.setPlayoutActive(this._rendererId);
        logger.info(`Started: ${this._representation.id}`);

        // // set time to last set time (relative to click start)
        this._player.enablePlayButton();
        this._player.enableScrubBar();
    }

    end() {
        super.end();
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
    addTimeEventListener(
        listenerId: string,
        startTime: number,
        startCallback: Function,
        endTime: ?number,
        clearCallback: ?Function,
    ) {
        super.addTimeEventListener(
            listenerId, (startTime + this._inTime), startCallback, endTime, clearCallback,
        );
    }

    renderVideoElement() {
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
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

    _getDuration() {
        // compensate for trimming
        let duration = super._getDuration();
        if (this._outTime >= 0) {
            duration = this._outTime - this._inTime;
        } else if (this._inTime) {
            duration -= this._inTime;
        }
        this._duration = duration;
        return duration;
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
