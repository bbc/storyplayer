import EventEmitter from "eventemitter3"
import {handleButtonTouchEvent} from "../utils"
import { UILogFunction } from '../types'
const buttonClassPrefix = "romper-overlay-button-choice-"
const OVERLAY_ACTIVATED_EVENT = "overlay-click-event"

class Overlay extends EventEmitter {

    _logFunction: UILogFunction
    _name: string
    _elements: object
    _labels: object
    _activeIconId: string
    _overlay: HTMLDivElement
    _button: HTMLButtonElement

    constructor(name: string, logFunction: UILogFunction) {
        super()
        this._logFunction = logFunction
        this._name = name
        this._elements = {}
        this._labels = {}
        this._activeIconId = null
        this._overlay = this._createOverlay()
        this._buttonClickHandler = this._buttonClickHandler.bind(this)
        this._button = this._createButton()
    }

    _buttonClickHandler() {
        if (this._isActive()) {
            this._logFunction(
                "OVERLAY_BUTTON_CLICKED",
                `${this._name} visible`,
                `${this._name} hidden`,
            )

            this.disactivateOverlay()
        } else {
            this._logFunction(
                "OVERLAY_BUTTON_CLICKED",
                `${this._name} hidden`,
                `${this._name} visible`,
            )

            this.activateOverlay()
        }
    }

    _createOverlay(): HTMLDivElement {
        const overlayDiv = document.createElement("div")
        overlayDiv.classList.add("romper-overlay")
        overlayDiv.setAttribute("role", "alert")
        overlayDiv.classList.add(`romper-${this._name}-overlay`)
        overlayDiv.classList.add("romper-inactive")

        overlayDiv.onclick = e => {
            e.stopPropagation()
        }

        return overlayDiv
    }

    // is the overlay showing?
    _isActive(): boolean {
        return !this._overlay.classList.contains("romper-inactive")
    }

    _createButton(): HTMLButtonElement {
        const button = document.createElement("button")
        button.setAttribute("type", "button")
        // eslint-disable-next-line max-len
        button.setAttribute(
            "title",
            `${
                this._name.charAt(0).toUpperCase() + this._name.slice(1)
            } button`,
        )

        // eslint-disable-next-line max-len
        if (this._name === "icon") {
            button.setAttribute("aria-label", "open list of chapters")
        } else if (this._name === "representation") {
            button.setAttribute("aria-label", "open choice of views")
        } else {
            button.setAttribute(
                "aria-label",
                `${this._name.charAt(0).toUpperCase() + this._name.slice(1)}`,
            )
        }

        button.setAttribute("spatial-navigation-object", "transport")
        button.classList.add("romper-button")
        button.classList.add(`romper-${this._name}-button`)
        button.classList.add("romper-inactive")
        const buttonIconDiv = document.createElement("div")
        buttonIconDiv.classList.add("romper-button-icon-div")
        buttonIconDiv.classList.add(`romper-${this._name}-button-icon-div`)
        button.appendChild(buttonIconDiv)
        button.onclick = this._buttonClickHandler
        button.addEventListener(
            "touchend",
            handleButtonTouchEvent(this._buttonClickHandler),
        )
        return button
    }

    useCustomButton(button) {
        this._button = button
        this._button.onclick = this._buttonClickHandler

        this._button.addEventListener(
            "touchend",
            handleButtonTouchEvent(this._buttonClickHandler),
        )
    }

    // the overlay creates its own button that activates and
    // disactivates the overlay
    // it also toggles its own state between selected and deselected
    // get this button here
    //
    // other buttons may be used, but will need to manage their own state
    // they can call the activateOverlay() and disactivateOverlay()
    // functions and should also lot their own analytics
    getButton(): HTMLButtonElement {
        return this._button
    }

    // get the DIV element that is the overlay content
    getOverlay(): HTMLDivElement {
        return this._overlay
    }

