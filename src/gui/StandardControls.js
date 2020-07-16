// @flow
import BaseControls from './BaseControls';
import Buttons, { ButtonEvents } from './Buttons';
import ScrubBar from './ScrubBar';
import Overlay from './Overlay';

//
// Component containing UI for all buttons
//
class StandardControls extends BaseControls {

    _containerDiv: HTMLDivElement;

    _scrubBar: BaseScrubBar;

    _buttonsActivateArea: HTMLDivElement;

    _narrativeElementTransport: HTMLDivElement;

    _buttonControls: BaseButtons;

    _logUserInteraction: Function;

    constructor(
        logUserInteraction: Function,
        volumeOverlay: Overlay,
        chapterOverlay: Overlay,
        switchableOverlay: Overlay,
    ) {
        super(logUserInteraction);
        this._logUserInteraction = logUserInteraction;

        // create button manager and scrub bar
        this._buttonControls = new Buttons(this._logUserInteraction);
        this._forwardButtonEvents();
        this._scrubBar = new ScrubBar(this._logUserInteraction);

        // next is needed for activating buttons area
        this._narrativeElementTransport = this._buttonControls.getTransportControls();

        // pass the overlay buttons to the button manager
        this._buttonControls.setVolumeButton(volumeOverlay.getButton());
        this._buttonControls.setChapterButton(chapterOverlay.getButton());
        this._buttonControls.setSwitchableButton(switchableOverlay.getButton());

        // build the control structure
        const mediaTransport = this._buttonControls.getControlsDiv(
            volumeOverlay.getOverlay(),
            chapterOverlay.getOverlay(),
            switchableOverlay.getOverlay(),
        );

        // add transport control buttons and scrub bar
        this._containerDiv = document.createElement('div');
        this._containerDiv.classList.add('romper-buttons');
        this._containerDiv.appendChild(this._scrubBar.getScrubBarElement());
        this._containerDiv.appendChild(mediaTransport);
    }
    
    // pass on any events
    _forwardButtonEvents() {
        this._buttonControls.on(ButtonEvents.SUBTITLES_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.SUBTITLES_BUTTON_CLICKED));
        this._buttonControls.on(ButtonEvents.FULLSCREEN_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.FULLSCREEN_BUTTON_CLICKED));
        this._buttonControls.on(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED));
        this._buttonControls.on(ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED));
        this._buttonControls.on(ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED));
        this._buttonControls.on(ButtonEvents.BACK_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.BACK_BUTTON_CLICKED));
        this._buttonControls.on(ButtonEvents.NEXT_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.NEXT_BUTTON_CLICKED));
    }

    // get the whole lot organised in a DIV
    getControls(): HTMLDivElement {
        return this._containerDiv;
    }

    showControls() {
        this._containerDiv.classList.add('show');
    }

    hideControls() {
        this._containerDiv.classList.remove('show');
    }

    setControlsActive() {
        this._containerDiv.classList.remove('romper-inactive');
    }

    setControlsInactive() {
        this._containerDiv.classList.add('romper-inactive');
    }

    setFullscreenOn() {
        this._containerDiv.classList.add('romper-buttons-fullscreen');
    }

    setFullscreenOff() {
        this._containerDiv.classList.remove('romper-buttons-fullscreen');
    }

    hideScrubBar() {
        this._scrubBar.hide();
    }

    showScrubBar() {
        this._scrubBar.show();
    }

    enableScrubBar() {
        this._scrubBar.enable();
    }

    disableScrubBar() {
        this._scrubBar.disable();
    }

    connectScrubBar(renderer: BaseRenderer) { 
        this._scrubBar.connect(renderer);
    }

    disconnectScrubBar() {
        this._scrubBar.disconnect(this._containerDiv);
    }

    /* exposing functionality to change how buttons look/feel */
    showTransportControls() {
        this._buttonControls.showTransportControls();
    }

    hideTransportControls() {
        this._buttonControls.hideTransportControls();
    }

    setTransportControlsActive() {
        this._buttonControls.setTransportControlsActive();
    }

    setTransportControlsInactive() {
        this._buttonControls.setTransportControlsInactive();
    }

    showSeekButtons(){
        this._buttonControls.showSeekButtons();
    }

    enablePlayButton() {
        this._buttonControls.enablePlayButton();
    }

    disablePlayButton() {
        this._buttonControls.disablePlayButton();
    }

    setPlaying(isPlaying: boolean){
        this._buttonControls.setPlaying(isPlaying);
    }

    setNextAvailable(isNextAvailable: boolean) {
        this._buttonControls.setNextAvailable(isNextAvailable);
    }

    setBackAvailable(isBackAvailable: boolean) {
        this._buttonControls.setBackAvailable(isBackAvailable);
    }

    enableSubtitlesButton() {
        this._buttonControls.enableSubtitlesButton();
    }

    disableSubtitlesButton() {
        this._buttonControls.disableSubtitlesButton();
    }
}

export default StandardControls;