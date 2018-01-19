// @flow

import BaseBehaviour from './BaseBehaviour';

export default class PauseBehaviour extends BaseBehaviour {
    timerHandle: ?number;

    constructor(behaviourDefinition: Object, onComplete: () => mixed) {
        super(behaviourDefinition, onComplete);
        this.timerHandle = null;
    }

    start() {
        const pause = parseFloat(this._behaviourDefinition.pauseTime);
        this.timerHandle = setTimeout(this.handleTimeout.bind(this), pause * 1000);
    }

    handleTimeout() {
        this.timerHandle = null;
        this._handleDone();
    }

    destroy() {
        if (this.timerHandle) {
            clearTimeout(this.timerHandle);
        }
    }
}

