import BaseRenderer from './BaseRenderer';

export default class SimpleAVRenderer extends BaseRenderer {

    start() {
        this._target.innerHTML = `<p>${this._representation.name}</p>`;
        const button = document.createElement('button');
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
