// @flow
import EventEmitter from 'events';
import AnalyticEvents from './AnalyticEvents';
import type { AnalyticsLogger, AnalyticEventName } from './AnalyticEvents';
import Controller from './Controller';
import type { AssetUrls } from './romper';
import BasePlayoutEngine from './playoutEngines/BasePlayoutEngine';
import DOMSwitchPlayoutEngine from './playoutEngines/DOMSwitchPlayoutEngine';
import SrcSwitchPlayoutEngine from './playoutEngines/SrcSwitchPlayoutEngine';
import IOSPlayoutEngine from './playoutEngines/iOSPlayoutEngine';
import logger from './logger';
import { BrowserUserAgent, PLAYOUT_ENGINES, MediaFormats } from './browserCapabilities';
import BaseRenderer from './renderers/BaseRenderer';
import { SESSION_STATE } from './SessionManager';
import { checkDebugPlayout, addDetail, scrollToTop, preventEventDefault, SLIDER_CLASS, handleButtonTouchEvent } from './utils'; // eslint-disable-line max-len
import { REASONER_EVENTS } from './Events';



const PlayerEvents = [
    'VOLUME_CHANGED',
    'VOLUME_MUTE_TOGGLE',
    'ICON_CLICKED',
    'REPRESENTATION_CLICKED',
    'BACK_BUTTON_CLICKED',
    'NEXT_BUTTON_CLICKED',
    'SCRUB_BAR_MOUSE_DOWN',
    'SCRUB_BAR_CHANGED',
    'SCRUB_BAR_MOUSE_UP',
    'PLAY_PAUSE_BUTTON_CLICKED',
    'SEEK_FORWARD_BUTTON_CLICKED',
    'SEEK_BACKWARD_BUTTON_CLICKED',
    'SUBTITLES_BUTTON_CLICKED',
    'FULLSCREEN_BUTTON_CLICKED',
    'REPEAT_BUTTON_CLICKED',
    'LINK_CHOSEN',
].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName;
    return events;
}, {});

const overlays = [];

function createOverlay(name: string, logFunction: Function) {
    const overlay = document.createElement('div');
    overlay.classList.add('romper-overlay');
    overlay.classList.add(`romper-${name}-overlay`);
    overlay.classList.add('romper-inactive');
    overlay.onclick = (e) => {
        e.stopPropagation();
    };

    const button = document.createElement('button');

    const deactivateOverlay = () => {
        if (!overlay.classList.contains('romper-inactive')) {
            logFunction('OVERLAY_DEACTIVATED', `${name} visible`, `${name} hidden`);
            overlay.classList.add('romper-inactive');
        }
        if (button.classList.contains('romper-button-selected')) {
            button.classList.remove('romper-button-selected');
        }
    };

    overlays.push({ overlay, deactivateOverlay });

    button.setAttribute('title', `${name.charAt(0).toUpperCase() + name.slice(1)} Button`);
    button.setAttribute('aria-label', `${name.charAt(0).toUpperCase() + name.slice(1)} Button`);
    button.classList.add('romper-button');
    button.classList.add(`romper-${name}-button`);
    button.classList.add('romper-inactive');
    const onClick = () => {
        overlays.filter(overlayObj => overlayObj.overlay !== overlay)
            .forEach(overlayObj => overlayObj.deactivateOverlay());
        if (overlay.parentElement) {
            Array.prototype.slice
                .call(overlay.parentElement.querySelectorAll('.romper-overlay'))
                .filter(el => el !== overlay)
                .forEach(el => el.classList.add('romper-inactive'));
            if (overlay.classList.contains('romper-inactive')) {
                logFunction('OVERLAY_BUTTON_CLICKED', `${name} hidden`, `${name} visible`);
                button.classList.add('romper-button-selected');
            } else {
                logFunction('OVERLAY_BUTTON_CLICKED', `${name} visible`, `${name} hidden`);
                button.classList.remove('romper-button-selected');
            }
            overlay.classList.toggle('romper-inactive');
        }
    };
    button.onclick = onClick;
    button.addEventListener(
        'touchend',
        handleButtonTouchEvent(onClick),
    );
    const buttonIconDiv = document.createElement('div');
    buttonIconDiv.classList.add('romper-button-icon-div');
    buttonIconDiv.classList.add(`romper-${name}-button-icon-div`);
    button.appendChild(buttonIconDiv);

    const elements = {};
    const labels = {};
    let activeIconId = null;

    const getCount = () => Object.keys(elements).length;

    const add = (id: string, el: HTMLElement, label?: string) => {
        overlay.classList.remove(`count-${getCount()}`);
        elements[id] = el;
        if (label) {
            labels[label] = id;
        }
        el.classList.add('romper-control-unselected');
        overlay.appendChild(el);
        button.classList.remove('romper-inactive');
        overlay.classList.add(`count-${getCount()}`);
    };

    const get = (id: string) => elements[id];

    const getIdForLabel = (label: string) => {
        if (labels[label]) {
            return labels[label];
        }
        return null;
    };

    const remove = (id: string) => {
        overlay.classList.remove(`count-${getCount()}`);
        if (elements[id]) {
            overlay.removeChild(elements[id]);
            delete elements[id];
            if (Object.keys(elements).length === 0) {
                button.classList.add('romper-inactive');
            }
        }
        overlay.classList.add(`count-${getCount()}`);
    };

    const setActive = (id: string) => {
        activeIconId = id;
        Object.keys(elements).forEach((key) => {
            if (key === id) {
                elements[key].setAttribute('data-link-choice', 'active');
                elements[key].classList.add('romper-control-selected');
                elements[key].classList.remove('romper-control-unselected');
                elements[key].classList.remove('default');
            } else {
                elements[key].setAttribute('data-link-choice', 'inactive');
                elements[key].classList.add('romper-control-unselected');
                elements[key].classList.remove('romper-control-selected');
                elements[key].classList.remove('default');
            }
        });
    };

    const getActive = () => {
        let activeIconElement = null;
        if (activeIconId) {
            activeIconElement = elements[activeIconId];
        }
        return activeIconElement;
    };

    const addClass = (id: string, classname: string) => {
        Object.keys(elements).forEach((key) => {
            if (key === id) {
                elements[key].classList.add(classname);
            }
        });
    };

    const removeClass = (id: string, classname: string) => {
        Object.keys(elements).forEach((key) => {
            if (key === id) {
                elements[key].classList.remove(classname);
            }
        });
    };

    const buttonClassPrefix = 'romper-overlay-button-choice-';

    const clearButtonClass = () => {
        button.classList.forEach((buttonClass) => {
            if (buttonClass.indexOf(buttonClassPrefix) === 0) {
                button.classList.remove(buttonClass);
            }
        });
    };

    const setButtonClass = (classname: string) => {
        clearButtonClass();
        button.classList.add(`${buttonClassPrefix}${classname}`);
    };

    const clearAll = () => {
        overlay.classList.remove(`count-${getCount()}`);
        Object.keys(elements).forEach((key) => {
            overlay.removeChild(elements[key]);
            delete elements[key];
            delete labels[key];
        });
        overlay.classList.add(`count-${getCount()}`);
    };

    // Consider a set or select method.

    return {
        overlay,
        button,
        add,
        remove,
        get,
        setActive,
        getActive,
        addClass,
        removeClass,
        deactivateOverlay,
        getIdForLabel,
        setButtonClass,
        clearAll,
        getCount,
    };
}


class Player extends EventEmitter {
    playoutEngine: BasePlayoutEngine

    _player: HTMLDivElement;

    _playerParent: HTMLElement;

    _backgroundLayer: HTMLDivElement;

    _mediaLayer: HTMLDivElement;

    _guiLayer: HTMLDivElement;

    _errorLayer: HTMLDivElement;

    _continueModalLayer: HTMLDivElement;

    _continueModalContent: HTMLDivElement;

    backgroundTarget: HTMLDivElement;

    mediaTarget: HTMLDivElement;

    guiTarget: HTMLDivElement;

    showingSubtitles: boolean;

    _overlays: HTMLDivElement;

    _overlayToggleButtons: HTMLDivElement;

    _buttons: HTMLDivElement;

    _buttonsActivateArea: HTMLDivElement;

    _narrativeElementTransport: HTMLDivElement;

    _mediaTransport: HTMLDivElement;

    _startExperienceButton: HTMLButtonElement;

    _resumeExperienceButton: HTMLButtonElement;

    _startExperienceImage: HTMLDivElement;

    _playPauseButton: HTMLButtonElement;

    _backButton: HTMLButtonElement;

    _seekBackButton: HTMLButtonElement;

    _seekForwardButton: HTMLButtonElement;

    _nextButton: HTMLButtonElement;

    _subtitlesButton: HTMLButtonElement;

    _fullscreenButton: HTMLButtonElement;

    _inFullScreen: boolean

    _volume: Object;

    _representation: Object;

    _icon: Object;

    _linkChoice: Object;

    _scrubBar: HTMLInputElement;

    _timeFeedback: HTMLDivElement;

    _currentTime: HTMLSpanElement;

    _totalTime: HTMLSpanElement;

    _analytics: AnalyticsLogger;

