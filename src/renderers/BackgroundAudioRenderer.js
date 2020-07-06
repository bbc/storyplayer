// @flow

import Player from '../Player';
import BackgroundRenderer from './BackgroundRenderer';
import type { MediaFetcher, AssetCollection } from '../romper';
import { MediaFormats } from '../browserCapabilities';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';

import logger from '../logger';
import { AUDIO } from '../utils';

const FADE_IN_TIME = 2000; // fade in time for audio in ms
const HARD_FADE_OUT_TIME = 500; // fade out in ms - will overrun into next NE
const FADE_STEP_LENGTH = 10; // time between steps for fades

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _target: HTMLDivElement;

    _handleVolumeClicked: Function;

    _volFadeInterval: ?IntervalID;

    // fade in interval
    _fadeIntervalId: ?IntervalID;

    // fade out interval
    _fadePaused: boolean;

    _fadedOut: boolean;

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
        super.start();
        this._fadedOut = false;
        this._fadePaused = false;
        if (!this._playoutEngine.getPlayoutActive(this._rendererId)) {
            this._playoutEngine.setPlayoutActive(this._rendererId);
            logger.info(`Starting new background audio ${this._getDescriptionString()}`);
        } else {
            logger.info(`Continuing background audio ${this._getDescriptionString()}`);
        }
        const audioElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (audioElement) {
            if (this._assetCollection && this._assetCollection.asset_collection_type
                === 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0') {
                audioElement.setAttribute('loop', 'true');
            }
            audioElement.volume = 0;
            this._volFadeInterval = setInterval(() => {
                if (audioElement.volume >= (1 - (FADE_STEP_LENGTH / FADE_IN_TIME))
                    && this._volFadeInterval) {
                    clearInterval(this._volFadeInterval);
                    this._volFadeInterval = null;
                } else {
                    audioElement.volume += (FADE_STEP_LENGTH / FADE_IN_TIME);
                }
            }, FADE_STEP_LENGTH);
        }
    }

    _getDescriptionString(): string {
        return this._assetCollection.name;
    }

    end() {
        this.fadeOut(HARD_FADE_OUT_TIME/1000);
        const endFunc = () => {
            this._playoutEngine.setPlayoutInactive(this._rendererId);
            if (this._volFadeInterval) {
                clearInterval(this._volFadeInterval);
                this._volFadeInterval = null;
            }
            if (this._fadeIntervalId) {
                clearInterval(this._fadeIntervalId);
                this._fadeIntervalId = null;
            }
        };
        if (this._fadedOut) {
            endFunc();
        } else {
            setTimeout(endFunc, HARD_FADE_OUT_TIME);
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
        logger.info(`Fading out background audio ${this._getDescriptionString()}`);
        // clear fade in
        if (this._volFadeInterval) {
            clearInterval(this._volFadeInterval);
            this._volFadeInterval = null;
        }
        const audioElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (audioElement && !this._fadeIntervalId) {
            const interval = (duration * 1000) / FADE_STEP_LENGTH; // number of steps
            this._fadeIntervalId = setInterval(() => {
                if (audioElement.volume >= (1 / interval) && this._fadeIntervalId) {
                    if (!this._fadePaused) {
                        audioElement.volume -= (1 / interval);
                    }
                } else if (this._fadeIntervalId) {
                    audioElement.volume = 0;
                    clearInterval(this._fadeIntervalId);
                    this._fadeIntervalId = null;
                    this._fadedOut = true;
                }
            }, FADE_STEP_LENGTH);
        }
    }

    _renderBackgroundAudio() {
        if (this._assetCollection && this._assetCollection.assets.audio_src) {
            this._fetchMedia(this._assetCollection.assets.audio_src, {
                mediaFormat: MediaFormats.getFormat(), 
                mediaType: AUDIO
            })
                .then((mediaUrl) => {
                    this._populateAudioElement(mediaUrl);
                }).catch((err) => { logger.error(err, 'Notfound'); });
        }
    }

    _populateAudioElement(mediaUrl: string, loop: ?boolean) {
        if (this._disabled) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                url: mediaUrl,
                loop,
            });
        }
    }

    destroy() {
        this.end();
        const destroyFunc = () => {
            this._playoutEngine.unqueuePlayout(this._rendererId);
            super.destroy();           
        };
        if (this._fadedOut) {
            destroyFunc();
        } else {
            // allow time for end fade to take place
            setTimeout(destroyFunc, HARD_FADE_OUT_TIME);
        }
    }
}
