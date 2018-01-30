// @flow
import BaseRenderer from '../renderers/BaseRenderer';
import logger from '../logger';
/* eslint-disable class-methods-use-this */
export default class BaseBehaviour {
    _behaviourDefinition: Object;
    _handleDone: Function;
    _onComplete: () => mixed;

    constructor(behaviourDefinition: Object, onComplete: () => mixed) {
        this._behaviourDefinition = behaviourDefinition;
        this._onComplete = onComplete;
        this._handleDone = this._handleDone.bind(this);
    }

    start(renderer: BaseRenderer) {
        const behaviourRenderer = renderer.getBehaviourRenderer(this._behaviourDefinition.type);
        if (behaviourRenderer) {
            behaviourRenderer(this._behaviourDefinition, this._handleDone);
        } else {
            logger.warn(`${renderer.constructor.name} does not support ${this._behaviourDefinition.type} - completing immediately`);
            this._onComplete();
        }
    }

    _handleDone() {
        this._onComplete();
    }

    destroy() { }
}
