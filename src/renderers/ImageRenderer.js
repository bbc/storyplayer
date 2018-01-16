// @flow

import BaseRenderer from './BaseRenderer';
import RendererEvents from './RendererEvents';

export default class ImageRenderer extends BaseRenderer {
    _imageElement: HTMLImageElement;

    start() {
        if (!this._imageElement) this.renderImageElement();
        this.emit(RendererEvents.STARTED);
        this._setVisibility(true);
        // this.renderDataModelInfo();
    }

    renderImageElement() {
        this._imageElement = document.createElement('img');
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        this._fetchMedia(fg.assets.image_src).then((mediaUrl) => {
                            console.log('FETCHED FROM MS MEDIA!', mediaUrl);
                            this._imageElement.src = mediaUrl;
                        }).catch((err) => { console.error(err, 'Notfound'); });
                    }
                });
        }

        this._target.appendChild(this._imageElement);
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

    queueUp() {
        this.renderImageElement();
        this._setVisibility(false);
    }

    switchFrom() {
        this._setVisibility(false);
    }

    switchTo() {
        this._setVisibility(true);
    }

    _setVisibility(visible: boolean) {
        // this._imageElement.style.visibility = visible ? 'visible' : 'hidden';
        this._imageElement.style.display = visible ? 'initial' : 'none';
    }

    destroy() {
        this._target.removeChild(this._imageElement);
        super.destroy();
    }
}
