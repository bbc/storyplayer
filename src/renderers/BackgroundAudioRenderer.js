// @flow

import Player, { PlayerEvents } from '../Player';
import BackgroundRenderer from './BackgroundRenderer';
import type { MediaFetcher, AssetCollection } from '../romper';

import HlsManager from '../HlsManager';
import logger from '../logger';

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _hls: Object;
    _target: HTMLDivElement;
    _handleVolumeClicked: Function;
    _playAudioCallback: Function;
    _hlsManager: HlsManager;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super(assetCollection, mediaFetcher, player);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);
        this._target = this._player.backgroundTarget;

        this._playAudioCallback = this._playAudioCallback.bind(this);

        this._hlsManager = player._hlsManager;
        this._hls = this._hlsManager.getHls('audio');

        this._renderBackgroundAudio();
    }

    start() {
        this._hls.start();
        this._player.addVolumeControl(this._assetCollection.id, 'Background');
        this._player.on(PlayerEvents.VOLUME_CHANGED, this._handleVolumeClicked);

        if (this._assetCollection && this._assetCollection
            .type === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
            const audioElement = this._hls.getMediaElement();
            audioElement.setAttribute('loop', 'true');
        }

        this.playAudio();
    }

    end() {
        try {
            this._hls.end();
        } catch (e) {
            //
        }

        this._player.removeVolumeControl(this._assetCollection.id);
        this._player.removeListener(PlayerEvents.VOLUME_CHANGED, this._handleVolumeClicked);
    }

    _handleVolumeClicked(event: Object): void {
        const audioElement = this._hls.getMediaElement();
        if (event.id === this._assetCollection.id) {
            audioElement.volume = event.value;
        }
    }

    _playAudioCallback(): void {
        const audioElement = this._hls.getMediaElement();
        this._hls.off(HlsManager.Events.MANIFEST_PARSED, this._playAudioCallback);
        audioElement.removeEventListener('loadeddata', this._playAudioCallback);

        if (this._destroyed) {
            logger.warn('loaded destroyed video element - not playing');
        } else {
            this._hls.play();
        }
    }

    playAudio() {
        const audioElement = this._hls.getMediaElement();
        if (audioElement.readyState >= audioElement.HAVE_CURRENT_DATA) {
            this._hls.play();
        } else if (audioElement.src.indexOf('m3u8') !== -1) {
            this._hls.on(HlsManager.Events.MANIFEST_PARSED, this._playAudioCallback);
        } else {
            audioElement.addEventListener('loadeddata', this._playAudioCallback);
        }
    }

    _renderBackgroundAudio() {
        const audioElement = document.createElement('audio');
        this._hls.attachMedia(audioElement);
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
            this._hls.loadSource(mediaUrl);
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

        this._hlsManager.returnHls(this._hls);
        super.destroy();
    }
}
