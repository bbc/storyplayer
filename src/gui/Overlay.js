// @flow
import EventEmitter from 'events';
import { handleButtonTouchEvent } from '../utils';

const buttonClassPrefix = 'romper-overlay-button-choice-';

const OVERLAY_CLICK_EVENT = 'overlay-click-event';

class Overlay extends EventEmitter {

    _button: HTMLButtonElement;

    _name: string;

    _overlay: HTMLDivElement;

    _logFunction: Function;

    _elements: Object;

    _labels: Object;

    _activeIconId: ?string;

    _buttonClickHandler: Function;

    constructor (name: string, logFunction: Function) {
        super();
        this._logFunction = logFunction;
        this._name = name;
        this._elements = {};
        this._labels = {};
        this._activeIconId = null;

        this._overlay = this._createOverlay();
        this._buttonClickHandler = this._buttonClickHandler.bind(this);
        this._button = this._createButton();
    }

    _buttonClickHandler() {
        this.emit(OVERLAY_CLICK_EVENT, { name: this._name });
        if (this._overlay.classList.contains('romper-inactive')) {
            this._logFunction('OVERLAY_BUTTON_CLICKED', `${this._name} hidden`, `${this._name} visible`);
            this._button.classList.add('romper-button-selected');
        } else {
            this._logFunction('OVERLAY_BUTTON_CLICKED', `${this._name} visible`, `${this._name} hidden`);
            this._button.classList.remove('romper-button-selected');
        }
        this._overlay.classList.toggle('romper-inactive');
    }

    _createOverlay(): HTMLDivElement {
        const overlayDiv = document.createElement('div');
        overlayDiv.classList.add('romper-overlay');
        overlayDiv.classList.add(`romper-${this._name}-overlay`);
        overlayDiv.classList.add('romper-inactive');
        overlayDiv.onclick = (e) => {
            e.stopPropagation();
        };
        return overlayDiv;
    }

    _createButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.setAttribute('type', 'button');
        button.setAttribute('title', `${this._name.charAt(0).toUpperCase() + this._name.slice(1)} button`);
        button.setAttribute('aria-label', `${this._name.charAt(0).toUpperCase() + this._name.slice(1)} button`);
        button.classList.add('romper-button');
        button.classList.add(`romper-${this._name}-button`);
        button.classList.add('romper-inactive');

        const buttonIconDiv = document.createElement('div');
        buttonIconDiv.classList.add('romper-button-icon-div');
        buttonIconDiv.classList.add(`romper-${this._name}-button-icon-div`);
        button.appendChild(buttonIconDiv);

        button.onclick = this._buttonClickHandler
        button.addEventListener(
            'touchend',
            handleButtonTouchEvent(this._buttonClickHandler),
        );
        return button;
    }

    getButton() {
        return this._button;
    }

    getOverlay() {
        return this._overlay;
    }

    deactivateOverlay() {
        if (!this._overlay.classList.contains('romper-inactive')) {
            this._logFunction('OVERLAY_DEACTIVATED', `${this._name} visible`, `${this._name} hidden`);
            this._overlay.classList.add('romper-inactive');
        }
        if (this._button.classList.contains('romper-button-selected')) {
            this._button.classList.remove('romper-button-selected');
        }
    }

    getName() {
        return this._name;
    }

    getCount() {
        return Object.keys(this._elements).length;
    }

    add(id: string, el: HTMLElement, label?: string) {
        this._overlay.classList.remove(`count-${this.getCount()}`);
        this._elements[id] = el;
        if (label) {
            this._labels[label] = id;
        }
        el.classList.add('romper-control-unselected');
        this._overlay.appendChild(el);
        this._button.classList.remove('romper-inactive');
        this._overlay.classList.add(`count-${this.getCount()}`);
    }

    get(id: string) {
        return this._elements[id];
    }

    getIdForLabel(label: string) {
        if (this._labels[label]) {
            return this._labels[label];
        }
        return null;
    }

    remove(id: string) {
        this._overlay.classList.remove(`count-${this.getCount()}`);
        if (this._elements[id]) {
            this._overlay.removeChild(this._elements[id]);
            delete this._elements[id];
            if (Object.keys(this._elements).length === 0) {
                this._button.classList.add('romper-inactive');
            }
        }
        this._overlay.classList.add(`count-${this.getCount()}`);
    }

    setActive(id: string) {
        this._activeIconId = id;
        Object.keys(this._elements).forEach((key) => {
            if (key === id) {
                this._elements[key].setAttribute('data-link-choice', 'active');
                this._elements[key].classList.add('romper-control-selected');
                this._elements[key].classList.remove('romper-control-unselected');
                this._elements[key].classList.remove('default');
            } else {
                this._elements[key].setAttribute('data-link-choice', 'inactive');
                this._elements[key].classList.add('romper-control-unselected');
                this._elements[key].classList.remove('romper-control-selected');
                this._elements[key].classList.remove('default');
            }
        });
    }

    getActive() {
        let activeIconElement = null;
        if (this._activeIconId) {
            activeIconElement = this._elements[this._activeIconId];
        }
        return activeIconElement;
    }

    addClass(id: string, classname: string) {
        Object.keys(this._elements).forEach((key) => {
            if (key === id) {
                this._elements[key].classList.add(classname);
            }
        });
    }

    removeClass(id: string, classname: string) {
        Object.keys(this._elements).forEach((key) => {
            if (key === id) {
                this._elements[key].classList.remove(classname);
            }
        });
    }

 
    clearButtonClass() {
        this._button.classList.forEach((buttonClass) => {
            if (buttonClass.indexOf(buttonClassPrefix) === 0) {
                this._button.classList.remove(buttonClass);
            }
        });
    }

    setButtonClass(classname: string) {
        this.clearButtonClass();
        this._button.classList.add(`${buttonClassPrefix}${classname}`);
    }

    clearAll() {
        this._overlay.classList.remove(`count-${this.getCount()}`);
        Object.keys(this._elements).forEach((key) => {
            this._overlay.removeChild(this._elements[key]);
            delete this._elements[key];
            delete this._labels[key];
        });
        this._overlay.classList.add(`count-${this.getCount()}`);
    }
}

export default Overlay;
export { OVERLAY_CLICK_EVENT };