    _assetUrls: AssetUrls;

    _logUserInteraction: Function;

    _volumeEventTimeouts: Object;

    _scrubbedEventTimeout: TimeoutID;

    _showRomperButtonsTimeout: TimeoutID;

    _RomperButtonsShowing: boolean;

    _userInteractionStarted: boolean;

    _numChoices: number;

    _removeExperienceOverlays: Function;

    setupExperienceOverlays: Function;

    _handleFullScreenChange: Function;

    _choiceIconSet: { [key: string]: Promise<Object> };

    _choiceCountdownTimeout: ?TimeoutID;

    _countdowner: HTMLDivElement;

    _countdownContainer: HTMLDivElement;

    _countdownTotal: number;

    _aspectRatio: number;

    _dogImage: HTMLDivElement;

    _details: ?HTMLDivElement

    _loadingLayer: HTMLElement

    _privacyDiv: ?HTMLDivElement;

    _controlsDisabled: boolean;

    _currentRenderer: ?BaseRenderer;

    _backNextWaiting: boolean; // flag to stop spamming of buttons

    _showErrorLayer: Function;

    _removeErrorLayer: Function;

    _showBufferingLayer: Function;

    _removeBufferingLayer: Function;

    _addContinueModal: Function;

    _hideModalLayer: Function;

    _startButtonHandler: Function;

    _controller: Controller;

    _scrubTimePoller: ?IntervalID;

