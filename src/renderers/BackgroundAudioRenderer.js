// @flow

import BackgroundRenderer from './BackgroundRenderer';
import type { MediaFetcher, AssetCollection } from '../romper';

// @flowignore
import Hls from '../../node_modules/hls.js/dist/hls';

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _audioElement: HTMLAudioElement;
    _hls: Object;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        target: HTMLElement,
    ) {
        super(assetCollection, mediaFetcher, target);
        if (Hls.isSupported()) {
            this._hls = new Hls();
        }
    }

    start() {
        this._renderBackgroundAudio();
        // this._renderDataModelInfo();
    }

    _renderBackgroundAudio() {
        this._audioElement = document.createElement('audio');
        if (this._assetCollection && this._assetCollection.assets.audio_src) {
            this._fetchMedia(this._assetCollection.assets.audio_src, 'audio').then((mediaUrl) => {
                this._populateAudioElement(this._audioElement, mediaUrl);
            }).catch((err) => { console.error(err, 'Notfound'); });
        }
        this._target.appendChild(this._audioElement);
    }

    _populateAudioElement(audioElement: HTMLAudioElement, mediaUrl: string) {
        if (mediaUrl.indexOf('.m3u8') !== -1) {
            this._hls.loadSource(mediaUrl);
            this._hls.attachMedia(audioElement);
            this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                audioElement.play();
            });
        } else {
            audioElement.setAttribute('src', mediaUrl);
            audioElement.addEventListener('loadeddata', () => {
                audioElement.play();
            });
        }
        if (this._assetCollection && this._assetCollection
            .type === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
            this._audioElement.setAttribute('loop', 'true');
        }
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
