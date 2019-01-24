// @flow

import Player from '../Player';
import BackgroundRenderer from './BackgroundRenderer';
import type { MediaFetcher, AssetCollection } from '../romper';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';

import logger from '../logger';

const FADE_IN_TIME = 2000; // fade in time for audio in ms

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _target: HTMLDivElement;
    _handleVolumeClicked: Function;
    _volFadeInterval: ?IntervalID; // fade in interval
    _fadeIntervalId: ?IntervalID; // fade out interval
    _fadePaused: boolean;

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
        this._fadePaused = false;
        if (!this._playoutEngine.getPlayoutActive(this._rendererId)) {
            this._playoutEngine.setPlayoutActive(this._rendererId);
        }
        const audioElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (audioElement) {
            if (this._assetCollection && this._assetCollection.asset_collection_type
                === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
                audioElement.setAttribute('loop', 'true');
            }
            audioElement.volume = 0;
            this._volFadeInterval = setInterval(() => {
                if (audioElement.volume >= (1 - (50 / FADE_IN_TIME)) && this._volFadeInterval) {
                    clearInterval(this._volFadeInterval);
                    this._volFadeInterval = null;
                } else {
                    audioElement.volume += (50 / FADE_IN_TIME);
                }
            }, 50);
        }
    }

    end() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);
        if (this._volFadeInterval) {
            clearInterval(this._volFadeInterval);
            this._volFadeInterval = null;
        }
        if (this._fadeIntervalId) {
            clearInterval(this._fadeIntervalId);
            this._fadeIntervalId = null;
        }
    }

    cancelFade() {
        if (this._fadeIntervalId) {
            clearInterval(this._fadeIntervalId);
            this._fadeIntervalId = null;
        }
    }

    pauseFade() {
        this._fadePaused = true;
    }

    resumeFade() {
        this._fadePaused = false;
    }

    // start fading out the volume, over given duration (seconds)
    fadeOut(duration: number) {
        // clear fade in
        if (this._volFadeInterval) {
            clearInterval(this._volFadeInterval);
            this._volFadeInterval = null;
        }
        const audioElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (audioElement && !this._fadeIntervalId) {
            const interval = (duration * 1000) / 50; // number of steps
            this._fadeIntervalId = setInterval(() => {
                if (audioElement.volume >= (1 / interval) && this._fadeIntervalId) {
                    if (!this._fadePaused) {
                        audioElement.volume -= (1 / interval);
                    }
                } else if (this._fadeIntervalId) {
                    audioElement.volume = 0;
                    clearInterval(this._fadeIntervalId);
                    this._fadeIntervalId = null;
                }
            }, 50);
        }
    }

    _renderBackgroundAudio() {
        if (this._assetCollection && this._assetCollection.assets.audio_src) {
            this._fetchMedia(this._assetCollection.assets.audio_src, 'audio').then((mediaUrl) => {
                this._populateAudioElement(mediaUrl);
                const audioElement = this._playoutEngine.getMediaElement(this._rendererId);
                audioElement.id = this._rendererId;
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
