// @flow

import BaseRenderer from './BaseRenderer';

export default class SimpleAVRenderer extends BaseRenderer {
    start() {
        this.renderVideoElement();
        // this.renderDataModelInfo();
        // cheat for now - only display button if not in target with subrenderer id:
        if (this._target.id !== 'subrenderer') this.renderNextButton();
    }

    renderVideoElement() {
        const videoElement = document.createElement('video');
        videoElement.style.width = '300px';
        // set its source
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        videoElement.src = fg.assets.av_src;
                        videoElement.play();
                    }
                });
        } else {
            // console.error('No foreground source for AVRenderer');
        }

        // render it
        this._target.appendChild(videoElement);
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
        const backgroundItem = document.createElement('li');
        const iconItem = document.createElement('li');
        assetList.appendChild(foregroundItem);
        assetList.appendChild(backgroundItem);
        assetList.appendChild(iconItem);
        this._target.appendChild(assetList);


        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    foregroundItem.textContent = `foreground: ${fg.name}`;
                    if (fg.assets.av_src) {
                        foregroundItem.textContent += ` from ${fg.assets.av_src}`;
                    }
                });
        }

        if (this._representation.asset_collection.background) {
            this._fetchAssetCollection(this._representation.asset_collection.background)
                .then((bg) => {
                    backgroundItem.textContent = `background: ${bg.name}`;
                    if (bg.assets.audio_src) {
                        backgroundItem.textContent += ` from ${bg.assets.audio_src}`;
                    }
                });
        } else {
            backgroundItem.textContent = 'background: none';
        }

        if (this._representation.asset_collection.icon) {
            this._fetchAssetCollection(this._representation.asset_collection.icon)
                .then((icon) => {
                    iconItem.textContent = `icon: ${icon.name}`;
                    if (icon.assets.image_src) {
                        iconItem.textContent += ` from ${icon.assets.image_src}`;
                    }
                });
        } else {
            iconItem.textContent = 'icon: none';
        }
    }

    destroy() {
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }
    }
}
