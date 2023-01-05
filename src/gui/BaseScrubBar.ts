/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

class BaseScrubBar {
    _logUserInteraction: (evType: string, from?: string, to?: string) => void
    _scrubBar: HTMLInputElement

    constructor(logUserInteraction) {
        this._logUserInteraction = logUserInteraction
    }

    getScrubBarElement() {
        return this._scrubBar
    }

    hide() {}

    show() {}

    enable() {}

    disable() {}

    disconnect(parentDiv) {}

    connect(renderer) {}
}

export default BaseScrubBar