    // activate this overlay - show the div
    // emits the OVERLAY_ACTIVATED_EVENT so that other overlays can
    // be disactivated
    activateOverlay() {
        this.emit(OVERLAY_ACTIVATED_EVENT, {
            name: this._name,
        })

        this._overlay.classList.remove("romper-inactive")

        this._button.classList.add("romper-button-selected")
    }

    disactivateOverlay() {
        if (!this._overlay.classList.contains("romper-inactive")) {
            this._logFunction(
                "OVERLAY_DEACTIVATED",
                `${this._name} visible`,
                `${this._name} hidden`,
            )

            this._overlay.classList.add("romper-inactive")
        }

        if (this._button.classList.contains("romper-button-selected")) {
            this._button.classList.remove("romper-button-selected")
        }
    }

    getName(): string {
        return this._name
    }

    getCount(): number {
        return Object.keys(this._elements).length
    }

    // add a child element to the overlay
    add(id: string, el: HTMLElement, label?: string) {
        this._overlay.classList.remove(`count-${this.getCount()}`)

        this._elements[id] = el

        if (label) {
            this._labels[label] = id
        }

        el.classList.add("romper-control-unselected")

        this._overlay.appendChild(el)

        this._button.classList.remove("romper-inactive")

        this._overlay.classList.add(`count-${this.getCount()}`)
    }

    // get one of the overlay children using its id
    get(id: string): HTMLElement {
        return this._elements[id]
    }

    getIdForLabel(label: string): string {
        if (this._labels[label]) {
            return this._labels[label]
        }

        return null
    }

    // remove a child
    remove(id: string) {
        this._overlay.classList.remove(`count-${this.getCount()}`)

        if (this._elements[id]) {
            this._overlay.removeChild(this._elements[id])

            delete this._elements[id]

            if (Object.keys(this._elements).length === 0) {
                this._button.classList.add("romper-inactive")
            }
        }

        this._overlay.classList.add(`count-${this.getCount()}`)
    }

    // set a child as active
    setElementActive(id: string) {
        this._activeIconId = id
        Object.keys(this._elements).forEach(key => {
            if (key === id) {
                this._elements[key].setAttribute("data-link-choice", "active")

                this._elements[key].classList.add("romper-control-selected")

                this._elements[key].classList.remove(
                    "romper-control-unselected",
                )

                this._elements[key].classList.remove("default")
            } else {
                this._elements[key].setAttribute("data-link-choice", "inactive")

                this._elements[key].classList.add("romper-control-unselected")

                this._elements[key].classList.remove("romper-control-selected")

                this._elements[key].classList.remove("default")
            }
        })
    }

    addClassToElement(id: string, classname: string) {
        Object.keys(this._elements).forEach(key => {
            if (key === id) {
                this._elements[key].classList.add(classname)
            }
        })
    }

    removeClassFromElement(id: string, classname: string) {
        Object.keys(this._elements).forEach(key => {
            if (key === id) {
                this._elements[key].classList.remove(classname)
            }
        })
    }

    _clearButtonClass() {
        this._button.classList.forEach(buttonClass => {
            if (buttonClass.indexOf(buttonClassPrefix) === 0) {
                this._button.classList.remove(buttonClass)
            }
        })
    }

    setButtonClass(classname: string) {
        this._clearButtonClass()

        this._button.classList.add(`${buttonClassPrefix}${classname}`)
    }

    clearAll() {
        this._overlay.classList.remove(`count-${this.getCount()}`)

        Object.keys(this._elements).forEach(key => {
            this._overlay.removeChild(this._elements[key])

            delete this._elements[key]
            delete this._labels[key]
        })

        this._overlay.classList.add(`count-${this.getCount()}`)
    }

    disableButton() {
        this._button.setAttribute("disabled", "true")

        this._button.classList.add("romper-control-disabled")
    }

    enableButton() {
        this._button.removeAttribute("disabled")

        this._button.classList.remove("romper-control-disabled")
    }
}

export default Overlay
export {OVERLAY_ACTIVATED_EVENT}
