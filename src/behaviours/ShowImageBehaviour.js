// @flow

import BaseBehaviour from './BaseBehaviour';
import BaseRenderer from '../renderers/BaseRenderer';

export default class ShowBehaviour extends BaseBehaviour {

    constructor(behaviourDefinition: Object, onComplete: () => mixed) {
        super(behaviourDefinition, onComplete);
    }

    start(renderer: BaseRenderer) {
        const imageAssetCollectionId = this.behaviourDefinition.image;
        renderer.applyShowImageBehaviour(imageAssetCollectionId, this._handleDone.bind(this));
    }

    _handleDone() {
        console.log('show image complete');
        this.onComplete();
    }

    destroy() { }
}

