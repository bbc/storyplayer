// @flow

import Player, { PlayerEvents } from '../Player';
import BackgroundRenderer from './BackgroundRenderer';
import type { MediaFetcher, AssetCollection } from '../romper';

// @flowignore
import Hls from '../../node_modules/hls.js/dist/hls';
import logger from '../logger';

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _audioElement: HTMLAudioElement;
    _hls: Object;
    _target: HTMLDivElement;
    _handleVolumeClicked: Function;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super(assetCollection, mediaFetcher, player);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);
        this._target = this._player.backgroundTarget;
        if (Hls.isSupported()) {
            this._hls = new Hls();
        }
    }

    start() {
        this._renderBackgroundAudio();
        this._player.addVolumeControl(this._assetCollection.id, 'Background');
        this._player.on(PlayerEvents.VOLUME_CHANGED, this._handleVolumeClicked);
    }

    _handleVolumeClicked(event: Object): void {
        if (event.id === this._assetCollection.id) {
            this._audioElement.volume = event.value;
        }
    }

    _renderBackgroundAudio() {
        this._audioElement = document.createElement('audio');
        if (this._assetCollection && this._assetCollection.assets.audio_src) {
            this._fetchMedia(this._assetCollection.assets.audio_src, 'audio').then((mediaUrl) => {
                this._populateAudioElement(this._audioElement, mediaUrl);
            }).catch((err) => { logger.error(err, 'Notfound'); });
        }
        this._target.appendChild(this._audioElement);
    }

    _populateAudioElement(audioElement: HTMLAudioElement, mediaUrl: string) {
        if (this._disabled) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            if (mediaUrl.indexOf('.m3u8') !== -1) {
                this._hls.loadSource(mediaUrl);
                this._hls.attachMedia(audioElement);
                this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (this._disabled) {
                        logger.warn('loaded destroyed audio element - not playing');
                    } else {
                        audioElement.play();
                    }
                });
            } else {
                audioElement.setAttribute('src', mediaUrl);
                audioElement.addEventListener('loadeddata', () => {
                    if (this._disabled) {
                        logger.warn('loaded destroyed audio element - not playing');
                    } else {
                        audioElement.play();
                    }
                });
            }
            if (this._assetCollection && this._assetCollection
                .type === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
                this._audioElement.setAttribute('loop', 'true');
            }
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
        this._player.removeVolumeControl(this._assetCollection.id);
        this._player.removeListener(PlayerEvents.VOLUME_CHANGED, this._handleVolumeClicked);
        super.destroy();
    }
}
