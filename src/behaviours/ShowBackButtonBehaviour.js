// @flow

import BaseBehaviour from './BaseBehaviour';
import BaseRenderer from '../renderers/BaseRenderer';

export default class ShowBackButtonBehaviour extends BaseBehaviour {
    _renderer: BaseRenderer;

    start(renderer: BaseRenderer) {
        this._renderer = renderer;
        this.renderBackButton();
    }

    renderBackButton() {
        const backButton = document.createElement('button');
        backButton.textContent = 'Back';
        backButton.addEventListener('click', () => this.handleButtonClick());

        // need access to renderer to put it in properly...
        this._renderer._target.appendChild(backButton);
        this.behaviourComplete();
    }

    handleButtonClick() {
        this._renderer.emit('goBack');
        console.log('go back!');
    }
}
