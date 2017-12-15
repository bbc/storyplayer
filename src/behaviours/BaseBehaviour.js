/* eslint-disable class-methods-use-this */
export default class BaseBehaviour {
    constructor(behaviourDefinition, onComplete) {
        this.behaviourDefinition = behaviourDefinition;
        this.onComplete = onComplete;
    }
    destroy() {}
}
