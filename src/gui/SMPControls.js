// @flow
import BaseControls, { ControlEvents } from './BaseControls';
import Overlay from './Overlay';
import { ButtonEvents } from './Buttons';
import { getSMPInterface } from '../utils'

// TODO: Create Queue for updateUiConfig calls and handle them in correct order

class SMPControls extends BaseControls {

    _logUserInteraction: Function;

    _smpPlayerInterface: Object;

    _backButton: boolean;

    _nextButton: boolean;

    _controlsEnabled: boolean;

    _containerDiv: HTMLDivElement;

    _chapterButton: HTMLButtonElement

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

        // Controls enabled by default
        this._controlsEnabled = true

        // Setup Chapter Overlay and attach Custom SMP button to it
        this._containerDiv = document.createElement('div');
        this._containerDiv.classList.add('romper-buttons');
        this._containerDiv.classList.add('show');
        this._containerDiv.appendChild(chapterOverlay.getOverlay());

        this._createChapterButton()
        chapterOverlay.useCustomButton(this._chapterButton)
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
        if(this._smpPlayerInterface.playlist === null) {
            setTimeout(() => {this.disableControls()}, 1000)
            return
        }

        if(this._controlsEnabled !== false) {
            this._smpPlayerInterface.updateUiConfig({
                controls:{
                    enabled: false,
                }
            })
            this._controlsEnabled = false
        }
    }

    enableControls() {
        if(this._smpPlayerInterface.playlist === null) {
            setTimeout(() => {this.enableControls()}, 1000)
            return
        }

        if(this._controlsEnabled !== true) {
            this._smpPlayerInterface.updateUiConfig({
                controls:{
                    enabled: false,
                }
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

    hideScrubBar() { }

    showScrubBar() { }

    enableScrubBar() { }

    disableScrubBar() { }

    connectScrubBar() { }

    disconnectScrubBar() { }

    setTransportControlsActive() { }

    setTransportControlsInactive() { }

    showSeekButtons(){
        // TODO: Where is hideSeekButtons?!
    }

    enablePlayButton() {
        // TODO: Not sure we can disable Play Button
    }

    disablePlayButton() {
        // TODO: Not sure we can disable Play Button
    }

    setPlaying(isPlaying: boolean){ }

    setNextAvailable(isNextAvailable: boolean) {
        if(this._smpPlayerInterface.playlist === null) {
            setTimeout(() => {this.setNextAvailable(isNextAvailable)}, 1000)
            return
        }

        if(this._nextEnabled !== isNextAvailable) {
            this._smpPlayerInterface.updateUiConfig({
                controls:{
                    alwaysEnableNextButton: isNextAvailable,
                }
            })
            this._nextEnabled = isNextAvailable
        }

    }

    setBackAvailable(isBackAvailable: boolean) {
        if(this._smpPlayerInterface.playlist === null) {
            setTimeout(() => {this.setBackAvailable(isBackAvailable)}, 1000)
            return
        }

        if(this._backButton !== isBackAvailable) {
            this._smpPlayerInterface.updateUiConfig({
                controls:{
                    alwaysEnablePreviousButton: isBackAvailable,
                }
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
