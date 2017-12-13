// @flow

import BaseBehaviour from './BaseBehaviour';
import BaseRenderer from '../renderers/BaseRenderer';

export default class ShowNextButtonBehaviour extends BaseBehaviour {
    _renderer: BaseRenderer;

    start(renderer: BaseRenderer) {
        this._renderer = renderer;
        this.renderNextButton();
    }

    renderNextButton() {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.addEventListener('click', () => this.handleButtonClick());

        // need access to renderer to put it in properly...
        this._renderer._target.appendChild(nextButton);
        this.behaviourComplete();
    }

    handleButtonClick() {
        this._renderer.emit('complete');
        console.log('go on!');
    }
}
