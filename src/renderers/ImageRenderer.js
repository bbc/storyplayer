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

    _timeRemaining: number;

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
        this._timeRemaining = 0;
    }

    willStart() {
        super.willStart();
        if (!this._imageElement) this.renderImageElement();

        this._visible = true;
        this._setVisibility(true);

        this._disablePlayButton();
        this._player.disableRepeatButton();
        this._disableScrubBar();
    }

    start() {
        super.start();
        this._hasEnded = true;
        if (this._representation.duration && this._representation.duration > 0){
            this._timeRemaining = this._representation.duration * 1000;
            // eslint-disable-next-line max-len
            logger.info(`Image representation ${this._representation.id} timed for ${this._representation.duration}s, starting now`);
            this._startTimer();
        } else if (this._representation.duration && this._representation.duration === 0) {
            this.complete();
        }
    }

    pause() {
        // if timed image, pause timeout
        if (this._timeRemaining > 0) {
            clearInterval(this._imageTimer);
        }
    }

    _startTimer() {
        this._imageTimer = setInterval(() => {
            this._timeRemaining -= TIMER_INTERVAL;
            if (this._timeRemaining <= 0) {
                // eslint-disable-next-line max-len
                logger.info(`Image representation ${this._representation.id} completed timeout`);
                this.complete();
            }
        }, TIMER_INTERVAL);
    }

    play(){
        // if timed image, resume timeout
        if (this._timeRemaining > 0){
            this._startTimer();
        }
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
        this._enablePlayButton();
        this._player.resetRepeatBackButton();
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
