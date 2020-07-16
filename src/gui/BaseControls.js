// @flow
import EventEmitter from 'events';

/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

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

    /* exposing functionality to change how buttons look/feel */
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

    showTransportControls() {  }

    hideTransportControls() { }

    setTransportControlsActive() { }

    setTransportControlsInactive() { }

    showSeekButtons(){ }

    enablePlayButton() { }

    disablePlayButton() { }

    setPlaying(isPlaying: boolean){ }

    setNextAvailable(isNextAvailable: boolean) { }

    setBackAvailable(isBackAvailable: boolean) { }

    enableSubtitlesButton() { }

    disableSubtitlesButton() { }
}

export default BaseControls;