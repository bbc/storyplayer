// @flow

import BaseRenderer from './BaseRenderer';

export default class ImageRenderer extends BaseRenderer {
    start() {
        this.renderImageElement();
        this.renderDataModelInfo();
        // cheat for now - only display button if not in target with subrenderer id:
        if (this._target.id !== 'subrenderer') this.renderNextButton();
    }

    renderImageElement() {
        const imageElement = document.createElement('img');
        if (this._representation.asset_collection.foreground) {
            //debugger; // eslint-disable-line no-debugger
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

        imageElement.style.width = '300px';
        imageElement.style.height = '150px';
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

    renderDataModelInfo() {
        const assetList = document.createElement('ul');
        const foregroundItem = document.createElement('li');
        assetList.appendChild(foregroundItem);
        this._target.appendChild(assetList);


        if (this._representation.asset_collection.foreground) {
            //debugger; // eslint-disable-line no-debugger
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
    }
}
