// @flow

import BackgroundRenderer from './BackgroundRenderer';

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _audioElement: HTMLAudioElement;

    start() {
        this._renderBackground();
        // this._renderDataModelInfo();
    }

    _renderBackground() {
        this._audioElement = document.createElement('audio');
        if (this._assetCollection && this._assetCollection.assets.audio_src) {
            this._fetchMedia(this._assetCollection.assets.audio_src).then((mediaUrl) => {
                this._audioElement.src = mediaUrl;
            }).catch((err) => { console.error(err, 'Notfound'); });
        }
        if (this._assetCollection && this._assetCollection
            .type === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
            this._audioElement.setAttribute('loop', 'true');
        }
        this._audioElement.addEventListener('loadeddata', () => {
            this._audioElement.play();
        });
        this._target.appendChild(this._audioElement);
    }

    _renderDataModelInfo() {
        const assetList = document.createElement('ul');
        const backgroundItem = document.createElement('li');
        assetList.appendChild(backgroundItem);
        this._target.appendChild(assetList);

        if (this._assetCollection) {
            backgroundItem.textContent = `background: ${this._assetCollection.name}`;
            if (this._assetCollection.assets.audio_src) {
                backgroundItem.textContent += ` from ${this._assetCollection.assets.audio_src}`;
            }
        }
    }

    destroy() {
        this._target.removeChild(this._audioElement);
        super.destroy();
    }
}
