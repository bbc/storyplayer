// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

import CustomVideoContext, { getVideoContext, getCanvas } from '../utils/custom-video-context';

import RendererEvents from './RendererEvents';


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

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target);
        // this._canvas = document.createElement('canvas');
        this.cueUp = this.cueUp.bind(this);
        this._cueUpWhenReady = this._cueUpWhenReady.bind(this)

        this._videoCtx = getVideoContext();
        this._canvas = getCanvas();
        this._target.appendChild(this._canvas);
        this._imageNode = {};
        this._nodeCreated = false;
        this._nodeCompleted = false;
        this._effectNodes = [];

        this._videoCtx.registerVideoContextClient(this._representation.id);
        this.renderImageElement();

        this.on('videoContextImageNodeCreated', () => { this._nodeCreated = true; });
    }

    start() {
        super.start();
        // start the video
        this.renderImage();
        // this.renderDataModelInfo();
        this._setVisible(true);
    }

    renderImage() {
        if (this._nodeCreated) {
            this._videoCtx.play();
            this._imageNode.connect(this._videoCtx.destination);
            // console.log('callbacks', this._imageNode._callbacks.length);
            const node = this._imageNode;
            node.start(0);
            this.emit(RendererEvents.STARTED);
            this._videoCtx.pause(); // TODO: need to call this once the image is really showing...
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
        console.log('vctx image node created', mediaUrl);
    }

    applyBlur() {
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
            node.destroy();
        });
    }

    renderImageElement() {
        // get asset and call build node function
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground).then((fg) => {
                if (fg.assets.image_src) {
                    this._fetchMedia(fg.assets.image_src)
                        .then((mediaUrl) => {
                            // this.populateVideoElement(this._videoElement, mediaUrl);
                            this.addImageNodeToVideoCtxGraph(mediaUrl);
                        })
                        .catch((err) => {
                            console.error(err, 'Notfound');
                        });
                }
            });
        } else {
            // console.error('No foreground source for AVRenderer');
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
            this._videoCtx.showVideoContextForClient(this._representation.id);
        } else {
            this._videoCtx.hideVideoContextForClient(this._representation.id);
        }
        // this._canvas.style.display = visible ? 'flex' : 'none';
    }

    switchFrom() {
        this._imageNode.disconnect();
        this._clearEffectNodes();
        this._setVisible(false);
    }

    switchTo() {
        this._imageNode.connect(this._videoCtx.destination);
        this._setVisible(true);
        // this.applyBlur();
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
            console.warn('VCtx could not destroy image node:', e);
        }
        this._videoCtx.unregisterVideoContextClient(this._representation.id);
    }

    destroy() {
        this.stopAndDisconnect();
        super.destroy();
    }
}
