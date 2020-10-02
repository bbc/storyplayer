// @flow
import EventEmitter from 'events';
import { handleButtonTouchEvent } from '../utils';
import Controller from '../Controller';

const DEFAULT_ERROR_MESSAGE = "Sorry, there is a problem - try skipping ahead";

//
// Component that shows an error modal
// with a message and ignore/next buttons
//
class ErrorControls extends EventEmitter {

    _container: HTMLDivElement;

    _controller: Controller;

    _nextButton: HTMLButtonElement;

    _ignoreButton: HTMLButtonElement;

    _messageDiv: HTMLDivElement;

    _controlsDiv: HTMLDivElement;


    constructor(controller) {
        super();
        this._controller = controller;
        this._buildUi();
    }

    // generate the UI
    _buildUi() {
        // modal
        this._container = document.createElement('div');
        this._container.classList.add('romper-error', 'romper-error-controls', 'hide');

        // message
        this._addMessageDiv();

        // controls
        this._addControls();
    }

    /**
     * get the DIV element that will show the message and/or controls
     */
    getLayer() {
        return this._container;
    }

    _addControls(){
        // container
        this._controlsDiv = document.createElement('div');
        this._controlsDiv.classList.add('romper-error-buttons', 'hide');
        this._container.appendChild(this._controlsDiv);
        // cancel/ignore button
        this._addIgnoreButton();
        // next button
        this._addNextButton();
    }

    _addNextButton() {
        this._nextButton = document.createElement('button');
        this._nextButton.setAttribute('type', 'button');
        this._nextButton.classList.add('romper-button');
        this._nextButton.classList.add('romper-next-button');
        this._nextButton.setAttribute('title', 'Next Button');
        this._nextButton.setAttribute('aria-label', 'Next Button');
        this._controlsDiv.appendChild(this._nextButton);
        const nextButtonIconDiv = document.createElement('div');
        nextButtonIconDiv.classList.add('romper-button-icon-div');
        this._nextButton.appendChild(document.createTextNode('Skip'));
        this._nextButton.appendChild(nextButtonIconDiv);

        this._nextButton.onclick = this._nextButtonClicked.bind(this);
        this._nextButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._nextButtonClicked.bind(this)),
        );
    }

    _addIgnoreButton() {
        this._ignoreButton = document.createElement('button');
        this._ignoreButton.setAttribute('type', 'button');
        this._ignoreButton.classList.add('romper-button', 'romper-ignore-button');
        this._ignoreButton.textContent = 'Ignore';
        this._ignoreButton.setAttribute('title', 'Ignore Button');
        this._ignoreButton.setAttribute('aria-label', 'Ignore Button');
        this._controlsDiv.appendChild(this._ignoreButton);
        const ignoreButtonIconDiv = document.createElement('div');
        ignoreButtonIconDiv.classList.add('romper-button-icon-div');
        this._ignoreButton.appendChild(ignoreButtonIconDiv);

        this._ignoreButton.onclick = this._ignoreButtonClicked.bind(this);
        this._ignoreButton.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._ignoreButtonClicked.bind(this)),
        );       
    }

    _addMessageDiv() {
        this._messageDiv = document.createElement('div');
        this._messageDiv.id = 'romper-error-message';
        this._messageDiv.className = 'romper-error-message';
        const errorMessage = document.createTextNode(DEFAULT_ERROR_MESSAGE);
        this._messageDiv.appendChild(errorMessage);
        this._container.appendChild(this._messageDiv);
    }

    _nextButtonClicked() {
        this._controller._reasoner.next();
        this.hideMessageControls();
    }

    _ignoreButtonClicked() {
        this.hideMessageControls();
    }

    // show a message, but no controls
    // if null default message is shown
    showMessage(message) {
        this._controlsDiv.classList.add('hide');
        this._setMessage(message);
        this._showLayer();
    }

    // set the message; shows default text if message is null
    _setMessage(message) {
        const textToShow = message || DEFAULT_ERROR_MESSAGE;
        this._messageDiv.textContent = textToShow;
    }

    // show the user the Error controls with a given message
    showControls(message) {
        this._setMessage(message);
        this._controlsDiv.classList.remove('hide');
        this._showLayer();
    }

    _showLayer() {
        this._container.classList.remove('hide');
    }

    // hide the message and controls
    hideMessageControls() {
        this._container.classList.add('hide');
        this._controlsDiv.classList.add('hide');
    }

}

export default ErrorControls;