// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import Player from '../Player';
import logger from '../logger';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

export default class ImageRenderer extends BaseRenderer {
    _aFrameSceneElement: any;

    _disablePlayButton: Function;

    _disableScrubBar: Function;

    _enablePlayButton: Function;

    _enableScrubBar: Function;

    _visible: boolean;


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
    }

    start() {
        super.start();
        if (!this._aFrameSceneElement) this.renderImageElement();

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

    buildBaseAframeScene() {
        // create a-frame scene
        // scene
        logger.info('Building aFrame image infrastructure');
        if (this._aFrameSceneElement) {
            return;
        }
        // scene
        this._aFrameSceneElement = document.createElement('a-scene');
        this._aFrameSceneElement.id = 'romperimgascene';
        this._aFrameSceneElement.setAttribute('embedded', '');
        this._aFrameSceneElement.classList.add('romper-aframe-scene');

        // sky
        this.sky = document.createElement('a-sky');
        
    }

    renderImageElement() {
        
        this.buildBaseAframeScene();
       
        this._setVisibility(false);
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        this._fetchMedia(fg.assets.image_src).then((mediaUrl) => {
                            logger.info(`FETCHED FROM MS MEDIA! ${mediaUrl}`);
                            console.log(mediaUrl);
                            this.sky.src = mediaUrl;
                        }).catch((err) => { logger.error(err, 'Notfound'); });
                    }
                });
        }
        this._aFrameSceneElement.appendChild(this.sky);
        this._target.appendChild(this._aFrameSceneElement);
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
