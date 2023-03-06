import EventEmitter from "eventemitter3"
import { UILogFunction } from '../types'

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

const ButtonEventTypes = [
    "BACK_BUTTON_CLICKED",
    "NEXT_BUTTON_CLICKED",
    "PLAY_PAUSE_BUTTON_CLICKED",
    "SEEK_FORWARD_BUTTON_CLICKED",
    "SEEK_BACKWARD_BUTTON_CLICKED",
    "SUBTITLES_BUTTON_CLICKED",
    "FULLSCREEN_BUTTON_CLICKED",
    "REPEAT_BUTTON_CLICKED",
    "SCRUB_BAR_MOUSE_DOWN",
    "SCRUB_BAR_CHANGED",
    "SCRUB_BAR_MOUSE_UP",
] as const

const ButtonEvents: Record<string, string> = 
    ButtonEventTypes.reduce((events, eventName) => {
        // eslint-disable-next-line no-param-reassign
        events[eventName] = eventName
        return events
    }, {}) 
    
//
// Base Component containing functionality for all core buttons
//

class BaseButtons extends EventEmitter {

    _logUserInteraction: UILogFunction
    _volumeButton: HTMLButtonElement
    _chapterButton: HTMLButtonElement
    _switchableButton: HTMLButtonElement

    constructor(logUserInteraction) {
        super()
        this._logUserInteraction = logUserInteraction
    }

    /* setters for overlay buttons */
    setVolumeButton(button: HTMLButtonElement) {
        this._volumeButton = button
    }

    setChapterButton(button: HTMLButtonElement) {
        this._chapterButton = button
    }

    setSwitchableButton(button: HTMLButtonElement) {
        this._switchableButton = button
    }

    /* getters */
    // get the whole lot organised in a DIV
    getControlsDiv(
        volumeOverlay: HTMLDivElement,
        chapterOverlay: HTMLDivElement,
        switchableOverlay: HTMLDivElement,
    ): HTMLDivElement {
        return document.createElement("div")
    }

    // get div with back, seeek back, play/pause, seek fwd, next
    getTransportControls(): HTMLDivElement {
        return document.createElement("div")
    }

    getFullscreenButton(): HTMLButtonElement {
        return document.createElement("button")
    }

    getSubtitlesButton(): HTMLButtonElement {
        return document.createElement("button")
    }

    getVolumeButton(): HTMLButtonElement {
        return this._volumeButton
    }

    getChapterButton(): HTMLButtonElement {
        return this._chapterButton
    }

    getSwitchableButton(): HTMLButtonElement {
        return this._switchableButton
    }

    /* exposing functionality to change how buttons look/feel */
    showTransportControls() {}

    hideTransportControls() {}

    setTransportControlsActive() {}

    setTransportControlsInactive() {}

    showSeekButtons() {}

    hideSeekButtons() {}

    enableSeekBack() {}

    disableSeekBack() {}

    enablePlayButton() {}

    disablePlayButton() {}

    setPlaying(isPlaying) {}

    setNextAvailable(isNextAvailable) {}

    setBackAvailable(isBackAvailable) {}

    enableSubtitlesButton() {}

    disableSubtitlesButton() {}
}

export {ButtonEvents}
export default BaseButtons
