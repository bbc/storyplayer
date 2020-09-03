// @flow
import EventEmitter from 'events';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger, AnalyticEventName } from '../AnalyticEvents';
import Controller from '../Controller';
import type { AssetUrls } from '../romper';
import BasePlayoutEngine from '../playoutEngines/BasePlayoutEngine';
import DOMSwitchPlayoutEngine from '../playoutEngines/DOMSwitchPlayoutEngine';
import IOSPlayoutEngine from '../playoutEngines/iOSPlayoutEngine';
import logger from '../logger';
import { BrowserUserAgent, MediaFormats } from '../browserCapabilities'; // eslint-disable-line max-len
import { PLAYOUT_ENGINES } from '../playoutEngines/playoutEngineConsts'
import BaseRenderer from '../renderers/BaseRenderer';
import { SESSION_STATE } from '../SessionManager';
import {
    getSetting,
    DEBUG_PLAYOUT_FLAG,
    FACEBOOK_BLOCK_FLAG,
    addDetail,
    scrollToTop,
    preventEventDefault,
    handleButtonTouchEvent,
    leftGreaterThanRight
} from '../utils'; // eslint-disable-line max-len
import { REASONER_EVENTS } from '../Events';
import { ButtonEvents } from './BaseButtons';
import Overlay, { OVERLAY_ACTIVATED_EVENT } from './Overlay';
import StandardControls from './StandardControls';
import { ControlEvents } from './BaseControls';

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

    _overlaysElement: HTMLDivElement;

    _overlays: Array<Overlay>;

    _controls: StandardControls;

    _startExperienceButton: HTMLButtonElement;

    _resumeExperienceButton: HTMLButtonElement;

    _startExperienceImage: HTMLImgElement;

    _fullscreenButton: HTMLButtonElement;


    _volume: Object;

    _representation: Object;

    _icon: Object;

    _linkChoice: Object;

    _analytics: AnalyticsLogger;

    _assetUrls: AssetUrls;

    _logUserInteraction: Function;

    _volumeEventTimeouts: Object;

    _userInteractionStarted: boolean;

    _numChoices: number;

    _removeExperienceOverlays: Function;

    setupExperienceOverlays: Function;


    _choiceIconSet: { [key: string]: Promise<Object> };

    _visibleChoices: { [key: number]: HTMLElement };

    _choiceCountdownTimeout: ?TimeoutID;

    _countdowner: HTMLDivElement;

    _countdownContainer: HTMLDivElement;

    _countdownTotal: number;

    _aspectRatio: number;

    _dogImage: HTMLDivElement;

    _details: ?HTMLDivElement

    _loadingLayer: HTMLElement

    _privacyDiv: ?HTMLDivElement;

    _currentRenderer: ?BaseRenderer;

    _showErrorLayer: Function;

    _removeErrorLayer: Function;

    showBufferingLayer: Function;

    removeBufferingLayer: Function;

    _addContinueModal: Function;

    _hideModalLayer: Function;

    _startButtonHandler: Function;

    createBehaviourOverlay: Function;

    _addCountdownToElement: Function;

    _isPausedForBehaviours: boolean;

    _controller: Controller;

    constructor(
        target: HTMLElement,
        analytics: AnalyticsLogger,
        assetUrls: AssetUrls,
        controller: Controller,
    ) {
        super();

        this._playerParent = target;
        this._analytics = analytics;
        this._assetUrls = assetUrls;
        this._controller = controller;

        this._overlays = [];
        this._numChoices = 0;
        this._choiceIconSet = {};
        this._visibleChoices = {}
        this._volumeEventTimeouts = {};
        this._countdownTotal = 0;
        this._userInteractionStarted = false;
        this._aspectRatio = 16 / 9;

        const playoutToUse = MediaFormats.getPlayoutEngine();

        // bind various functions
        this._logUserInteraction = this._logUserInteraction.bind(this);
        this._removeExperienceOverlays = this._removeExperienceOverlays.bind(this);
        this._showErrorLayer = this._showErrorLayer.bind(this);
        this._removeErrorLayer = this._removeErrorLayer.bind(this);
        this.showBufferingLayer = this.showBufferingLayer.bind(this);
        this.removeBufferingLayer = this.removeBufferingLayer.bind(this);
        this._addContinueModal = this._addContinueModal.bind(this);
        this._startButtonHandler = this._startButtonHandler.bind(this);
        this.createBehaviourOverlay = this.createBehaviourOverlay.bind(this);
        this._addCountdownToElement = this._addCountdownToElement.bind(this);


        // add fullscreen handling
        this._toggleFullScreen = this._toggleFullScreen.bind(this);
        this._addFullscreenListeners = this._addFullscreenListeners.bind(this);
        this._handleFullScreenEvent = this._handleFullScreenEvent.bind(this);

        this._addFullscreenListeners();

        this._player = document.createElement('div');
        this._player.classList.add('romper-player');
        this._player.classList.add('noselect');

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

        this._overlaysElement = document.createElement('div');
        this._overlaysElement.classList.add('romper-overlays');
        this._overlaysElement.classList.add('buttons-hidden');

        this._guiLayer.appendChild(this._overlaysElement);

        // Hide gui elements until start clicked
        this._overlaysElement.classList.add('romper-inactive');

        // Create the overlays.
        this._volume = this._createOverlay('volume', this._logUserInteraction);
        this._icon = this._createOverlay('icon', this._logUserInteraction);
        this._representation = this._createOverlay('representation', this._logUserInteraction);

        // create the button manager and scrub bar according to playout engine
        switch (playoutToUse) {
        // case PLAYOUT_ENGINES.SMP_PLAYOUT:
        // SMP connect its own transport buttons and scrub bar
        // this._buttonControls = new SMPButtons(this._logUserInteraction);
        // this._scrubBar = new SMPScrubBar(this._logUserInteraction);
        // it can choose to use the buttons created by the overlays or make its own
        default:
            // use normal built-in scrub bar, buttons, etc
            this._buildStandardControls();
        }

        // listen for button events and handle them
        this._setupButtonHandling();

        // choice countdown
        this._createCountdownElement();

        // facebook problem workaround
        const facebookiOSWebview = BrowserUserAgent.facebookWebview() && BrowserUserAgent.iOS();
        const overrideFacebookBlock = getSetting(FACEBOOK_BLOCK_FLAG);
        if(facebookiOSWebview && !overrideFacebookBlock) {
            const fbWebviewDiv = document.createElement('div');
            fbWebviewDiv.className = "webview-error";
            fbWebviewDiv.innerHTML = "<div class=\"webview-error-div\">"
                + "<h1>Facebook Browser is not supported</h1>"
                + "<p>Please click on the three dots in top right corner and click "
                + "'Open in Safari'</p></div>";
            target.appendChild(fbWebviewDiv);
        } else {
            target.appendChild(this._player);
        }

        // Expose the layers for external manipulation if needed.
        this.guiTarget = this._guiLayer;
        this.mediaTarget = this._mediaLayer;
        this.backgroundTarget = this._backgroundLayer;

        // Event Listeners
        // keyboard
        if (this._controller.handleKeys) {
            document.addEventListener('keydown', this._keyPressHandler.bind(this));
        }

        // mouse/touch
        this._overlaysElement.onclick = this._handleOverlayClick.bind(this);
        this._overlaysElement.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._handleOverlayClick.bind(this)),
        );


        this._player.addEventListener('touchend', this._handleTouchEndEvent.bind(this));

        const debugPlayout = getSetting(DEBUG_PLAYOUT_FLAG);
        if (debugPlayout) {
            logger.info("Playout debugging: ON")
        }
        this._isPausedForBehaviours = false;

        logger.info('Using playout engine: ', playoutToUse);

        switch (playoutToUse) {
        case PLAYOUT_ENGINES.DOM_SWITCH_PLAYOUT:
            // Use shiny source switching engine.... smooth.
            this.playoutEngine = new DOMSwitchPlayoutEngine(this, debugPlayout);
            break;
        case PLAYOUT_ENGINES.IOS_PLAYOUT:
            // Refactored iOS playout engine
            this.playoutEngine = new IOSPlayoutEngine(this, debugPlayout);
            break;
        case PLAYOUT_ENGINES.SMP_PLAYOUT:
            // SMP playout engine
            throw new Error("Not Implemented Yet!")
        default:
            logger.fatal('Invalid Playout Engine');
            throw new Error('Invalid Playout Engine');
        }

        if(debugPlayout) {
            // Print all calls to PlayoutEngine along with their arguments
            const playoutEngineHandler = {
                get (getTarget, getProp) {
                    // eslint-disable-next-line func-names
                    return function() {
                        /* eslint-disable prefer-rest-params */
                        logger.info( `PlayoutEngine call (C): ${getProp} (${arguments.length})` );
                        logger.info( `PlayoutEngine call (C+A): ${getProp}`, ...arguments );
                        // eslint-disable-next-line prefer-spread
                        const ret = getTarget[ getProp ].apply( getTarget, arguments );
                        logger.info( `PlayoutEngine call (C+R): ${getProp}`, ret );
                        /* eslint-enable prefer-rest-params */

                        return ret
                    }
                },
            };
            this.playoutEngine = new Proxy(this.playoutEngine, playoutEngineHandler);
        }
    }

    // build UI components
    _buildStandardControls() {
        this._controls = new StandardControls(
            this._logUserInteraction,
            this._volume,
            this._icon,
            this._representation,
        );
        this._guiLayer.appendChild(this._controls.getControls());
        this._guiLayer.appendChild(this._controls.getActivator());
    }

    // create an element ready for rendering countdown
    _createCountdownElement() {
        this._countdownContainer = document.createElement('div');
        this._countdownContainer.classList.add('romper-ux-divider');
        this._countdowner = document.createElement('div');
        this._countdowner.classList.add('romper-ux-countdown');
        this._countdownContainer.appendChild(this._countdowner);
    }

    _createOverlay(name: string, logFunction: Function) {
        const overlay = new Overlay(name, logFunction);
        this._overlays.push(overlay);

        // one overlay has been activated, disactivate all other overlays
        overlay.on(OVERLAY_ACTIVATED_EVENT, (clickedName) => {
            this._overlays.filter(o => o.getName() !== clickedName)
                .forEach(o => o.disactivateOverlay());
        });
        return overlay;
    }

    getOverlayElement() {
        return this._overlaysElement;
    }

    // key listener
    _keyPressHandler(event: KeyboardEvent) {
        // F toggles fullscreen
        if (event.code === 'KeyF') {
            this._toggleFullScreen();
            event.preventDefault();
        }
        if (!this._userInteractionStarted) return;
        // numbers activate link choices
        const keyNumber = parseInt(event.key, 10);
        if (!isNaN(keyNumber)) { // eslint-disable-line no-restricted-globals
            // for choices map number key presses to choices L-R
            if (this._visibleChoices[keyNumber]) {
                const newMouseEvent = document.createEvent('MouseEvents');
                newMouseEvent.initEvent('click', true, true);
                newMouseEvent.synthetic = true;
                this._visibleChoices[keyNumber].dispatchEvent(newMouseEvent, true);
            }
        }
    }

    setCurrentRenderer(renderer: BaseRenderer) {
        this._currentRenderer = renderer;
    }

    _setupButtonHandling() {
        this._controls.disableSubtitlesButton();
        /* eslint-disable max-len */
        this._controls.on(ButtonEvents.SUBTITLES_BUTTON_CLICKED, () => this.emit(PlayerEvents.SUBTITLES_BUTTON_CLICKED));
        this._controls.on(ButtonEvents.FULLSCREEN_BUTTON_CLICKED, () => this._toggleFullScreen());
        this._controls.on(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED, () => this.emit(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED));
        this._controls.on(ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED, () => this.emit(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED));
        this._controls.on(ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED, () => this.emit(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED));
        /* eslint-enable max-len */
        this._controls.on(ButtonEvents.BACK_BUTTON_CLICKED, () => {
            this._hideAllOverlays();
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
        });
        this._controls.on(ButtonEvents.NEXT_BUTTON_CLICKED, () => {
            if (!this._userInteractionStarted) {
                this._enableUserInteraction();
            }
            this._hideAllOverlays();
            this.emit(PlayerEvents.NEXT_BUTTON_CLICKED);
        });
        this._controls.on(ControlEvents.SHOWING_BUTTONS, () => {});
        this._controls.on(ControlEvents.HIDING_BUTTONS, () => {});
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
        if (leftGreaterThanRight(guiAspect, this._aspectRatio)) {
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

    // eslint-disable-next-line class-methods-use-this
    _createButtonLabel(text: string) {
        const buttonSpan = document.createElement('span');
        buttonSpan.innerHTML = text;
        buttonSpan.classList.add('button-label');
        return buttonSpan;
    }

    _addContinueModal(options: Object) {
        this._createResumeExperienceButton(options);

        this._resumeExperienceButton.setAttribute('title', 'Resume and accept terms');
        this._resumeExperienceButton.setAttribute('aria-label', 'Resume Button');

        this._resumeExperienceButton.appendChild(this._createButtonLabel('Resume'))

        const cancelButton = document.createElement('button');
        cancelButton.setAttribute('type', 'button');
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

        cancelButton.appendChild(this._createButtonLabel('Restart'));
        

        const cancelButtonHandler = () => {
            this._controls.setTransportControlsActive();
            this._logUserInteraction(AnalyticEvents.names.BEHAVIOUR_CANCEL_BUTTON_CLICKED);
            this._controller.setSessionState(SESSION_STATE.RESTART);
            this._controller.deleteExistingSession();
            this._controller.resetStory();
            this._hideModalLayer();
            this._startButtonHandler();
        };

        cancelButton.onclick = cancelButtonHandler;
        cancelButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(cancelButtonHandler),
        );

        const resumeExperienceButtonHandler = () => {
            this.emit(REASONER_EVENTS.ROMPER_STORY_STARTED);
            this._logUserInteraction(AnalyticEvents.names.BEHAVIOUR_CONTINUE_BUTTON_CLICKED);
            this._controls.setTransportControlsActive();
            this._controller.setSessionState(SESSION_STATE.RESUME);
            this._controller.restart();
            this._hideModalLayer();
            this._enableUserInteraction();
        };

        this._resumeExperienceButton.onclick = resumeExperienceButtonHandler;
        this._resumeExperienceButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(resumeExperienceButtonHandler),
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

    // TODO: this needs proper testing!
    _handleTouchEndEvent(event: Object) {
        // Get the element that was clicked on
        const endTarget = document.elementFromPoint(
            event.changedTouches[0].pageX,
            event.changedTouches[0].pageY,
        );

        if (!this._controls.getShowing()) {
            // Open romper buttons if user touches anywhere on screen that is background
            const openTriggerElements = [
                this._overlaysElement,
                // this._narrativeElementTransport, // TODO why?
                this._controls.getActivator(),
            ];
            if (openTriggerElements.some(el => (el === endTarget))) {
                this._controls.activateRomperButtons();
                this._hideAllOverlays();
                event.preventDefault();
            }
        } else {
            // Close romper buttons if user touches anywhere above buttons bar
            const closeTriggerElements = [
                this._overlaysElement,
                // this._narrativeElementTransport, // TODO why close on this?
            ];
            // Prevent touch being converted to click on button bar
            // (which would then trigger activate area mouseenter events)
            const proventClickTriggerElements = [
                this._controls.getControls(),
            ];
            if (closeTriggerElements.some(el => (el === endTarget))) {
                this._controls.hideControls();
                this._hideAllOverlays();
                event.preventDefault();
            } else if (proventClickTriggerElements.some(el => (el === endTarget))) {
                event.preventDefault();
            }
        }
    }

    _showRomperButtons() {
        this._logRendererAction(AnalyticEvents.names.BUTTONS_ACTIVATED);
        this._overlaysElement.classList.remove('buttons-hidden');
        this._overlaysElement.classList.add('buttons-showing');
    }

    _hideRomperButtons() {
        this._logRendererAction(AnalyticEvents.names.BUTTONS_DEACTIVATED);
        this._overlaysElement.classList.add('buttons-hidden');
        this._overlaysElement.classList.remove('buttons-showing');
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
        this._controls.showControls();
    }

    showBufferingLayer() {
        this._loadingLayer.classList.add('show');
    }

    removeBufferingLayer() {
        this._loadingLayer.classList.remove('show');
    }

    _removeErrorLayer() {
        this._errorLayer.classList.remove('show');
        this._errorLayer.classList.add('hide');
        this._controls.hideControls();
    }

    _createStartExperienceButton(options: Object) {
        this._startExperienceButton = document.createElement('button');
        this._startExperienceButton.setAttribute('type', 'button');
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

    /**
     * Creates a start image if we don't have one then appends it to the DOM
     * @param {Object} options
     */
    _createStartImage(options: Object) {
        if(!this._startExperienceImage) {
            this._startExperienceImage = document.createElement('img');
            this._startExperienceImage.className = 'romper-start-image';
            this._startExperienceImage.src = options.background_art;
        }
        this._mediaLayer.appendChild(this._startExperienceImage);

    }

    _createResumeExperienceButton(options: Object) {
        this._resumeExperienceButton = document.createElement('button');
        this._resumeExperienceButton.setAttribute('type', 'button');
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

    /**
     * Sets up the overlays for the start/resume buttons and start image image
     * @param {Object} options - options for start overlays
     */
    setupExperienceOverlays(options: Object) {
        switch (this._controller.getSessionState()) {
        case SESSION_STATE.RESUME:
            this._controls.setTransportControlsActive();
            break;
        case SESSION_STATE.EXISTING:
            this._createResumeOverlays(options);
            if (options.hide_narrative_buttons) {
                // can't use player.setNextAvailable
                // as this may get reset after this by NE change handling
                this._controls.setTransportControlsInactive();
            }
            break;
        case SESSION_STATE.RESTART:
            this._controls.setTransportControlsActive();
            break
        case SESSION_STATE.NEW:
            this._createStartOverlays(options);
            break;
        default:
            if (options.hide_narrative_buttons) {
                // can't use player.setNextAvailable
                // as this may get reset after this by NE change handling
                this._controls.setTransportControlsInactive();
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
            (event: TouchEvent) => {
                handleButtonTouchEvent(this._startButtonHandler, event);
            },
            false,
        );
    }

    _startButtonHandler() {
        this._removeExperienceOverlays();
        this.emit(REASONER_EVENTS.ROMPER_STORY_STARTED);
        this._enableUserInteraction();
        this._controls.setTransportControlsActive();
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
        this._overlaysElement.classList.add('romper-inactive');
        this._controls.setControlsInactive()
        this.playoutEngine.setPermissionToPlay(false);
    }

    _enableUserInteraction() {
        if (this._userInteractionStarted) {
            return;
        }

        this._userInteractionStarted = true;
        this._overlaysElement.classList.remove('romper-inactive');
        this._controls.setControlsActive();
        this.playoutEngine.setPermissionToPlay(true);

        this._logUserInteraction(AnalyticEvents.names.START_BUTTON_CLICKED);
        this.emit(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED);
    }

    _handleOverlayClick(event: Object) {
        if (this._controls.getShowing()) {
            this._hideRomperButtons();
        } else {
            this._controls.activateRomperButtons(event);
        }
        this._hideAllOverlays();
    }

    _hideAllOverlays() {
        if (this._representation) {
            this._representation.disactivateOverlay();
        }
        if (this._volume) {
            this._volume.disactivateOverlay();
        }
        if (this._icon) {
            this._icon.disactivateOverlay();
        }
    }

    enableSubtitlesControl() {
        this._controls.enableSubtitlesButton()
    }

    disableSubtitlesControl() {
        this._controls.disableSubtitlesButton()
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
            data: information,
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

    /* Volume handling */
    setVolumeControlLevel(label: string, value: number) {
        const id = this._volume.getIdForLabel(label);
        const volumeControl = this._volume.get(id);
        if (volumeControl) {
            if (volumeControl.childNodes[1] && volumeControl.childNodes[1].childNodes[2]) {
                // set slider value
                volumeControl.childNodes[1].childNodes[1].value = value;
                // and feedback div
                volumeControl.childNodes[1].childNodes[2].textContent = `${Math.floor(10 * value)}`;
            }
            this.emit(PlayerEvents.VOLUME_CHANGED, { id, value, label });
        }
    }

    setMuted(label: string, muted: boolean) {
        const id = this._volume.getIdForLabel(label);
        const volumeControl = this._volume.get(id);
        if(volumeControl) {
            const muteButton = document.getElementById(`mute-button-${id}`);
            if(muted && muteButton) {
                this._volume.get(id).classList.add('romper-muted');
                muteButton.setAttribute('data-muted', 'true');
                muteButton.classList.remove('romper-mute-button');
                muteButton.classList.add('romper-muted-button');
            } else {
                this._volume.get(id).classList.remove('romper-muted');
            }
            this.emit(PlayerEvents.VOLUME_MUTE_TOGGLE, { id, label, muted });
        }
    }

    _setMuteCallBack(id: string, label: string, muteButton: HTMLDivElement)  {
        return () => {
            this._volume.get(id).classList.toggle('romper-muted');
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
                    this._volume.get(id).classList.remove('romper-muted');
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
        controlDiv.id = `volume-control-${id}`;
        const muteDiv = document.createElement('div');
        muteDiv.id = `mute-button-${id}`;
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

        muteDiv.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._setMuteCallBack(id, label, muteDiv).bind(this)),
        );
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
    /* End of volume handling */

    /* Representation overlay (switchables) */
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
            this._representation.disactivateOverlay();
            this._representation.setElementActive(id);
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

    activateRepresentationControl(id: string) {
        this._representation.removeClassFromElement(id, 'romper-control-disabled');
    }

    deactivateRepresentationControl(id: string) {
        this._representation.addClassToElement(id, 'romper-control-disabled');
    }

    removeRepresentationControl(id: string) {
        this._representation.remove(id);
    }

    setActiveRepresentationControl(id: string) {
        this._representation.setElementActive(id);
    }
    /* end of Representation overlay */

    createBehaviourOverlay(behaviour: Object): Overlay {
        const behaviourOverlay = this._createOverlay('link-choice', this._logUserInteraction);
        const behaviourElement = behaviourOverlay.getOverlay()
        behaviourElement.id = behaviour.id;

        this._addCountdownToElement(behaviourElement);
        this._overlaysElement.appendChild(behaviourElement);
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
                choiceClick, // let event through to overlay
            );

            linkChoiceControl.appendChild(iconContainer);
            if (text && src) {
                const linkChoiceIconSrc = (src !== '' ? src : this._assetUrls.noAssetIconUrl);
                linkChoiceControl.classList.add('icon');
                linkChoiceControl.classList.add('text');
                const iconParent = document.createElement('div');
                const iconElement = document.createElement('img');
                iconElement.src = linkChoiceIconSrc;
                iconParent.appendChild(iconElement);
                iconParent.className = 'romper-link-icon-container'
                const iconTextPar = document.createElement('p');
                iconTextPar.textContent = text;
                iconTextPar.className = 'romper-link-text-icon';
                iconContainer.appendChild(iconParent);
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
                const iconElement = document.createElement('img');
                iconElement.src = linkChoiceIconSrc;
                iconContainer.appendChild(iconElement);
            }
            resolve({
                icon: linkChoiceControl,
                uuid: id,
                container: iconContainer,
            });
        });

        this._choiceIconSet[id] = containerPromise;
        return linkChoiceControl;
    }

    hideChoiceIcons(){
        this._controls.getControls().classList.add('icons-showing'); // TODO - fix?
        this._overlaysElement.classList.add('romper-inactive');
    }

    // show the choice icons
    // make the one linking to activeLinkId NE highlighted
    // optionally apply a class to the overlay
    showChoiceIcons(activeLinkId: ?string, overlayClass: ?string, behaviourOverlay: Object, choiceCount: number) { // eslint-disable-line max-len
        this._hideRomperButtons();
        const behaviourElement = behaviourOverlay.getOverlay()
        this._controls.getControls().classList.add('icons-showing'); // TODO - fix?
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
        // promise.all ensures all the dom elements are created before showing them
        return Promise.all(promisesArray)
            .then((icons) => {
                icons.forEach((iconObj, id) => {
                    const { icon, uuid, container } = iconObj;
                    if (activeLinkId && uuid === activeLinkId) {
                        icon.classList.add('default');
                    }
                    const clickHandler = () => {
                        // set classes to show which is selected
                        behaviourOverlay.setElementActive(`${id}`);
                    };
                    icon.onclick = clickHandler;
                    icon.addEventListener(
                        'touchend',
                        handleButtonTouchEvent(clickHandler),
                    );
                    behaviourOverlay.add(id, icon);
                    if(behaviourElement){
                        behaviourElement.appendChild(icon);
                    }
                    this._visibleChoices[id + 1] = container;
                });
            });
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
            this._reflectTimeout(currentRenderer);
        }, 10);
        this._countdownContainer.classList.add('show');
        // }
    }

    _reflectTimeout(currentRenderer: BaseRenderer) {
        const { remainingTime } = currentRenderer.getCurrentTime();
        const { style } = this._countdowner;
        const percentRemain = 100 * (remainingTime / this._countdownTotal);
        if (percentRemain > 0) {
            style.width = `${percentRemain}%`;
            style.marginLeft = `${(100 - percentRemain)/2}%`;
            this._choiceCountdownTimeout = setTimeout(() => {
                this._reflectTimeout(currentRenderer);

            }, 10);
        } else {
            clearTimeout(this._choiceCountdownTimeout);
            this._choiceCountdownTimeout = null;
            this._countdownTotal = 0;
            style.width = '0';
            style.marginLeft = '49%';
        }
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
            this._icon.disactivateOverlay();
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

    removeIconControl(id: string) {
        this._icon.remove(id);
    }

    enterCompleteBehavourPhase() {
        this._logRendererAction(AnalyticEvents.names.COMPLETE_BEHAVIOUR_PHASE_STARTED);
        this.disableScrubBar();
        this._controls.disableSeekBack();
        this.disablePlayButton();
        this._disableRepresentationControl();
    }

    _pauseForBehaviours() {
        if (this.playoutEngine.isPlaying()) {
            this._isPausedForBehaviours = true;
            this.playoutEngine.pause();
        }
        this._controls.disablePlayButton();
    }

    _unpauseAfterBehaviours() {
        if (this._isPausedForBehaviours) {
            this._isPausedForBehaviours = false;
            this.playoutEngine.play();
        }
        this._controls.enablePlayButton();
    }

    exitCompleteBehaviourPhase() {
        this._controls.enableSeekBack();
    }

    enterStartBehaviourPhase(renderer: BaseRenderer) {
        this.setCurrentRenderer(renderer);
        this._controls.disableSeekBack();
        this._pauseForBehaviours();
        this._logRendererAction(AnalyticEvents.names.START_BEHAVIOUR_PHASE_STARTED);
    }

    exitStartBehaviourPhase() {
        this._unpauseAfterBehaviours();
        this._logRendererAction(AnalyticEvents.names.START_BEHAVIOUR_PHASE_ENDED);
        this.enableControls();
        this.showSeekButtons();
        this.enablePlayButton();
        this.enableScrubBar();
        this._enableRepresentationControl();
    }

    enableLinkChoiceControl() {
        const linkChoice = this.getLinkChoiceElement()[0];
        linkChoice.classList.remove('romper-inactive');
    }

    disableLinkChoiceControl() {
        const linkChoice = this.getLinkChoiceElement()[0];
        linkChoice.classList.add('romper-inactive');
    }

    resetControls() {
        // this.clearLinkChoices();
        this.enableControls();
        this._hideAllOverlays();
    }

    clearLinkChoices() {
        this._numChoices = 0;
        this._choiceIconSet = {};
        this._visibleChoices = {};
        if (this._choiceCountdownTimeout) {
            clearTimeout(this._choiceCountdownTimeout);
            this._choiceCountdownTimeout = null;
            this._countdownTotal = 0;
            this._countdownContainer.classList.remove('show');
        }
        this._controls.getControls().classList.remove('icons-showing');
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
        // @flowignore
        return full? linkChoices : [linkChoices[0]];
    }

    _enableRepresentationControl() {
        this._representation.enableButton();
    }

    _disableRepresentationControl() {
        this._representation.disableButton();
    }

    disableControls() {
        this._controls.disableControls();
    }

    enableControls() {
        this._controls.enableControls();
    }

    // eslint-disable-next-line class-methods-use-this
    showSeekButtons() {
        this._controls.showSeekButtons();
        this.showScrubBar();
    }

    hideSeekButtons() {
        this._controls.hideSeekButtons();
    }

    // SCRUB BAR
    hideScrubBar() {
        this._controls.hideScrubBar()
    }

    showScrubBar() {
        this._controls.showScrubBar();
    }

    enableScrubBar() {
        this._controls.enableScrubBar();
    }

    disableScrubBar() {
        this._controls.disableScrubBar();
    }

    disconnectScrubBar(renderer: BaseRenderer) {
        if (renderer !== this._currentRenderer) {
            return;
        }
        this._controls.disconnectScrubBar();
    }

    connectScrubBar(renderer: BaseRenderer) {
        this._controls.connectScrubBar(renderer);
    }
    // SCRUB BAR END

    disablePlayButton() {
        this._controls.disablePlayButton();
    }

    enablePlayButton() {
        this._controls.enablePlayButton();
    }

    setPlaying(isPlaying: boolean) {
        this._controls.setPlaying(isPlaying);
    }

    setNextAvailable(isNextAvailable: boolean) {
        this._controls.setNextAvailable(isNextAvailable);
    }

    setBackAvailable(isBackAvailable: boolean) {
        this._controls.setBackAvailable(isBackAvailable);
    }

    _applyExitFullscreenBehaviour(behaviour: Object, callback: () => mixed) {
        if (Player._isFullScreen()) {
            this._exitFullScreen();
        }
        scrollToTop();
        callback();
    }

    static _isFullScreen() {
        let isFullScreen = false;
        if (document.fullscreenElement) {
            isFullScreen = (document.fullscreenElement != null);
        }
        // @flowignore
        if (document.webkitFullscreenElement) {
            isFullScreen = isFullScreen || (document.webkitFullscreenElement != null);
        }
        // @flowignore
        if (document.mozFullScreenElement) {
            isFullScreen = isFullScreen || (document.mozFullScreenElement != null);
        }
        // @flowignore
        if (document.msFullscreenElement) {
            isFullScreen = isFullScreen || (document.msFullscreenElement != null);
        }
        if (document.getElementsByClassName('romper-target-fullscreen').length > 0) {
            isFullScreen = true;
        }
        return isFullScreen;
    }

    /**
     * Toggles fullscreen using our controls button
     */
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

    /**
     * enters fullscreen from the player
     * in ios we handle this ourselves
     * @fires fullscreenchange event we listen to unless on ios 
     */
    _enterFullScreen() {
        if (this._playerParent.requestFullscreen) {
            // @flowignore
            this._playerParent.requestFullscreen();
            // @flowignore
        } else if (this._playerParent.mozRequestFullScreen) {
            // @flowignore
            this._playerParent.mozRequestFullScreen(); // Firefox
            // @flowignore
        } else if (this._playerParent.webkitRequestFullscreen) {
            // @flowignore
            this._playerParent.webkitRequestFullscreen(); // Chrome and Safari
        } else {
            window.scrollTo(0, 1);
            this._playerParent.classList.add('romper-target-fullscreen'); // iOS
        }

        // ios is special handle these separately;
        if (BrowserUserAgent.iOS()) {
            this._playerParent.addEventListener('touchmove', preventEventDefault);
            this._player.classList.add('ios-fullscreen'); // iOS
        }
    }

    /**
     * exits fullscreen from the player
     * in ios we handle this ourselves
     * @fires fullscreenchange event we listen to
     */
    _exitFullScreen() {
        // || document.webkitIsFullScreen);
        if (document.exitFullscreen) {
            // @flowignore
            document.exitFullscreen();
        // @flowignore
        } else if (document.mozCancelFullScreen) {
            // @flowignore
            document.mozCancelFullScreen(); // Firefox
        // @flowignore    
        } else if (document.webkitExitFullscreen) {
            // @flowignore
            document.webkitExitFullscreen(); // Chrome and Safari
        // @flowignore
        } else if (document.msExitFullscreen) {
            // @flowignore
            document.msExitFullscreen(); // Chrome and Safari
        } else {
            this._playerParent.classList.remove('romper-target-fullscreen'); // iOS
        }
        scrollToTop();

        // ios is special handle these events separately
        if(BrowserUserAgent.iOS()) {
            this._playerParent.removeEventListener('touchmove', preventEventDefault);
            this._player.classList.remove('ios-fullscreen'); // iOS
        }
    }

    /**
     * Relies on the document 'fullscreenchange' event firing, then sets the style for the player accordingly
     * handles iOS fullscreen behaviour too.
     */
    _handleFullScreenEvent() {
        if(Player._isFullScreen()) {
            // srtup controls and styling
            this._controls.setFullscreenOn();
            this._player.classList.add('romper-player-fullscreen');

            // fit player to size, so all UI remains within media
            const windowAspect = window.innerWidth / window.innerHeight;
            const scaleFactor = BrowserUserAgent.iOS() ? 0.8: 1; // scale80% for iOS
            if (leftGreaterThanRight(windowAspect, this._aspectRatio)) { // too wide
                const width = this._aspectRatio * 100 * scaleFactor;
                this._player.style.height = `${100 * scaleFactor}vh`;
                this._player.style.width = `${width}vh`;
                this._player.style.marginLeft = `calc((100vw - ${width}vh) / 2)`;
            } else { // too tall
                const height = (100 * scaleFactor) / this._aspectRatio;
                this._player.style.height = `${height}vw`;
                this._player.style.width = `${100 * scaleFactor}vw`;
                this._player.style.marginLeft = `${(100 - (scaleFactor * 100)) / 2}vw`;
            }
        } else {
            this._controls.setFullscreenOff();
            this._player.classList.remove('romper-player-fullscreen');
            this._player.removeAttribute('style');
        }
    }


    _addFullscreenListeners() {
        document.addEventListener('webkitfullscreenchange', this._handleFullScreenEvent);
        document.addEventListener('mozfullscreenchange', this._handleFullScreenEvent);
        document.addEventListener('fullscreenchange', this._handleFullScreenEvent);
        document.addEventListener('MSFullscreenChange', this._handleFullScreenEvent);
    }
}

export default Player;
export { PlayerEvents };
