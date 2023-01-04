import EventEmitter from "events"
import {handleButtonTouchEvent} from "../utils"
import {PlayerEvents} from "./Player"
import {createElementWithClass} from "../documentUtils"
const DEFAULT_ERROR_MESSAGE = "Sorry, there is a problem - try skipping ahead" //
// Component that shows an error modal
// with a message and ignore/next buttons
//

class ErrorControls extends EventEmitter {
    _container: HTMLDivElement
    _nextButton: HTMLButtonElement
    _ignoreButton: HTMLButtonElement
    _messageDiv: HTMLDivElement
    _controlsDiv: HTMLDivElement

    constructor() {
        super()

        this._buildUi()
    }

    // generate the UI
    _buildUi() {
        // modal
        this._container = createElementWithClass("div", "romper-error-layer", [
            "romper-error",
            "romper-error-controls",
            "hide",
        ])

        // message
        this._addMessageDiv()

        // controls
        this._addControls()
    }

    /**
     * get the DIV element that will show the message and/or controls
     */
    getLayer() {
        return this._container
    }

    _addControls() {
        // container
        this._controlsDiv = createElementWithClass(
            "div",
            "romper-error-controls",
            ["romper-error-buttons", "hide"],
        )

        this._container.appendChild(this._controlsDiv)

        // cancel/ignore button
        this._addIgnoreButton()

        // next button
        this._addNextButton()
    }

    _addNextButton() {
        this._nextButton = createElementWithClass(
            "button",
            "romper-error-next-button",
            ["romper-button", "romper-next-button"],
        )

        this._nextButton.setAttribute("type", "button")

        this._nextButton.setAttribute("title", "Next Button")

        this._nextButton.setAttribute("aria-label", "Next")

        this._controlsDiv.appendChild(this._nextButton)

        const nextButtonIconDiv = createElementWithClass(
            "div",
            "romper-error-next-button-icon",
            ["romper-button-icon-div"],
        )

        this._nextButton.appendChild(document.createTextNode("Skip"))

        this._nextButton.appendChild(nextButtonIconDiv)

        this._nextButton.onclick = this._nextButtonClicked.bind(this)

        this._nextButton.addEventListener(
            "touchend",
            handleButtonTouchEvent(this._nextButtonClicked.bind(this)),
        )
    }

    _addIgnoreButton() {
        this._ignoreButton = createElementWithClass(
            "button",
            "romper-error-ignore-button",
            ["romper-button", "romper-ignore-button"],
        )

        this._ignoreButton.setAttribute("type", "button")

        this._ignoreButton.textContent = "Ignore"

        this._ignoreButton.setAttribute("title", "Ignore Button")

        this._ignoreButton.setAttribute("aria-label", "Ignore")

        this._controlsDiv.appendChild(this._ignoreButton)

        this._ignoreButton.onclick = this._ignoreButtonClicked.bind(this)

        this._ignoreButton.addEventListener(
            "touchend",
            handleButtonTouchEvent(this._ignoreButtonClicked.bind(this)),
        )
    }

    _addMessageDiv() {
        this._messageDiv = createElementWithClass(
            "div",
            "romper-error-message",
            ["romper-error-message"],
        )
        const errorMessage = document.createTextNode(DEFAULT_ERROR_MESSAGE)

        this._messageDiv.appendChild(errorMessage)

        this._container.appendChild(this._messageDiv)
    }

    _nextButtonClicked() {
        this.hideMessageControls()
        this.emit(PlayerEvents.ERROR_SKIP_BUTTON_CLICKED)
    }

    _ignoreButtonClicked() {
        this.hideMessageControls()
    }

    // show a message, but no controls
    // if null default message is shown
    showMessage(message) {
        this._controlsDiv.classList.add("hide")

        this._setMessage(message)

        this._showLayer()
    }

    // set the message; shows default text if message is null
    _setMessage(message) {
        const textToShow = message || DEFAULT_ERROR_MESSAGE
        this._messageDiv.textContent = textToShow
    }

    // show the user the Error controls with a given message
    showControls(message) {
        this._setMessage(message)

        this._controlsDiv.classList.remove("hide")

        this._showLayer()
    }

    _showLayer() {
        this._container.classList.remove("hide")
    }

    // hide the message and controls
    hideMessageControls() {
        this._container.classList.add("hide")

        this._controlsDiv.classList.add("hide")
    }
}

export default ErrorControls