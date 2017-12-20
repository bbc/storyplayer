// @flow

import BackgroundRenderer from './BackgroundRenderer';

export default class BsackgroundAudioRenderer extends BackgroundRenderer {
    start() {
        this._renderBackground();
        // this._renderDataModelInfo();
    }

    _renderBackground() {
        const audioElement = document.createElement('audio');
        this._getBackgroundAssetCollection()
            .then((bg) => {
                if (bg && bg.assets.audio_src) {
                    this._fetchMedia(bg.assets.audio_src).then((mediaUrl) => {
                        audioElement.src = mediaUrl;
                    }).catch((err) => { console.error(err, 'Notfound'); });
                }
                if (bg && bg.type === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
                    audioElement.setAttribute('loop', 'true');
                }
            });
        audioElement.addEventListener('loadeddata', () => {
            audioElement.play();
        });
        this._target.appendChild(audioElement);
    }

    _renderDataModelInfo() {
        const assetList = document.createElement('ul');
        const backgroundItem = document.createElement('li');
        assetList.appendChild(backgroundItem);
        this._target.appendChild(assetList);


        if (this._representation.asset_collection.background) {
            this._fetchAssetCollection(this._representation.asset_collection.background)
                .then((bg) => {
                    backgroundItem.textContent = `background: ${bg.name}`;
                    if (bg.assets.audio_src) {
                        backgroundItem.textContent += ` from ${bg.assets.audio_src}`;
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
