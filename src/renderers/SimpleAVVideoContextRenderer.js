// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';

import CustomVideoContext, { getVideoContext, getCanvas, createVideoContextNodeForUrl } from '../utils/custom-video-context';

import RendererEvents from './RendererEvents';
import logger from '../logger';

export default class SimpleAVVideoContextRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _canvas: HTMLCanvasElement;
    _videoNode: Object;
    _videoCtx: Object;
    _nodeCreated: boolean;
    _nodeCompleted: boolean;
    cueUp: Function;
    _cueUpWhenReady: Function;
    playVideo: Function;
    _effectNodes: Array<Object>;
    _applyBlurBehaviour: Function;
    _applyShowImageBehaviour: Function;
    _monitorVideoTimelineForEnd: Function;
    _monitorVideoTimeoutHandle: number;
    _videoContextQueueTimeoutHandle: number;
    _isCurrentSwitchChoice: boolean;
    _destinationVideoContextNode: Object;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
        analytics: AnalyticsLogger,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target, analytics);
        this.playVideo = this.playVideo.bind(this);
        this.cueUp = this.cueUp.bind(this);
        this._cueUpWhenReady = this._cueUpWhenReady.bind(this);

        this._videoCtx = getVideoContext();
        this._canvas = getCanvas();
        this._target.appendChild(this._canvas);
        this._videoNode = {};
        this._nodeCreated = false;
        this._nodeCompleted = false;
        this._effectNodes = [];
        this._isCurrentSwitchChoice = false;

        this.renderVideoElement();
        CustomVideoContext.registerVideoContextClient(this._representation.id);

        this.on('videoContextNodeCreated', () => { this._nodeCreated = true; });

        this._applyBlurBehaviour = this._applyBlurBehaviour.bind(this);
        this._applyShowImageBehaviour = this._applyShowImageBehaviour.bind(this);
        this._monitorVideoTimelineForEnd = this._monitorVideoTimelineForEnd.bind(this);

        this._behaviourRendererMap = {
            'urn:x-object-based-media:asset-mixin:blur/v1.0': this._applyBlurBehaviour,
            'urn:x-object-based-media:asset-mixin:showimage/v1.0': this._applyShowImageBehaviour,
        };

        // after we've created it, wait a bit, then see if we can add to the end of the queue
        // this._videoContextQueueTimeoutHandle = setTimeout(() => { this._addVideoNodeToVideoContextTimeline(); }, 5000);
    }

    start() {
        super.start();
        // start the video
        this.setVisible(true);
        this.playVideo();
        // this.renderDataModelInfo();
        this._isCurrentSwitchChoice = true;
    }

    playVideo() {
        if (this._nodeCreated) {
            this._destinationVideoContextNode = this._videoNode;
            this._videoNode.connect(this._videoCtx.destination);
            const node = this._videoNode;

            // if the video isn't queued in VideoContext, then set start time
            if (this._videoNode.state <= 2) {
                node.start(0);
            }

            this.emit(RendererEvents.STARTED);
            this._videoCtx.play();
            this.setMute(false);
            this._monitorVideoTimeoutHandle = setTimeout(this._monitorVideoTimelineForEnd, 200);
        } else {
            this.on('videoContextNodeCreated', () => {
                this._nodeCreated = true;
                this.playVideo();
            });
        }
    }

    _addVideoNodeToVideoContextTimeline() {
        // what is current finish time of VideoContext
        const videoContextEndTime = this._videoCtx.guessContextFinishTime();

        // if we don't already have a start time for our node, place it at
        // the end of the timeline
        if (this._nodeCreated && this._videoNode.state === 0) {
            this._videoNode.startAt(videoContextEndTime - 0.05);
            this._videoNode.connect(this._videoCtx.destination);
            this._destinationVideoContextNode = this._videoNode;
        }
    }

    addVideoNodeToVideoCtxGraph(mediaUrl: string) {
        const videoNode1 = createVideoContextNodeForUrl(mediaUrl);
        videoNode1.registerCallback('ended', () => {
            // this shouldn't be needed - should reach in _monitorVideoTimelineForEnd first
            logger.warn(`VCtx node completed event received ${mediaUrl}`);
            if (!this._nodeCompleted) {
                this.complete();
            } else {
                logger.warn('multiple VCtx ended events received');
            }
            this._nodeCompleted = true;
        });

        this._videoNode = videoNode1;
        this.emit('videoContextNodeCreated');
    }

    _monitorVideoTimelineForEnd() {
        // TODO: this monitoring is to catch the video before it has completely finished:
        // waiting for VideoContext complete event means video is black/invisble
        // and can't have effects applied
        if ((this._videoNode.state === 2) && this._videoCtx.currentTime > (this._videoNode.stopTime - 0.1)) {
            if (!this._nodeCompleted) {
                this._videoCtx.pause();
                if (this._isCurrentSwitchChoice) {
                    this.complete();
                } else {
                    logger.warn('completed VCtx simple av that was npt visible');
                }
            } else {
                logger.warn('multiple VCtx ended events received');
            }
            this._nodeCompleted = true;
        } else {
            this._monitorVideoTimeoutHandle = setTimeout(this._monitorVideoTimelineForEnd, 20);
        }
    }

    renderVideoElement() {
        // get asset and call build node function
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground).then((fg) => {
                if (fg.assets.av_src) {
                    this._fetchMedia(fg.assets.av_src)
                        .then((mediaUrl) => {
                            this.addVideoNodeToVideoCtxGraph(mediaUrl);
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

    getCurrentTime(): Object {
        const timeObject = {
            timeBased: true,
            currentTime: this._videoNode._currentTime,
        };
        return timeObject;
    }

    _applyBlurBehaviour(behaviour: Object, behaviourAppliedCallback: () => void) {
        // create effect notes
        const blurEffectHoriz = this._videoCtx.effect(CustomVideoContext.DEFINITIONS.HORIZONTAL_BLUR);
        const blurEffectVert = this._videoCtx.effect(CustomVideoContext.DEFINITIONS.VERTICAL_BLUR);
        blurEffectHoriz.blurAmount = behaviour.blur;
        blurEffectVert.blurAmount = behaviour.blur;

        // rewire
        this._destinationVideoContextNode.disconnect();
        this._destinationVideoContextNode.connect(blurEffectHoriz);
        blurEffectHoriz.connect(blurEffectVert);
        blurEffectVert.connect(this._videoCtx.destination);
        this._destinationVideoContextNode = blurEffectVert;

        // store effect nodes so they can be destroyed
        this._effectNodes.push(blurEffectHoriz);
        this._effectNodes.push(blurEffectVert);

        // behaviour completed
        behaviourAppliedCallback();
    }

    _overlayImage(mediaUrl: string) {
        // create image node
        const imageNode = this._videoCtx.image(mediaUrl);
        imageNode.start(0);

        // create combine node
        const combine = this._videoCtx.compositor(CustomVideoContext.DEFINITIONS.COMBINE);
        combine.a = 0.5;

        // rewire
        this._destinationVideoContextNode.disconnect();
        this._destinationVideoContextNode.connect(combine);
        imageNode.connect(combine);
        combine.connect(this._videoCtx.destination);
        this._destinationVideoContextNode = combine;
        // store extra nodes for deletion
        this._effectNodes.push(imageNode);
        this._effectNodes.push(combine);
    }

    _applyShowImageBehaviour(behaviour: Object, callback: () => mixed) {
        const assetCollectionId = behaviour.image;
        this._fetchAssetCollection(assetCollectionId).then((image) => {
            if (image.assets.image_src) {
                this._overlayImage(image.assets.image_src);
                callback();
            }
        });
    }

    _clearEffectNodes() {
        this._effectNodes.forEach((node) => {
            node.destroy();
        });
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
            this.on('videoContextNodeCreated', () => {
                this._cueUpWhenReady();
            });
        }
    }

    setMute(quiet: boolean) {
        if (this._videoNode.element) this._videoNode.element.muted = quiet;
    }

    setVisible(visible: boolean) {
        if (visible) {
            CustomVideoContext.showVideoContextForClient(this._representation.id);
        } else {
            CustomVideoContext.hideVideoContextForClient(this._representation.id);
        }
    }

    switchFrom() {
        this._isCurrentSwitchChoice = false;
        this._videoNode.disconnect();
        this.setMute(true);
        this.setVisible(false);
        this._videoCtx.pause();
    }

    switchTo() {
        this._isCurrentSwitchChoice = true;
        this._videoCtx.play();
        this.playVideo();
        this.setMute(false);
        this.setVisible(true);
    }

    stopAndDisconnect() {
        this._clearEffectNodes();
        this._videoNode.unregisterCallback();

        // Stop current active node
        // this._videoNode.stop(-1);

        // disconnect current active node.
        this._videoNode.disconnect();
        this._videoNode.destroy();
        CustomVideoContext.unregisterVideoContextClient(this._representation.id);
    }

    destroy() {
        clearTimeout(this._monitorVideoTimeoutHandle);
        clearTimeout(this._videoContextQueueTimeoutHandle);
        this.stopAndDisconnect();
        super.destroy();
    }
}
