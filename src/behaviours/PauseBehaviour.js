// @flow

import BaseBehaviour from './BaseBehaviour';
import logger from '../logger';

export default class PauseBehaviour extends BaseBehaviour {
    timerHandle: ?TimeoutID;

    constructor(behaviourDefinition: Object, onComplete: () => void) {
        super(behaviourDefinition, onComplete);
        this.timerHandle = null;
    }

    start() {
        const pause = parseFloat(this._behaviourDefinition.pauseTime);
        if (pause < 0) {
            logger.info('negative pause time: pause behaviour will never complete');
        } else {
            this.timerHandle = setTimeout(this.handleTimeout.bind(this), pause * 1000);
        }
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
