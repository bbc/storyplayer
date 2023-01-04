import BaseControls, {ControlEvents} from "./BaseControls"
import type BaseRenderer from "../renderers/BaseRenderer"
import type BaseButtons from "./BaseButtons"
import type BaseScrubBar from "./BaseScrubBar"
import Buttons, {ButtonEvents} from "./Buttons"
import ScrubBar from "./ScrubBar"
import Overlay from "./Overlay"
import {handleButtonTouchEvent} from "../utils"

//
// Component containing UI for all buttons
//

class StandardControls extends BaseControls {
    _containerDiv: HTMLDivElement
    _scrubBar: BaseScrubBar
    _buttonsActivateArea: HTMLDivElement
    _showRomperButtonsTimeout: ReturnType<typeof setTimeout>
    _hideTimeout: ReturnType<typeof setTimeout> | null | undefined
    _narrativeElementTransport: HTMLDivElement
    _buttonControls: BaseButtons
    _controlsDisabled: boolean

    constructor(
        logUserInteraction: (...args: Array<any>) => any,
        volumeOverlay: Overlay,
        chapterOverlay: Overlay,
        switchableOverlay: Overlay,
    ) {
        super(
            logUserInteraction,
            volumeOverlay,
            chapterOverlay,
            switchableOverlay,
        )
        // create button manager and scrub bar
        this._buttonControls = new Buttons(this._logUserInteraction)

        this._forwardButtonEvents()

        this._scrubBar = new ScrubBar(this._logUserInteraction)
        this._buttonsActivateArea = document.createElement("div")

        this._buttonsActivateArea.classList.add("romper-buttons-activate-area")

        this._buttonsActivateArea.classList.add("hide")

        this._buttonsActivateArea.classList.add("romper-inactive")

        this._buttonsActivateArea.onmouseenter = () => {
            this.activateRomperButtons()
        }

        this._buttonsActivateArea.onmousemove = () => {
            this.activateRomperButtons()
        }

        document.addEventListener("keydown", e => {
            if (e.key === "Tab" || this.getShowing()) {
                this.activateRomperButtons()
            }
        })

        this._buttonsActivateArea.addEventListener(
            "touchend",
            handleButtonTouchEvent(this.activateRomperButtons.bind(this)),
        )

        this._buttonsActivateArea.onclick = this.activateRomperButtons.bind(
            this,
        )
        // next is needed for activating buttons area
        this._narrativeElementTransport = this._buttonControls.getTransportControls()
        // pass the overlay buttons to the button manager
        const volBtn = volumeOverlay.getButton()
        volBtn.setAttribute("tabindex", "2")

        this._buttonControls.setVolumeButton(volBtn)

        this._buttonControls.setChapterButton(chapterOverlay.getButton())

        this._buttonControls.setSwitchableButton(switchableOverlay.getButton())

        // build the control structure
        const mediaTransport = this._buttonControls.getControlsDiv(
            volumeOverlay.getOverlay(),
            chapterOverlay.getOverlay(),
            switchableOverlay.getOverlay(),
        )

        // add transport control buttons and scrub bar
        this._containerDiv = document.createElement("div")

        this._containerDiv.classList.add("romper-buttons")

        this._containerDiv.setAttribute("role", "navigation")

        this._containerDiv.setAttribute("aria-disabled", "true")

        this._containerDiv.appendChild(this._scrubBar.getScrubBarElement())

        this._containerDiv.appendChild(mediaTransport)

        this._containerDiv.onmousemove = () => {
            this.activateRomperButtons()
        }

        this._containerDiv.onmouseleave = () => {
            this.hideControls()
        }
    }

    // pass on any events
    _forwardButtonEvents() {
        ;[
            ButtonEvents.SUBTITLES_BUTTON_CLICKED,
            ButtonEvents.FULLSCREEN_BUTTON_CLICKED,
            ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED,
            ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED,
            ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED,
            ButtonEvents.BACK_BUTTON_CLICKED,
            ButtonEvents.NEXT_BUTTON_CLICKED,
        ].forEach(eventType => {
            this._buttonControls.on(eventType, e => this.emit(eventType, e))
        })
    }

    activateRomperButtons(
        event?: Record<string, any> | null | undefined,
        override?: boolean | null | undefined,
    ) {
        if (event) {
            event.stopPropagation()
            event.preventDefault()
        }

        if (!override && this._controlsDisabled) {
            return
        }

        if (!this.getShowing()) {
            this.showControls()
        }

        if (override) {
            return
        }

        if (this._showRomperButtonsTimeout)
            clearTimeout(this._showRomperButtonsTimeout)
        this._showRomperButtonsTimeout = setTimeout(
            () => this.hideControls(),
            5000,
        )
    }

