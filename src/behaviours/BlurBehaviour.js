// @flow

import BaseBehaviour from './BaseBehaviour';
import BaseRenderer from '../renderers/BaseRenderer';

export default class BlurBehaviour extends BaseBehaviour {
    timerHandle: ?number;

    constructor(behaviourDefinition: Object, onComplete: () => mixed) {
        super(behaviourDefinition, onComplete);
    }

    start(renderer: BaseRenderer) {
        const blur = parseFloat(this.behaviourDefinition.blur);
        renderer.applyBlurBehaviour(blur);
    }

    destroy() { }
}

