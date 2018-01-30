// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher, AnalyticsLogger } from '../romper';
import Player from '../Player';

import CustomVideoContext, { getVideoContext, getCanvas } from '../utils/custom-video-context';

import RendererEvents from './RendererEvents';
import logger from '../logger';

export default class ImageVideoContextRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _canvas: HTMLCanvasElement;
    _imageNode: Object;
    _videoCtx: Object;
    _nodeCreated: boolean;
    _nodeCompleted: boolean;
    _effectNodes: Array<Object>;
    cueUp: Function;
    _cueUpWhenReady: Function;
    _renderImageTimeoutHandle: number;
    _target: HTMLDivElement;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player, analytics);
        // this._canvas = document.createElement('canvas');
        this.cueUp = this.cueUp.bind(this);
        this._cueUpWhenReady = this._cueUpWhenReady.bind(this);

        this._videoCtx = getVideoContext();
        this._canvas = getCanvas();
        this._target = player.mediaTarget;
        this._target.appendChild(this._canvas);
        this._imageNode = {};
        this._nodeCreated = false;
        this._nodeCompleted = false;
        this._effectNodes = [];

        CustomVideoContext.registerVideoContextClient(this._representation.id);
        this.renderImageElement();

        this.on('videoContextImageNodeCreated', () => { this._nodeCreated = true; });
    }

    start() {
        super.start();
        // start the video
        this.renderImage();
        this._setVisible(true);
    }

    renderImage() {
        if (this._nodeCreated) {
            this._videoCtx.play();
            this._imageNode.connect(this._videoCtx.destination);
            const node = this._imageNode;
            node.start(0);
            this.emit(RendererEvents.STARTED);
            // TODO: we will miss first 20ms of video when we switch to them
            this._renderImageTimeoutHandle = setTimeout(() => { this._videoCtx.pause(); }, 32);
        } else {
            this.on('videoContextImageNodeCreated', () => {
                this._nodeCreated = true;
                this.renderImage();
            });
        }
    }

    addImageNodeToVideoCtxGraph(mediaUrl: string) {
        this._imageNode = this._videoCtx.image(mediaUrl);
        this._nodeCompleted = true;
        this.emit('videoContextImageNodeCreated');
        logger.info(`vctx image node created ${mediaUrl}`);
    }

    applyBlur() {
        // eslint-disable-next-line max-len
        const blurEffectHoriz = this._videoCtx.effect(CustomVideoContext.DEFINITIONS.HORIZONTAL_BLUR);
        const blurEffectVert = this._videoCtx.effect(CustomVideoContext.DEFINITIONS.VERTICAL_BLUR);
        this._imageNode.disconnect();
        this._imageNode.connect(blurEffectHoriz);
        blurEffectHoriz.connect(blurEffectVert);
        blurEffectVert.connect(this._videoCtx.destination);
        this._effectNodes.push(blurEffectHoriz);
        this._effectNodes.push(blurEffectVert);
    }

    _clearEffectNodes() {
        this._effectNodes.forEach((node) => {
            try {
                node.destroy();
            } catch (e) {
                logger.warn(`VCtx effect node destroy error: ${e}`);
            }
        });
    }

    renderImageElement() {
        // get asset and call build node function
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        this._fetchMedia(fg.assets.image_src)
                            .then((mediaUrl) => {
                                this.addImageNodeToVideoCtxGraph(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Notfound');
                            });
                    }
                });
        }
    }

    renderDataModelInfo() {
        const assetList = document.createElement('ul');
        const foregroundItem = document.createElement('li');
        assetList.appendChild(foregroundItem);
        this._target.appendChild(assetList);


        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    foregroundItem.textContent = `foreground: ${fg.name}`;
                    if (fg.assets.image_src) {
                        foregroundItem.textContent += ` from ${fg.assets.image_src}`;
                    }
                });
        }
    }

    _setVisible(visible: boolean) {
        if (visible) {
            CustomVideoContext.showVideoContextForClient(this._representation.id);
        } else {
            CustomVideoContext.hideVideoContextForClient(this._representation.id);
        }
    }

    switchFrom() {
        this._imageNode.disconnect();
        this._setVisible(false);
    }

    switchTo() {
        this._imageNode.connect(this._videoCtx.destination);
        this._setVisible(true);
    }

    // prepare rendere so it can be switched to quickly and in sync
    cueUp() {
        this._setVisible(false);
        this._cueUpWhenReady();
    }

    _cueUpWhenReady() {
        if (this._nodeCreated) {
            this._imageNode.connect(this._videoCtx.destination);
            this._imageNode.start(0);
            this._imageNode.disconnect();
        } else {
            this.on('videoContextImageNodeCreated', () => {
                this._cueUpWhenReady();
            });
        }
    }

    stopAndDisconnect() {
        this._clearEffectNodes();
        try {
            if (this._nodeCreated) this._imageNode.destroy();
        } catch (e) {
            logger.warn(`VCtx could not destroy image node: ${e}`);
        }
        CustomVideoContext.unregisterVideoContextClient(this._representation.id);
    }

    destroy() {
        clearTimeout(this._renderImageTimeoutHandle);
        this.stopAndDisconnect();
        super.destroy();
    }
}
