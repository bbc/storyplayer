// @flow

import BaseRenderer from './BaseRenderer';

export default class ImageRenderer extends BaseRenderer {
    start() {
        this.renderImageElement();
        this.renderDataModelInfo();
    }

    renderImageElement() {
        const imageElement = document.createElement('img');
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        this._fetchMedia(fg.assets.image_src).then((mediaUrl) => {
                            console.log('FETCHED FROM MS MEDIA!', mediaUrl);
                            imageElement.src = mediaUrl;
                        }).catch((err) => { console.error(err, 'Notfound'); });
                    }
                });
        }

        this._target.appendChild(imageElement);
    }

    renderDataModelInfo() {
        const assetList = document.createElement('ul');
        const foregroundItem = document.createElement('li');
        assetList.appendChild(foregroundItem);
        this._target.appendChild(assetList);


        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    foregroundItem.textContent = `foreground: ${fg.name}`;
                    if (fg.assets.image_src) {
                        foregroundItem.textContent += ` from ${fg.assets.image_src}`;
                    }
                });
        }
    }

    destroy() {
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }
        super.destroy();
    }
}
