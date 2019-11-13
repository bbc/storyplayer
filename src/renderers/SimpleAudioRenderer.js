// @flow

import Player from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import { MediaFormats } from '../browserCapabilities';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';

// import MediaManager from '../MediaManager';
// import MediaInstance from '../MediaInstance';

import Controller from '../Controller';

import logger from '../logger';
import { AUDIO } from '../utils';

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

    _outTimeEventListener: Function;

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

        this._outTimeEventListener = this._outTimeEventListener.bind(this);
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
    }

    _seekEventHandler() {
        super.seekEventHandler(this._inTime);
    }

    start() {
        super.start();
        this._playoutEngine.setPlayoutActive(this._rendererId);

        logger.info(`Started: ${this._representation.id}`);

        // automatically move on at audio end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'seeked', this._seekEventHandler);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);

        const mediaElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (mediaElement) {
            mediaElement.classList.add('romper-audio-element');
        }
        this._player.enablePlayButton();
        this._player.enableScrubBar();
    }

    end() {
        super.end();
        this._lastSetTime = 0;
        this._playoutEngine.setPlayoutInactive(this._rendererId);

        logger.info(`Ended: ${this._representation.id}`);

        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'seeked', this._seekEventHandler);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);

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
                    if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                        this._setInTime(parseFloat(fg.meta.romper.in));
                    }
                    if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                        this._setOutTime(parseFloat(fg.meta.romper.out));
                    }
                    if (fg.assets.audio_src) {
                        this._fetchMedia(fg.assets.audio_src, {
                            mediaFormat: MediaFormats.getFormat(), 
                            mediaType: AUDIO
                        })
                            .then((mediaUrl) => {
                                this.populateAudioElement(mediaUrl, fg.loop);
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
