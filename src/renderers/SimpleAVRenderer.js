import BaseRenderer from './BaseRenderer';

export default class SimpleAVRenderer extends BaseRenderer {

    start() {
        this._target.innerHTML = `<p>${this._representation.name}</p>`;
        const assetList = document.createElement('ul');
        const foregroundItem = document.createElement('li');
        const backgroundItem = document.createElement('li');
        const iconItem = document.createElement('li');
        assetList.appendChild(foregroundItem);
        assetList.appendChild(backgroundItem);
        assetList.appendChild(iconItem);
        this._target.appendChild(assetList);

        if(this._representation.asset_collection.foreground){
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then(fg => {
                    foregroundItem.textContent = `foreground: ${fg.name}`;
                });
        } else {
            foregroundItem.textContent = 'foreground: none';
        }

        if(this._representation.asset_collection.background){
            this._fetchAssetCollection(this._representation.asset_collection.background)
                .then(bg => {
                    backgroundItem.textContent = `background: ${bg.name}`;
                });
        } else {
            backgroundItem.textContent = 'background: none';
        }

        if(this._representation.asset_collection.icon){
            this._fetchAssetCollection(this._representation.asset_collection.icon)
                .then(icon => {
                    iconItem.textContent = `icon: ${icon.name}`;
                });
        } else {
            iconItem.textContent = 'icon: none';
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
