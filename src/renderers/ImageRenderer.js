// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import Player from '../Player';
import logger from '../logger';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

const TIMER_INTERVAL = 100;

export default class ImageRenderer extends BaseRenderer {
    _imageElement: HTMLImageElement;

    _disablePlayButton: Function;

    _disableScrubBar: Function;

    _enablePlayButton: Function;

    _enableScrubBar: Function;

    _visible: boolean;

    _imageTimer: ?IntervalID;

    _timeElapsed: number;

    _duration: number;

    _timeIntervals: { [key: string]: IntervalID };

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
        controller: Controller,
    ) {
        super(
            representation,
            assetCollectionFetcher,
            fetchMedia,
            player,
            analytics,
            controller,
        );
        this.renderImageElement();
        this._disablePlayButton = () => { this._player.disablePlayButton(); };
        this._enablePlayButton = () => { this._player.enablePlayButton(); };
        this._disableScrubBar = () => { this._player.disableScrubBar(); };
        this._enableScrubBar = () => { this._player.enableScrubBar(); };
        this._timeElapsed = 0;
        this._duration = Infinity;
        this._timeIntervals = {};
    }

    willStart() {
        super.willStart();
        if (!this._imageElement) this.renderImageElement();

        this._visible = true;
        this._setVisibility(true);

        this._disablePlayButton();
    }

    start() {
        super.start();
        this._hasEnded = true;
        if (this._representation.duration && this._representation.duration > 0){
            this._duration = this._representation.duration;
            this._timeElapsed = 0;
            // eslint-disable-next-line max-len
            logger.info(`Image representation ${this._representation.id} timed for ${this._representation.duration}s, starting now`);
        }
        if (this._representation.duration && this._representation.duration === 0) {
            this.complete();
        } else {
            this._startTimer();
        }
    }

    pause() {
        clearInterval(this._imageTimer);
    }

    _startTimer() {
        this._imageTimer = setInterval(() => {
            this._timeElapsed += TIMER_INTERVAL/1000;
            if (this._timeElapsed >= this._duration) {
                // eslint-disable-next-line max-len
                logger.info(`Image representation ${this._representation.id} completed timeout`);
                this.complete();
            }
        }, TIMER_INTERVAL);
    }

    getCurrentTime(): Object {
        if (this._representation.duration && this._representation.duration > 0) {
            const timeObject = {
                timeBased: true,
                currentTime: this._timeElapsed,
                remainingTime: this._duration - this._timeElapsed,
            };
            return timeObject;
        }
        return super.getCurrentTime();
    }

    addTimeEventListener(listenerId: string, time: number, callback: Function) {
        this._timeEventListeners[listenerId] = callback;
        if (time > this._duration) {
            logger.warn('Tried to adding time event listener to image after its completion time');
            return;
        }
        this._timeIntervals[listenerId] = setInterval(() => {
            if (time > 0 && this._timeElapsed >= time) {
                if (listenerId in this._timeEventListeners) {
                    delete this._timeEventListeners[listenerId];
                    callback();
                }
                if (listenerId in this._timeIntervals) {
                    clearInterval(this._timeIntervals[listenerId]);
                    delete this._timeIntervals[listenerId];
                }
            }
        }, 50);
    }

    deleteTimeEventListener(listenerId: string) {
        if (listenerId in this._timeEventListeners) {
            delete this._timeEventListeners[listenerId];
        }
        if (listenerId in this._timeIntervals) {
            clearInterval(this._timeIntervals[listenerId]);
            delete this._timeIntervals[listenerId];
        }
    }

    play(){
        this._startTimer();
    }

    end() {
        super.end();
        this._visible = false;
        // Hack to make image transitions smooth (preventing showing of black background with
        // loading wheel). For some reason the DOM transition on images is slow, not sure why this
        // is only the case for images and not video but this fixes it.
        setTimeout(() => {
            if (!this._visible) {
                this._setVisibility(false);
            }
        }, 100);
        if (this._imageTimer){
            clearInterval(this._imageTimer);
        }
        Object.keys(this._timeIntervals).forEach((listenerId) => {
            clearInterval(this._timeIntervals[listenerId]);
        });
        this._timeIntervals = {};
        this._enablePlayButton();
        this._enableScrubBar();
    }

    renderImageElement() {
        this._imageElement = document.createElement('img');
        this._imageElement.className = 'romper-render-image';
        this._setVisibility(false);
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        this._fetchMedia(fg.assets.image_src).then((mediaUrl) => {
                            logger.info(`FETCHED FROM MS MEDIA! ${mediaUrl}`);
                            this._imageElement.src = mediaUrl;
                        }).catch((err) => { logger.error(err, 'Notfound'); });
                    }
                });
        }

        this._target.appendChild(this._imageElement);
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    _setVisibility(visible: boolean) {
        if (this._imageElement) this._imageElement.style.display = visible ? 'initial' : 'none';
    }

    destroy() {
        this.end();

        if (this._imageElement) this._target.removeChild(this._imageElement);
        super.destroy();
    }
}
