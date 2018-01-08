// @flow

import BaseBehaviour from './BaseBehaviour';

export default class ShowImageAndPauseBehaviour extends BaseBehaviour {
    timerHandle: ?number;

    constructor(behaviourDefinition: Object, onComplete: () => mixed) {
        super(behaviourDefinition, onComplete);
        this.timerHandle = null;
    }

    start() {
        const pause = parseFloat(this.behaviourDefinition.pause);
        this.timerHandle = setTimeout(this.handleTimeout.bind(this), pause * 1000);
    }

    handleTimeout() {
        this.timerHandle = null;
        this.onComplete();
    }

    destroy() {
        if (this.timerHandle) {
            clearTimeout(this.timerHandle);
        }
    }
}

