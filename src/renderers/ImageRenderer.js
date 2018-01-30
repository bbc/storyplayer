// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import RendererEvents from './RendererEvents';
import logger from '../logger';

export default class ImageRenderer extends BaseRenderer {
    _imageElement: HTMLImageElement;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target);
        this.renderImageElement();
    }

    start() {
        if (!this._imageElement) this.renderImageElement();
        this.emit(RendererEvents.STARTED);
        this._setVisibility(true);
    }

    renderImageElement() {
        this._imageElement = document.createElement('img');
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        this._fetchMedia(fg.assets.image_src).then((mediaUrl) => {
                            logger.info(`FETCHED FROM MS MEDIA! ${mediaUrl}`);
                            this._imageElement.src = mediaUrl;
                            this._setVisibility(false);
                        }).catch((err) => { logger.error(err, 'Notfound'); });
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
        if (this._imageElement) this._imageElement.style.display = visible ? 'initial' : 'none';
    }

    destroy() {
        if (this._imageElement) this._target.removeChild(this._imageElement);
        super.destroy();
    }
}
