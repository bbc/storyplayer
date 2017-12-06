// @flow

import BaseRenderer from './BaseRenderer';

export default class ImageRenderer extends BaseRenderer {
    start() {
        this.renderImageElement();
        // cheat for now - only display button if not in target with subrenderer id:
        if (this._target.id !== 'subrenderer') this.renderNextButton();
    }

    renderImageElement() {
        const imageElement = document.createElement('img');
        imageElement.src = 'http://localhost/~andybr/obm/makeTests/frog/colour_flog8.svg';
        imageElement.style.width = '300px';
        this._target.appendChild(imageElement);
    }

    renderNextButton() {
        // render next button
        const buttonDiv = document.createElement('div');
        const button = document.createElement('button');
        button.innerHTML = 'Next';
        button.addEventListener('click', () => {
            this.emit('complete');
        });
        buttonDiv.appendChild(button);
        this._target.appendChild(buttonDiv);
    }

    destroy() {
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }
    }
}
