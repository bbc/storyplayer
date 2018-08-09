// @flow

import Player, { PlayerEvents } from '../Player';
import BackgroundRenderer from './BackgroundRenderer';
import type { MediaFetcher, AssetCollection } from '../romper';

import MediaManager from '../MediaManager';
import MediaInstance from '../MediaInstance';

import logger from '../logger';

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _mediaInstance: MediaInstance;
    _target: HTMLDivElement;
    _handleVolumeClicked: Function;
    _mediaManager: MediaManager;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super(assetCollection, mediaFetcher, player);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);
        this._target = this._player.backgroundTarget;

        this._mediaManager = player._mediaManager;
        this._mediaInstance = this._mediaManager.getMediaInstance('background');

        this._renderBackgroundAudio();
    }

    start() {
        this._mediaInstance.start();
        this._player.addVolumeControl(this._assetCollection.id, 'Background');
        this._player.on(PlayerEvents.VOLUME_CHANGED, this._handleVolumeClicked);

        if (this._assetCollection && this._assetCollection.asset_collection_type
                === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
            const audioElement = this._mediaInstance.getMediaElement();
            audioElement.setAttribute('loop', 'true');
        }

        this._mediaInstance.play();
    }

    end() {
        try {
            this._mediaInstance.end();
        } catch (e) {
            //
        }

        this._player.removeVolumeControl(this._assetCollection.id);
        this._player.removeListener(PlayerEvents.VOLUME_CHANGED, this._handleVolumeClicked);
    }

    _handleVolumeClicked(event: Object): void {
        if (event.id === this._assetCollection.id) {
            this._mediaInstance.setVolume(event.value);
        }
    }

    _renderBackgroundAudio() {
        const audioElement = document.createElement('audio');
        this._mediaInstance.attachMedia(audioElement);
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
            this._mediaInstance.loadSource(mediaUrl);
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

        this._mediaManager.returnMediaInstance(this._mediaInstance);
        super.destroy();
    }
}
