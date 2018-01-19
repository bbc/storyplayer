// @flow

import VideoContext from 'videocontext';
// @flowignore
import Hls from '../../node_modules/hls.js/dist/hls';

let videoContext;
let canvas;

const nodeRepresentationMap = {};

export default class CustomVideoContext extends VideoContext {
    /* eslint-disable no-param-reassign */

    registerVideoContextClient(id: string) {
        // console.log('registering', id);
        nodeRepresentationMap[id] = false;
    }

    unregisterVideoContextClient(id: string) {
        // console.log('forgetting', id);
        delete nodeRepresentationMap[id];
    }

    showVideoContextForClient(id: string) {
        // console.log('show vtx', id);
        if (nodeRepresentationMap.hasOwnProperty(id)) {
            nodeRepresentationMap[id] = true;
        } else {
            console.warn('representation', id, 'not registered on VCtx');
        }
        this._calculateVisibility();
    }

    hideVideoContextForClient(id: string) {
        // console.log('hide vtx', id);
        if (nodeRepresentationMap.hasOwnProperty(id)) {
            nodeRepresentationMap[id] = false;
        } else {
            console.warn('representation', id, 'not registered on VCtx');
        }
        this._calculateVisibility();
    }

    _calculateVisibility() {
        let show = false;
        Object.keys(nodeRepresentationMap).forEach((user) => {
            show = show || nodeRepresentationMap[user];
        });
        // console.log('canvas show', show);
        canvas.style.display = show ? 'flex' : 'none';
    }

    hls(m3u8: Promise<string>, sourceOffset: number = 0, preloadTime: number = 4, attributes: Object = {}) {
        const videoElement = document.createElement('video');
        attributes.crossorigin = 'anonymous';
        // $FlowIgnore
        const videoNode: Object = this.video(videoElement, sourceOffset, preloadTime, attributes);

        videoNode.registerCallback('load', async () => {
            const manifestUrl = await m3u8;

            videoNode.hlsplayer = new Hls();

            if (manifestUrl.indexOf('.m3u8') !== -1) {
                videoNode.hlsplayer.loadSource(manifestUrl);
                videoNode.hlsplayer.attachMedia(videoElement);
                videoNode.hlsplayer.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoElement.play();
                });
            }
        });

        videoNode.registerCallback('play', () => {
        });

        videoNode.registerCallback('destroy', (node: Object) => {
            if (node.hlsplayer) {
                node.hlsplayer.destroy();
            }
        });
        return videoNode;
    }
}

export function getCanvas() {
    return canvas;
}

export function getNodeRepresentationMap() {
    return nodeRepresentationMap;
}

export function createNodeForRepresentation(representationId: string, mediaUrl: string) {
    let videoNode;
    // if mediaUrl is hls
    if (mediaUrl.indexOf('.m3u8') !== -1) {
        videoNode = this._videoCtx.hls(mediaUrl, 0, 4);
    } else {
        videoNode = this._videoCtx.video(mediaUrl, 0, 4);
    }
    // MORE THOUGHT NEEDED HERE
    videoNode.connect(this._videoCtx.destination);

    nodeRepresentationMap[representationId] = videoNode;

    return videoNode;
}


export function getVideoContext() {
    if (!videoContext) {
        canvas = document.createElement('canvas');
        canvas.className = 'romper-video-element';
        canvas.setAttribute('width', '512px');
        canvas.setAttribute('height', '288px');
        videoContext = new CustomVideoContext(canvas);
    }
    return videoContext;
}
