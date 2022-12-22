/* eslint-disable class-methods-use-this */

class BaseScrubBar {

    constructor(logUserInteraction) {
        this._logUserInteraction = logUserInteraction;
    }

    getScrubBarElement() {
        return this._scrubBar;
    }

    hide() { }

    show() { }

    enable() { }

    disable() { }

    // eslint-disable-next-line no-unused-vars
    disconnect(parentDiv) { }

    // eslint-disable-next-line no-unused-vars
    connect(renderer) { }
}

export default BaseScrubBar;