// @flow
import BaseRenderer from '../renderers/BaseRenderer';
import BaseBehaviour from './BaseBehaviour';


export default class PauseBehaviour extends BaseBehaviour {
    timerHandle: ?number;

    constructor(behaviourDefinition: Object, onComplete: () => mixed) {
        super(behaviourDefinition, onComplete);
        this.timerHandle = null;
    }

    start(renderer: BaseRenderer) {
        const player = renderer._player;
        player._applyExitFullscreenBehaviour.bind(player)(
            this._behaviourDefinition,
            this._handleDone,
        );
    }

    destroy() {
        if (this.timerHandle) {
            clearTimeout(this.timerHandle);
        }
    }
}
