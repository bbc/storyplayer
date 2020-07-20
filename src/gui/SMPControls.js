// @flow
import BaseControls from './BaseControls';
import Overlay from './Overlay';
import { ButtonEvents } from './Buttons';
import { getSMPInterface } from '../utils'

/* eslint-disable class-methods-use-this */

class SMPControls extends BaseControls {

    _logUserInteraction: Function;

    _smpPlayerInterface: Object;

    _backButton: boolean;

    _nextButton: boolean;

    _controlsEnabled: boolean;

    _containerDiv: HTMLDivElement;

    _chapterButton: HTMLButtonElement;

    _uiUpdateQueue: Array<Object>;

    _uiUpdateQueueTimer: Number;

    constructor(
        logUserInteraction: Function,
        volumeOverlay: Overlay,
        chapterOverlay: Overlay,
        switchableOverlay: Overlay,
    ) {
        super(logUserInteraction, volumeOverlay, chapterOverlay, switchableOverlay);
        this._smpPlayerInterface = getSMPInterface()

        // Previous Button
        this._smpPlayerInterface.addEventListener("previousRequested", () => {
            // TODO: Fix issue where back is available on first node
            this.emit(ButtonEvents.BACK_BUTTON_CLICKED)
        })

        // Next Button
        this._smpPlayerInterface.addEventListener("nextRequested", () => {
            this.emit(ButtonEvents.NEXT_BUTTON_CLICKED)
        })

        // Pause Button
        this._smpPlayerInterface.addEventListener("pause", (event) => {
            if(!event.ended) {
                this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED)
            }
        })

