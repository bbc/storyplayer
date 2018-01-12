// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

import CustomVideoContext, { getVideoContext, getCanvas } from '../utils/custom-video-context';

import RendererEvents from './RendererEvents';


export default class SimpleAVVideoContextRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _canvas: HTMLCanvasElement;
    _videoNode: Object;
    _videoCtx: Object;
    NODE_CREATED: boolean;

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
        this._videoNode = {};
        this.NODE_CREATED = false;

        this.renderVideoElement();

        this.on('videoContextNodeCreated', () => { this.NODE_CREATED = true; });
    }

    start() {
        super.start();
        // start the video
        this.playVideo();
        // this.renderDataModelInfo();
    }

    playVideo() {
        if (this.NODE_CREATED) {
            const node = this._videoNode;
            node.start(0);
            this.emit(RendererEvents.STARTED);
            this._videoCtx.play();
        } else {
            const that = this;
            this.on('videoContextNodeCreated', () => { that.NODE_CREATED = true; that.playVideo(); });
        }
    }

    addVideoNodeToVideoCtxGraph(mediaUrl: string) {
        let videoNode1;
        // if mediaUrl is hls
        if (mediaUrl.indexOf('.m3u8') !== -1) {
            videoNode1 = this._videoCtx.hls(mediaUrl, 0, 4);
        } else {
            videoNode1 = this._videoCtx.video(mediaUrl, 0, 4);
        }
        videoNode1.connect(this._videoCtx.destination);

        videoNode1.registerCallback('ended', this.complete.bind(this));

        this._videoNode = videoNode1;
        this.emit('videoContextNodeCreated');
        console.log('vctx node created. loaded.');
    }

    renderVideoElement() {
        // get asset and call build node function
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground).then((fg) => {
                if (fg.assets.av_src) {
                    this._fetchMedia(fg.assets.av_src)
                        .then((mediaUrl) => {
                            // this.populateVideoElement(this._videoElement, mediaUrl);
                            this.addVideoNodeToVideoCtxGraph(mediaUrl);
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
        const backgroundItem = document.createElement('li');
        const iconItem = document.createElement('li');
        assetList.appendChild(foregroundItem);
        assetList.appendChild(backgroundItem);
        assetList.appendChild(iconItem);
        this._target.appendChild(assetList);

        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground).then((fg) => {
                foregroundItem.textContent = `foreground: ${fg.name}`;
                if (fg.assets.av_src) {
                    foregroundItem.textContent += ` from ${fg.assets.av_src}`;
                }
            });
        }

        if (
            this._representation.asset_collection.background &&
            this._representation.asset_collection.background.length > 0
        ) {
            this._fetchAssetCollection(this._representation.asset_collection.background[0]).then((bg) => {
                backgroundItem.textContent = `background: ${bg.name}`;
                if (bg.assets.audio_src) {
                    backgroundItem.textContent += ` from ${bg.assets.audio_src}`;
                }
            });
        } else {
            backgroundItem.textContent = 'background: none';
        }

        if (this._representation.asset_collection.icon) {
            this._fetchAssetCollection(this._representation.asset_collection.icon.default).then((icon) => {
                iconItem.textContent = `icon: ${icon.name}`;
                if (icon.assets.image_src) {
                    iconItem.textContent += ` from ${icon.assets.image_src}`;
                }
            });
        } else {
            iconItem.textContent = 'icon: none';
        }
    }

    stopAndDisconnect() {
        this._videoNode.unregisterCallback();

        // Stop current active node
        this._videoNode.stop(-1);

        // disconnect current active node.
        this._videoNode.disconnect();
    }

    destroy() {
        this.stopAndDisconnect();
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }

        super.destroy();
    }
}
