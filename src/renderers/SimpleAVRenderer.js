// @flow

import BaseRenderer from './BaseRenderer';
import MediaFetcher from '../fetchers/MediaFetcher';
import type { Representation, AssetCollectionFetcher } from '../romper';
import Hls from '../../node_modules/hls.js/dist/hls';

export default class SimpleAVRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _hls: Object;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target);
        if (Hls.isSupported()) {
            this._hls = new Hls();
        }
    }

    start() {
        super.start();
        this.renderVideoElement();
        this.renderDataModelInfo();
    }

    renderVideoElement() {
        const videoElement = document.createElement('video');

        // set its source
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        this._fetchMedia(fg.assets.av_src).then((mediaUrl) => {
                            this.populateVideoElement(videoElement, mediaUrl);
                        }).catch((err) => { console.error(err, 'Notfound'); });
                    }
                });
        } else {
            // console.error('No foreground source for AVRenderer');
        }

        // render it
        this._target.appendChild(videoElement);

        // automatically move on at video end
        videoElement.addEventListener('ended', () => {
            super.complete();
        });
    }

    populateVideoElement(videoElement: HTMLVideoElement, mediaUrl: string) {
        // if mediaUrl is hls
        if (mediaUrl.indexOf('.m3u8') !== -1) {
            this._hls.loadSource(mediaUrl);
            this._hls.attachMedia(videoElement);
            this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoElement.play();
            });
        } else {
            videoElement.setAttribute('src', mediaUrl);
            videoElement.setAttribute('muted', 'true');
            videoElement.addEventListener('loadeddata', () => {
                videoElement.play();
            });
        }
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

        if (this._representation.asset_collection.background
            && this._representation.asset_collection.background.length > 0) {
            this._fetchAssetCollection(this._representation.asset_collection.background[0])
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
            this._fetchAssetCollection(this._representation.asset_collection.icon.default)
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
        super.destroy();
    }
}
