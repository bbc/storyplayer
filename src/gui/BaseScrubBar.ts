/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { UILogFunction } from '../types'

class BaseScrubBar {
    _logUserInteraction: UILogFunction
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