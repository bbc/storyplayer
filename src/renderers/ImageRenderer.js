// @flow

import BaseRenderer, { RENDERER_PHASES } from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import Player from '../Player';
import logger from '../logger';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

export default class ImageRenderer extends BaseRenderer {
    _imageElement: HTMLImgElement;

    _disablePlayButton: Function;

    _disableScrubBar: Function;

    _enablePlayButton: Function;

    _enableScrubBar: Function;

    _visible: boolean;

    _duration: number;

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
        this._disablePlayButton = () => { this._player.disablePlayButton(); };
        this._enablePlayButton = () => { this._player.enablePlayButton(); };
        this._disableScrubBar = () => { this._player.disableScrubBar(); };
        this._enableScrubBar = () => { this._player.enableScrubBar(); };
        this._duration = this._representation.duration ? this._representation.duration : Infinity;
    }

    async init() {
        try {
            await this.renderImageElement();
            this._setPhase(RENDERER_PHASES.CONSTRUCTED);
        } catch(e) {
            logger.error(e, 'Could not construct image renderer');
        }
    }

    willStart() {
        const ready = super.willStart();
        if (!ready) return false;

        this._visible = true;
        this._setVisibility(true);
        return true;
    }

    start() {
        super.start();
        this._playoutEngine.startNonAVPlayout()
        if (this._duration === Infinity || this._duration < 0) {
            logger.info(`Image representation ${this._representation.id} persistent`);
            this._disablePlayButton();
            this._disableScrubBar();
            this._setPhase(RENDERER_PHASES.MEDIA_FINISHED); // so link choices still work
        } else if (this._duration === 0) {
            logger.warn(`Image representation ${this._representation.id} has zero duration`);
            this.complete();
        } else {
            // eslint-disable-next-line max-len
            logger.info(`Image representation ${this._representation.id} timed for ${this._duration}s, starting now`);
            this._enableScrubBar();
            this._timer.addTimeEventListener(
                `${this._rendererId}-complete`,
                this._duration,
                () => {
                    // eslint-disable-next-line max-len
                    logger.info(`Image representation ${this._representation.id} completed time`);
                    this.complete();
                },
            );
        }
    }

    end() {
        const needToEnd = super.end();
        this._playoutEngine.stopNonAVPlayout()
        if (!needToEnd) return false;

        this._visible = false;
        // Hack to make image transitions smooth (preventing showing of black background with
        // loading wheel). For some reason the DOM transition on images is slow, not sure why this
        // is only the case for images and not video but this fixes it.
        setTimeout(() => {
            if (!this._visible) {
                this._setVisibility(false);
            }
        }, 100);
        return true;
    }

    async renderImageElement() {
        this._imageElement = document.createElement('img');
        this._imageElement.className = 'romper-render-image';
        this._setVisibility(false);
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(
                this._representation.asset_collections.foreground_id,
            );
            if (fg.assets.image_src) {
                try {
                    const mediaUrl = await this._fetchMedia(fg.assets.image_src);
                    logger.info(`FETCHED FROM MS MEDIA! ${mediaUrl}`);
                    this._imageElement.src = mediaUrl;
                }
                catch(err) {
                    logger.error(err, 'Notfound');
                    throw new Error('Image media not found');
                }
            }
        } else {
            throw new Error('No foreground assets for image representation');
        }

        this._target.appendChild(this._imageElement);
    }

    switchFrom() {
        this._setVisibility(false);
    }

    switchTo() {
        this._setVisibility(true);
    }

    _setVisibility(visible: boolean) {
        if (this._imageElement) this._imageElement.style.opacity = visible ? '1' : '0';
    }

    destroy() {
        const needToDestroy = super.destroy();
        if(!needToDestroy) return false;

        if (this._imageElement) {
            try {
                this._target.removeChild(this._imageElement);
            } catch(e) {
                logger.warn(`Could not remove image on destroy: ${e}`);
            }
        }
        return true;
    }
}
