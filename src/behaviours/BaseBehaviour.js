// @flow

/* eslint-disable class-methods-use-this */
export default class BaseBehaviour {
    behaviourDefinition: Object;
    onComplete: () => mixed;

    constructor(behaviourDefinition: Object, onComplete: () => mixed) {
        this.behaviourDefinition = behaviourDefinition;
        this.onComplete = onComplete;
    }
    destroy() { }
}
