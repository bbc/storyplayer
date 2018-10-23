// @flow

import Player from '../Player';
import BackgroundRenderer from './BackgroundRenderer';
import type { MediaFetcher, AssetCollection } from '../romper';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';

import logger from '../logger';

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _target: HTMLDivElement;
    _handleVolumeClicked: Function;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super(assetCollection, mediaFetcher, player);
        this._target = this._player.backgroundTarget;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.BACKGROUND_A,
        });
        this._renderBackgroundAudio();
    }

    start() {
        this._playoutEngine.setPlayoutActive(this._rendererId);

        if (this._assetCollection && this._assetCollection.asset_collection_type
                === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
            const audioElement = this._playoutEngine.getMediaElement(this._rendererId);
            audioElement.setAttribute('loop', 'true');
        }
    }

    end() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);
    }

    _renderBackgroundAudio() {
        if (this._assetCollection && this._assetCollection.assets.audio_src) {
            this._fetchMedia(this._assetCollection.assets.audio_src, 'audio').then((mediaUrl) => {
                this._populateAudioElement(mediaUrl);
            }).catch((err) => { logger.error(err, 'Notfound'); });
        }
    }

    _populateAudioElement(mediaUrl: string) {
        if (this._disabled) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                url: mediaUrl,
            });
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
        this.end();

        this._playoutEngine.unqueuePlayout(this._rendererId);

        super.destroy();
    }
}
