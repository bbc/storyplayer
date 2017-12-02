import BaseRenderer from './BaseRenderer';

export default class SimpleAVRenderer extends BaseRenderer {

    start() {
        this._target.innerHTML = `<p>${this._representation.name}</p>`;
        const assetname = document.createElement('p');
        this._target.appendChild(assetname);

        if(this._representation.asset_collection.foreground){
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then(fg => {
                    assetname.textContent = `foreground: ${fg.name}`;
                });
        } else {
            console.log("no foreground");
        }

        if(this._representation.asset_collection.background){
            this._fetchAssetCollection(this._representation.asset_collection.background)
                .then(bg => {
                    assetname.innerHTML += `<br/>background: ${bg.name}`;
                });
        } else {
            console.log("no background");
        }

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
