// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import Player from '../Player';
import logger from '../logger';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import AFrameRenderer from './AFrameRenderer';


export default class AFrameImageRenderer extends BaseRenderer {
    _aFrameSceneElement: any;

    _disablePlayButton: Function;

    _disableScrubBar: Function;

    _enablePlayButton: Function;

    _enableScrubBar: Function;

    _imageElement: HTMLImageElement;

    _initialRotation: string;

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
        this._collectElementsToRender();

    }

    start() {
        super.start();
        this.renderImageElement();

        this._disablePlayButton();
        this._disableScrubBar();
        this._hasEnded = true;
    }

    end() {
        super.end();
        this._enablePlayButton();
        this._enableScrubBar();
    }

    _buildAssets(mediaUrl: string) {
        // create HTML img asset and add it as an aframe asset
        this._imageElement = document.createElement('img');
        this._imageElement.src = mediaUrl;
        this._imageElement.id = mediaUrl;
        AFrameRenderer.addAsset(this._imageElement);
    }

    _collectElementsToRender() {
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        if (fg.meta && fg.meta.romper && fg.meta.romper.rotation) {
                            // starting rotation
                            this._initialRotation = fg.meta.romper.rotation;
                        }
                        this._fetchMedia(fg.assets.image_src)
                            .then((mediaUrl) => {
                                this._buildAssets(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Image not found');
                            });
                    }
                });
        }
    }

    renderImageElement() {
        AFrameRenderer.addAFrameToRenderTarget(this._target, this._player, this._analytics);
        AFrameRenderer._show360Image(this._imageElement.id);
        AFrameRenderer.setSceneHidden(false);
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    // eslint-disable-next-line class-methods-use-this
    isVRViewable(): boolean {
        return true;
    }

    destroy() {
        this.end();
        super.destroy();
    }
}
