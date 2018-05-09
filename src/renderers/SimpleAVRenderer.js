// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';

import MediaManager from '../MediaManager';
import MediaInstance from '../MediaInstance';

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
    _mediaInstance: MediaInstance;
    _videoTrack: HTMLTrackElement;
    _canvas: HTMLCanvasElement;
    _applyBlurBehaviour: Function;
    _applyColourOverlayBehaviour: Function;
    _applyShowImageBehaviour: Function;
    _applyWaitForButtonBehaviour: Function;
    _behaviourElements: Array<HTMLElement>;
    _target: HTMLDivElement;
    _handlePlayPauseButtonClicked: Function;
    _handleVolumeClicked: Function;
    _handleSubtitlesClicked: Function;
    _mediaManager: MediaManager;
    _subtitlesLoaded: boolean;
    _subtitlesExist: boolean;
    _subtitlesShowing: boolean;
    _subtitlesSrc: string;

    _lastSetTime: number

    _endedEventListener: Function;
    _playEventListener: Function;
    _pauseEventListener: Function;

    _enableSubtitlesButton: Function;
    _disableSubtitlesButton: Function;

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

        this._endedEventListener = this._endedEventListener.bind(this);
        this._playEventListener = this._playEventListener.bind(this);
        this._pauseEventListener = this._pauseEventListener.bind(this);

        this._mediaManager = player._mediaManager;

        this._mediaInstance = this._mediaManager.getMediaInstance('foreground');

        this.renderVideoElement();
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);

        this._target = player.mediaTarget;
        this._applyBlurBehaviour = this._applyBlurBehaviour.bind(this);
        this._applyColourOverlayBehaviour = this._applyColourOverlayBehaviour.bind(this);
        this._applyShowImageBehaviour = this._applyShowImageBehaviour.bind(this);
        this._applyWaitForButtonBehaviour = this._applyWaitForButtonBehaviour.bind(this);
        this._behaviourElements = [];

        this._subtitlesShowing = player.showingSubtitles;
        this._subtitlesLoaded = false;
        this._subtitlesExist = true;
        this._subtitlesSrc = '';

        this._enableSubtitlesButton = () => {
            // Either activate subtitles control or wait until subtitles are loaded
            if (this._subtitlesLoaded) {
                player.enableSubtitlesControl();
            } else if (this._subtitlesExist) {
                // If _subtitlesExist is false then subtitles cannot be loaded so don't set timeout
                setTimeout(() => { this._enableSubtitlesButton(); }, 1000);
            }
        };
        this._disableSubtitlesButton = () => { player.disableSubtitlesControl(); };

        this._behaviourRendererMap = {
            'urn:x-object-based-media:representation-behaviour:blur/v1.0': this._applyBlurBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:colouroverlay/v1.0': this._applyColourOverlayBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showimage/v1.0': this._applyShowImageBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showwaitbutton/v1.0': this._applyWaitForButtonBehaviour,
        };

        this._lastSetTime = 0;
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
        this._mediaInstance.start();
        const videoElement = this._mediaInstance.getMediaElement();
        logger.info(`Started: ${this._representation.id}`);

        this.setCurrentTime(0);

        // automatically move on at video end
        videoElement.addEventListener('ended', this._endedEventListener);
        videoElement.addEventListener('play', this._playEventListener);
        videoElement.addEventListener('pause', this._pauseEventListener);

        const player = this._player;

        this._subtitlesShowing = player.showingSubtitles;
        this._showHideSubtitles();
        videoElement.addEventListener('loadedmetadata', () => {
            this._showHideSubtitles();
        });

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

        this._mediaInstance.play();

        this._enableSubtitlesButton();

        this._clearBehaviourElements();
    }

    end() {
        this._disableSubtitlesButton();
        this._mediaInstance.pause();
        this._subtitlesShowing = false;
        this._showHideSubtitles();

        logger.info(`Ended: ${this._representation.id}`);

        const videoElement = this._mediaInstance.getMediaElement();

        if (this._videoTrack && this._videoTrack.parentNode === videoElement) {
            this._subtitlesLoaded = false;
            videoElement.removeChild(this._videoTrack);
        }

        videoElement.removeEventListener('ended', this._endedEventListener);
        videoElement.removeEventListener('play', this._playEventListener);
        videoElement.removeEventListener('pause', this._pauseEventListener);

        try {
            this._clearBehaviourElements();
            this._mediaInstance.end();
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

    renderVideoElement() {
        const videoElement = document.createElement('video');
        videoElement.className = 'romper-video-element';
        videoElement.crossOrigin = 'anonymous';
        this._mediaInstance.attachMedia(videoElement);

        // set video source
        if (this._representation.asset_collections.foreground) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground)
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
                                this._subtitlesExist = false;
                            });
                    } else {
                        this._subtitlesExist = false;
                    }
                });
        }
    }

    populateVideoElement(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else {
            this._mediaInstance.loadSource(mediaUrl);
        }
    }

    // eslint-disable-next-line
    populateVideoSubs(mediaUrl: string) {
        const videoElement = this._mediaInstance.getMediaElement();
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else {
            // this._mediaInstance.loadSubs(mediaUrl);
            videoElement.addEventListener('loadedmetadata', () => {
                // Load Subtitles
                this._subtitlesSrc = mediaUrl;
                this._subtitlesLoaded = true;

                this._showHideSubtitles();
            });
        }
    }

    _showHideSubtitles() {
        const videoElement = this._mediaInstance.getMediaElement();
        if (this._videoTrack) {
            this._videoTrack.mode = 'hidden';
            if (videoElement.textTracks[0]) {
                videoElement.textTracks[0].mode = 'hidden';
            }
            const videoTrackParent = this._videoTrack.parentNode;
            if (videoTrackParent) {
                videoTrackParent.removeChild(this._videoTrack);
            }
        }
        if (this._subtitlesLoaded && this._subtitlesShowing) {
            this._videoTrack = ((document.createElement('track'): any): HTMLTrackElement);
            this._videoTrack.kind = 'captions';
            this._videoTrack.label = 'English';
            this._videoTrack.srclang = 'en';
            this._videoTrack.src = this._subtitlesSrc;
            this._videoTrack.default = false;
            videoElement.appendChild(this._videoTrack);

            // Show Subtitles
            this._videoTrack.mode = 'showing';

            if (videoElement.textTracks[0]) {
                videoElement.textTracks[0].mode = 'showing';
            }
        }
    }

    _applyBlurBehaviour(behaviour: Object, callback: () => mixed) {
        const videoElement = this._mediaInstance.getMediaElement();
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

    _applyWaitForButtonBehaviour(behaviour: Object, callback: () => mixed) {
        const continueButton = document.createElement('button');
        continueButton.classList.add(behaviour.button_class);
        continueButton.setAttribute('title', 'Continue Button');
        continueButton.setAttribute('aria-label', 'Continue Button');
        const continueButtonIconDiv = document.createElement('div');
        continueButtonIconDiv.classList.add('romper-button-icon-div');
        continueButtonIconDiv.classList.add(`${behaviour.button_class}-icon-div`);
        continueButton.appendChild(continueButtonIconDiv);
        const continueButtonTextDiv = document.createElement('div');
        continueButtonTextDiv.innerHTML = behaviour.text;
        continueButtonTextDiv.classList.add('romper-button-text-div');
        continueButtonTextDiv.classList.add(`${behaviour.button_class}-text-div`);
        continueButton.appendChild(continueButtonTextDiv);

        this._target.appendChild(continueButton);
        this._behaviourElements.push(continueButton);

        const buttonClickHandler = () => {
            this._player._enableUserInteraction();
            this._player._narrativeElementTransport.classList.remove('romper-inactive');
            this.logUserInteraction(AnalyticEvents.names.BEHAVIOUR_CONTINUE_BUTTON_CLICKED);
            callback();
        };
        continueButton.onclick = buttonClickHandler;

        if (behaviour.hide_narrative_buttons) {
            // can't use player.setNextAvailable
            // as this may get reset after this by NE change handling
            this._player._narrativeElementTransport.classList.add('romper-inactive');
        }
    }

    _overlayImage(imageSrc: string) {
        const overlayImageElement = document.createElement('img');
        overlayImageElement.src = imageSrc;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
    }

    _handlePlayPauseButtonClicked(): void {
        const videoElement = this._mediaInstance.getMediaElement();
        if (videoElement.paused === true) {
            this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE, 'paused', 'playing');
            this._mediaInstance.play();
        } else {
            this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE, 'playing', 'paused');
            this._mediaInstance.pause();
        }
    }

    _handleVolumeClicked(event: Object): void {
        if (event.id === this._representation.id) {
            this._mediaInstance.setVolume(event.value);
        }
    }

    _handleSubtitlesClicked(): void {
        this._subtitlesShowing = !this._subtitlesShowing;
        this._showHideSubtitles();
    }

    getCurrentTime(): Object {
        const videoElement = this._mediaInstance.getMediaElement();
        let videoTime;
        if (
            !videoElement ||
            videoElement.readyState < videoElement.HAVE_CURRENT_DATA
        ) {
            videoTime = this._lastSetTime;
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
        this._lastSetTime = time;
        const videoElement = this._mediaInstance.getMediaElement();
        if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
            videoElement.currentTime = time;
        } else if (videoElement.src.indexOf('m3u8') !== -1) {
            this._mediaInstance.on(MediaManager.Events.MANIFEST_PARSED, () => {
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
        const videoElement = this._mediaInstance.getMediaElement();
        videoElement.style.filter = ''; // eslint-disable-line prefer-destructuring
        this._behaviourElements.forEach((be) => {
            try {
                this._target.removeChild(be);
            } catch (e) {
                logger.warn(`could not remove behaviour element ${be.id} from SimpleAVRenderer`);
            }
        });
    }

    destroy() {
        this.end();

        this._mediaManager.returnMediaInstance(this._mediaInstance);

        super.destroy();
    }
}
