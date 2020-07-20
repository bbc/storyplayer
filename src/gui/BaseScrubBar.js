// @flow
import BaseRenderer from '../renderers/BaseRenderer';

/* eslint-disable class-methods-use-this */

class BaseScrubBar {

    _logUserInteraction: Function;

    constructor(logUserInteraction: Function) {
        this._logUserInteraction = logUserInteraction;
    }

    getScrubBarElement(): HTMLInputElement {
        return this._scrubBar;
    }

    hide() { }

    show() { }

    enable() { }

    disable() { }

    // eslint-disable-next-line no-unused-vars
    disconnect(parentDiv: ?HTMLDivElement) { }

    // eslint-disable-next-line no-unused-vars
    connect(renderer: BaseRenderer) { }
}

export default BaseScrubBar;