// @flow

import { RENDERER_PHASES } from './BaseRenderer';
import BaseTimedIntervalRenderer from './BaseTimedIntervalRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../storyplayer';
import Player from '../gui/Player';
import logger from '../logger';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

export default class ImageRenderer extends BaseTimedIntervalRenderer {
    _imageElement: HTMLImgElement;

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
    }

    async init() {
        try {
            await this.renderImageElement();
            await this._preloadBehaviourAssets();
            this._setPhase(RENDERER_PHASES.CONSTRUCTED);
        } catch(e) {
            logger.error(e, 'Could not construct image renderer');
        }
    }

    start() {
        const ready = super.start();
        if (!ready) return false;

        const duration = this.getDuration();
        this._playoutEngine.startNonAVPlayout(this._rendererId, duration)
        this._setVisibility(true);

        if (duration === Infinity) {
            logger.info(`Image representation ${this._representation.id} persistent`);
            this._disablePlayButton();
            this._disableScrubBar();
            this._setPhase(RENDERER_PHASES.MEDIA_FINISHED); // so link choices still work
        } else if (duration === 0) {
            logger.warn(`Image representation ${this._representation.id} has zero duration`);
            this.complete();
        } else {
            // eslint-disable-next-line max-len
            logger.info(`Image representation ${this._representation.id} timed for ${duration}s, starting now`);
            this._player.showSeekButtons();
            this._enableScrubBar();
            this.addTimeEventListener(
                `${this._rendererId}-complete`,
                duration,
                () => {
                    // eslint-disable-next-line max-len
                    logger.info(`Image representation ${this._representation.id} completed time`);
                    this._testIfInVarPanel();
                },
            );
        }
        return true;
    }

    // tests if we're in a variable panel, and waits until we've finished before moving on
    _testIfInVarPanel() {
        if (!this.inVariablePanel) {
            this.complete();
        }
        else {
            setTimeout(() => this._testIfInVarPanel(), 100);
        }
    }

    end() {
        const needToEnd = super.end();
        if (!needToEnd) return false;
        this._playoutEngine.stopNonAVPlayout(this._rendererId)

        this._setVisibility(false);
        return true;
    }

    async renderImageElement() {
        this._imageElement = document.createElement('img');
        this._imageElement.className = 'romper-render-image notInteractiveContent noselect';
        this._imageElement.setAttribute('draggable', 'false');
        this._setVisibility(false);
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(
                this._representation.asset_collections.foreground_id,
            );
            if (fg.assets.image_src) {
                try {
                    const mediaUrl = await this._fetchMedia(fg.assets.image_src, { includeCredentials: true });
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
