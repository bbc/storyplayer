// @flow

import VideoContext from 'videocontext';
// @flowignore
import Hls from '../../node_modules/hls.js/dist/hls';

let videoContext;
let canvas;

const nodeRepresentationMap = {};

export function getVideoContext() {
    if (!videoContext) {
        canvas = document.createElement('canvas');
        videoContext = new CustomVideoContext(canvas);
    }
    return videoContext;
}

export function getCanvas() {
    return canvas;
}

export function getNodeRepresentationMap() {
    return nodeRepresentationMap;
}

export function createNodeForRepresentation(representationId: string, mediaUrl: sting) {
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


export default class CustomVideoContext extends VideoContext {
    /* eslint-disable no-param-reassign */

    hls(m3u8: Promise<string>, sourceOffset: number = 0, preloadTime: number = 4, attributes: Object = {}) {
        const videoElement = document.createElement('video');
        attributes.crossorigin = 'anonymous';
        // $FlowIgnore
        const videoNode: Object = this.video(videoElement, sourceOffset, preloadTime, attributes);

        videoNode.registerCallback('load', async () => {
            const manifestUrl = await m3u8;

            videoNode.hlsplayer = new Hls();

            let currentTimeOffset = 0;
            if (videoNode._currentTime > videoNode._startTime) {
                currentTimeOffset = videoNode._currentTime - videoNode._startTime;
            }

            if (manifestUrl.indexOf('.m3u8') !== -1) {
                videoNode.hlsplayer.loadSource(manifestUrl);
                videoNode.hlsplayer.attachMedia(videoElement);
                videoNode.hlsplayer.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoElement.play();
                });
            }

            //    videoNode.hlsplayer.startPosition(videoNode._sourceOffset + currentTimeOffset);
        });

        videoNode.registerCallback('play', () => {
        });

        videoNode.registerCallback('destroy', (node: Object) => {
            if (node.hlsplayer) {
                // node.hlsplayer.reset();
            }
        });
        return videoNode;
    }
}
