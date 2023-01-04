import EventEmitter from "events"
import BaseRenderer from "../renderers/BaseRenderer"
import type Overlay from "./Overlay"

/* eslint-disable class-methods-use-this */

/* eslint-disable no-unused-vars */
const ControlEventsTypes = ["SHOWING_BUTTONS", "HIDING_BUTTONS"]

const ControlEvents: Record<string, string> = ControlEventsTypes.reduce(
    (events, eventName) => {
        // eslint-disable-next-line no-param-reassign
        events[eventName] = eventName
        return events
    },
    {},
) 

//
// Component containing UI for all buttons
//

class BaseControls extends EventEmitter {
    _logUserInteraction: Function
    volumeOverlay: Overlay
    chapterOverlay: Overlay
    switchableOverlay: Overlay

    constructor(
        logUserInteraction: (...args: Array<any>) => any,
        volumeOverlay: Overlay,
        chapterOverlay: Overlay,
        switchableOverlay: Overlay,
    ) {
        super()
        this._logUserInteraction = logUserInteraction
    }

    /* getters */
    // get the whole lot organised in a DIV
    getControls(): HTMLDivElement | void { }

    // get a div that activates the buttons
    getActivator(): HTMLDivElement | void { }

    // are the controls showing
    getShowing(): boolean {
        console.error('Calling getShowing on BaseControls - should be overriden')
        return true
    }

    /* exposing functionality to change how buttons look/feel */
    disableControls() {}

    enableControls() {}

    showControls() {}

    hideControls() {}

    setControlsActive() {}

    setControlsInactive() {}

    setFullscreenOn() {}

    setFullscreenOff() {}

    hideScrubBar() {}

    showScrubBar() {}

    enableScrubBar() {}

    disableScrubBar() {}

    focusScrubBar() {}

    connectScrubBar(renderer: BaseRenderer) {}

    disconnectScrubBar() {}

    setTransportControlsActive() {}

    setTransportControlsInactive() {}

    showSeekButtons() {}

    enableSeekBack() {}

    disableSeekBack() {}

    hideSeekButtons() {}

    enablePlayButton() {}

    disablePlayButton() {}

    setPlaying(isPlaying: boolean) {}

    setNextAvailable(isNextAvailable: boolean) {}

    setBackAvailable(isBackAvailable: boolean) {}

    enableSubtitlesButton() {}

    disableSubtitlesButton() {}

    setSubtitlesAboveElement(element?: HTMLElement) {}

    resetSubtitleHeight() {}

    enableBackgroundAudio() {}

    disableBackgroundAudio() {}

    setAccessilitySliderAvailable(show: boolean) {}

    activateRomperButtons(event?: Event) {}
}

export {ControlEvents}
export default BaseControls