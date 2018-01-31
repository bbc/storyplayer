// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

// @flowignore
import Hls from '../../node_modules/hls.js/dist/hls';
import logger from '../logger';

export default class SimpleAVRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _hls: Object;
    _videoElement: HTMLVideoElement;
    _canvas: HTMLCanvasElement;
    _applyBlurBehaviour: Function;
    _applyShowImageBehaviour: Function;
    _behaviourElements: Array<HTMLElement>;
    _target: HTMLDivElement;
    _handlePlayPauseButtonClicked: Function;
    _handleFullscreenButtonClicked: Function;
    _handleVolumeClicked: Function;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._handleFullscreenButtonClicked = this._handleFullscreenButtonClicked.bind(this);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);

        if (Hls.isSupported()) {
            this._hls = new Hls();
        }
        this.renderVideoElement();

        this._target = player.mediaTarget;
        this._applyBlurBehaviour = this._applyBlurBehaviour.bind(this);
        this._applyShowImageBehaviour = this._applyShowImageBehaviour.bind(this);
        this._behaviourElements = [];

        this._behaviourRendererMap = {
            'urn:x-object-based-media:asset-mixin:blur/v1.0': this._applyBlurBehaviour,
            'urn:x-object-based-media:asset-mixin:showimage/v1.0': this._applyShowImageBehaviour,
        };
    }

    start() {
        super.start();
        this._target.appendChild(this._videoElement);

        const player = this._player;
        player.addVolumeControl(this._representation.id, 'Foreground');
        player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        player.on(
            PlayerEvents.FULLSCREEN_BUTTON_CLICKED,
            this._handleFullscreenButtonClicked,
        );
        player.on(
            PlayerEvents.VOLUME_CHANGED,
            this._handleVolumeClicked,
        );
        this.playVideo();
    }

    playVideo() {
        if (this._videoElement.readyState >= this._videoElement.HAVE_CURRENT_DATA) {
            this._videoElement.play();
        } else if (this._videoElement.src.indexOf('m3u8') !== -1) {
            this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (this._destroyed) {
                    console.warn('loaded destroyed video element - not playing');
                } else {
                    this._videoElement.play();
                }
            });
        } else {
            this._videoElement.addEventListener('loadeddata', () => {
                if (this._destroyed) {
                    console.warn('loaded destroyed video element - not playing');
                } else {
                    this._videoElement.play();
                }
            });
        }
    }

    renderVideoElement() {
        this._videoElement = document.createElement('video');
        this._videoElement.className = 'romper-video-element';

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
            this._fetchAssetCollection(this._representation.asset_collection.foreground).then((fg) => {
                if (fg.assets.av_src) {
                    this._fetchMedia(fg.assets.av_src)
                        .then((mediaUrl) => {
                            this.populateVideoElement(this._videoElement, mediaUrl);
                        })
                        .catch((err) => {
                            logger.error(err, 'Notfound');
                        });
                }
            });
        }
    }

    populateVideoElement(videoElement: HTMLVideoElement, mediaUrl: string) {
        if (this._destroyed) {
            console.warn('trying to populate video element that has been destroyed');
        } else if (mediaUrl.indexOf('.m3u8') !== -1) {
            this._hls.loadSource(mediaUrl);
            this._hls.attachMedia(videoElement);
        } else {
            videoElement.setAttribute('src', mediaUrl);
        }
    }

    _applyBlurBehaviour(behaviour: Object, callback: () => mixed) {
        const { blur } = behaviour;
        this._videoElement.style.filter = `blur(${blur}px)`; // eslint-disable-line prefer-destructuring
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
        overlayImageElement.className = 'overlayImage';
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

    _handleFullscreenButtonClicked(): void {
        const video = this._videoElement;

        if (video.requestFullscreen) {
            // @flowignore
            video.requestFullscreen();
        } else if (video.mozRequestFullScreen) {
            // @flowignore
            video.mozRequestFullScreen(); // Firefox
        } else if (video.webkitRequestFullscreen) {
            // @flowignore
            video.webkitRequestFullscreen(); // Chrome and Safari
        }
    }

    _handleVolumeClicked(event: Object): void {
        if (event.id === this._representation.id) {
            this._videoElement.volume = event.value;
        }
    }

    getCurrentTime(): Object {
        let videoTime;
        if (!this._videoElement || this._videoElement.readyState < this._videoElement.HAVE_CURRENT_DATA) {
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
            this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this._videoElement.currentTime = time;
            });
        } else {
            this._videoElement.addEventListener('loadeddata', () => {
                this._videoElement.currentTime = time;
            });
        }
    }

    switchFrom() {
        this.destroy();
    }

    switchTo() {
        this.start();
    }

    _clearBehaviourElements() {
        this._behaviourElements.forEach((be) => {
            this._target.removeChild(be);
        });
    }

    destroy() {
        try {
            this._clearBehaviourElements();
            this._target.removeChild(this._videoElement);
        } catch (e) {
            //
        }

        const player = this._player;
        player.removeVolumeControl(this._representation.id);
        player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        player.removeListener(
            PlayerEvents.FULLSCREEN_BUTTON_CLICKED,
            this._handleFullscreenButtonClicked,
        );
        player.removeListener(
            PlayerEvents.VOLUME_CHANGED,
            this._handleVolumeClicked,
        );

        super.destroy();
    }
}
