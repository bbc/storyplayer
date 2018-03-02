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

    _endedEventListener: Function;
    _playEventListener: Function;
    _pauseEventListener: Function;

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

        this._endedEventListener = this._endedEventListener.bind(this);
        this._playEventListener = this._playEventListener.bind(this);
        this._pauseEventListener = this._pauseEventListener.bind(this);

        this._hlsManager = player._hlsManager;

        this._hls = this._hlsManager.getHls('video');

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
        this._videoTrack = ((document.createElement('track'): any): HTMLTrackElement);

        this._behaviourRendererMap = {
            'urn:x-object-based-media:asset-mixin:blur/v1.0': this._applyBlurBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:asset-mixin:colouroverlay/v1.0': this._applyColourOverlayBehaviour,
            'urn:x-object-based-media:asset-mixin:showimage/v1.0': this._applyShowImageBehaviour,
        };
    }

    _endedEventListener() {
        this._player.setPlaying(false);
        super.complete();
    }

    _playEventListener() {
        this._player.setPlaying(true);
    }

    _pauseEventListener() {
        this._player.setPlaying(false);
    }

    start() {
        super.start();
        this._hls.start(this._target);
        const videoElement = this._hls.getMediaElement();
        logger.info(`Started: ${this._representation.id}`);

        // automatically move on at video end
        videoElement.addEventListener('ended', this._endedEventListener);
        videoElement.addEventListener('play', this._playEventListener);
        videoElement.addEventListener('pause', this._pauseEventListener);

        const player = this._player;

        if (this._videoTrack.parentNode !== videoElement) {
            videoElement.appendChild(this._videoTrack);
        }

        this._subtitlesShowing = player.showingSubtitles;
        this._showHideSubtitles();

        player.addVolumeControl(this._representation.id, 'Foreground');
        player.connectScrubBar(videoElement);
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
        this._hls.pause();
        logger.info(`Ended: ${this._representation.id}`);

        const videoElement = this._hls.getMediaElement();

        if (this._videoTrack.parentNode === videoElement) {
            videoElement.removeChild(this._videoTrack);
        }

        videoElement.removeEventListener('ended', this._endedEventListener);
        videoElement.removeEventListener('play', this._playEventListener);
        videoElement.removeEventListener('pause', this._pauseEventListener);

        try {
            this._clearBehaviourElements();
            this._hls.end(this._target);
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
        const videoElement = this._hls.getMediaElement();
        this._hls.off(HlsManager.Events.MANIFEST_PARSED, this._playVideoCallback);
        videoElement.removeEventListener('loadeddata', this._playVideoCallback);

        if (this._destroyed) {
            logger.warn('loaded destroyed video element - not playing');
        } else {
            this._hls.play();
        }
    }

    playVideo() {
        const videoElement = this._hls.getMediaElement();
        if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
            this._hls.play();
        } else if (videoElement.src.indexOf('m3u8') !== -1) {
            this._hls.on(HlsManager.Events.MANIFEST_PARSED, this._playVideoCallback);
        } else {
            videoElement.addEventListener('loadeddata', this._playVideoCallback);
        }
    }

    renderVideoElement() {
        const videoElement = document.createElement('video');
        videoElement.className = 'romper-video-element';
        videoElement.crossOrigin = 'anonymous';
        this._hls.attachMedia(videoElement);

        // set video source
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        this._fetchMedia(fg.assets.av_src)
                            .then((mediaUrl) => {
                                this.populateVideoElement(mediaUrl);
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

    populateVideoElement(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else {
            this._hls.loadSource(mediaUrl);
        }
    }

    // eslint-disable-next-line
    populateVideoSubs(mediaUrl: string) {
        const videoElement = this._hls.getMediaElement();
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else {
            // this._hls.loadSubs(mediaUrl);
            videoElement.addEventListener('loadedmetadata', () => {
                // Load Subtitles
                this._videoTrack.kind = 'captions';
                this._videoTrack.label = 'English';
                this._videoTrack.srclang = 'en';
                this._videoTrack.src = mediaUrl;
                this._videoTrack.default = false;
                this._subtitlesLoaded = true;

                this._showHideSubtitles();
            });
        }
    }

    _showHideSubtitles() {
        const videoElement = this._hls.getMediaElement();
        if (this._subtitlesLoaded) {
            if (this._subtitlesShowing) {
                // Show Subtitles
                this._videoTrack.mode = 'showing';

                if (videoElement.textTracks[0]) {
                    videoElement.textTracks[0].mode = 'showing';
                }
            } else {
                // Hide Subtitles
                this._videoTrack.mode = 'hidden';
                if (videoElement.textTracks[0]) {
                    videoElement.textTracks[0].mode = 'hidden';
                }
            }
        }
    }

    _applyBlurBehaviour(behaviour: Object, callback: () => mixed) {
        const videoElement = this._hls.getMediaElement();
        const { blur } = behaviour;
        videoElement.style.filter = `blur(${blur}px)`;
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
        const videoElement = this._hls.getMediaElement();
        if (videoElement.paused === true) {
            this._hls.play();
        } else {
            this._hls.pause();
        }
    }

    _handleVolumeClicked(event: Object): void {
        const videoElement = this._hls.getMediaElement();
        if (event.id === this._representation.id) {
            videoElement.volume = event.value;
        }
    }

    _handleSubtitlesClicked(): void {
        this._subtitlesShowing = !this._subtitlesShowing;
        this._showHideSubtitles();
    }

    getCurrentTime(): Object {
        const videoElement = this._hls.getMediaElement();
        let videoTime;
        if (
            !videoElement ||
            videoElement.readyState < videoElement.HAVE_CURRENT_DATA
        ) {
            videoTime = 0;
        } else {
            videoTime = videoElement.currentTime;
        }
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        const videoElement = this._hls.getMediaElement();
        if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
            videoElement.currentTime = time;
        } else if (videoElement.src.indexOf('m3u8') !== -1) {
            this._hls.on(HlsManager.Events.MANIFEST_PARSED, () => {
                videoElement.currentTime = time;
            });
        } else {
            videoElement.addEventListener('loadeddata', () => {
                videoElement.currentTime = time;
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
        const videoElement = this._hls.getMediaElement();
        videoElement.style.filter = ''; // eslint-disable-line prefer-destructuring
        this._behaviourElements.forEach((be) => {
            this._target.removeChild(be);
        });
    }

    destroy() {
        this.end();

        this._hlsManager.returnHls(this._hls);

        super.destroy();
    }
}
