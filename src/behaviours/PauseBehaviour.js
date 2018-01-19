// @flow

import BaseBehaviour from './BaseBehaviour';
import BaseRenderer from '../renderers/BaseRenderer';

export default class PauseBehaviour extends BaseBehaviour {
    timerHandle: ?number;

    constructor(behaviourDefinition: Object, onComplete: () => mixed) {
        super(behaviourDefinition, onComplete);
        this.timerHandle = null;
    }

    start(renderer: BaseRenderer) {
        const pause = parseFloat(this.behaviourDefinition.pause);
        this.timerHandle = setTimeout(this.handleTimeout.bind(this), pause * 1000 * 10);
        // TODO ^^ current story has 1s pause - make 10s here for testing
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

