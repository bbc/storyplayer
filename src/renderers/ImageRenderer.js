// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import Player from '../Player';
import logger from '../logger';
import type { AnalyticsLogger } from '../AnalyticEvents';

export default class ImageRenderer extends BaseRenderer {
    _imageElement: HTMLImageElement;
    _disablePlayButton: Function;
    _disableScrubBar: Function;
    _enablePlayButton: Function;
    _enableScrubBar: Function;


    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player, analytics);
        this.renderImageElement();
        this._disablePlayButton = () => { this._player.disablePlayButton(); };
        this._enablePlayButton = () => { this._player.enablePlayButton(); };
        this._disableScrubBar = () => { this._player.disableScrubBar(); };
        this._enableScrubBar = () => { this._player.enableScrubBar(); };
    }

    start() {
        super.start();
        if (!this._imageElement) this.renderImageElement();
        this._setVisibility(true);
        this._disablePlayButton();
        this._disableScrubBar();
    }

    end() {
        this._setVisibility(false);
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
