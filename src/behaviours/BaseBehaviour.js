// @flow
export default class BaseBehaviour {
    behaviourComplete: (event: string, completionEvent: string) => void;

    constructor(behaviourComplete: (event: string, completionEvent: string) => void) {
        this.behaviourComplete = behaviourComplete;
    }
}