        // Play Button
        this._smpPlayerInterface.addEventListener("playing", () => {
            // TODO: This picks up all play events not just the ones triggered
            // from the play button. Requires review by Andy B
            this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED)
        })

        // Controls enabled by default
        this._controlsEnabled = true

        // Setup Chapter Overlay and attach Custom SMP button to it
        this._containerDiv = document.createElement('div');
        this._containerDiv.classList.add('romper-buttons');
        this._containerDiv.classList.add('show');
        this._containerDiv.appendChild(chapterOverlay.getOverlay());

        this._uiUpdateQueue = []

        this._createChapterButton()
        chapterOverlay.useCustomButton(this._chapterButton)

        this._setDefaultSMPControlsConfig()
    }

    _uiUpdate(controlsConfig) {
        this._uiUpdateQueue.push(controlsConfig)
        this._processUiUpdateQueue()
    }

    _processUiUpdateQueue() {
        if(this._uiUpdateQueueTimer) {
            clearTimeout(this._uiUpdateQueueTimer)
            this._uiUpdateQueueTimer = null;
        }
        if(this._smpPlayerInterface.playlist === null) {
            this._uiUpdateQueueTimer = setTimeout(() => {this._processUiUpdateQueue()}, 1000)
            return
        }

        // Apply all UI config changes in one go by combining settings
        const controlsConfig = this._uiUpdateQueue.reduce((combinedConfig, nextValue) => {
            return {
                ...combinedConfig,
                ...nextValue,
            }
        }, {})
        this._uiUpdateQueue = []

        this._smpPlayerInterface.updateUiConfig({
            controls: controlsConfig
        })
    }

    _setDefaultSMPControlsConfig() {
        // Setup Default Controls Settings
        this._uiUpdate({
            enabled: true,
            spaceControlsPlayback: true,
            // TODO: Should controls disappear at end?
            availableOnMediaEnded: false,
            includeNextButton: true,
            includePreviousButton: true,
            // previousNextJustEvents not used in StoryKit Button Calls
            // previousNextJustEvents: true,
            includeBackIntervalButton: true,
            includeForwardIntervalButton: true,
            alwaysEnablePreviousButton: false,
            alwaysEnableNextButton: false,
        })
    }

    _createChapterButton() {
        const controlBar = document.querySelector('.p_playerControlBarHolder');
        const chapterButton = document.createElement('button');
        chapterButton.classList.add("p_button")
        chapterButton.classList.add("p_controlBarButton")
        chapterButton.classList.add("chapterButton")
        chapterButton.classList.add("romper-inactive")
        chapterButton.setAttribute("role", "button")
        chapterButton.setAttribute("aria-live", "polite")
        chapterButton.setAttribute("aria-label", "Toggle Chapter Menu")
        chapterButton.onmouseover = () => {
            chapterButton.classList.add("p_buttonHover")
        }
        chapterButton.onmouseout = () => {
            chapterButton.classList.remove("p_buttonHover")
        }
        chapterButton.innerHTML = '<span class="p_hiddenElement" aria-hidden="true">Toggle Chapter Menu</span><div class="p_iconHolder"><svg xmlns="http://www.w3.org/2000/svg" class="p_svg chapterIcon" focusable="false" viewBox="0 0 60 60"><title>chapters</title><rect x="8" width="24" height="8"/><rect x="16" y="12" width="16" height="8"/><rect x="8" y="24" width="24" height="8"/><polygon points="0 23 12 16 0 9 0 23"/></svg></div>'
        controlBar.insertBefore(chapterButton, document.querySelector(".p_fullscreenButton"))

        this._chapterButton = chapterButton;
    }

    /* getters */

    // get the whole lot organised in a DIV
    getControls(): HTMLDivElement {
        return this._containerDiv
    }

    // get a div that activates the buttons
    getActivator(): HTMLDivElement { }

    // are the controls showing
    getShowing(): boolean { }

    /* exposing functionality to change how buttons look/feel */
    disableControls() {
        if(this._controlsEnabled !== false) {
            this._uiUpdate({
                enabled: false,
            })
            this._controlsEnabled = false
        }
    }

    enableControls() {
        if(this._controlsEnabled !== true) {
            this._uiUpdate({
                enabled: true,
            })
            this._controlsEnabled = true
        }
    }

    // eslint-disable-next-line class-methods-use-this
    showControls() {
        // Activating of SMP handled by SMP. No need to manually show/hide controls
    }

    // eslint-disable-next-line class-methods-use-this
    hideControls() {
        // Activating of SMP handled by SMP. No need to manually show/hide controls
    }

    setControlsActive() {
        this.enableControls()
    }

    setControlsInactive() {
        this.disableControls()
    }

    setFullscreenOn() { }

    setFullscreenOff() { }

    hideScrubBar() {
        // Not used, might be required for hideSeekButtons in player
    }

    showScrubBar() {
        // Called from showSeekButtons in player
    }

    enableScrubBar() {
        if(this._scrubEnabled !== true) {
            this._uiUpdate({
                mode: "default",
            })
            this._scrubEnabled = true
        }
    }

    disableScrubBar() {
        if(this._scrubEnabled !== false) {
            this._uiUpdate({
                mode: "controls",
            })
            this._scrubEnabled = false
        }
    }

    connectScrubBar() { }

    disconnectScrubBar() { }

    setTransportControlsActive() { }

    setTransportControlsInactive() { }

    showSeekButtons() {
        // TODO: Where is hideSeekButtons?!
    }

    enablePlayButton() {
        // TODO: Not sure we can disable Play Button
    }

    disablePlayButton() {
        // TODO: Not sure we can disable Play Button
    }

    setPlaying(){ }

    setNextAvailable(isNextAvailable: boolean) {
        if(this._nextEnabled !== isNextAvailable) {
            this._uiUpdate({
                alwaysEnableNextButton: isNextAvailable,
            })
            this._nextEnabled = isNextAvailable
        }

    }

    setBackAvailable(isBackAvailable: boolean) {
        if(this._backButton !== isBackAvailable) {
            this._uiUpdate({
                alwaysEnablePreviousButton: isBackAvailable,
            })
            this._backButton = isBackAvailable;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    enableSubtitlesButton() {
        // SMP Handles Subtitles & Subtitles Button
    }

    // eslint-disable-next-line class-methods-use-this
    disableSubtitlesButton() {
        // SMP Handles Subtitles & Subtitles Button
    }
}

export default SMPControls;
