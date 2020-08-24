// @flow
import BaseControls from './BaseControls';
import Overlay from './Overlay';
import { ButtonEvents } from './Buttons';
import { getSMPInterface } from '../utils'
import BasePlayoutEngine from '../playoutEngines/BasePlayoutEngine';
import logger from '../logger';
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

    _scrubTimePoller: ?IntervalID;

    _playoutEngine: BasePlayoutEngine;

    constructor(
        logUserInteraction: Function,
        volumeOverlay: Overlay,
        chapterOverlay: Overlay,
        switchableOverlay: Overlay,
        playoutEngine: BasePlayoutEngine,
    ) {
        super(logUserInteraction, volumeOverlay, chapterOverlay, switchableOverlay);

        this._playoutEngine = playoutEngine;

        this._smpPlayerInterface = getSMPInterface();

        // Previous Button
        this._smpPlayerInterface.addEventListener("previousRequested", () => {
            this.emit(ButtonEvents.BACK_BUTTON_CLICKED)
        })

        // Next Button
        this._smpPlayerInterface.addEventListener("nextRequested", () => {
            this.emit(ButtonEvents.NEXT_BUTTON_CLICKED)
        })

        // TODO: Fix analytics for PlayPause button in SMP
        // // Pause Button
        // this._smpPlayerInterface.addEventListener("pauseRequested", () => {
        //     this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED, {pauseButtonClicked: true})
        // })
        //
        // // Play Button
        // this._smpPlayerInterface.addEventListener("playRequested", () => {
        //     // TODO: This picks up all play events not just the ones triggered
        //     // from the play button. Requires review by Andy B
        //     this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED, {playButtonClicked: true})
        // })

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
            availableOnMediaEnded: true,
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
    getShowing(): boolean {
        return true
    }

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
        // Handled by SMP
    }

    setControlsInactive() {
        // called when restarting an experience and throwing up new splash screen
        // and play button
        // TODO: need to test properly
        this.disableControls();
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

    connectScrubBar(renderer: BaseRenderer) {
        // clear any existing polling
        if (this._scrubTimePoller) clearInterval(this._scrubTimePoller);

        // Update the seek bar as the media plays
        this._scrubTimePoller = setInterval(
            () => {
                const { currentTime } = renderer.getCurrentTime();
                this._playoutEngine.setNonAVPlayoutTime(renderer._rendererId, currentTime);
            },
            200,
        );

        this._smpPlayerInterface.addEventListener("seekRequested", (event) => {
            const { currentTime, duration } = renderer.getCurrentTime();
            let seekTo = event.time;
            // Hack as SMP doesn't have time whilst playing fake item so detect is
            // seek is due to scrub or +/- 20s buttons
            if(seekTo === this._smpPlayerInterface.currentTime + 20) {
                seekTo = Math.min(currentTime + 20, duration);
            } else if(seekTo === 0 && this._smpPlayerInterface.currentTime <= 20) {
                seekTo = Math.max(currentTime - 20, 0);
            }
            renderer.setCurrentTime(seekTo);
        })
    }

    disconnectScrubBar() {
        // clear any existing polling
        if (this._scrubTimePoller) clearInterval(this._scrubTimePoller);
    }

    setTransportControlsActive() { }

    setTransportControlsInactive() { }

    showSeekButtons() {
        // TODO: Where is hideSeekButtons?!
    }

    enablePlayButton() {
        // Hack: SMP may change element id at anytime which is why it's in a
        // catch statement
        try {
            document.getElementById("p_audioui_playpause").removeAttribute('disabled');
        } catch (error) {
            logger.warn("Cannot find play button: ", error)
        }
    }

    disablePlayButton() {
        // Hack: SMP may change element id at anytime which is why it's in a
        // catch statement
        try {
            document.getElementById("p_audioui_playpause").setAttribute('disabled', 'true');
        } catch (error) {
            logger.warn("Cannot find play button: ", error)
        }
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
