// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

import { getVideoContext, getCanvas } from '../utils/custom-video-context';

import RendererEvents from './RendererEvents';


export default class ImageVideoContextRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _canvas: HTMLCanvasElement;
    _imageNode: Object;
    _videoCtx: Object;
    _nodeCreated: boolean;
    _nodeCompleted: boolean;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target);
        // this._canvas = document.createElement('canvas');
        this._videoCtx = getVideoContext();
        const canvas = getCanvas();
        this._target.appendChild(canvas);
        this._imageNode = {};
        this._nodeCreated = false;
        this._nodeCompleted = false;

        this.renderImageElement();

        this.on('videoContextNodeCreated', () => { this._nodeCreated = true; });
    }

    start() {
        super.start();
        // start the video
        this.renderImage();
        // this.renderDataModelInfo();
    }

    renderImage() {
        if (this._nodeCreated) {
            this._imageNode.connect(this._videoCtx.destination);
            // console.log('callbacks', this._imageNode._callbacks.length);
            const node = this._imageNode;
            node.start(0);
            this.emit(RendererEvents.STARTED);
            this._videoCtx.play();
        } else {
            const that = this;
            this.on('videoContextNodeCreated', () => {
                that._nodeCreated = true;
                that.renderImage();
            });
        }
    }

    addImageNodeToVideoCtxGraph(mediaUrl: string) {
        this._imageNode = this._videoCtx.image(mediaUrl);
        this._nodeCompleted = true;
        this.emit('videoContextNodeCreated');
        // console.log('vctx node created. loaded.', mediaUrl);
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

    switchFrom() {
        this._imageNode.disconnect();
        this._videoCtx.play();
    }

    switchTo() {
        this.renderImage();
        this._videoCtx.pause();
    }

    stopAndDisconnect() {
        this._imageNode.destroy();
    }

    destroy() {
        this.stopAndDisconnect();
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }

        super.destroy();
    }
}
