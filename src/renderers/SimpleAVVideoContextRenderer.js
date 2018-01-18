// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

import { getVideoContext, getCanvas } from '../utils/custom-video-context';

import RendererEvents from './RendererEvents';


export default class SimpleAVVideoContextRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _canvas: HTMLCanvasElement;
    _videoNode: Object;
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
        this._canvas = getCanvas();
        this._target.appendChild(this._canvas);
        this._videoNode = {};
        this._nodeCreated = false;
        this._nodeCompleted = false;

        this.renderVideoElement();
        this._videoCtx.registerMe(this._representation.id);

        this.on('videoContextNodeCreated', () => { this._nodeCreated = true; });
    }

    start() {
        super.start();
        // start the video
        this.setVisible(true);
        this.playVideo();
        // this.renderDataModelInfo();
    }

    playVideo() {
        if (this._nodeCreated) {
            this._videoNode.connect(this._videoCtx.destination);
            const node = this._videoNode;
            node.start(0);
            this.emit(RendererEvents.STARTED);
            this._videoCtx.play();
            this.setMute(false);
        } else {
            const that = this;
            this.on('videoContextNodeCreated', () => {
                that._nodeCreated = true;
                that.playVideo();
            });
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

        videoNode1.registerCallback('ended', () => {
            // console.log('VCtx node complete', mediaUrl);
            if (!this._nodeCompleted) {
                this.complete();// .bind(this);
            } else {
                console.warn('multiple VCtx ended events received');
            }
            this._nodeCompleted = true;
        });

        this._videoNode = videoNode1;
        this.emit('videoContextNodeCreated');
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

    getTimeData(): Object {
        const timeObject = {
            timeBased: true,
            currentTime: this._videoNode._currentTime,
        };
        return timeObject;
    }

    // prepare rendere so it can be switched to quickly and in sync
    cueUp() {
        this.setVisible(false);
        this._cueUpWhenReady();
    }

    _cueUpWhenReady() {
        if (this._nodeCreated) {
            this._videoNode.connect(this._videoCtx.destination);
            this.setMute(true);
            this._videoNode.start(0);
            this._videoNode.disconnect();
        } else {
            const that = this;
            this.on('videoContextNodeCreated', () => {
                that._cueUpWhenReady();
            });
        }
    }

    setMute(quiet: boolean) {
        if (this._videoNode.element) this._videoNode.element.muted = quiet;
    }

    setVisible(visible: boolean) {
        if (visible) {
            this._videoCtx.showMe(this._representation.id);
        } else {
            this._videoCtx.hideMe(this._representation.id);
        }
        // this._canvas.style.display = visible ? 'flex' : 'none';
    }

    switchFrom() {
        this._videoNode.disconnect();
        this.setMute(true);
        this.setVisible(false);
        this._videoCtx.pause();
    }

    switchTo() {
        this._videoCtx.play();
        this.playVideo();
        this.setMute(false);
        this.setVisible(true);
    }

    stopAndDisconnect() {
        this._videoNode.unregisterCallback();

        // Stop current active node
        this._videoNode.stop(-1);

        // disconnect current active node.
        this._videoNode.disconnect();
        this._videoNode.destroy();
        this._videoCtx.forgetMe(this._representation.id);
    }

    destroy() {
        this.stopAndDisconnect();
        super.destroy();
    }
}
