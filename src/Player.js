// @flow
import EventEmitter from 'events';
import AnalyticEvents from './AnalyticEvents';
import type { AnalyticsLogger, AnalyticEventName } from './AnalyticEvents';
import type { AssetUrls } from './romper';
import BasePlayoutEngine from './playoutEngines/BasePlayoutEngine';
import DOMSwitchPlayoutEngine from './playoutEngines/DOMSwitchPlayoutEngine';
import SrcSwitchPlayoutEngine from './playoutEngines/SrcSwitchPlayoutEngine';
import logger from './logger';
import { BrowserUserAgent } from './browserCapabilities';
import BaseRenderer from './renderers/BaseRenderer';

const PLAYOUT_ENGINES = {
    SRC_SWITCH_PLAYOUT: 'src',
    DOM_SWITCH_PLAYOUT: 'dom',
};

const PlayerEvents = [
    'VOLUME_CHANGED',
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

function scrollToTop() {
    window.setTimeout(() => {
        window.scrollTo(0, 0);
        if (
            document.getElementsByClassName('taster-offsite-panel').length > 0 &&
            document.getElementsByClassName('taster-offsite-panel')[0].scrollIntoView
        ) {
            document.getElementsByClassName('taster-offsite-panel')[0].scrollIntoView();
        } else if (
            document.getElementsByClassName('offsite-panel').length > 0 &&
            document.getElementsByClassName('offsite-panel')[0].scrollIntoView
        ) {
            document.getElementsByClassName('offsite-panel')[0].scrollIntoView();
        }
    }, 100);
}

function handleButtonTouchEvent(callback: Function) {
    return (event: Object) => {
        // Stop propagation of touch event.
        event.stopPropagation();
        // Stop click events on tablets being fired off for this touch.
        event.preventDefault();
        // Call action for this event
        callback();
    };
}

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

    const add = (id: string, el: HTMLElement, label?: string) => {
        elements[id] = el;
        if (label) {
            labels[label] = id;
        }
        el.classList.add('romper-control-unselected');
        overlay.appendChild(el);
        button.classList.remove('romper-inactive');
    };

    const get = (id: string) => elements[id];

    const getIdForLabel = (label: string) => {
        if (labels[label]) {
            return labels[label];
        }
        return null;
    };

    const remove = (id: string) => {
        if (elements[id]) {
            overlay.removeChild(elements[id]);
            delete elements[id];
            if (Object.keys(elements).length === 0) {
                button.classList.add('romper-inactive');
            }
        }
    };

    const setActive = (id: string) => {
        activeIconId = id;
        Object.keys(elements).forEach((key) => {
            if (key === id) {
                elements[key].classList.add('romper-control-selected');
                elements[key].classList.remove('romper-control-unselected');
                elements[key].classList.remove('default');
            } else {
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
        Object.keys(elements).forEach((key) => {
            overlay.removeChild(elements[key]);
            delete elements[key];
            delete labels[key];
        });
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
    };
}

class Player extends EventEmitter {
    playoutEngine: BasePlayoutEngine

    _player: HTMLDivElement;

    _playerParent: HTMLElement;

    _backgroundLayer: HTMLDivElement;

    _mediaLayer: HTMLDivElement;

    _guiLayer: HTMLDivElement;

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

    _startExperienceImage: HTMLImageElement;

    _repeatButton: HTMLButtonElement;

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

    _backRepeatTimeout: TimeoutID;

    _RomperButtonsShowing: boolean;

    _userInteractionStarted: boolean;

    _numChoices: number;

    removeExperienceStartButtonAndImage: Function;

    _handleFullScreenChange: Function;

    resetRepeatBackButton: Function;

    _choiceIconSet: { [key: string]: Promise<Object> };

    _choiceCountdownTimeout: ?TimeoutID;

    _countdowner: HTMLDivElement;

    _countdownContainer: HTMLDivElement;

    _countdownTotal: number;

    _dogImage: HTMLImageElement;

    _debugDisplay: boolean;

    constructor(target: HTMLElement, analytics: AnalyticsLogger, assetUrls: AssetUrls) {
        super();

        this._numChoices = 0;
        this._choiceIconSet = {};
        this._volumeEventTimeouts = {};
        this._RomperButtonsShowing = false;
        this._countdownTotal = 0;

        this._userInteractionStarted = false;

        this.showingSubtitles = false;

        this._analytics = analytics;
        this._assetUrls = assetUrls;

        const debugDisplay = new URLSearchParams(window.location.search).get('debugPlayout');
        if (debugDisplay) {
            this._debugDisplay = true;
            logger.info('Player display in debug mode');
        } else {
            this._debugDisplay = false;
        }

        this._logUserInteraction = this._logUserInteraction.bind(this);
        this.resetRepeatBackButton = this.resetRepeatBackButton.bind(this);

        this._player = document.createElement('div');
        this._player.classList.add('romper-player');

        this._playerParent = target;

        this._backgroundLayer = document.createElement('div');
        this._backgroundLayer.classList.add('romper-background');

        this._mediaLayer = document.createElement('div');
        this._mediaLayer.classList.add('romper-media');

        const loadingLayer = document.createElement('div');
        loadingLayer.classList.add('romper-loading');
        const loadingLayerInner = document.createElement('div');
        loadingLayerInner.classList.add('romper-loading-inner');
        loadingLayer.appendChild(loadingLayerInner);
        this._mediaLayer.appendChild(loadingLayer);

        this._guiLayer = document.createElement('div');
        this._guiLayer.classList.add('romper-gui');

        this._player.appendChild(this._backgroundLayer);
        this._player.appendChild(this._mediaLayer);
        this._player.appendChild(this._guiLayer);

        this._overlays = document.createElement('div');
        this._overlays.classList.add('romper-overlays');
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

        this._narrativeElementTransport = document.createElement('div');
        this._narrativeElementTransport.classList.add('romper-narrative-element-transport');

        this._backButton = document.createElement('button');
        this._backButton.classList.add('romper-button');
        this._backButton.classList.add('romper-back-button');
        this._backButton.classList.add('romper-inactive');
        this._backButton.setAttribute('title', 'Back Button');
        this._backButton.setAttribute('aria-label', 'Back Button');
        const backButtonIconDiv = document.createElement('div');
        backButtonIconDiv.classList.add('romper-button-icon-div');
        backButtonIconDiv.classList.add('romper-back-button-icon-div');
        this._backButton.appendChild(backButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._backButton);

        this._repeatButton = document.createElement('button');
        this._repeatButton.classList.add('romper-button');
        this._repeatButton.classList.add('romper-repeat-button');
        // this._repeatButton.classList.add('romper-inactive');
        this._repeatButton.setAttribute('title', 'Repeat Button');
        this._repeatButton.setAttribute('aria-label', 'Repeat Button');
        const repeatButtonIconDiv = document.createElement('div');
        repeatButtonIconDiv.classList.add('romper-button-icon-div');
        // repeatButtonIconDiv.classList.add('romper-repeat-button-icon-div');
        this._repeatButton.appendChild(repeatButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._repeatButton);

        this._seekBackButton = document.createElement('button');
        this._seekBackButton.classList.add('romper-button');
        this._seekBackButton.classList.add('romper-seek-back-button');
        // this._seekBackButton.classList.add('romper-inactive');
        this._seekBackButton.setAttribute('title', 'Seek Back Button');
        this._seekBackButton.setAttribute('aria-label', 'Seek Back Button');
        const seekBackButtonIconDiv = document.createElement('div');
        seekBackButtonIconDiv.classList.add('romper-button-icon-div');
        // seekBackButtonIconDiv.classList.add('romper-back-button-icon-div');
        this._seekBackButton.appendChild(seekBackButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._seekBackButton);

        this._playPauseButton = document.createElement('button');
        this._playPauseButton.classList.add('romper-button');
        this._playPauseButton.classList.add('romper-play-button');
        this._playPauseButton.setAttribute('title', 'Play Pause Button');
        this._playPauseButton.setAttribute('aria-label', 'Play Pause Button');
        const playPauseButtonIconDiv = document.createElement('div');
        playPauseButtonIconDiv.classList.add('romper-button-icon-div');
        // playPauseButtonIconDiv.classList.add('romper-play-button-icon-div');
        this._playPauseButton.appendChild(playPauseButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._playPauseButton);

        this._seekForwardButton = document.createElement('button');
        this._seekForwardButton.classList.add('romper-button');
        this._seekForwardButton.classList.add('romper-seek-fwd-button');
        // this._seekForwardButton.classList.add('romper-inactive');
        this._seekForwardButton.setAttribute('title', 'Seek Forward Button');
        this._seekForwardButton.setAttribute('aria-label', 'Seek Forward Button');
        const seekForwardButtonIconDiv = document.createElement('div');
        seekForwardButtonIconDiv.classList.add('romper-button-icon-div');
        // seekForwardButtonIconDiv.classList.add('romper-back-button-icon-div');
        this._seekForwardButton.appendChild(seekForwardButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._seekForwardButton);

        this._nextButton = document.createElement('button');
        this._nextButton.classList.add('romper-button');
        this._nextButton.classList.add('romper-next-button');
        this._nextButton.setAttribute('title', 'Next Button');
        this._nextButton.setAttribute('aria-label', 'Next Button');
        this._narrativeElementTransport.appendChild(this._nextButton);
        const nextButtonIconDiv = document.createElement('div');
        nextButtonIconDiv.classList.add('romper-button-icon-div');
        // nextButtonIconDiv.classList.add('romper-next-button-icon-div');
        this._nextButton.appendChild(nextButtonIconDiv);

        this._guiLayer.appendChild(this._overlays);
        // this._guiLayer.appendChild(this._narrativeElementTransport);
        this._guiLayer.appendChild(this._buttons);
        this._guiLayer.appendChild(this._buttonsActivateArea);

        this._scrubBar = document.createElement('input');
        this._scrubBar.setAttribute('title', 'Seek bar');
        this._scrubBar.setAttribute('aria-label', 'Seek bar');
        this._scrubBar.type = 'range';
        this._scrubBar.value = '0';
        this._scrubBar.className = 'romper-scrub-bar';
        if (this._debugDisplay) {
            this._scrubBar.classList.add('debug');
        }
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
        // this._guiLayer.appendChild(this._overlayToggleButtons);
        mediaTransportRight.appendChild(this._overlayToggleButtons);

        this._volume = createOverlay('volume', this._logUserInteraction);
        // this._overlays.appendChild(this._volume.overlay);
        mediaTransportLeft.appendChild(this._volume.overlay);
        mediaTransportLeft.appendChild(this._volume.button);

        this._representation = createOverlay('representation', this._logUserInteraction);
        this._overlays.appendChild(this._representation.overlay);
        this._overlayToggleButtons.appendChild(this._representation.button);

        this._icon = createOverlay('icon', this._logUserInteraction);
        this._overlays.appendChild(this._icon.overlay);
        this._overlayToggleButtons.appendChild(this._icon.button);

        this._linkChoice = createOverlay('link-choice', this._logUserInteraction);
        this._overlays.appendChild(this._linkChoice.overlay);
        // no need for toggle button
        this._countdownContainer = document.createElement('div');
        this._countdownContainer.classList.add('romper-ux-divider');
        this._linkChoice.overlay.appendChild(this._countdownContainer);
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
        this._overlays.onclick = this._hideAllOverlays.bind(this);

        this._backButton.onclick = this._backButtonClicked.bind(this);
        this._backButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._backButtonClicked.bind(this)),
        );

        this._repeatButton.onclick = this._repeatButtonClicked.bind(this);
        this._repeatButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._repeatButtonClicked.bind(this)),
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

        document.addEventListener('keydown', this._handleKeyboardEvent.bind(this));
        this._player.addEventListener('touchend', this._handleTouchEndEvent.bind(this));

        this._buttonsActivateArea.onmouseenter = this._showRomperButtons.bind(this);
        this._buttonsActivateArea.onmousemove = this._showRomperButtons.bind(this);
        this._buttons.onmouseleave = this._hideRomperButtons.bind(this);

        this.removeExperienceStartButtonAndImage =
            this.removeExperienceStartButtonAndImage.bind(this);

        let playoutToUse = 'dom';

        if (BrowserUserAgent.iOS()) {
            playoutToUse = 'src';
        }

        const overridePlayout = new URLSearchParams(window.location.search).get('overridePlayout');
        if (overridePlayout) {
            playoutToUse = overridePlayout;
            logger.info("Overriding playout engine: ",playoutToUse)
        }

        let debugPlayout = false
        const overrideDebug = new URLSearchParams(window.location.search).get('debugPlayout');
        if (overrideDebug && overrideDebug === "true") {
            debugPlayout = true
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
        default:
            logger.fatal('Invalid Playout Engine');
            throw new Error('Invalid Playout Engine');
        }
    }

    addDog(src: string, position: Object) {
        if (this._dogImage === undefined) {
            this._dogImage = document.createElement('img');
        }
        this._dogImage.className = 'romper-dog';
        this._dogImage.src = src;
        this._player.appendChild(this._dogImage);
        const { top, left, width, height } = position;
        this._dogImage.style.top = `${top}%`;
        this._dogImage.style.left = `${left}%`;
        this._dogImage.style.width = `${width}%`;
        this._dogImage.style.height = `${height}%`;
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

    _handleKeyboardEvent(event: Object) {
        if (event.code === 'Escape') {
            if (this._RomperButtonsShowing) this._hideRomperButtons();
        } else if (!this._RomperButtonsShowing) {
            this._showRomperButtons();
            this._showRomperButtonsTimeout = setTimeout(() => {
                this._hideRomperButtons();
            }, 5000);
        }
    }

    _showRomperButtons() {
        this._logRendererAction(AnalyticEvents.names.BUTTONS_ACTIVATED);
        this._RomperButtonsShowing = true;
        this._buttons.classList.add('show');
        this._narrativeElementTransport.classList.add('show');
        this._buttonsActivateArea.classList.add('hide');
    }

    _hideRomperButtons() {
        if (this._showRomperButtonsTimeout) clearTimeout(this._showRomperButtonsTimeout);
        this._logRendererAction(AnalyticEvents.names.BUTTONS_DEACTIVATED);
        this._RomperButtonsShowing = false;
        this._buttons.classList.remove('show');
        this._narrativeElementTransport.classList.remove('show');
        this._buttonsActivateArea.classList.remove('hide');
    }

    addExperienceStartButtonAndImage(options: Object) {
        this._startExperienceButton = document.createElement('button');
        this._startExperienceButton.classList.add(options.button_class);
        this._startExperienceButton.setAttribute('title', 'Continue Button');
        this._startExperienceButton.setAttribute('aria-label', 'Continue Button');
        const continueButtonIconHolder = document.createElement('div');
        this._startExperienceButton.appendChild(continueButtonIconHolder);
        continueButtonIconHolder.classList.add('romper-start-button-icon');
        const continueButtonIconDiv = document.createElement('div');
        continueButtonIconDiv.classList.add('romper-button-icon-div');
        continueButtonIconDiv.classList.add(`${options.button_class}-icon-div`);
        continueButtonIconHolder.appendChild(continueButtonIconDiv);

        this._startExperienceImage = document.createElement('img');
        this._startExperienceImage.className = 'romper-start-image';
        this._startExperienceImage.src = options.background_art;

        this._guiLayer.appendChild(this._startExperienceButton);
        this._mediaLayer.appendChild(this._startExperienceImage);
        this._mediaLayer.classList.add('romper-prestart');

        const buttonClickHandler = () => {
            this.removeExperienceStartButtonAndImage();
            this._enableUserInteraction();
            this._narrativeElementTransport.classList.remove('romper-inactive');
            this._logUserInteraction(AnalyticEvents.names.BEHAVIOUR_CONTINUE_BUTTON_CLICKED);
        };

        this._startExperienceButton.onclick = buttonClickHandler;

        if (options.hide_narrative_buttons) {
            // can't use player.setNextAvailable
            // as this may get reset after this by NE change handling
            this._narrativeElementTransport.classList.add('romper-inactive');
        }
    }

    _clearOverlays() {
        this._icon.clearAll();
        this._representation.clearAll();
        this._volume.clearAll();
        this._linkChoice.clearAll();
    }

    prepareForRestart() {
        if (this._startExperienceButton || this._startExperienceImage) {
            this.removeExperienceStartButtonAndImage();
        }
        this.playoutEngine.pause();
        this._clearOverlays();
        this._disableUserInteraction();
        logger.info('disabling experience before restart');
    }

    removeExperienceStartButtonAndImage() {
        try {
            this._guiLayer.removeChild(this._startExperienceButton);
            this._mediaLayer.removeChild(this._startExperienceImage);
            this._mediaLayer.classList.remove('romper-prestart');
        } catch (e) {
            logger.warn('could not remove start button and/or image');
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
        this.emit(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED);
    }

    _seekBackwardButtonClicked() {
        this.emit(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED);
    }

    _repeatButtonClicked() {
        // reveal back button and hide this
        this._disableRepeatButton();
        // set timer
        if (this._backRepeatTimeout) {
            clearTimeout(this._backRepeatTimeout);
        }
        // on timer end, hide back button and reveal this
        this._backRepeatTimeout = setTimeout(this.resetRepeatBackButton, 2000);
        this.emit(PlayerEvents.REPEAT_BUTTON_CLICKED);
        this._logUserInteraction(AnalyticEvents.names.REPEAT_BUTTON_CLICKED);
    }

    // hide the repeat button, and show the back button
    resetRepeatBackButton() {
        this._backButton.classList.add('romper-inactive');
        this._repeatButton.classList.remove('romper-inactive');
    }

    // hide the repeat button, and show the back button, AMD make sure repeat doesn't reappear
    // as result of timeout
    disableRepeatButton() {
        // disable repeat, and clear timeout so it stays disabled
        if (this._backRepeatTimeout) {
            clearTimeout(this._backRepeatTimeout);
        }
        this._disableRepeatButton();
    }

    // hide the back button, and show the repeat button
    _disableRepeatButton() {
        this._backButton.classList.remove('romper-inactive');
        this._repeatButton.classList.add('romper-inactive');
    }

    _backButtonClicked() {
        this._hideAllOverlays();
        this.emit(PlayerEvents.BACK_BUTTON_CLICKED);
        this._logUserInteraction(AnalyticEvents.names.BACK_BUTTON_CLICKED);
    }

    _nextButtonClicked() {
        if (!this._userInteractionStarted) {
            this._enableUserInteraction();
        }
        this._hideAllOverlays();
        this.emit(PlayerEvents.NEXT_BUTTON_CLICKED);
        this._logUserInteraction(AnalyticEvents.names.NEXT_BUTTON_CLICKED);
        this.resetRepeatBackButton();
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
        if (this._linkChoice) {
            this._linkChoice.deactivateOverlay();
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
    ) {
        const logData = {
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names[userEventName],
            from: fromId == null ? 'not_set' : fromId,
            to: toId == null ? 'not_set' : toId,
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

    _setVolumeCallback(
        id: string,
        label: string,
        levelSpan: HTMLSpanElement,
        muteButton: HTMLDivElement,
    ) {
        return (event: Object) => {
            const value = parseFloat(event.target.value);
            // eslint-disable-next-line no-param-reassign
            levelSpan.textContent = `${Math.floor(10 * value)}`;
            if (value === 0) {
                muteButton.classList.remove('romper-mute-button');
                muteButton.classList.add('romper-muted-button');
            } else {
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
        const volumeControl = document.createElement('div');
        volumeControl.classList.add('romper-volume-control');
        volumeControl.classList.add(`romper-volume-label-${label.toLowerCase()}`);

        const volumeLabel = document.createElement('div');
        volumeLabel.classList.add('romper-volume-label');
        volumeLabel.textContent = label;

        const controlDiv = document.createElement('div');
        controlDiv.classList.add('romper-control-line');
        const muteDiv = document.createElement('div');
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

        muteDiv.onclick = () => {
            volumeRange.value = '0';
            this._setVolumeCallback(id, label, levelSpan, muteDiv)
                .bind(this)({ target: { value: 0 }});
        }

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

    addTextLinkIconChoice(id: string, text: string, src: string, label: string): HTMLDivElement {
        return this._addLinkChoiceContainer(id, label, text, src);
    }

    addLinkChoiceControl(id: string, src: string, label: string): HTMLDivElement {
        return this._addLinkChoiceContainer(id, label, null, src);
    }

    addTextLinkChoice(id: string, text: string, label: string): HTMLDivElement {
        return this._addLinkChoiceContainer(id, label, text, null);
    }

    _addLinkChoiceContainer(id: string, label: string, text: ?string, src: ?string) {
        this._linkChoice.overlay.classList.remove(`choices-${this._numChoices}`);
        this._numChoices += 1;
        this._linkChoice.overlay.classList.add(`choices-${this._numChoices}`);

        if (this._numChoices >= 4) {
            this._linkChoice.overlay.classList.add('tworow');
        } else {
            this._linkChoice.overlay.classList.remove('tworow');
        }

        const linkChoiceControl = document.createElement('div');
        const containerPromise = new Promise((resolve) => {
            linkChoiceControl.classList.add('romper-link-control');
            linkChoiceControl.classList.add(`romper-link-choice-${id}`);
            linkChoiceControl.setAttribute('title', label);
            linkChoiceControl.setAttribute('aria-label', label);

            const iconContainer = document.createElement('div');
            const choiceClick = () => {
                this.emit(PlayerEvents.LINK_CHOSEN, { id });
                this._logUserInteraction(AnalyticEvents.names.LINK_CHOICE_CLICKED, null, id);
            };
            iconContainer.onclick = choiceClick;
            iconContainer.addEventListener(
                'touchend',
                handleButtonTouchEvent(choiceClick),
            );

            linkChoiceControl.appendChild(iconContainer);
            if (text && src) {
                const linkChoiceIconSrc = (src !== '' ? src : this._assetUrls.noAssetIconUrl);
                const iconElement = document.createElement('div');
                iconElement.className = 'romper-link-icon-container';
                iconContainer.appendChild(iconElement);
                const { style } = iconElement;
                // @flowignore
                style.backgroundImage = `url(${linkChoiceIconSrc})`;
                style.backgroundSize = 'contain';
                style.backgroundRepeat = 'no-repeat';
                style.backgroundPosition = 'center';
                const iconTextPar = document.createElement('p');
                iconTextPar.textContent = text;
                iconTextPar.className = 'romper-link-text-icon';
                iconContainer.appendChild(iconTextPar);
            } else if (text) {
                iconContainer.className = 'romper-text-link-container';
                const iconTextPar = document.createElement('p');
                iconTextPar.textContent = text;
                iconTextPar.className = 'romper-link-text-icon';
                iconContainer.appendChild(iconTextPar);
            } else {
                iconContainer.className = 'romper-link-icon-container';
                const linkChoiceIconSrc = (src !== '' ? src : this._assetUrls.noAssetIconUrl);
                const { style } = iconContainer;
                // @flowignore
                style.backgroundImage = `url(${linkChoiceIconSrc})`;
                style.backgroundSize = 'contain';
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

    // show the choice icons
    // make the one linking to activeLinkId NE highlighted
    // optionally apply a class to the overlay
    showChoiceIcons(activeLinkId: ?string, overlayClass: ?string) {
        this._linkChoice.overlay.classList.remove('romper-inactive');
        const promisesArray = [];
        Object.keys(this._choiceIconSet).forEach((id) => {
            promisesArray.push(this._choiceIconSet[id]);
        });
        if (overlayClass
            && !(overlayClass in this._linkChoice.overlay.classList)) {
            this._linkChoice.overlay.classList.add(overlayClass);
        }
        return Promise.all(promisesArray).then((icons) => {
            icons.forEach((iconObj, id) => {
                const { icon, uuid } = iconObj;
                if (activeLinkId && uuid === activeLinkId) {
                    icon.classList.add('default');
                }
                const clickHandler = () => {
                    // set classes to show which is selected
                    this._linkChoice.setActive(`${id}`);
                };
                icon.onclick = clickHandler;
                this._linkChoice.add(id, icon);
            });
        });
    }

    getActiveChoiceIcon(): ?HTMLDivElement {
        return this._linkChoice.getActive();
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
            style.width = '2%';
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
        this.showRepeatButton();
        this.disableRepresentationControl();
    }

    enterStartBehaviourPhase() {
        this._logRendererAction(AnalyticEvents.names.START_BEHAVIOUR_PHASE_STARTED);
        // this.hideRepeatButton();
    }

    exitStartBehaviourPhase() {
        this._logRendererAction(AnalyticEvents.names.START_BEHAVIOUR_PHASE_ENDED);
        this.enableControls();
        this.enablePlayButton();
        this.enableScrubBar();
        this.enableRepresentationControl();
    }

    enableLinkChoiceControl() {
        this._linkChoice.overlay.classList.remove('romper-inactive');
    }

    disableLinkChoiceControl() {
        this._linkChoice.overlay.classList.add('romper-inactive');
    }

    clearLinkChoices() {
        this._numChoices = 0;
        this._choiceIconSet = {};
        this._linkChoice.clearAll();
        if (this._choiceCountdownTimeout) {
            clearTimeout(this._choiceCountdownTimeout);
            this._choiceCountdownTimeout = null;
            this._countdownTotal = 0;
            this._countdownContainer.classList.remove('show');
        }
        this._linkChoice.overlay.className =
            'romper-overlay romper-link-choice-overlay romper-inactive';
        this._linkChoice.overlay.style.setProperty('animation', 'none');
    }

    getLinkChoiceElement(): HTMLElement {
        return this._linkChoice.overlay;
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
        this._buttonsActivateArea.classList.add('disabled');
    }

    enableControls() {
        this._buttonsActivateArea.classList.remove('disabled');
    }

    enableScrubBar() {
        this._scrubBar.removeAttribute('disabled');
        this._scrubBar.classList.remove('romper-control-disabled');
    }

    disableScrubBar() {
        this._scrubBar.setAttribute('disabled', 'true');
        this._scrubBar.classList.add('romper-control-disabled');
    }

    disconnectScrubBar() {
        if (this._scrubBar) {
            const scrubBar = this._scrubBar;
            // Remove event listeners on scrub bar by cloning and replacing old scrubBar
            const newScrubBar = scrubBar.cloneNode(true);
            this._buttons.replaceChild(newScrubBar, scrubBar);
            this._scrubBar = newScrubBar;
        }
    }

    connectScrubBar(media: HTMLMediaElement) {
        const scrubBar = this._scrubBar;

        const scrubBarChangeFunc = () => {
            // Calculate the new time
            const time = media.duration * (parseInt(scrubBar.value, 10) / 100);
            // Update the media time
            // eslint-disable-next-line no-param-reassign
            media.currentTime = time;

            // Don't spam analtics with lots of volume changes
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
            const percent = e.offsetX / scrubBar.offsetWidth;
            // eslint-disable-next-line no-param-reassign
            media.currentTime = percent * media.duration;
        });

        let wasPlaying = false;
        // Pause the media when the slider handle is being dragged
        scrubBar.addEventListener('mousedown', () => {
            wasPlaying = !media.paused;
            media.pause();
        });

        // Play the media when the slider handle is dropped (if it was previously playing)
        scrubBar.addEventListener('mouseup', () => {
            if (wasPlaying) {
                media.play();
            }
        });

        // Update the seek bar as the media plays
        media.addEventListener('timeupdate', () => {
            // Calculate the slider value
            const value = (100 / media.duration) * media.currentTime;

            // Update the slider value
            scrubBar.value = value.toString();
        });
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

    hideRepeatButton() {
        this._repeatButton.classList.add('romper-inactive');
    }

    enablePlayButton() {
        this._playPauseButton.classList.remove('romper-control-disabled');
        this._playPauseButton.removeAttribute('disabled');
    }

    showRepeatButton() {
        this._repeatButton.classList.remove('romper-inactive');
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
        document.addEventListener('webkitfullscreenchange', this._handleFullScreenChange);
        document.addEventListener('mozfullscreenchange', this._handleFullScreenChange);
        document.addEventListener('fullscreenchange', this._handleFullScreenChange);
        document.addEventListener('MSFullscreenChange', this._handleFullScreenChange);
    }


    _handleFullScreenChange() {
        if (this._inFullScreen) {
            this._exitFullScreen();
        } else if (Player._isFullScreen()) {
            this._inFullScreen = true;
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

        document.removeEventListener('webkitfullscreenchange', this._handleFullScreenChange);
        document.removeEventListener('mozfullscreenchange', this._handleFullScreenChange);
        document.removeEventListener('fullscreenchange', this._handleFullScreenChange);
        document.removeEventListener('MSFullscreenChange', this._handleFullScreenChange);
    }
}

export default Player;
export { PlayerEvents };
