// @flow

import BaseBehaviour from './BaseBehaviour';
import BaseRenderer from '../renderers/BaseRenderer';
import logger from '../logger';

export default class PauseBehaviour extends BaseBehaviour {
    timerHandle: ?TimeoutID;

    _renderer: BaseRenderer;

    isPausing: boolean;

    constructor(behaviourDefinition: Object, onComplete: () => void) {
        super(behaviourDefinition, onComplete);
        this.timerHandle = null;
        this.isPausing = false;
    }

    start(renderer: BaseRenderer) {
        this._renderer = renderer;
        const pause = parseFloat(this._behaviourDefinition.pauseTime);
        if (pause < 0) {
            logger.info('negative pause time: pause behaviour will never complete');
        } else {
            this.timerHandle = setTimeout(this.handleTimeout.bind(this), pause * 1000);
        }
        this._renderer.setInPause(true);
        this.isPausing = true;
    }

    handleTimeout() {
        if (!this.isPausing) return;
        this._renderer.setInPause(false);
        this.isPausing = false;
        this.timerHandle = null;
        this._handleDone();
    }

    destroy() {
        this.isPausing = false;
        if (this.timerHandle) {
            clearTimeout(this.timerHandle);
        }
    }
}
