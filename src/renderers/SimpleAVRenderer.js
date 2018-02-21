// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';

import HlsManager from '../HlsManager';
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
    _hls: Object;
    _videoElement: HTMLVideoElement;
    _videoTrack: HTMLTrackElement;
    _canvas: HTMLCanvasElement;
    _applyBlurBehaviour: Function;
    _applyColourOverlayBehaviour: Function;
    _applyShowImageBehaviour: Function;
    _behaviourElements: Array<HTMLElement>;
    _target: HTMLDivElement;
    _handlePlayPauseButtonClicked: Function;
    _handleVolumeClicked: Function;
    _handleSubtitlesClicked: Function;
    _playVideoCallback: Function;
    _hlsManager: HlsManager;
    _subtitlesLoaded: boolean;
    _subtitlesShowing: boolean;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player, analytics);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);
        this._handleSubtitlesClicked = this._handleSubtitlesClicked.bind(this);
        this._playVideoCallback = this._playVideoCallback.bind(this);

        this._hlsManager = player._hlsManager;

        if (this._hlsManager.isSupported()) {
            this._hls = this._hlsManager.getHlsFromPool();
        }
        this.renderVideoElement();
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);

        this._target = player.mediaTarget;
        this._applyBlurBehaviour = this._applyBlurBehaviour.bind(this);
        this._applyColourOverlayBehaviour = this._applyColourOverlayBehaviour.bind(this);
        this._applyShowImageBehaviour = this._applyShowImageBehaviour.bind(this);
        this._behaviourElements = [];

        this._subtitlesShowing = player.showingSubtitles;
        this._subtitlesLoaded = false;

        this._behaviourRendererMap = {
            'urn:x-object-based-media:asset-mixin:blur/v1.0': this._applyBlurBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:asset-mixin:colouroverlay/v1.0': this._applyColourOverlayBehaviour,
            'urn:x-object-based-media:asset-mixin:showimage/v1.0': this._applyShowImageBehaviour,
        };
    }

    start() {
        super.start();
        this._target.appendChild(this._videoElement);

        const player = this._player;
        player.addVolumeControl(this._representation.id, 'Foreground');
        player.connectScrubBar(this._videoElement);
        player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        player.on(
            PlayerEvents.VOLUME_CHANGED,
            this._handleVolumeClicked,
        );
        player.on(
            PlayerEvents.SUBTITLES_BUTTON_CLICKED,
            this._handleSubtitlesClicked,
        );
        this.playVideo();
    }

    end() {
        this._videoElement.pause();

        try {
            this._clearBehaviourElements();
            this._target.removeChild(this._videoElement);
        } catch (e) {
            //
        }

        const player = this._player;
        player.removeVolumeControl(this._representation.id);
        player.disconnectScrubBar();
        player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        player.removeListener(
            PlayerEvents.VOLUME_CHANGED,
            this._handleVolumeClicked,
        );
        player.removeListener(
            PlayerEvents.SUBTITLES_BUTTON_CLICKED,
            this._handleSubtitlesClicked,
        );
    }

    _playVideoCallback(): void {
        if (this._destroyed) {
            logger.warn('loaded destroyed video element - not playing');
        } else {
            this._videoElement.play();
        }
    }

    playVideo() {
        if (this._videoElement.readyState >= this._videoElement.HAVE_CURRENT_DATA) {
            this._videoElement.play();
        } else if (this._videoElement.src.indexOf('m3u8') !== -1) {
            this._hls.on(HlsManager.Events.MANIFEST_PARSED, this._playVideoCallback);
        } else {
            this._videoElement.addEventListener('loadeddata', this._playVideoCallback);
        }
    }

    renderVideoElement() {
        this._videoElement = document.createElement('video');
        this._videoElement.className = 'romper-video-element';
        this._videoElement.crossOrigin = 'anonymous';

        // automatically move on at video end
        this._videoElement.addEventListener('ended', () => {
            this._player.setPlaying(false);
            super.complete();
        });
        this._videoElement.addEventListener('play', () => {
            this._player.setPlaying(true);
        });
        this._videoElement.addEventListener('pause', () => {
            this._player.setPlaying(false);
        });

        // set video source
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        this._fetchMedia(fg.assets.av_src)
                            .then((mediaUrl) => {
                                this.populateVideoElement(this._videoElement, mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Video not found');
                            });
                    }
                    if (fg.assets.sub_src) {
                        this._fetchMedia(fg.assets.sub_src)
                            .then((mediaUrl) => {
                                this.populateVideoSubs(this._videoElement, mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Subs not found');
                            });
                    }
                });
        }
    }

    populateVideoElement(videoElement: HTMLVideoElement, mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else if (mediaUrl.indexOf('.m3u8') !== -1) {
            this._hls.loadSource(mediaUrl);
            this._hls.attachMedia(videoElement);
        } else {
            videoElement.setAttribute('src', mediaUrl);
        }
    }

    populateVideoSubs(videoElement: HTMLVideoElement, mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate subs of video element that has been destroyed');
        } else {
            videoElement.addEventListener('loadedmetadata', () => {
                // Load Subtitles
                this._videoTrack = ((document.createElement('track'): any): HTMLTrackElement);
                this._videoTrack.kind = 'captions';
                this._videoTrack.label = 'English';
                this._videoTrack.srclang = 'en';
                this._videoTrack.src = mediaUrl;
                this._videoTrack.default = true;
                this._videoElement.appendChild(this._videoTrack);

                this._subtitlesLoaded = true;
                this._showHideSubtitles();
            });
        }
    }

    _showHideSubtitles() {
        if (this._subtitlesLoaded) {
            if (this._subtitlesShowing) {
                // Show Subtitles
                this._videoTrack.mode = 'showing';
                this._videoElement.textTracks[0].mode = 'showing';
            } else {
                // Hide Subtitles
                this._videoTrack.mode = 'hidden';
                this._videoElement.textTracks[0].mode = 'hidden';
            }
        }
    }

    _applyBlurBehaviour(behaviour: Object, callback: () => mixed) {
        const { blur } = behaviour;
        this._videoElement.style.filter = `blur(${blur}px)`;
        callback();
    }

    _applyColourOverlayBehaviour(behaviour: Object, callback: () => mixed) {
        const { colour } = behaviour;
        const overlayImageElement = document.createElement('div');
        overlayImageElement.style.background = colour;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
        callback();
    }

    _applyShowImageBehaviour(behaviour: Object, callback: () => mixed) {
        const assetCollectionId = behaviour.image;
        this._fetchAssetCollection(assetCollectionId).then((image) => {
            if (image.assets.image_src) {
                this._overlayImage(image.assets.image_src);
                callback();
            }
        });
    }

    _overlayImage(imageSrc: string) {
        const overlayImageElement = document.createElement('img');
        overlayImageElement.src = imageSrc;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
    }

    _handlePlayPauseButtonClicked(): void {
        const video = this._videoElement;
        if (video.paused === true) {
            video.play();
        } else {
            video.pause();
        }
    }

    _handleVolumeClicked(event: Object): void {
        if (event.id === this._representation.id) {
            this._videoElement.volume = event.value;
        }
    }

    _handleSubtitlesClicked(): void {
        this._subtitlesShowing = !this._subtitlesShowing;
        this._showHideSubtitles();
    }

    getCurrentTime(): Object {
        let videoTime;
        if (
            !this._videoElement ||
            this._videoElement.readyState < this._videoElement.HAVE_CURRENT_DATA
        ) {
            videoTime = 0;
        } else {
            videoTime = this._videoElement.currentTime;
        }
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        if (this._videoElement.readyState >= this._videoElement.HAVE_CURRENT_DATA) {
            this._videoElement.currentTime = time;
        } else if (this._videoElement.src.indexOf('m3u8') !== -1) {
            this._hls.on(HlsManager.Events.MANIFEST_PARSED, () => {
                this._videoElement.currentTime = time;
            });
        } else {
            this._videoElement.addEventListener('loadeddata', () => {
                this._videoElement.currentTime = time;
            });
        }
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    _clearBehaviourElements() {
        this._videoElement.style.filter = ''; // eslint-disable-line prefer-destructuring
        this._behaviourElements.forEach((be) => {
            this._target.removeChild(be);
        });
    }

    destroy() {
        this.end();

        this._hlsManager.returnHlsToPool(this._hls);

        delete this._videoTrack;
        delete this._videoElement;

        super.destroy();
    }
}
