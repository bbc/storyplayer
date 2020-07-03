// @flow

import Player from '../Player';
import BaseRenderer, { RENDERER_PHASES } from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import { MediaFormats } from '../browserCapabilities';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
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

    _backgroundImage: ?HTMLElement;

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

        this._lastSetTime = 0;
        this._inTime = 0;
        this._outTime = -1;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_A,
            id: this._representation.asset_collections.foreground_id,
            playPauseHandler: this._handlePlayPauseButtonClicked,
        });
    }

    async init() {
        try {
            await Promise.all([
                this._renderAudioElement(),
                this._renderBackgroundImage(),
            ]);
            this.phase = RENDERER_PHASES.CONSTRUCTED;
        } catch(e) {
            logger.error(e, 'could not initiate audio renderer');
        }
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

    async _renderBackgroundImage() {
        // eslint-disable-next-line max-len
        logger.info(`Rendering background image for audio representation ${this._representation.id}`);
        if (this._representation.asset_collections.background_image) {
            try {
                const assetCollectionId = this._representation.asset_collections.background_image;
                const image = await this._fetchAssetCollection(assetCollectionId);
                if (image.assets.image_src) {
                    const imageUrl = await this._fetchMedia(image.assets.image_src);
                    this._backgroundImage = document.createElement('img');
                    this._backgroundImage.className = 'romper-render-image';
                    this._backgroundImage.src = imageUrl;
                    if (this.phase !== RENDERER_PHASES.MAIN) {
                        this._setImageVisibility(false);
                    } else {
                        this._setImageVisibility(true);
                    }
                    this._target.appendChild(this._backgroundImage);
                }
            } catch (err) {
                logger.error(err, 'Background image not found'); 
            }
        }
    }

    start() {
        super.start();
        this._setImageVisibility(true);
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
        this._setImageVisibility(false);
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

    async _renderAudioElement() {
        // set audio source
        if (this._representation.asset_collections.foreground_id) {
            try {
                const fg = await this._fetchAssetCollection(this._representation.asset_collections.foreground_id);
                if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                    this._setInTime(parseFloat(fg.meta.romper.in));
                }
                if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                    this._setOutTime(parseFloat(fg.meta.romper.out));
                }
                if (fg.assets.audio_src) {
                    const mediaUrl = await this._fetchMedia(fg.assets.audio_src, {
                        mediaFormat: MediaFormats.getFormat(), 
                        mediaType: AUDIO
                    });
                    this.populateAudioElement(mediaUrl, fg.loop);
                }
                if (fg.assets.sub_src) {
                    try {
                        const subsUrl = await this._fetchMedia(fg.assets.sub_src);
                        this.populateAudioSubs(subsUrl);
                    } catch(err) {
                        logger.error(err, 'Subs not found');
                    }
                }
            } catch (err) {
                throw new Error('Could not get audio assets');
            }
        } else {
            throw new Error('No foreground asset collection for audio representation');
        }
    }

    // show/hide the background image
    _setImageVisibility(visible: boolean) {
        if (this._backgroundImage) this._backgroundImage.style.opacity = visible ? '1' : '0';
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
        if (this._backgroundImage) this._target.removeChild(this._backgroundImage);

        super.destroy();
    }
}
