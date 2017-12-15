import BaseBehaviour from './BaseBehaviour';

export default class ShowImageAndPauseBehaviour extends BaseBehaviour {
    constructor(behaviourDefinition, onComplete) {
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

