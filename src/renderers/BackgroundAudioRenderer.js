// @flow

import BackgroundRenderer from './BackgroundRenderer';
/*
    "asset_collections": [
        {
            "id": "d22484f9-da14-484b-8051-71be36b2227f",
            "name": "Looping Background Music",
            "description": "This background music loops throughout the experience and is played under each step of the make",
            "version": "0:0",
            "tags": {},
            "type": "urn:x-object-based-media:asset-collection-types:looping-audio/v1.0",
            "assets": {
                "audio_src": "urn:x-ipstudio:entity:package:af4dfbe4-5efc-46a8-ab6e-a50b891ec119"
            }
        },
*/

export default class BsackgroundAudioRenderer extends BackgroundRenderer {
    start() {
        this._renderBackground();
        // this._renderDataModelInfo();
    }

    _renderBackground() {
        const audioElement = document.createElement('audio');
        // audioElement.loop;
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
