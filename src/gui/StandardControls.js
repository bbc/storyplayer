// @flow
import BaseControls, { ControlEvents } from './BaseControls';
import Buttons, { ButtonEvents } from './Buttons';
import BaseButtons from './BaseButtons'
import ScrubBar from './ScrubBar';
import BaseScrubBar from './BaseScrubBar';
import Overlay from './Overlay';
import BaseRenderer from '../renderers/BaseRenderer';
import { handleButtonTouchEvent } from '../utils';
import { createElementWithClass } from '../documentUtils';

//
// Component containing UI for all buttons
//
class StandardControls extends BaseControls {

    _buttonsContainer: HTMLDivElement;

    _scrubBar: BaseScrubBar;

    _buttonsActivateArea: HTMLDivElement;

    _showRomperButtonsTimeout: TimeoutID;

    _hideTimeout: ?TimeoutID;

    _narrativeElementTransport: HTMLDivElement;

    _buttonControls: BaseButtons;

    _controlsDisabled: boolean;

    _logUserInteraction: Function;

    constructor(
        logUserInteraction: Function,
        volumeOverlay: Overlay,
        chapterOverlay: Overlay,
        switchableOverlay: Overlay,
    ) {
        super(logUserInteraction, volumeOverlay, chapterOverlay, switchableOverlay);

        // create button manager and scrub bar
        this._buttonControls = new Buttons(this._logUserInteraction);
        this._forwardButtonEvents();
        this._scrubBar = new ScrubBar(this._logUserInteraction);

        this._buttonsActivateArea = createElementWithClass('div', 'button-activate-area', ['romper-buttons-activate-area', 'hide', 'romper-inactive']);

        this._buttonsActivateArea.onmouseenter = () => {
            this.activateRomperButtons();
        };
        this._buttonsActivateArea.onmousemove = () => {
            this.activateRomperButtons();
        };
        this._buttonsActivateArea.addEventListener(
            'touchend',
            handleButtonTouchEvent(this.activateRomperButtons.bind(this)),
        );
        this._buttonsActivateArea.onclick = this.activateRomperButtons.bind(this);


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
        this._buttonsContainer = createElementWithClass('div', 'buttons-container', ['romper-buttons']);

        this._buttonsContainer.appendChild(this._scrubBar.getScrubBarElement());
        this._buttonsContainer.appendChild(mediaTransport);
        this._buttonsContainer.onmousemove = () => {
            this.activateRomperButtons();
        };
        this._buttonsContainer.onmouseleave = () => {
            this.hideControls();
        };
    }

    // pass on any events
    _forwardButtonEvents() {
        [
            ButtonEvents.SUBTITLES_BUTTON_CLICKED,
            ButtonEvents.FULLSCREEN_BUTTON_CLICKED,
            ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED,
            ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED,
            ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED,
            ButtonEvents.BACK_BUTTON_CLICKED,
            ButtonEvents.NEXT_BUTTON_CLICKED,
        ].forEach((eventType) => {
            this._buttonControls.on(eventType, (e) => this.emit(eventType, e));
        })
    }

    activateRomperButtons(event: ?Object, override: ?boolean) {
        if(event) {
            event.stopPropagation();
            event.preventDefault();
        }
        if (!override && this._controlsDisabled) {
            return;
        }
        if (!this.getShowing()) {
            this.showControls();
        }
        if(override) {
            return;
        }
        if (this._showRomperButtonsTimeout) clearTimeout(this._showRomperButtonsTimeout);
        this._showRomperButtonsTimeout = setTimeout(() => this.hideControls(), 5000);
    }

    // get the whole lot organised in a DIV
    getControls(): HTMLDivElement {
        return this._buttonsContainer;
    }

    getActivator(): HTMLDivElement {
        return this._buttonsActivateArea;
    }

    // this stops activation from proceeding
    // and hides controls immediately
    disableControls() {
        this._controlsDisabled = true;
        this.hideControls();
    }

    enableControls() {
        this._controlsDisabled = false;
    }

    getShowing(): boolean {
        return this._buttonsContainer.classList.contains('show');
    }

    // make the controls visible
    showControls() {
        if (this._hideTimeout) {
            // has only just hidden - don't emit either event
            clearTimeout(this._hideTimeout);
        } else {
            this.emit(ControlEvents.SHOWING_BUTTONS);
        }
        this._buttonsContainer.classList.add('show');
        this._buttonControls.showTransportControls();
        this._buttonsActivateArea.classList.add('hide');
    }

    // make the controls disappear
    hideControls() {
        if (!this.getShowing()) return;
        if (this._showRomperButtonsTimeout) clearTimeout(this._showRomperButtonsTimeout);
        this._buttonsContainer.classList.remove('show');
        this._buttonControls.hideTransportControls();
        this._buttonsActivateArea.classList.remove('hide');
        // hiding the controls causes the mouse to trigger a new show event
        // we don't want to spam the Player with show/hide events
        // when the controls are basically staying visible
        // so emit event after a short timeout; if the buttons show again
        // clear the timeout
        this._hideTimeout = setTimeout(() => {
            if (!this.getShowing()) {
                this.emit(ControlEvents.HIDING_BUTTONS);
                this._hideTimeout = null;
            }
        }, 300);
    }

    // this is like disableControls, but also has the effect of getting rid
    // of the activate area, so other things can be clicked on (e.g., start button)
    setControlsInactive() {
        this._buttonsContainer.classList.add('romper-inactive');
        this._buttonsActivateArea.classList.add('romper-inactive');
    }

    setControlsActive() {
        this._buttonsContainer.classList.remove('romper-inactive');
        this._buttonsActivateArea.classList.remove('romper-inactive');
        this._buttonsActivateArea.classList.remove('hide');
    }

    setFullscreenOn() {
        this._buttonsContainer.classList.add('romper-buttons-fullscreen');
    }

    setFullscreenOff() {
        this._buttonsContainer.classList.remove('romper-buttons-fullscreen');
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
        this._scrubBar.disconnect(this._buttonsContainer);
    }

    /* exposing functionality to change how buttons look/feel */
    setTransportControlsActive() {
        this._buttonControls.setTransportControlsActive();
    }

    setTransportControlsInactive() {
        this._buttonControls.setTransportControlsInactive();
    }

    showSeekButtons() {
        this._buttonControls.showSeekButtons();
    }

    hideSeekButtons() {
        this._buttonControls.hideSeekButtons();
    }

    enableSeekBack() {
        this._buttonControls.enableSeekBack();
    }

    disableSeekBack() {
        this._buttonControls.disableSeekBack();
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
