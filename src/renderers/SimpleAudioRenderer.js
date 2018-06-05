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

export default class SimpleAudioRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _mediaInstance: MediaInstance;
    _audioTrack: HTMLTrackElement;
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

        this.renderAudioElement();
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);

        this._target = player.mediaTarget;
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
        const audioElement = this._mediaInstance.getMediaElement();
        logger.info(`Started: ${this._representation.id}`);

        this.setCurrentTime(0);

        // automatically move on at audio end
        audioElement.addEventListener('ended', this._endedEventListener);
        audioElement.addEventListener('play', this._playEventListener);
        audioElement.addEventListener('pause', this._pauseEventListener);

        const player = this._player;

        this._subtitlesShowing = player.showingSubtitles;
        this._showHideSubtitles();
        audioElement.addEventListener('loadedmetadata', () => {
            this._showHideSubtitles();
        });

        player.addVolumeControl(this._representation.id, 'Foreground');
        player.connectScrubBar(audioElement);
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
        this._player._foregroundMediaElement.classList.remove('romper-audio-element');
        this._disableSubtitlesButton();
        this._mediaInstance.pause();
        this._subtitlesShowing = false;
        this._showHideSubtitles();

        logger.info(`Ended: ${this._representation.id}`);

        const audioElement = this._mediaInstance.getMediaElement();

        if (this._audioTrack && this._audioTrack.parentNode === audioElement) {
            this._subtitlesLoaded = false;
            audioElement.removeChild(this._audioTrack);
        }

        audioElement.removeEventListener('ended', this._endedEventListener);
        audioElement.removeEventListener('play', this._playEventListener);
        audioElement.removeEventListener('pause', this._pauseEventListener);

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

    renderAudioElement() {
        const audioElement = document.createElement('audio');
        audioElement.className = 'romper-audio-element';
        audioElement.crossOrigin = 'anonymous';
        this._mediaInstance.attachMedia(audioElement);

        // set audio source
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.audio_src) {
                        this._fetchMedia(fg.assets.audio_src)
                            .then((mediaUrl) => {
                                this.populateAudioElement(mediaUrl);
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
                                this._subtitlesExist = false;
                            });
                    } else {
                        this._subtitlesExist = false;
                    }
                });
        }
    }

    populateAudioElement(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._player._foregroundMediaElement.classList.add('romper-audio-element');
            this._mediaInstance.loadSource(mediaUrl);
        }
    }

    // eslint-disable-next-line
    populateAudioSubs(mediaUrl: string) {
        const audioElement = this._mediaInstance.getMediaElement();
        if (this._destroyed) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            // this._mediaInstance.loadSubs(mediaUrl);
            audioElement.addEventListener('loadedmetadata', () => {
                // Load Subtitles
                this._subtitlesSrc = mediaUrl;
                this._subtitlesLoaded = true;

                this._showHideSubtitles();
            });
        }
    }

    _showHideSubtitles() {
        const audioElement = this._mediaInstance.getMediaElement();
        if (this._audioTrack) {
            this._audioTrack.mode = 'hidden';
            if (audioElement.textTracks[0]) {
                audioElement.textTracks[0].mode = 'hidden';
            }
            const audioTrackParent = this._audioTrack.parentNode;
            if (audioTrackParent) {
                audioTrackParent.removeChild(this._audioTrack);
            }
        }
        if (this._subtitlesLoaded && this._subtitlesShowing) {
            this._audioTrack = ((document.createElement('track'): any): HTMLTrackElement);
            this._audioTrack.kind = 'captions';
            this._audioTrack.label = 'English';
            this._audioTrack.srclang = 'en';
            this._audioTrack.src = this._subtitlesSrc;
            this._audioTrack.default = false;
            audioElement.appendChild(this._audioTrack);

            // Show Subtitles
            this._audioTrack.mode = 'showing';

            if (audioElement.textTracks[0]) {
                audioElement.textTracks[0].mode = 'showing';
            }
        }
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
        const audioElement = this._mediaInstance.getMediaElement();
        if (audioElement.paused === true) {
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
        const audioElement = this._mediaInstance.getMediaElement();
        let audioTime;
        if (
            !audioElement ||
            audioElement.readyState < audioElement.HAVE_CURRENT_DATA
        ) {
            audioTime = this._lastSetTime;
        } else {
            audioTime = audioElement.currentTime;
        }
        const timeObject = {
            timeBased: true,
            currentTime: audioTime,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        this._lastSetTime = time;
        const audioElement = this._mediaInstance.getMediaElement();
        if (audioElement.readyState >= audioElement.HAVE_CURRENT_DATA) {
            audioElement.currentTime = time;
        } else if (audioElement.src.indexOf('m3u8') !== -1) {
            this._mediaInstance.on(MediaManager.Events.MANIFEST_PARSED, () => {
                audioElement.currentTime = time;
            });
        } else {
            audioElement.addEventListener('loadeddata', () => {
                audioElement.currentTime = time;
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
        const audioElement = this._mediaInstance.getMediaElement();
        audioElement.style.filter = ''; // eslint-disable-line prefer-destructuring
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