    constructor(
        target: HTMLElement,
        analytics: AnalyticsLogger,
        assetUrls: AssetUrls,
        controller: Controller,
    ) {
        super();
        this._controller = controller;
        this._numChoices = 0;
        this._choiceIconSet = {};
        this._volumeEventTimeouts = {};
        this._RomperButtonsShowing = false;
        this._countdownTotal = 0;

        this._userInteractionStarted = false;
        this._controlsDisabled = false;
        this._backNextWaiting = false;

        this.showingSubtitles = false;

        this._analytics = analytics;
        this._assetUrls = assetUrls;

        this._logUserInteraction = this._logUserInteraction.bind(this);

        this._player = document.createElement('div');
        this._player.classList.add('romper-player');
        this._player.classList.add('noselect');

        this._playerParent = target;

        this._backgroundLayer = document.createElement('div');
        this._backgroundLayer.classList.add('romper-background');

        this._mediaLayer = document.createElement('div');
        this._mediaLayer.id = 'media-layer';
        this._mediaLayer.classList.add('romper-media');

        this._loadingLayer = document.createElement('div');
        this._loadingLayer.id = 'loading-layer';
        this._loadingLayer.classList.add('romper-loading');
        const loadingLayerInner = document.createElement('div');
        loadingLayerInner.classList.add('romper-loading-inner');
        this._loadingLayer.appendChild(loadingLayerInner);
        this._mediaLayer.appendChild(this._loadingLayer);

        this._aspectRatio = 16 / 9;
        this._guiLayer = document.createElement('div');
        this._guiLayer.id = 'gui-layer';
        this._guiLayer.classList.add('romper-gui');

        this._errorLayer = document.createElement('div');
        // eslint-disable-next-line max-len
        const errorMessage = document.createTextNode("Sorry, there's a problem - try skipping ahead");
        this._errorLayer.appendChild(errorMessage);
        this._errorLayer.classList.add('romper-error');
        this._errorLayer.classList.add('hide');

        this._continueModalLayer = document.createElement('div');
        this._continueModalLayer.id = 'continue-modal';
        this._continueModalLayer.classList.add('continue-modal');

        this._continueModalContent = document.createElement('div');
        this._continueModalContent.classList.add('continue-modal-content');
        this._continueModalLayer.appendChild(this._continueModalContent);

        this._player.appendChild(this._backgroundLayer);
        this._player.appendChild(this._mediaLayer);
        this._player.appendChild(this._guiLayer);
        this._player.appendChild(this._errorLayer);
        this._guiLayer.appendChild(this._continueModalLayer);

        this._overlays = document.createElement('div');
        this._overlays.classList.add('romper-overlays');
        this._overlays.classList.add('buttons-hidden');
        /*
                <narrativeElementTransport>
                    <previous, repeat, next />
                <buttons>
                    <scrub />
                    <lower section>
                        <play vol representations icons time sub FS>
                    </lowersection>
        */

        this._buttonsActivateArea = document.createElement('div');
        this._buttonsActivateArea.classList.add('romper-buttons-activate-area');
        this._buttonsActivateArea.classList.add('hide');

        this._buttons = document.createElement('div');
        this._buttons.classList.add('romper-buttons');
        this._buttons.onmousemove = this._activateRomperButtons.bind(this);

        this._narrativeElementTransport = document.createElement('div');
        this._narrativeElementTransport.classList.add('romper-narrative-element-transport');

        this._backButton = document.createElement('button');
        this._backButton.classList.add('romper-button');
        this._backButton.classList.add('romper-back-button');
        this._backButton.setAttribute('title', 'Back Button');
        this._backButton.setAttribute('aria-label', 'Back Button');
        this._backButton.setAttribute('data-required-controls', 'false');
        const backButtonIconDiv = document.createElement('div');
        backButtonIconDiv.classList.add('romper-button-icon-div');
        backButtonIconDiv.classList.add('romper-back-button-icon-div');
        this._backButton.appendChild(backButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._backButton);

        this._seekBackButton = document.createElement('button');
        this._seekBackButton.classList.add('romper-button');
        this._seekBackButton.classList.add('romper-seek-back-button');
        this._seekBackButton.setAttribute('title', 'Seek Back Button');
        this._seekBackButton.setAttribute('aria-label', 'Seek Back Button');
        this._seekBackButton.setAttribute('data-required-controls', 'false');
        const seekBackButtonIconDiv = document.createElement('div');
        seekBackButtonIconDiv.classList.add('romper-button-icon-div');
        this._seekBackButton.appendChild(seekBackButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._seekBackButton);

        this._playPauseButton = document.createElement('button');
        this._playPauseButton.classList.add('romper-button');
        this._playPauseButton.classList.add('romper-play-button');
        this._playPauseButton.setAttribute('title', 'Play Pause Button');
        this._playPauseButton.setAttribute('aria-label', 'Play Pause Button');
        this._playPauseButton.setAttribute('data-required-controls', 'true');
        const playPauseButtonIconDiv = document.createElement('div');
        playPauseButtonIconDiv.classList.add('romper-button-icon-div');
        this._playPauseButton.appendChild(playPauseButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._playPauseButton);

        this._seekForwardButton = document.createElement('button');
        this._seekForwardButton.classList.add('romper-button');
        this._seekForwardButton.classList.add('romper-seek-fwd-button');
        this._seekForwardButton.setAttribute('title', 'Seek Forward Button');
        this._seekForwardButton.setAttribute('aria-label', 'Seek Forward Button');
        this._seekForwardButton.setAttribute('data-required-controls', 'false');
        const seekForwardButtonIconDiv = document.createElement('div');
        seekForwardButtonIconDiv.classList.add('romper-button-icon-div');
        this._seekForwardButton.appendChild(seekForwardButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._seekForwardButton);

        this._nextButton = document.createElement('button');
        this._nextButton.classList.add('romper-button');
        this._nextButton.classList.add('romper-next-button');
        this._nextButton.setAttribute('title', 'Next Button');
        this._nextButton.setAttribute('aria-label', 'Next Button');
        this._nextButton.setAttribute('data-required-controls', 'false');
        this._narrativeElementTransport.appendChild(this._nextButton);
        const nextButtonIconDiv = document.createElement('div');
        nextButtonIconDiv.classList.add('romper-button-icon-div');
        this._nextButton.appendChild(nextButtonIconDiv);

        this._guiLayer.appendChild(this._overlays);
        this._guiLayer.appendChild(this._buttons);
        this._guiLayer.appendChild(this._buttonsActivateArea);

        this._scrubBar = document.createElement('input');
        this._scrubBar.setAttribute('title', 'Seek bar');
        this._scrubBar.setAttribute('aria-label', 'Seek bar');
        this._scrubBar.setAttribute('data-required-controls', 'false');
        this._scrubBar.type = 'range';
        this._scrubBar.id = 'scrub-bar';
        this._scrubBar.value = '0';
        this._scrubBar.className = 'romper-scrub-bar';
        this._scrubBar.classList.add(SLIDER_CLASS);
        this._buttons.appendChild(this._scrubBar);

        this._mediaTransport = document.createElement('div');
        this._mediaTransport.classList.add('romper-media-transport');

        const mediaTransportLeft = document.createElement('div');
        mediaTransportLeft.classList.add('left');

        const mediaTransportCenter = document.createElement('div');
        mediaTransportCenter.classList.add('center');
        mediaTransportCenter.appendChild(this._narrativeElementTransport);

        const mediaTransportRight = document.createElement('div');
        mediaTransportRight.classList.add('right');
        this._mediaTransport.appendChild(mediaTransportLeft);
        this._mediaTransport.appendChild(mediaTransportCenter);
        this._mediaTransport.appendChild(mediaTransportRight);

        // Create the overlays.
        this._overlayToggleButtons = document.createElement('div');
        this._overlayToggleButtons.classList.add('romper-overlay-controls');
        this._overlayToggleButtons.classList.add('romper-inactive');
        mediaTransportRight.appendChild(this._overlayToggleButtons);

        this._volume = createOverlay('volume', this._logUserInteraction);
        mediaTransportLeft.appendChild(this._volume.overlay);
        mediaTransportLeft.appendChild(this._volume.button);

        this._representation = createOverlay('representation', this._logUserInteraction);
        mediaTransportRight.appendChild(this._representation.overlay);
        this._overlayToggleButtons.appendChild(this._representation.button);

        this._icon = createOverlay('icon', this._logUserInteraction);
        mediaTransportRight.appendChild(this._icon.overlay);
        this._overlayToggleButtons.appendChild(this._icon.button);

        // no need for toggle button
        this._countdownContainer = document.createElement('div');
        this._countdownContainer.classList.add('romper-ux-divider');
        this._countdowner = document.createElement('div');
        this._countdowner.classList.add('romper-ux-countdown');
        this._countdownContainer.appendChild(this._countdowner);

        this._subtitlesButton = document.createElement('button');
        this._subtitlesButton.classList.add('romper-button');
        this._subtitlesButton.setAttribute('title', 'Subtitles Button');
        this._subtitlesButton.setAttribute('aria-label', 'Subtitles Button');
        this._subtitlesButton.classList.add('romper-subtitles-button');
        this.disableSubtitlesControl();
        const subtitlesButtonIconDiv = document.createElement('div');
        subtitlesButtonIconDiv.classList.add('romper-button-icon-div');
        subtitlesButtonIconDiv.classList.add('romper-subtitles-button-icon-div');
        this._subtitlesButton.appendChild(subtitlesButtonIconDiv);
        mediaTransportRight.appendChild(this._subtitlesButton);

        this._fullscreenButton = document.createElement('button');
        this._fullscreenButton.classList.add('romper-button');
        this._fullscreenButton.classList.add('romper-fullscreen-button');
        this._fullscreenButton.setAttribute('title', 'Fullscreen Button');
        this._fullscreenButton.setAttribute('aria-label', 'Fullscreen Button');
        const fullscreenButtonIconDiv = document.createElement('div');
        fullscreenButtonIconDiv.classList.add('romper-button-icon-div');
        fullscreenButtonIconDiv.classList.add('romper-fullscreen-button-icon-div');
        this._fullscreenButton.appendChild(fullscreenButtonIconDiv);
        mediaTransportRight.appendChild(this._fullscreenButton);

        this._buttons.appendChild(this._mediaTransport);


        target.appendChild(this._player);

        // Hide gui elements until start clicked
        this._overlays.classList.add('romper-inactive');
        this._buttons.classList.add('romper-inactive');
        this._buttonsActivateArea.classList.add('romper-inactive');

        // Expose the layers for external manipulation if needed.
        this.guiTarget = this._guiLayer;
        this.mediaTarget = this._mediaLayer;
        this.backgroundTarget = this._backgroundLayer;

        // Event Listeners
        this._overlays.onclick = this._handleOverlayClick.bind(this);
        this._overlays.addEventListener(
            'touchend',
            this._handleOverlayClick.bind(this),
        );

        this._backButton.onclick = this._backButtonClicked.bind(this);
        this._backButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._backButtonClicked.bind(this)),
        );

        this._nextButton.onclick = this._nextButtonClicked.bind(this);
        this._nextButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._nextButtonClicked.bind(this)),
        );

        this._playPauseButton.onclick = this._playPauseButtonClicked.bind(this);

        this._playPauseButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._playPauseButtonClicked.bind(this)),
        );

        this._seekBackButton.onclick = this._seekBackwardButtonClicked.bind(this);
        this._seekBackButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._seekBackwardButtonClicked.bind(this)),
        );

        this._seekForwardButton.onclick = this._seekForwardButtonClicked.bind(this);
        this._seekForwardButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._seekForwardButtonClicked.bind(this)),
        );

        this._subtitlesButton.onclick = this._subtitlesButtonClicked.bind(this);
        this._subtitlesButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._subtitlesButtonClicked.bind(this)),
        );

        this._fullscreenButton.onclick = this._toggleFullScreen.bind(this);
        this._fullscreenButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._toggleFullScreen.bind(this)),
        );
        this._handleFullScreenChange = this._handleFullScreenChange.bind(this);
        this._inFullScreen = false;

        this._player.addEventListener('touchend', this._handleTouchEndEvent.bind(this));

        this._buttonsActivateArea.onmouseenter = this._activateRomperButtons.bind(this);
        this._buttonsActivateArea.onmousemove = this._activateRomperButtons.bind(this);
        this._buttonsActivateArea.addEventListener(
            'touchend',
            this._activateRomperButtons.bind(this),
        );
        this._buttonsActivateArea.onclick = this._activateRomperButtons.bind(this);
        this._buttons.onmouseleave = this._hideRomperButtons.bind(this);

        this._removeExperienceOverlays = this._removeExperienceOverlays.bind(this);

        const playoutToUse = MediaFormats.getPlayoutEngine();

        const debugPlayout = checkDebugPlayout();
        if (debugPlayout) {
            logger.info("Playout debugging: ON")
        }

        logger.info('Using playout engine: ', playoutToUse);

        switch (playoutToUse) {
        case PLAYOUT_ENGINES.SRC_SWITCH_PLAYOUT:
            // Use craptastic iOS playout engine
            this.playoutEngine = new SrcSwitchPlayoutEngine(this, debugPlayout);
            break;
        case PLAYOUT_ENGINES.DOM_SWITCH_PLAYOUT:
            // Use shiny source switching engine.... smooth.
            this.playoutEngine = new DOMSwitchPlayoutEngine(this, debugPlayout);
            break;
        case PLAYOUT_ENGINES.IOS_PLAYOUT:
            // Refactored iOS playout engine
            this.playoutEngine = new IOSPlayoutEngine(this, debugPlayout);
            break;
        default:
            logger.fatal('Invalid Playout Engine');
            throw new Error('Invalid Playout Engine');
        }

        this._showErrorLayer = this._showErrorLayer.bind(this);
        this._removeErrorLayer = this._removeErrorLayer.bind(this);
        this._showBufferingLayer = this._showBufferingLayer.bind(this);
        this._removeBufferingLayer = this._removeBufferingLayer.bind(this);
        this._addContinueModal = this._addContinueModal.bind(this);
        this._startButtonHandler = this._startButtonHandler.bind(this);

        this.createBehaviourOverlay = this.createBehaviourOverlay.bind(this);
        this._addCountdownToElement = this._addCountdownToElement.bind(this);
    }

    setCurrentRenderer(renderer: BaseRenderer) {
        this._currentRenderer = renderer;
    }

    setAspectRatio(aspectRatio: number) {
        logger.info(`Setting aspect ratio to ${aspectRatio}`);
        this._aspectRatio = aspectRatio;
    }

    addDog(src: string, position: Object) {
        if (this._dogImage === undefined) {
            this._dogImage = document.createElement('div');
        }
        window.addEventListener('resize', () => {
            this._setDogPosition(position);
        });
        this._dogImage.className = 'romper-dog';
        this._dogImage.style.backgroundImage = `url(${src})`;
        this._player.appendChild(this._dogImage);

        this._setDogPosition(position);
    }

    _setDogPosition(position: Object) {
        const { top, left, width, height } = position;
        const guiAspect = this._guiLayer.clientWidth / this._guiLayer.clientHeight;
        if (guiAspect > this._aspectRatio) {
            const mediaWidth = (this._aspectRatio * this._guiLayer.clientHeight);
            const sideGap = (this._guiLayer.clientWidth - mediaWidth) / 2;
            this._dogImage.style.left = `${sideGap + ((left/100) * mediaWidth)}px`;
            this._dogImage.style.top = `${top}%`;
            this._dogImage.style.width = `${(width/100) * mediaWidth}px`;
            this._dogImage.style.height = `${height}%`;
        } else {
            const mediaHeight = this._guiLayer.clientWidth / this._aspectRatio;
            const topGap = (this._guiLayer.clientHeight - mediaHeight) / 2;
            this._dogImage.style.left = `${left}%`;
            this._dogImage.style.top = `${topGap + ((top/100) * mediaHeight)}px`;
            this._dogImage.style.width = `${width}%`;
            this._dogImage.style.height = `${(height/100) * mediaHeight}px`;
        }
    }

    addDetails(elementName: ?string, elementId: ?string, name: ?string, id: ?string) {
        if (!this._details) {
            this._details = document.createElement('div');
        }
        // clean up then redo
        while (this._details.firstChild) {
            this._details.removeChild(this._details.firstChild);
        }
        this._details.className = 'details-overlay';
        const narrativeElement = addDetail('NE', elementName, elementId);
        this._details.appendChild(narrativeElement);

        const representation = addDetail('REP', name, id);
        this._details.appendChild(representation);
        this._player.appendChild(this._details);
    }

    addAssetCollectionDetails(assetCollection: Object) {
        if(!assetCollection) return;
        if (!this._details) {
            this._details = document.createElement('div');
            this._player.appendChild(this._details);
        }
        this._details.className = 'details-overlay';
        const assetCollectionDetail = addDetail('Asset', assetCollection.name, assetCollection.id)
        this._details.appendChild(assetCollectionDetail);
    }

    _addContinueModal(options: Object) {
        this._createResumeExperienceButton(options);

        this._resumeExperienceButton.setAttribute('title', 'Resume and accept terms');
        this._resumeExperienceButton.setAttribute('aria-label', 'Resume Button');

        const cancelButton = document.createElement('button');
        cancelButton.classList.add('romper-reset-button');
        cancelButton.setAttribute('title', 'Restart and accept terms');
        cancelButton.setAttribute('aria-label', 'Restart Button');

        const cancelButtonHolder = document.createElement('div');
        cancelButton.appendChild(cancelButtonHolder);
        cancelButtonHolder.classList.add('romper-reset-button-icon');

        const cancelButtonDiv = document.createElement('div');
        cancelButtonDiv.classList.add('romper-button-icon-div');
        cancelButtonDiv.classList.add(`romper-reset-button-icon-div`);
        cancelButtonHolder.appendChild(cancelButtonDiv);

        const cancelButtonHandler = () => {
            this._narrativeElementTransport.classList.remove('romper-inactive');
            this._logUserInteraction(AnalyticEvents.names.BEHAVIOUR_CANCEL_BUTTON_CLICKED);
            this._controller.setSessionState(SESSION_STATE.RESTART);
            this._controller.deleteExistingSession();
            this._controller.resetStory(this._controller._storyId);
            this._hideModalLayer();
            this._startButtonHandler();
        };

        cancelButton.onclick = cancelButtonHandler;
        cancelButton.addEventListener('touchend', cancelButtonHandler);

        const resumeExperienceButtonHandler = () => {
            this.emit(REASONER_EVENTS.ROMPER_STORY_STARTED);
            this._logUserInteraction(AnalyticEvents.names.BEHAVIOUR_CONTINUE_BUTTON_CLICKED);
            this._narrativeElementTransport.classList.remove('romper-inactive');
            this._controller.setSessionState(SESSION_STATE.RESUME);
            this._controller.restart(this._controller._storyId);
            this._hideModalLayer();
            this._enableUserInteraction();
        };

        this._resumeExperienceButton.onclick = resumeExperienceButtonHandler;
        this._resumeExperienceButton.addEventListener(
            'touchend',
            resumeExperienceButtonHandler,
        );

        // resume
        const continueMessage = document.createElement('div');
        continueMessage.className = 'continue-experience';
        continueMessage.textContent = 'Restart or Resume?';
        continueMessage.classList.add('modal-inner-content');

        this._continueModalContent.appendChild(continueMessage);
        // restart
        this._continueModalContent.appendChild(cancelButton);
        // continue
        this._continueModalContent.appendChild(this._resumeExperienceButton);



        if(this._continueModalLayer) {
            this._continueModalLayer.classList.add('show');
            this._continueModalContent.classList.add('show');
        }
    }

    _handleTouchEndEvent(event: Object) {
        // Get the element that was clicked on
        const endTarget = document.elementFromPoint(
            event.changedTouches[0].pageX,
            event.changedTouches[0].pageY,
        );

        if (!this._RomperButtonsShowing) {
            // Open romper buttons if user touches anywhere on screen that is background
            const openTriggerElements = [
                this._overlays,
                this._narrativeElementTransport,
                this._buttonsActivateArea,
            ];
            if (openTriggerElements.some(el => (el === endTarget))) {
                this._showRomperButtons();
                this._hideAllOverlays();
                // Hide buttons after 5 seconds
                this._showRomperButtonsTimeout = setTimeout(() => {
                    this._hideRomperButtons();
                }, 5000);
                event.preventDefault();
            }
        } else {
            // Close romper buttons if user touches anywhere above buttons bar
            const closeTriggerElements = [
                this._overlays,
                this._narrativeElementTransport,
            ];
            // Prevent touch being converted to click on button bar
            // (which would then trigger activate area mouseenter events)
            const proventClickTriggerElements = [
                this._buttons,
            ];
            if (closeTriggerElements.some(el => (el === endTarget))) {
                this._hideRomperButtons();
                this._hideAllOverlays();
                event.preventDefault();
            } else if (proventClickTriggerElements.some(el => (el === endTarget))) {
                event.preventDefault();
            }
        }
    }

    _activateRomperButtons(event: ?Object, override: ?boolean) {
        if(event) {
            event.stopPropagation();
            event.preventDefault();
        }
        if (!override && this._controlsDisabled) {
            return;
        }
        if (!this._RomperButtonsShowing) {
            this._showRomperButtons();
        }
        if(override) {
            return;
        }
        if (this._showRomperButtonsTimeout) clearTimeout(this._showRomperButtonsTimeout);
        this._showRomperButtonsTimeout = setTimeout(() => {
            this._hideRomperButtons();
        }, 5000);
    }

    _showRomperButtons() {
        this._logRendererAction(AnalyticEvents.names.BUTTONS_ACTIVATED);
        this._RomperButtonsShowing = true;
        this._buttons.classList.add('show');
        this._narrativeElementTransport.classList.add('show');
        this._buttonsActivateArea.classList.add('hide');
        this._overlays.classList.remove('buttons-hidden');
        this._overlays.classList.add('buttons-showing');
    }

    _hideRomperButtons() {
        if (this._showRomperButtonsTimeout) clearTimeout(this._showRomperButtonsTimeout);
        this._logRendererAction(AnalyticEvents.names.BUTTONS_DEACTIVATED);
        this._RomperButtonsShowing = false;
        this._buttons.classList.remove('show');
        this._narrativeElementTransport.classList.remove('show');
        this._buttonsActivateArea.classList.remove('hide');
        this._overlays.classList.add('buttons-hidden');
        this._overlays.classList.remove('buttons-showing');
    }

    _hideModalLayer() {
        if(this._continueModalLayer) {
            this._guiLayer.removeChild(this._continueModalLayer);
            this._continueModalLayer = null;
        }
    }

    _showErrorLayer() {
        this._errorLayer.classList.add('show');
        this._errorLayer.classList.remove('hide');
        if(!this._RomperButtonsShowing){
            this._showRomperButtons();
        }
    }

    _showBufferingLayer() {
        this._loadingLayer.classList.add('show');
    }

    _removeBufferingLayer() {
        this._loadingLayer.classList.remove('show');
    }

    _removeErrorLayer() {
        this._errorLayer.classList.remove('show');
        this._errorLayer.classList.add('hide');

        if(this._RomperButtonsShowing) {
            this._hideRomperButtons();
        }
    }

    _createStartExperienceButton(options: Object) {
        this._startExperienceButton = document.createElement('button');
        this._startExperienceButton.classList.add(options.button_class);
        this._startExperienceButton.setAttribute('title', 'Play and accept terms');
        this._startExperienceButton.setAttribute('aria-label', 'Start Button');

        const startButtonIconHolder = document.createElement('div');
        this._startExperienceButton.appendChild(startButtonIconHolder);

        startButtonIconHolder.classList.add('romper-start-button-icon');
        const startButtonIconDiv = document.createElement('div');
        startButtonIconDiv.classList.add('romper-button-icon-div');
        startButtonIconDiv.classList.add(`${options.button_class}-icon-div`);
        startButtonIconHolder.appendChild(startButtonIconDiv);
    }

    _createStartImage(options: Object) {
        if(!this._startExperienceImage) {
            this._startExperienceImage = document.createElement('div');
            this._startExperienceImage.className = 'romper-start-image';
            this._startExperienceImage.style.backgroundImage = `url(${options.background_art})`;
            this._mediaLayer.appendChild(this._startExperienceImage);
        }
    }

    _createResumeExperienceButton(options: Object) {
        this._resumeExperienceButton = document.createElement('button');
        this._resumeExperienceButton.classList.add(options.button_class);
        this._resumeExperienceButton.setAttribute('title', 'Play and accept terms');
        this._resumeExperienceButton.setAttribute('aria-label', 'Start Button');

        const resumeButtonHolder = document.createElement('div');
        this._resumeExperienceButton.appendChild(resumeButtonHolder);
        resumeButtonHolder.classList.add('romper-start-button-icon');

        const resumeButtonDiv = document.createElement('div');
        resumeButtonDiv.classList.add('romper-button-icon-div');
        resumeButtonDiv.classList.add(`${options.button_class}-icon-div`);
        resumeButtonHolder.appendChild(resumeButtonDiv);
    }

    setupExperienceOverlays(options: Object) {
        switch (this._controller.getSessionState()) {
        case SESSION_STATE.RESUME:
            this._narrativeElementTransport.classList.remove('romper-inactive');
            break;
        case SESSION_STATE.EXISTING:
            this._createResumeOverlays(options);
            if (options.hide_narrative_buttons) {
                // can't use player.setNextAvailable
                // as this may get reset after this by NE change handling
                this._narrativeElementTransport.classList.add('romper-inactive');
            }
            break;
        case SESSION_STATE.RESTART:
            this._narrativeElementTransport.classList.remove('romper-inactive');
            break
        case SESSION_STATE.NEW:
            this._createStartOverlays(options);
            break;
        default:
            if (options.hide_narrative_buttons) {
                // can't use player.setNextAvailable
                // as this may get reset after this by NE change handling
                this._narrativeElementTransport.classList.add('romper-inactive');
            }
            this._createStartOverlays(options);
            break;
        }
    }

    _createPrivacyNotice(options: Object) {
        if (options.privacy_notice !== null) {
            const privacyPar = document.createElement('p');
            privacyPar.innerHTML = options.privacy_notice.replace('\n', '<br/>');
            this._privacyDiv = document.createElement('div');
            this._privacyDiv.className = 'romper-privacy-notice';
            this._privacyDiv.appendChild(privacyPar);
            if (this._privacyDiv) {
                this._mediaLayer.appendChild(this._privacyDiv);
            }
        }
    }

    _createSharedOverlays(options:Object) {
        this._createPrivacyNotice(options);
        this._createStartImage(options);
        this._mediaLayer.classList.add('romper-prestart');
    }

    _createResumeOverlays(options: Object) {
        this._createSharedOverlays(options);
        this._addContinueModal(options);
    }

    _createStartOverlays(options: Object) {
        this._createSharedOverlays(options);
        this._createStartExperienceButton(options);
        this._guiLayer.appendChild(this._startExperienceButton);
        this._startExperienceButton.onclick = this._startButtonHandler;
        this._startExperienceButton.addEventListener(
            'touchend',
            this._startButtonHandler,
        );
    }

    _startButtonHandler() {
        this.emit(REASONER_EVENTS.ROMPER_STORY_STARTED);
        this._removeExperienceOverlays();
        this._enableUserInteraction();
        this._narrativeElementTransport.classList.remove('romper-inactive');
        this._logUserInteraction(AnalyticEvents.names.BEHAVIOUR_CONTINUE_BUTTON_CLICKED);
        this._controller.setExistingSession();
    }

    _clearOverlays() {
        this._icon.clearAll();
        this._representation.clearAll();
        this._volume.clearAll();
    }

    prepareForRestart() {
        if (this._startExperienceButton || this._startExperienceImage) {
            this._removeExperienceOverlays();
        }
        this.playoutEngine.pause();
        this._clearOverlays();
        this._disableUserInteraction();
        logger.info('disabling experience before restart');
    }

    _removeExperienceOverlays() {
        try {
            if(this._startExperienceButton) {
                this._guiLayer.removeChild(this._startExperienceButton);
                // this._startExperienceButton = null;
            }
            if (this._privacyDiv) {
                this._mediaLayer.removeChild(this._privacyDiv);
            }
            if(this._startExperienceImage) {
                this._mediaLayer.removeChild(this._startExperienceImage);
                // this._startExperienceImage = null;
            }
            this._mediaLayer.classList.remove('romper-prestart');
        } catch (e) {
            logger.warn(e);
            logger.warn('could not remove _startExperienceImage');
        }
    }

    _disableUserInteraction() {
        this._userInteractionStarted = false;
        this._overlays.classList.add('romper-inactive');
        this._buttons.classList.add('romper-inactive');
        this._buttonsActivateArea.classList.add('romper-inactive');
        this._overlayToggleButtons.classList.add('romper-inactive');

        this.playoutEngine.setPermissionToPlay(false);
    }

    _enableUserInteraction() {
        if (this._userInteractionStarted) {
            return;
        }

        this._userInteractionStarted = true;
        this._overlays.classList.remove('romper-inactive');
        this._buttons.classList.remove('romper-inactive');
        this._buttonsActivateArea.classList.remove('romper-inactive');
        this._buttonsActivateArea.classList.remove('hide');
        this._overlayToggleButtons.classList.remove('romper-inactive');

        this.playoutEngine.setPermissionToPlay(true);

        this._logUserInteraction(AnalyticEvents.names.START_BUTTON_CLICKED);
        this._playPauseButtonClicked();
    }

    _playPauseButtonClicked() {
        this.emit(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED);
        this._logUserInteraction(AnalyticEvents.names.PLAY_PAUSE_BUTTON_CLICKED);
    }

    _seekForwardButtonClicked() {
        if (!this._backNextWaiting) {
            this.emit(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED);
            this._backNextWaiting = true;
            setTimeout(() => { this._backNextWaiting = false; }, 500);
        }
    }

    _seekBackwardButtonClicked() {
        if (!this._backNextWaiting) {
            this.emit(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED);
            this._backNextWaiting = true;
            setTimeout(() => { this._backNextWaiting = false; }, 500);
        }
    }

    _backButtonClicked() {
        this._hideAllOverlays();
        if (!this._backNextWaiting) {
            let currentSegmentTime = 0;
            if (this._currentRenderer) {
                const { currentTime } = this._currentRenderer.getCurrentTime();
                currentSegmentTime = currentTime;
            }
            if (currentSegmentTime < 2) {
                this.emit(PlayerEvents.BACK_BUTTON_CLICKED);
            } else {
                this.emit(PlayerEvents.REPEAT_BUTTON_CLICKED);
            }
            this._backNextWaiting = true;
            setTimeout(() => { this._backNextWaiting = false; }, 500);
        }
        this._logUserInteraction(AnalyticEvents.names.BACK_BUTTON_CLICKED);
    }

    _nextButtonClicked() {
        if (!this._userInteractionStarted) {
            this._enableUserInteraction();
        }
        if (!this._backNextWaiting) {
            this._hideAllOverlays();
            this.emit(PlayerEvents.NEXT_BUTTON_CLICKED);
            this._backNextWaiting = true;
            setTimeout(() => { this._backNextWaiting = false; }, 500);
        }
        this._logUserInteraction(AnalyticEvents.names.NEXT_BUTTON_CLICKED);
    }

    _handleOverlayClick(event: Object) {
        if (this._RomperButtonsShowing) {
            this._hideRomperButtons();
        } else {
            this._activateRomperButtons(event);
        }
        this._hideAllOverlays();
    }

    _hideAllOverlays() {
        if (this._representation) {
            this._representation.deactivateOverlay();
        }
        if (this._volume) {
            this._volume.deactivateOverlay();
        }
        if (this._icon) {
            this._icon.deactivateOverlay();
        }
    }

    _subtitlesButtonClicked() {
        this.showingSubtitles = !this.showingSubtitles;
        if (this.showingSubtitles) {
            this._subtitlesButton.classList.add('romper-button-selected');
        } else {
            this._subtitlesButton.classList.remove('romper-button-selected');
        }

        const showingSubtitlesIntToString = [
            'hidden',
            'showing',
        ];

        this.emit(PlayerEvents.SUBTITLES_BUTTON_CLICKED);
        // The + here converts bool to int
        this._logUserInteraction(
            AnalyticEvents.names.SUBTITLES_BUTTON_CLICKED,
            showingSubtitlesIntToString[+!this.showingSubtitles],
            showingSubtitlesIntToString[+this.showingSubtitles],
        );
    }

    enableSubtitlesControl() {
        this._subtitlesButton.classList.remove('romper-control-disabled');
        this._subtitlesButton.removeAttribute('disabled');
    }

    disableSubtitlesControl() {
        this._subtitlesButton.classList.add('romper-control-disabled');
        this._subtitlesButton.setAttribute('disabled', 'true');
    }

    _logUserInteraction(
        userEventName: AnalyticEventName,
        fromId: string = 'not_set',
        toId: string = 'not_set',
        information: ?Object = {},
    ) {
        const logData = {
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names[userEventName],
            from: fromId == null ? 'not_set' : fromId,
            to: toId == null ? 'not_set' : toId,
            information: JSON.stringify(information),
        };
        this._analytics(logData);
    }

    _logRendererAction(userEventName: AnalyticEventName) {
        const logData = {
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names[userEventName],
            from: 'not_set',
            to: 'not_set',
        };
        this._analytics(logData);
    }

    setVolumeControlLevel(label: string, value: number) {
        const id = this._volume.getIdForLabel(label);
        const overlay = this._volume.get(id);
        if (overlay) {
            if (overlay.childNodes[1] && overlay.childNodes[1].childNodes[2]) {
                // set slider value
                overlay.childNodes[1].childNodes[1].value = value;
                // and feedback div
                overlay.childNodes[1].childNodes[2].textContent = `${Math.floor(10 * value)}`;
            }
            this.emit(PlayerEvents.VOLUME_CHANGED, { id, value, label });
        }
    }

    setMuted(label: string, muted: boolean) {
        const id = this._volume.getIdForLabel(label);
        const overlay = this._volume.get(id);
        if(overlay) {
            const muteButton = document.getElementById('mute-button-id');
            if(muted && muteButton) {
                muteButton.setAttribute('data-muted', 'true');
                muteButton.classList.remove('romper-mute-button');
                muteButton.classList.add('romper-muted-button');
            }
            this.emit(PlayerEvents.VOLUME_MUTE_TOGGLE, { id, label, muted });
        }
    }

    _setMuteCallBack(id: string, label: string, muteButton: HTMLDivElement)  {
        return () => {
            muteButton.classList.toggle('romper-mute-button');
            const muted = muteButton.classList.toggle('romper-muted-button');
            muteButton.setAttribute('data-muted', muted)
            this.emit(PlayerEvents.VOLUME_MUTE_TOGGLE, { id, label, muted });
            this._logUserInteraction(AnalyticEvents.names.VOLUME_MUTE_TOGGLED,
                `${label}: ${!muted}`, `${label}: ${muted}`);
        };
    };

    _setVolumeCallback(
        id: string,
        label: string,
        levelSpan: HTMLSpanElement,
        muteButton: HTMLDivElement) {
        return (event: Object) => {
            const value = parseFloat(event.target.value);
            // eslint-disable-next-line no-param-reassign
            levelSpan.textContent = `${Math.floor(10 * value)}`;
            if (value === 0) {
                muteButton.classList.remove('romper-mute-button');
                muteButton.classList.add('romper-muted-button');
            } else {
                const isMuted = muteButton.classList.contains('romper-muted-button');
                if(isMuted) {
                    this.emit(PlayerEvents.VOLUME_MUTE_TOGGLE, { id, label, muted: false });
                }
                muteButton.classList.add('romper-mute-button');
                muteButton.classList.remove('romper-muted-button');
            }

            this.emit(PlayerEvents.VOLUME_CHANGED, { id, value, label });

            // Don't spam analtics with lots of volume changes
            // Wait 1 second after volume stops changing before sending analytics
            if (this._volumeEventTimeouts[label]) {
                clearTimeout(this._volumeEventTimeouts[label]);
            }
            this._volumeEventTimeouts[label] = setTimeout(() => {
                this._logUserInteraction(
                    AnalyticEvents.names.VOLUME_CHANGED, null,
                    `${label}: ${event.target.value}`,
                );
            }, 1000);
        };
    }

    addVolumeControl(id: string, label: string) {
        if(BrowserUserAgent.iOS()) {
            return;
        }

        const volumeControl = document.createElement('div');
        volumeControl.classList.add('romper-volume-control');
        volumeControl.classList.add(`romper-volume-label-${label.toLowerCase()}`);

        const volumeLabel = document.createElement('div');
        volumeLabel.classList.add('romper-volume-label');
        volumeLabel.textContent = label;

        const controlDiv = document.createElement('div');
        controlDiv.classList.add('romper-control-line');
        const muteDiv = document.createElement('div');
        muteDiv.id = 'mute-button-id';
        muteDiv.classList.add('romper-mute-button');
        muteDiv.appendChild(document.createElement('div'));
        const levelSpan = document.createElement('span');
        levelSpan.classList.add('romper-volume-level');
        levelSpan.textContent = '10';

        const volumeRange = document.createElement('input');
        volumeRange.type = 'range';
        volumeRange.min = '0';
        volumeRange.step = '0.01';
        volumeRange.max = '1';
        volumeRange.defaultValue = '1';
        volumeRange.classList.add('romper-volume-range');
        volumeRange.oninput = this._setVolumeCallback(id, label, levelSpan, muteDiv).bind(this);
        volumeRange.onchange = this._setVolumeCallback(id, label, levelSpan, muteDiv).bind(this);

        muteDiv.ontouchend = (e) => {
            e.preventDefault();
            this._setMuteCallBack(id, label, muteDiv);
        };
        muteDiv.onclick = this._setMuteCallBack(id, label, muteDiv).bind(this);

        controlDiv.appendChild(muteDiv);
        controlDiv.appendChild(volumeRange);
        controlDiv.appendChild(levelSpan);

        volumeControl.appendChild(volumeLabel);
        volumeControl.appendChild(controlDiv);

        this._volume.add(id, volumeControl, label);
    }

    removeVolumeControl(id: string) {
        this._volume.remove(id);
    }

    clearAllRepresentationControls() {
        this._representation.clearAll();
    }

    addRepresentationControl(id: string, src: string, label: string) {
        const representationControl = document.createElement('div');
        representationControl.classList.add('romper-representation-control');
        representationControl.classList.add(`romper-representation-choice-${id}`);
        representationControl.setAttribute('title', label);
        representationControl.setAttribute('aria-label', label);

        const iconContainer = document.createElement('div');
        iconContainer.classList.add('romper-representation-icon-container');

        const representationIcon = document.createElement('img');
        if (src !== '') {
            representationIcon.src = src;
        } else {
            representationIcon.src = this._assetUrls.noAssetIconUrl;
        }
        representationIcon.classList.add('romper-representation-icon');
        representationIcon.setAttribute('draggable', 'false');
        const representationIconClick = () => {
            this.emit(PlayerEvents.REPRESENTATION_CLICKED, { id });
            this._representation.deactivateOverlay();
            this._representation.setActive(id);
            this._representation.setButtonClass(`${id}`);
            this._logUserInteraction(AnalyticEvents.names.SWITCH_VIEW_BUTTON_CLICKED, null, id);
        };

        representationIcon.onclick = representationIconClick;
        representationIcon.addEventListener(
            'touchend',
            handleButtonTouchEvent(representationIconClick),
        );

        iconContainer.appendChild(representationIcon);
        representationControl.appendChild(iconContainer);

        this._representation.add(id, representationControl);
    }

    createBehaviourOverlay(behaviour: Object) {
        const behaviourOverlay = createOverlay('link-choice', this._logUserInteraction);
        const behaviourElement = behaviourOverlay.overlay
        behaviourElement.id = behaviour.id;

        this._addCountdownToElement(behaviourElement);
        this._overlays.appendChild(behaviourElement);
        return behaviourOverlay;
    }

    _addCountdownToElement(element: HTMLElement) {
        element.appendChild(this._countdownContainer);
    }

    addTextLinkIconChoice(behaviourElement: HTMLElement, id: string, text: string, src: string, label: string): HTMLDivElement { // eslint-disable-line max-len
        return this._addLinkChoiceContainer(behaviourElement, id, label, text, src);
    }

    addLinkChoiceControl(behaviourElement: HTMLElement, id: string, src: string, label: string): HTMLDivElement { // eslint-disable-line max-len
        return this._addLinkChoiceContainer(behaviourElement, id, label, null, src);
    }

    addTextLinkChoice(behaviourElement: HTMLElement, id: string, text: string, label: string): HTMLDivElement { // eslint-disable-line max-len
        return this._addLinkChoiceContainer(behaviourElement, id, label, text, null);
    }

    _addLinkChoiceContainer(behaviourElement: HTMLElement, id: string, label: string, text: ?string, src: ?string) { // eslint-disable-line max-len
        this._numChoices += 1;

        if (this._numChoices > 8) {
            behaviourElement.classList.remove('tworow');
            behaviourElement.classList.add('threerow');
        } else if (this._numChoices >= 4) {
            behaviourElement.classList.remove('threerow');
            behaviourElement.classList.add('tworow');
        } else {
            behaviourElement.classList.remove('tworow');
            behaviourElement.classList.remove('threerow');
        }

        const linkChoiceControl = document.createElement('div');
        const containerPromise = new Promise((resolve) => {
            linkChoiceControl.classList.add('romper-link-control');
            linkChoiceControl.classList.add('noselect');
            linkChoiceControl.classList.add(`romper-link-choice-${id}`);
            linkChoiceControl.setAttribute('aria-label', label);

            linkChoiceControl.setAttribute('data-link-choice', 'inactive');

            const iconContainer = document.createElement('div');
            const choiceClick = () => {
                
                this.emit(PlayerEvents.LINK_CHOSEN, { id, behaviourId: behaviourElement.id  });
                this._logUserInteraction(
                    AnalyticEvents.names.LINK_CHOICE_CLICKED,
                    null,
                    id,
                    { label, text, },
                );
            };
            iconContainer.onclick = choiceClick;
            iconContainer.addEventListener(
                'touchend',
                choiceClick,
            );

            linkChoiceControl.appendChild(iconContainer);
            if (text && src) {
                const linkChoiceIconSrc = (src !== '' ? src : this._assetUrls.noAssetIconUrl);
                const iconElement = document.createElement('div');
                iconElement.className = 'romper-link-icon-container'
                linkChoiceControl.classList.add('icon');
                linkChoiceControl.classList.add('text');
                iconContainer.appendChild(iconElement);
                const { style } = iconElement;
                // @flowignore
                style.backgroundImage = `url(${linkChoiceIconSrc})`;
                style.backgroundSize = 'cover';
                style.backgroundRepeat = 'no-repeat';
                style.backgroundPosition = 'center';
                const iconTextPar = document.createElement('p');
                iconTextPar.textContent = text;
                iconTextPar.className = 'romper-link-text-icon';
                iconContainer.appendChild(iconTextPar);
            } else if (text) {
                iconContainer.className = 'romper-text-link-container';
                linkChoiceControl.classList.add('text');
                const iconTextPar = document.createElement('p');
                iconTextPar.textContent = text;
                iconTextPar.className = 'romper-link-text-icon';
                iconContainer.appendChild(iconTextPar);
            } else {
                iconContainer.className = 'romper-link-icon-container';
                linkChoiceControl.classList.add('icon');
                const linkChoiceIconSrc = (src !== '' ? src : this._assetUrls.noAssetIconUrl);
                const { style } = iconContainer;
                // @flowignore
                style.backgroundImage = `url(${linkChoiceIconSrc})`;
                style.backgroundSize = 'cover';
                style.backgroundRepeat = 'no-repeat';
                style.backgroundPosition = 'center';
            }
            resolve({
                icon: linkChoiceControl,
                uuid: id,
            });
        });

        this._choiceIconSet[id] = containerPromise;
        return linkChoiceControl;
    }

    hideChoiceIcons(){
        this._buttons.classList.add('icons-showing');
        this._overlays.classList.add('romper-inactive');
    }

    // show the choice icons
    // make the one linking to activeLinkId NE highlighted
    // optionally apply a class to the overlay
    showChoiceIcons(activeLinkId: ?string, overlayClass: ?string, behaviourOverlay: Object, choiceCount: number) { // eslint-disable-line max-len
        this._hideRomperButtons();
        const behaviourElement = behaviourOverlay.overlay
        this._buttons.classList.add('icons-showing');
        behaviourElement.classList.remove('romper-inactive');
        behaviourElement.classList.add(`choices-${choiceCount}`);
        behaviourElement.classList.add(`count-${choiceCount}`);
        const promisesArray = [];
        Object.keys(this._choiceIconSet).forEach((id) => {
            promisesArray.push(this._choiceIconSet[id]);
        });
        if (overlayClass && !(overlayClass in behaviourElement.classList)) {
            behaviourElement.classList.add(overlayClass);
        }
        return Promise.all(promisesArray).then((icons) => {
            icons.forEach((iconObj, id) => {
                const { icon, uuid } = iconObj;
                if (activeLinkId && uuid === activeLinkId) {
                    icon.classList.add('default');
                }
                const clickHandler = () => {
                    // set classes to show which is selected
                    behaviourOverlay.setActive(`${id}`);
                };
                icon.onclick = clickHandler;
                icon.addEventListener('touchend', clickHandler);
                behaviourOverlay.add(id, icon);
                if(behaviourElement){
                    behaviourElement.appendChild(icon);
                }
            });
        });
    }

    // eslint-disable-next-line class-methods-use-this
    getActiveChoiceIcon(): ?HTMLDivElement {
        return document.querySelectorAll('[data-link-choice="active"]')[0];
    }

    // start animation to reflect choice remaining
    startChoiceCountdown(currentRenderer: BaseRenderer) {
        if (this._choiceCountdownTimeout) {
            clearTimeout(this._choiceCountdownTimeout);
        }
        if (this._countdownTotal === 0) {
            let { remainingTime } = currentRenderer.getCurrentTime();
            if (!remainingTime) {
                remainingTime = 3; // default if we can't find out
            }
            this._countdownTotal = remainingTime;
        }
        this._choiceCountdownTimeout = setTimeout(() => {
            this.reflectTimeout(currentRenderer);
        }, 10);
        this._countdownContainer.classList.add('show');
        // }
    }

    reflectTimeout(currentRenderer: BaseRenderer) {
        const { remainingTime } = currentRenderer.getCurrentTime();
        const { style } = this._countdowner;
        const percentRemain = 100 * (remainingTime / this._countdownTotal);
        if (percentRemain > 0) {
            style.width = `${percentRemain}%`;
            style.marginLeft = `${(100 - percentRemain)/2}%`;
            this._choiceCountdownTimeout = setTimeout(() => {
                this.reflectTimeout(currentRenderer);

            }, 10);
        } else {
            clearTimeout(this._choiceCountdownTimeout);
            this._choiceCountdownTimeout = null;
            this._countdownTotal = 0;
            style.width = '0';
            style.marginLeft = '49%';
        }
    }

    activateRepresentationControl(id: string) {
        this._representation.removeClass(id, 'romper-control-disabled');
    }

    deactivateRepresentationControl(id: string) {
        this._representation.addClass(id, 'romper-control-disabled');
    }

    removeRepresentationControl(id: string) {
        this._representation.remove(id);
    }

    addIconControl(
        id: string,
        src: string,
        selected: boolean = false,
        representationName: string,
        labelString: ?string,
    ) {
        const iconControl = document.createElement('div');
        iconControl.classList.add('romper-icon-control');

        const icon = document.createElement('img');
        if (src !== '') {
            icon.src = src;
        } else {
            icon.src = this._assetUrls.noAssetIconUrl;
        }

        icon.classList.add('romper-icon');
        if (labelString) {
            icon.classList.add(`romper-icon-choice-${labelString}`);
        }
        icon.setAttribute('title', representationName);
        icon.setAttribute('aria-label', representationName);
        icon.setAttribute('draggable', 'false');
        if (selected) {
            icon.classList.add('romper-selected');
        }
        const iconClick = () => {
            this.emit(PlayerEvents.ICON_CLICKED, { id });
            this._icon.deactivateOverlay();
            this._icon.setButtonClass(id);
            this._logUserInteraction(AnalyticEvents.names.CHANGE_CHAPTER_BUTTON_CLICKED, null, id);
        };

        icon.onclick = iconClick;
        icon.addEventListener(
            'touchend',
            handleButtonTouchEvent(iconClick),
        );

        iconControl.appendChild(icon);

        if (labelString) {
            const label = document.createElement('span');
            label.classList.add('romper-icon-label');
            label.classList.add(`romper-icon-label-${labelString}`);
            label.textContent = labelString;
            iconControl.appendChild(label);
        }

        this._icon.add(id, iconControl);
    }

    setIconControl(id: string, src: string, selected: boolean = false) {
        const iconControl = this._icon.get(id);

        if (iconControl) {
            if (selected) {
                iconControl.classList.remove('romper-control-unselected');
                iconControl.classList.add('romper-control-selected');
            } else {
                iconControl.classList.add('romper-control-unselected');
                iconControl.classList.remove('romper-control-selected');
            }
            const icon = iconControl.children[0];
            if (src !== '') {
                icon.src = src;
            } else {
                icon.src = this._assetUrls.noAssetIconUrl;
            }
        }
    }

    setActiveRepresentationControl(id: string) {
        this._representation.setActive(id);
    }

    enterCompleteBehavourPhase() {
        this._logRendererAction(AnalyticEvents.names.COMPLETE_BEHAVIOUR_PHASE_STARTED);
        this.disableScrubBar();
        this.disablePlayButton();
        this.disableRepresentationControl();
    }

    enterStartBehaviourPhase(renderer: BaseRenderer) {
        this.setCurrentRenderer(renderer);
        this._logRendererAction(AnalyticEvents.names.START_BEHAVIOUR_PHASE_STARTED);
    }

    exitStartBehaviourPhase() {
        this._logRendererAction(AnalyticEvents.names.START_BEHAVIOUR_PHASE_ENDED);
        this.enableControls();
        this.showSeekButtons();
        this.enablePlayButton();
        this.enableScrubBar();
        this.enableRepresentationControl();
    }


    enableLinkChoiceControl() {
        const linkChoice = this.getLinkChoiceElement()[0];
        linkChoice.classList.remove('romper-inactive');
    }

    disableLinkChoiceControl() {
        const linkChoice = this.getLinkChoiceElement()[0];
        linkChoice.classList.add('romper-inactive');
    }

    hideScrubBar() {
        this._scrubBar.style.display = 'none';
    }

    showScrubBar() {
        this._scrubBar.style.display = 'block';
    }


    resetControls() {
        // this.clearLinkChoices();
        this.enableControls();
        this._hideAllOverlays();
    }

    clearLinkChoices() {
        this._numChoices = 0;
        this._choiceIconSet = {};
        if (this._choiceCountdownTimeout) {
            clearTimeout(this._choiceCountdownTimeout);
            this._choiceCountdownTimeout = null;
            this._countdownTotal = 0;
            this._countdownContainer.classList.remove('show');
        }
        this._buttons.classList.remove('icons-showing');
        const linkChoices = this.getLinkChoiceElement(true);
        linkChoices.forEach((linkChoice) => {
            linkChoice.style.setProperty('animation', 'none');
            // eslint-disable-next-line no-param-reassign
            linkChoice.className =
                'romper-overlay romper-link-choice-overlay romper-inactive';
        });
    }

    // eslint-disable-next-line class-methods-use-this
    getLinkChoiceElement(full: ?boolean): [HTMLElement] {
        const linkChoices = document.querySelectorAll('[data-behaviour="link-choice"]');
        return full? linkChoices : [linkChoices[0]];
    }

    enableRepresentationControl() {
        this._representation.button.removeAttribute('disabled');
        this._representation.button.classList.remove('romper-control-disabled');
    }

    disableRepresentationControl() {
        this._representation.button.setAttribute('disabled', 'true');
        this._representation.button.classList.add('romper-control-disabled');
    }

    disableControls() {
        this._controlsDisabled = true;
    }

    enableControls() {
        this._controlsDisabled = false;
    }

    // eslint-disable-next-line class-methods-use-this
    showSeekButtons() {
        const nonEssential = document.querySelectorAll('[data-required-controls="false"]');
        nonEssential.forEach(control => {
            // eslint-disable-next-line no-param-reassign
            control.style.display = 'block';
        });
    }

    enableScrubBar() {
        this._scrubBar.removeAttribute('disabled');
        this._scrubBar.classList.remove('romper-control-disabled');
    }

    disableScrubBar() {
        this._scrubBar.setAttribute('disabled', 'true');
        this._scrubBar.classList.add('romper-control-disabled');
    }

    disconnectScrubBar(renderer: BaseRenderer) {
        if (renderer !== this._currentRenderer) {
            return;
        }
        if (this._scrubBar) {
            const scrubBar = this._scrubBar;
            // Remove event listeners on scrub bar by cloning and replacing old scrubBar
            const newScrubBar = scrubBar.cloneNode(true);
            this._buttons.replaceChild(newScrubBar, scrubBar);
            this._scrubBar = newScrubBar;
        }
        if (this._scrubTimePoller) {
            clearInterval(this._scrubTimePoller);
            this._scrubTimePoller = null;
        }
    }

    connectScrubBar(renderer: BaseRenderer) {
        const scrubBar = this._scrubBar;

        let isSyncing = false; // do we need to wait for everything to sync?

        const scrubBarChangeFunc = () => {
            // Calculate the new time
            const { duration } = renderer.getCurrentTime();
            const time = duration * (parseInt(scrubBar.value, 10) / 100);
            isSyncing = true;
            renderer.setCurrentTime(time);

            // Don't spam analtics with lots of changes
            // Wait 1 second after volume stops changing before sending analytics
            if (this._scrubbedEventTimeout) {
                clearTimeout(this._scrubbedEventTimeout);
            }
            this._scrubbedEventTimeout = setTimeout(() => {
                this._logUserInteraction(
                    AnalyticEvents.names.VIDEO_SCRUBBED,
                    null,
                    time.toString(),
                );
            }, 1000);
        };

        // update scrub bar position as media plays
        scrubBar.oninput = scrubBarChangeFunc;
        scrubBar.onchange = scrubBarChangeFunc;

        // allow clicking the scrub bar to seek to a media position
        scrubBar.addEventListener('click', (e: MouseEvent) => {
            isSyncing = true;
            const percent = e.offsetX / scrubBar.offsetWidth;
            const { duration } = renderer.getCurrentTime();
            // Update the media time
            const newTime = percent * duration;
            renderer.setCurrentTime(newTime);
        });
        
        let isDragging = false;
        // Pause the media when the slider handle is being dragged
        scrubBar.addEventListener('mousedown', () => {
            isDragging = true;
        });

        // Play the media when the slider handle is dropped (if it was previously playing)
        scrubBar.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // clear any existing polling
        if (this._scrubTimePoller) clearInterval(this._scrubTimePoller);

        // Update the seek bar as the media plays
        this._scrubTimePoller = setInterval(
            () => {
                const { currentTime, duration, timersSyncing } = renderer.getCurrentTime();
                const value = ((100 / duration) * currentTime);
                // Update the slider value
                if (!(isDragging || isSyncing)) {
                    scrubBar.value = value.toString();
                }
                if (isSyncing && !timersSyncing) {
                    isSyncing = false;
                }
            },
            200,
        );
    }

    static _formatTime(time: number): string {
        let seconds = parseInt(time, 10);
        if (Number.isNaN(seconds)) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        seconds %= 60;
        seconds = seconds < 10 ? `0${seconds}` : seconds;
        return `${minutes}:${seconds}`;
    }

    disablePlayButton() {
        this._playPauseButton.classList.add('romper-control-disabled');
        this._playPauseButton.setAttribute('disabled', 'true');
    }

    enablePlayButton() {
        this._playPauseButton.classList.remove('romper-control-disabled');
        this._playPauseButton.removeAttribute('disabled');
    }

    removeIconControl(id: string) {
        this._icon.remove(id);
    }

    setPlaying(isPlaying: boolean) {
        if (isPlaying) {
            this._playPauseButton.classList.add('romper-pause-button');
            this._playPauseButton.classList.remove('romper-play-button');
        } else {
            this._playPauseButton.classList.add('romper-play-button');
            this._playPauseButton.classList.remove('romper-pause-button');
        }
    }

    setNextAvailable(isNextAvailable: boolean) {
        if (isNextAvailable) {
            this._nextButton.classList.remove('romper-unavailable');
        } else {
            this._nextButton.classList.add('romper-unavailable');
        }
    }

    setBackAvailable(isBackAvailable: boolean) {
        if (isBackAvailable) {
            this._backButton.classList.remove('romper-unavailable');
        } else {
            this._backButton.classList.add('romper-unavailable');
        }
    }

    _applyExitFullscreenBehaviour(behaviour: Object, callback: () => mixed) {
        if (Player._isFullScreen()) {
            this._exitFullScreen();
        }
        scrollToTop();
        callback();
    }

    _toggleFullScreen(): void {
        if (Player._isFullScreen()) {
            this._logUserInteraction(
                AnalyticEvents.names.FULLSCREEN_BUTTON_CLICKED,
                'fullscreen',
                'not-fullscreen',
            );
            this._exitFullScreen();
        } else {
            this._logUserInteraction(
                AnalyticEvents.names.FULLSCREEN_BUTTON_CLICKED,
                'not-fullscreen',
                'fullscreen',
            );
            this._enterFullScreen();
        }
    }

    static _isFullScreen() {
        let isFullScreen = false;
        if ((document: any).fullscreenElement) {
            isFullScreen = ((document: any).fullscreenElement != null);
        }
        if ((document: any).webkitFullscreenElement) {
            isFullScreen = isFullScreen || ((document: any).webkitFullscreenElement != null);
        }
        if ((document: any).mozFullScreenElement) {
            isFullScreen = isFullScreen || ((document: any).mozFullScreenElement != null);
        }
        if ((document: any).msFullscreenElement) {
            isFullScreen = isFullScreen || ((document: any).msFullscreenElement != null);
        }
        if (document.getElementsByClassName('romper-target-fullscreen').length > 0) {
            isFullScreen = true;
        }
        return isFullScreen;
    }

    _enterFullScreen() {
        this._buttons.classList.add('romper-buttons-fullscreen');
        this._player.classList.add('romper-player-fullscreen');

        if (this._playerParent.requestFullscreen) {
            // @flowignore
            this._playerParent.requestFullscreen();
        } else if ((this._playerParent: any).mozRequestFullScreen) {
            // @flowignore
            this._playerParent.mozRequestFullScreen(); // Firefox
        } else if ((this._playerParent: any).webkitRequestFullscreen) {
            // @flowignore
            this._playerParent.webkitRequestFullscreen(); // Chrome and Safari
        } else {
            window.scrollTo(0, 1);
            this._playerParent.classList.add('romper-target-fullscreen'); // iOS
        }

        this._inFullScreen = false;
        // if we are an iphone capture these events;
        if(BrowserUserAgent.iOS()) {
            this._playerParent.addEventListener('touchmove', preventEventDefault);
        }
        document.addEventListener('webkitfullscreenchange', this._handleFullScreenChange);
        document.addEventListener('mozfullscreenchange', this._handleFullScreenChange);
        document.addEventListener('fullscreenchange', this._handleFullScreenChange);
        document.addEventListener('MSFullscreenChange', this._handleFullScreenChange);
    }


    _handleFullScreenChange() {
        if (!Player._isFullScreen()) {
            this._buttons.classList.remove('romper-buttons-fullscreen');
            this._player.classList.remove('romper-player-fullscreen');

            document.removeEventListener('webkitfullscreenchange', this._handleFullScreenChange);
            document.removeEventListener('mozfullscreenchange', this._handleFullScreenChange);
            document.removeEventListener('fullscreenchange', this._handleFullScreenChange);
            document.removeEventListener('MSFullscreenChange', this._handleFullScreenChange);
        }
    }

    _exitFullScreen() {
        this._buttons.classList.remove('romper-buttons-fullscreen');
        this._player.classList.remove('romper-player-fullscreen');
        // || document.webkitIsFullScreen);
        if ((document: any).exitFullscreen) {
            // @flowignore
            document.exitFullscreen();
        } else if ((document: any).mozCancelFullScreen) {
            // @flowignore
            document.mozCancelFullScreen(); // Firefox
        } else if ((document: any).webkitExitFullscreen) {
            // @flowignore
            document.webkitExitFullscreen(); // Chrome and Safari
        } else if ((document: any).msExitFullscreen) {
            // @flowignore
            document.msExitFullscreen(); // Chrome and Safari
        } else {
            this._playerParent.classList.remove('romper-target-fullscreen'); // iOS
        }
        scrollToTop();

        if(BrowserUserAgent.iOS()) {
            this._playerParent.removeEventListener('touchmove', preventEventDefault);
        }
        document.removeEventListener('webkitfullscreenchange', this._handleFullScreenChange);
        document.removeEventListener('mozfullscreenchange', this._handleFullScreenChange);
        document.removeEventListener('fullscreenchange', this._handleFullScreenChange);
        document.removeEventListener('MSFullscreenChange', this._handleFullScreenChange);
    }
}

export default Player;
export { PlayerEvents };
