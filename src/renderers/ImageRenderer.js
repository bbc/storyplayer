// @flow

import BaseRenderer from './BaseRenderer';

export default class ImageRenderer extends BaseRenderer {
    start() {
        this._target.innerHTML = `<p>An Image</p>`;

        const button = document.createElement('button');
        button.innerHTML = 'Next';
        button.addEventListener('click', () => {
            this.emit('complete');
        });
        this._target.appendChild(button);
    }

    destroy() {
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }
    }
}
