// @flow
import EventEmitter from 'events';

/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

const ControlEvents = [
    'SHOWING_BUTTONS',
    'HIDING_BUTTONS',
].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName;
    return events;
}, {});


//
// Component containing UI for all buttons
//
class BaseControls extends EventEmitter {

    _logUserInteraction: Function;

    constructor(
        logUserInteraction: Function,
        volumeOverlay: Overlay,
        chapterOverlay: Overlay,
        switchableOverlay: Overlay,
    ) {
        super();
        this._logUserInteraction = logUserInteraction;
    }

    /* setters for overlay buttons */
    setVolumeButton(button: HTMLButtonElement) { }

    setChapterButton(button: HTMLButtonElement) { }

    setSwitchableButton(button: HTMLButtonElement) { }

    /* getters */
    
    // get the whole lot organised in a DIV
    getControls(): HTMLDivElement {
        return document.createElement('div');
    }

    // get a div that activates the buttons
    getActivator(): HTMLDivElement { }

    // are the controls showing
    getShowing(): boolean { }

    /* exposing functionality to change how buttons look/feel */
    disableControls() { }

    enableControls() { }

    showControls() { }

    hideControls() { }

    setControlsActive() { }

    setControlsInactive() { }

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

    showSeekButtons(){ }

    enableSeekBack() { }

    disableSeekBack() { }

    hideSeekButtons(){ }

    enablePlayButton() { }

    disablePlayButton() { }

    setPlaying(isPlaying: boolean){ }

    setNextAvailable(isNextAvailable: boolean) { }

    setBackAvailable(isBackAvailable: boolean) { }

    enableSubtitlesButton() { }

    disableSubtitlesButton() { }
}

export { ControlEvents };
export default BaseControls;