// @flow
import EventEmitter from 'events';
// import AnalyticEvents from '../AnalyticEvents';
import { handleButtonTouchEvent } from '../utils';
import AnalyticEvents from '../AnalyticEvents';
import NarrativeElementTransport from './NarrativeElementTransport';

const ButtonEvents = [
    'BACK_BUTTON_CLICKED',
    'NEXT_BUTTON_CLICKED',
    'PLAY_PAUSE_BUTTON_CLICKED',
    'SEEK_FORWARD_BUTTON_CLICKED',
    'SEEK_BACKWARD_BUTTON_CLICKED',
    'SUBTITLES_BUTTON_CLICKED',
    'FULLSCREEN_BUTTON_CLICKED',
    'REPEAT_BUTTON_CLICKED',
    'SCRUB_BAR_MOUSE_DOWN',
    'SCRUB_BAR_CHANGED',
    'SCRUB_BAR_MOUSE_UP',
].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName;
    return events;
}, {});

//
// Component containing UI for all buttons
//
class Buttons extends EventEmitter {

    _subtitlesButton: HTMLButtonElement;

    showingSubtitles: boolean;

    _fullscreenButton: HTMLButtonElement;

    _transportControls: NarrativeElementTransport;

    _logUserInteraction: Function;

    constructor(logUserInteraction) {
        super();
        this._logUserInteraction = logUserInteraction;

        this._subtitlesButton = this._createSubtitlesButton();
        this.showingSubtitles = false;

        this._fullscreenButton = this._createFullscreenButton();
        this._transportControls = this._initiateTransportControls();
    }

    _initiateTransportControls(): NarrativeElementTransport {
        const transportControls = new NarrativeElementTransport(this._logUserInteraction);
        transportControls.on(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED, () => this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED));
        transportControls.on(ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED, () => this.emit(ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED));
        transportControls.on(ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED, () => this.emit(ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED));
        transportControls.on(ButtonEvents.BACK_BUTTON_CLICKED, () => this.emit(ButtonEvents.BACK_BUTTON_CLICKED));
        transportControls.on(ButtonEvents.NEXT_BUTTON_CLICKED, () => this.emit(ButtonEvents.NEXT_BUTTON_CLICKED));
        return transportControls;
    }

    getTransportControls() {
        return this._transportControls;
    }

    getSubtitlesButton() {
        return this._subtitlesButton;
    }

    _setSubtitlesButtonSelected(selected: boolean) {
        if (selected) {
            this._subtitlesButton.classList.add('romper-button-selected');
        } else {
            this._subtitlesButton.classList.remove('romper-button-selected');
        }
    }

    enableSubtitlesButton() {
        this._subtitlesButton.classList.remove('romper-control-disabled');
        this._subtitlesButton.removeAttribute('disabled');
    }

    disableSubtitlesButton() {
        this._subtitlesButton.classList.add('romper-control-disabled');
        this._subtitlesButton.setAttribute('disabled', 'true');
    }

    getFullscreenButton() { 
        return this._fullscreenButton;
    }

    _createSubtitlesButton(): HTMLButtonElement {
        const subsButton = document.createElement('button');
        subsButton.setAttribute('type', 'button');
        subsButton.classList.add('romper-button');
        subsButton.setAttribute('title', 'Subtitles Button');
        subsButton.setAttribute('aria-label', 'Subtitles Button');
        subsButton.classList.add('romper-subtitles-button');
        // this.disableSubtitlesControl();
        const subtitlesButtonIconDiv = document.createElement('div');
        subtitlesButtonIconDiv.classList.add('romper-button-icon-div');
        subtitlesButtonIconDiv.classList.add('romper-subtitles-button-icon-div');
        subsButton.appendChild(subtitlesButtonIconDiv);

        subsButton.onclick = this._handleSubtitlesButton.bind(this);
        subsButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._handleSubtitlesButton.bind(this)),
        );
        return subsButton;
    }

    _createFullscreenButton(): HTMLButtonElement {
        const fsButton = document.createElement('button');
        fsButton.setAttribute('type', 'button');
        fsButton.classList.add('romper-button');
        fsButton.classList.add('romper-fullscreen-button');
        fsButton.setAttribute('title', 'Fullscreen Button');
        fsButton.setAttribute('aria-label', 'Fullscreen Button');
        const fullscreenButtonIconDiv = document.createElement('div');
        fullscreenButtonIconDiv.classList.add('romper-button-icon-div');
        fullscreenButtonIconDiv.classList.add('romper-fullscreen-button-icon-div');
        fsButton.appendChild(fullscreenButtonIconDiv);

        fsButton.onclick = this._handleFullScreenButton.bind(this);
        fsButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._handleFullScreenButton.bind(this)),
        );
        return fsButton;
    }

    _handleFullScreenButton() {
        this.emit(ButtonEvents.FULLSCREEN_BUTTON_CLICKED);
    }

    _handleSubtitlesButton() {
        this.showingSubtitles = !this.showingSubtitles;
        this._setSubtitlesButtonSelected(this.showingSubtitles);
        
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

}

export { ButtonEvents };
export default Buttons;