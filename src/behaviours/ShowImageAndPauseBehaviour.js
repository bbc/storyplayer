import BaseBehaviour from './BaseBehaviour';

export default class ShowImageAndPauseBehaviour extends BaseBehaviour {
    start() {
        console.log('Pausing for 3 seconds...');
        setTimeout(this.handleTimeout.bind(this), 3000);
    }

    handleTimeout() {
        console.log('Pausing finished');
        this.done = true;
        this.behaviourComplete();
    }
}

