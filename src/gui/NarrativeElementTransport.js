// @flow
import EventEmitter from 'events';
import AnalyticEvents from '../AnalyticEvents';
import { handleButtonTouchEvent } from '../utils';
import { ButtonEvents } from './Buttons';

//
// Component containing UI for Narrative Element controls
//
class NarrativeElementTransport extends EventEmitter {

    _playPauseButton: HTMLButtonElement;

    _backButton: HTMLButtonElement;

    _seekBackButton: HTMLButtonElement;

    _seekForwardButton: HTMLButtonElement;

    _nextButton: HTMLButtonElement;

    _container: HTMLDivElement;

    _backNextWaiting: boolean; // flag to stop spamming of buttons
    
    _backClickedOnce: boolean; // but allow double click on back

    _logUserInteraction: Function;

    _isPlaying: boolean;

    constructor(
        logUserInteraction: Function,
    ) {
        super();
        this._logUserInteraction = logUserInteraction;
        this._container = document.createElement('div');
        this._container.classList.add('romper-narrative-element-transport');

        this._backButton = document.createElement('button');
        this._backButton.setAttribute('tabindex', '2');
        this._backButton.setAttribute('type', 'button');
        this._backButton.classList.add('romper-button');
        this._backButton.classList.add('romper-back-button');
        this._backButton.setAttribute('title', 'Back Button');
        this._backButton.setAttribute('aria-label', 'Back');
        const backButtonIconDiv = document.createElement('div');
        backButtonIconDiv.classList.add('romper-button-icon-div');
        backButtonIconDiv.classList.add('romper-back-button-icon-div');
        this._backButton.appendChild(backButtonIconDiv);
        this._container.appendChild(this._backButton);

        this._seekBackButton = document.createElement('button');
        this._seekBackButton.setAttribute('tabindex', '2');
        this._seekBackButton.setAttribute('type', 'button');
        this._seekBackButton.classList.add('romper-button');
        this._seekBackButton.classList.add('romper-seek-back-button');
        this._seekBackButton.setAttribute('title', 'Seek Back Button');
        this._seekBackButton.setAttribute('aria-label', 'Seek Back');
        const seekBackButtonIconDiv = document.createElement('div');
        seekBackButtonIconDiv.classList.add('romper-button-icon-div');
        this._seekBackButton.appendChild(seekBackButtonIconDiv);
        this._container.appendChild(this._seekBackButton);

        this._playPauseButton = document.createElement('button');
        this._playPauseButton.setAttribute('tabindex', '2');
        this._playPauseButton.setAttribute('type', 'button');
        this._playPauseButton.classList.add('romper-button');
        this._playPauseButton.classList.add('romper-play-button');
        this._playPauseButton.setAttribute('title', 'Play Pause Button');
        this._playPauseButton.setAttribute('aria-label', 'Play Pause');
        const playPauseButtonIconDiv = document.createElement('div');
        playPauseButtonIconDiv.classList.add('romper-button-icon-div');
        this._playPauseButton.appendChild(playPauseButtonIconDiv);
        this._container.appendChild(this._playPauseButton);

        this._seekForwardButton = document.createElement('button');
        this._seekForwardButton.setAttribute('type', 'button');
        this._seekForwardButton.setAttribute('tabindex', '2');
        this._seekForwardButton.classList.add('romper-button');
        this._seekForwardButton.classList.add('romper-seek-fwd-button');
        this._seekForwardButton.setAttribute('title', 'Seek Forward Button');
        this._seekForwardButton.setAttribute('aria-label', 'Seek Forward');
        const seekForwardButtonIconDiv = document.createElement('div');
        seekForwardButtonIconDiv.classList.add('romper-button-icon-div');
        this._seekForwardButton.appendChild(seekForwardButtonIconDiv);
        this._container.appendChild(this._seekForwardButton);

        this._nextButton = document.createElement('button');
        this._nextButton.setAttribute('type', 'button');
        this._nextButton.setAttribute('tabindex', '2');
        this._nextButton.classList.add('romper-button');
        this._nextButton.classList.add('romper-next-button');
        this._nextButton.setAttribute('title', 'Next Button');
        this._nextButton.setAttribute('aria-label', 'Next');
        this._container.appendChild(this._nextButton);
        const nextButtonIconDiv = document.createElement('div');
        nextButtonIconDiv.classList.add('romper-button-icon-div');
        this._nextButton.appendChild(nextButtonIconDiv);
        this._backNextWaiting = false;
        this._backClickedOnce = false;

        this._backButton.onclick = this._backButtonClicked.bind(this);
        this._backButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._backButtonClicked.bind(this)),
        );

        this._nextButton.onclick = this._nextButtonClicked.bind(this);
        this._nextButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._nextButtonClicked.bind(this)),
        );

        this._playPauseButton.onclick = this._playPauseButtonClicked.bind(this);

        this._playPauseButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._playPauseButtonClicked.bind(this)),
        );

        this._seekBackButton.onclick = this._seekBackwardButtonClicked.bind(this);
        this._seekBackButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._seekBackwardButtonClicked.bind(this)),
        );

        this._seekForwardButton.onclick = this._seekForwardButtonClicked.bind(this);
        this._seekForwardButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._seekForwardButtonClicked.bind(this)),
        );

        this._isPlaying = false;
    }

    // get the HTML <div> container with the buttons
    getControls() {
        return this._container;
    }

    // show the controls
    show() {
        this._container.classList.add('show');
    }

    // hide the controls
    hide() {
        this._container.classList.remove('show');
    }

    // set all controls active
    setActive() {
        this._container.classList.remove('romper-inactive');
    }

    // set all controls inactive
    setInactive() {
        this._container.classList.add('romper-inactive');
    }

    disablePlayButton() {
        this._playPauseButton.classList.add('romper-control-disabled');
        this._playPauseButton.setAttribute('disabled', 'true');
    }

    enablePlayButton() {
        this._playPauseButton.classList.remove('romper-control-disabled');
        this._playPauseButton.removeAttribute('disabled');
    }

    // switch the play pause button between play and pause states
    setPlaying(isPlaying: boolean) {
        this._isPlaying = isPlaying
        if (isPlaying) {
            this._playPauseButton.classList.add('romper-pause-button');
            this._playPauseButton.classList.remove('romper-play-button');
        } else {
            this._playPauseButton.classList.add('romper-play-button');
            this._playPauseButton.classList.remove('romper-pause-button');
        }
    }

    setNextAvailable(isNextAvailable: boolean) {
        if (isNextAvailable) {
            this._nextButton.classList.remove('romper-unavailable');
            this._nextButton.disabled = false;
        } else {
            this._nextButton.classList.add('romper-unavailable');
            this._nextButton.disabled = true;
        }
    }

    setBackAvailable(isBackAvailable: boolean) {
        if (isBackAvailable) {
            this._backButton.classList.remove('romper-unavailable');
            this._backButton.disabled = false;
        } else {
            this._backButton.classList.add('romper-unavailable');
            this._backButton.disabled = true;
        }
    }

    showSeekButtons() {
        this._seekBackButton.classList.remove('romper-control-disabled');
        this._seekBackButton.removeAttribute('disabled');
        this._seekForwardButton.classList.remove('romper-control-disabled');
        this._seekForwardButton.removeAttribute('disabled');
    }

    hideSeekButtons() {
        this._seekBackButton.classList.add('romper-control-disabled');
        this._seekBackButton.setAttribute('disabled', 'true');
        this._seekForwardButton.classList.add('romper-control-disabled');
        this._seekForwardButton.setAttribute('disabled', 'true');
    }

    enableSeekBack() {
        this._seekBackButton.classList.remove('romper-control-disabled');
        this._seekBackButton.removeAttribute('disabled');
    }

    disableSeekBack() {        
        this._seekBackButton.classList.add('romper-control-disabled');
        this._seekBackButton.setAttribute('disabled', 'true');
    }

    _playPauseButtonClicked() {
        if(this._isPlaying) {
            this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED, {pauseButtonClicked: true});
        } else {
            this.emit(ButtonEvents.PLAY_PAUSE_BUTTON_CLICKED, {playButtonClicked: true});
        }
        this._logUserInteraction(AnalyticEvents.names.PLAY_PAUSE_BUTTON_CLICKED);
    }

    _seekForwardButtonClicked() {
        if (!this._backNextWaiting) {
            this.emit(ButtonEvents.SEEK_FORWARD_BUTTON_CLICKED);
            this._backNextWaiting = true;
            setTimeout(() => { this._backNextWaiting = false; }, 500);
        }
    }

    _seekBackwardButtonClicked() {
        if (!this._backNextWaiting) {
            this.emit(ButtonEvents.SEEK_BACKWARD_BUTTON_CLICKED);
            this._backNextWaiting = true;
            setTimeout(() => { this._backNextWaiting = false; }, 500);
        }
    }

    _backButtonClicked() {
        if (!this._backClickedOnce) {
            this.emit(ButtonEvents.BACK_BUTTON_CLICKED);
            this._backClickedOnce = true;
            setTimeout(() => { 
                this._backClickedOnce = false;
            }, 1000);
        } else if (!this._backNextWaiting) {
            this.emit(ButtonEvents.BACK_BUTTON_CLICKED);
            this._backNextWaiting = true;
            setTimeout(() => { 
                this._backNextWaiting = false;
                this._backClickedOnce = false;
            }, 500);
        }

        this._logUserInteraction(AnalyticEvents.names.BACK_BUTTON_CLICKED);
    }

    _nextButtonClicked() {
        if (!this._backNextWaiting) {
            this.emit(ButtonEvents.NEXT_BUTTON_CLICKED);
            this._backNextWaiting = true;
            setTimeout(() => { this._backNextWaiting = false; }, 500);
        }
        this._logUserInteraction(AnalyticEvents.names.NEXT_BUTTON_CLICKED);
    }
}

export default NarrativeElementTransport;