    // get the whole lot organised in a DIV
    getControls(): HTMLDivElement {
        return this._containerDiv
    }

    getActivator(): HTMLDivElement {
        return this._buttonsActivateArea
    }

    focusScrubBar() {
        this._scrubBar.getScrubBarElement().focus()
    }

    // this stops activation from proceeding
    // and hides controls immediately
    disableControls() {
        this._controlsDisabled = true

        this._containerDiv.setAttribute("aria-disabled", "true")

        this._containerDiv.classList.add("disabled")

        this.hideControls()
    }

    enableControls() {
        this._controlsDisabled = false

        this._containerDiv.setAttribute("aria-disabled", "false")

        this._containerDiv.classList.remove("disabled")
    }

    getShowing(): boolean {
        return this._containerDiv.classList.contains("show")
    }

    // make the controls visible
    showControls() {
        if (this._hideTimeout) {
            // has only just hidden - don't emit either event
            clearTimeout(this._hideTimeout)
        } else {
            this.emit(ControlEvents.SHOWING_BUTTONS)
        }

        this._containerDiv.classList.add("show")

        this._buttonControls.showTransportControls()

        this._buttonsActivateArea.classList.add("hide")
    }

    // make the controls disappear
    hideControls() {
        if (!this.getShowing()) return
        if (this._showRomperButtonsTimeout)
            clearTimeout(this._showRomperButtonsTimeout)

        this._containerDiv.classList.remove("show")

        this._buttonControls.hideTransportControls()

        this._buttonsActivateArea.classList.remove("hide")

        // hiding the controls causes the mouse to trigger a new show event
        // we don't want to spam the Player with show/hide events
        // when the controls are basically staying visible
        // so emit event after a short timeout; if the buttons show again
        // clear the timeout
        this._hideTimeout = setTimeout(() => {
            if (!this.getShowing()) {
                this.emit(ControlEvents.HIDING_BUTTONS)
                this._hideTimeout = null
            }
        }, 300)
    }

    // this is like disableControls, but also has the effect of getting rid
    // of the activate area, so other things can be clicked on (e.g., start button)
    setControlsInactive() {
        this._containerDiv.classList.add("romper-inactive")

        this._buttonsActivateArea.classList.add("romper-inactive")
    }

    setControlsActive() {
        this.enableControls()

        this._containerDiv.classList.remove("romper-inactive")

        this._buttonsActivateArea.classList.remove("romper-inactive")

        this._buttonsActivateArea.classList.remove("hide")
    }

    setFullscreenOn() {
        this._containerDiv.classList.add("romper-buttons-fullscreen")
    }

    setFullscreenOff() {
        this._containerDiv.classList.remove("romper-buttons-fullscreen")
    }

    hideScrubBar() {
        this._scrubBar.hide()
    }

    showScrubBar() {
        this._scrubBar.show()
    }

    enableScrubBar() {
        this._scrubBar.enable()
    }

    disableScrubBar() {
        this._scrubBar.disable()
    }

    connectScrubBar(renderer: BaseRenderer) {
        this._scrubBar.connect(renderer)
    }

    disconnectScrubBar() {
        this._scrubBar.disconnect(this._containerDiv)
    }

    /* exposing functionality to change how buttons look/feel */
    setTransportControlsActive() {
        this._buttonControls.setTransportControlsActive()
    }

    setTransportControlsInactive() {
        this._buttonControls.setTransportControlsInactive()
    }

    showSeekButtons() {
        this._buttonControls.showSeekButtons()
    }

    hideSeekButtons() {
        this._buttonControls.hideSeekButtons()
    }

    enableSeekBack() {
        this._buttonControls.enableSeekBack()
    }

    disableSeekBack() {
        this._buttonControls.disableSeekBack()
    }

    enablePlayButton() {
        this._buttonControls.enablePlayButton()
    }

    disablePlayButton() {
        this._buttonControls.disablePlayButton()
    }

    setPlaying(isPlaying: boolean) {
        this._buttonControls.setPlaying(isPlaying)
    }

    setNextAvailable(isNextAvailable: boolean) {
        this._buttonControls.setNextAvailable(isNextAvailable)
    }

    setBackAvailable(isBackAvailable: boolean) {
        this._buttonControls.setBackAvailable(isBackAvailable)
    }

    enableSubtitlesButton() {
        this._buttonControls.enableSubtitlesButton()
    }

    disableSubtitlesButton() {
        this._buttonControls.disableSubtitlesButton()
    }
}

export default StandardControls