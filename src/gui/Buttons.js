// @flow
import { handleButtonTouchEvent } from '../utils';
import AnalyticEvents from '../AnalyticEvents';
import NarrativeElementTransport from './NarrativeElementTransport';
import BaseButtons, { ButtonEvents } from './BaseButtons';
import { createElementWithClass } from '../documentUtils';

//
// Component containing UI for all buttons
//
class Buttons extends BaseButtons {

    _subtitlesButton: HTMLButtonElement;

    showingSubtitles: boolean;

    _fullscreenButton: HTMLButtonElement;

    _transportControls: NarrativeElementTransport;

    constructor(logUserInteraction: Function) {
        super(logUserInteraction);

        this._subtitlesButton = this._createSubtitlesButton();
        this.showingSubtitles = false;

        this._fullscreenButton = this._createFullscreenButton();
        this._transportControls = this._initiateTransportControls();
    }

    /* creating stuff */
    _createSubtitlesButton(): HTMLButtonElement {
        const subsButton = createElementWithClass('button', 'subtitle-button', ['romper-button', 'romper-subtitles-button']);
        subsButton.setAttribute('type', 'button');
        subsButton.setAttribute('title', 'Subtitles Button');
        subsButton.setAttribute('aria-label', 'Subtitles Button');
        // this.disableSubtitlesControl();
        const subtitlesButtonIconDiv = createElementWithClass('div', 'subtitles-icon', ['romper-button-icon-div', 'romper-subtitles-button-icon-div']);
        subsButton.appendChild(subtitlesButtonIconDiv);

        subsButton.onclick = this._handleSubtitlesButton.bind(this);
        subsButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._handleSubtitlesButton.bind(this)),
        );
        return subsButton;
    }

    _createFullscreenButton(): HTMLButtonElement {
        const fsButton = createElementWithClass('button', 'fullscreen-button', ['romper-button', 'romper-fullscreen-button']);
        fsButton.setAttribute('type', 'button');
        fsButton.setAttribute('title', 'Fullscreen Button');
        fsButton.setAttribute('aria-label', 'Fullscreen Button');
        const fullscreenButtonIconDiv = createElementWithClass('div', 'fullscreen-icon', ['romper-button-icon-div', 'romper-fullscreen-button-icon-div']);
        fsButton.appendChild(fullscreenButtonIconDiv);

        fsButton.onclick = this._handleFullScreenButton.bind(this);
        fsButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._handleFullScreenButton.bind(this)),
        );
        return fsButton;
    }

    _initiateTransportControls(): NarrativeElementTransport {
        const transportControls = new NarrativeElementTransport(this._logUserInteraction);
        transportControls.on(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED));
        transportControls.on(ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED));
        transportControls.on(ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED));
        transportControls.on(ButtonEvents.BACK_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.BACK_BUTTON_CLICKED));
        transportControls.on(ButtonEvents.NEXT_BUTTON_CLICKED,
            () => this.emit(ButtonEvents.NEXT_BUTTON_CLICKED));
        return transportControls;
    }

    /* handling clicks */
    _handleFullScreenButton() {
        this.emit(ButtonEvents.FULLSCREEN_BUTTON_CLICKED);
    }

    _handleSubtitlesButton() {
        this.showingSubtitles = !this.showingSubtitles;
        if (this.showingSubtitles) {
            this._subtitlesButton.classList.add('romper-button-selected');
        } else {
            this._subtitlesButton.classList.remove('romper-button-selected');
        }
        
        const showingSubtitlesIntToString = [
            'hidden',
            'showing',
        ];

        this.emit(ButtonEvents.SUBTITLES_BUTTON_CLICKED);
        // The + here converts bool to int
        this._logUserInteraction(
            AnalyticEvents.names.SUBTITLES_BUTTON_CLICKED,
            showingSubtitlesIntToString[+!this.showingSubtitles],
            showingSubtitlesIntToString[+this.showingSubtitles],
        );
    }

    /* getters */

    // get div with back, seeek back, play/pause, seek fwd, next
    getTransportControls() {
        return this._transportControls.getControls();
    }

    getFullscreenButton() { 
        return this._fullscreenButton;
    }

    getSubtitlesButton() {
        return this._subtitlesButton;
    }

    // get an HTML DIV element that contains all the UI, including buttons
    // and overlays, but not the scrub bar
    // nor the button activation controls
    getControlsDiv(
        volumeOverlay: HTMLDivElement,
        chapterOverlay: HTMLDivElement,
        switchableOverlay: HTMLDivElement,
    ): HTMLDivElement {
        // create the container divs
        const mediaTransport = createElementWithClass('div', 'media-transport', ['romper-media-transport']);
        
        const mediaTransportLeft = createElementWithClass('div', 'media-transport-left', ['left']);
        const mediaTransportCenter = createElementWithClass('div', 'media-transport-center', ['center']);
        const mediaTransportRight = createElementWithClass('div', 'media-transport-right', ['right']);

        mediaTransport.appendChild(mediaTransportLeft);
        mediaTransport.appendChild(mediaTransportCenter);
        mediaTransport.appendChild(mediaTransportRight);

        // to hold icon and representation toggles:
        const overlayToggleButtons = createElementWithClass('div', 'overlay-controls', ['romper-overlay-controls']);

        // add the buttons to the appropriate container divs
        // volume on left
        mediaTransportLeft.appendChild(this.getVolumeButton());
        mediaTransportLeft.appendChild(volumeOverlay);

        // back, seek, play, seek, next in center
        mediaTransportCenter.appendChild(this.getTransportControls());

        // switchable, chapter, subtitles, fullscreen on right
        mediaTransportRight.appendChild(switchableOverlay);
        mediaTransportRight.appendChild(chapterOverlay);
        overlayToggleButtons.appendChild(this.getSwitchableButton());
        overlayToggleButtons.appendChild(this.getChapterButton());
        mediaTransportRight.appendChild(overlayToggleButtons);
        const subtitlesButton = this.getSubtitlesButton();
        mediaTransportRight.appendChild(subtitlesButton);
        this._fullscreenButton = this.getFullscreenButton();
        mediaTransportRight.appendChild(this._fullscreenButton);

        return mediaTransport;
    }

    /* exposing functionality to change how buttons look/feel */

    // show/hide
    showTransportControls() {
        this._transportControls.show();
    }

    hideTransportControls() {
        this._transportControls.hide();
    }

    setTransportControlsActive() {
        this._transportControls.setActive();
    }

    setTransportControlsInactive() {
        this._transportControls.setInactive();
    }

    showSeekButtons() {
        this._transportControls.showSeekButtons();
    }

    hideSeekButtons() {
        this._transportControls.hideSeekButtons();
    }

    enableSeekBack() {
        this._transportControls.enableSeekBack();
    }

    disableSeekBack() {
        this._transportControls.disableSeekBack();
    }

    enablePlayButton() {
        this._transportControls.enablePlayButton();
    }

    disablePlayButton() {
        this._transportControls.disablePlayButton();
    }

    setPlaying(isPlaying: boolean){
        this._transportControls.setPlaying(isPlaying);
    }

    setNextAvailable(isNextAvailable: boolean) {
        this._transportControls.setNextAvailable(isNextAvailable);
    }

    setBackAvailable(isBackAvailable: boolean) {
        this._transportControls.setBackAvailable(isBackAvailable);
    }

    enableSubtitlesButton() {
        this._subtitlesButton.classList.remove('romper-control-disabled');
        this._subtitlesButton.removeAttribute('disabled');
    }

    disableSubtitlesButton() {
        this._subtitlesButton.classList.add('romper-control-disabled');
        this._subtitlesButton.setAttribute('disabled', 'true');
    }
}

export { ButtonEvents };
export default Buttons;