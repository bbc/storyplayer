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

    _visible: boolean;

    _afr: typeof AFrameRenderer;

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
       // if (!this._aFrameSceneElement) this.renderImageElement();

        this._visible = true;
        this._setVisibility(true);

        this._disablePlayButton();
        this._disableScrubBar();
        this._hasEnded = true;
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
        this._enablePlayButton();
        this._enableScrubBar();
    }

    _buildAssets(mediaUrl) {
       

        // create HTML img asset and add it as an aframe asset
        this._imageElement = document.createElement('img');
        this._imageElement.src = mediaUrl;
        this._imageElement.id = mediaUrl;
        AFrameRenderer.addAsset(this._imageElement);

        console.log('build', this._imageElement);
        console.log('build', mediaUrl);

        this.renderImageElement();

    }

    _collectElementsToRender() {
        console.log('collect')
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    console.log(fg);
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
                                logger.error(err, 'Video not found');
                            });
                    }
                });
        }

    }

 
    renderImageElement() {
        console.log('render', this._imageElement, this._imageElement.id);
        this._setVisibility(false);
        AFrameRenderer.addAFrameToRenderTarget(this._target, this._player, this._analytics);
        AFrameRenderer._show360Image(this._imageElement.id);
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    _setVisibility(visible: boolean) {
        if (this._aFrameSceneElement) this._aFrameSceneElement.style.display = visible ? 'initial' : 'none';
    }

    destroy() {
        this.end();

        if (this._aFrameSceneElement) this._target.removeChild(this._aFrameSceneElement);
        super.destroy();
    }
}
