// @flow

// @flowignore
import VideoContext from 'videocontext';
// @flowignore
import Hls from '../../node_modules/hls.js/dist/hls';

export default class CustomVideoContext extends VideoContext {
    /* dash(mpd: Promise<string>, sourceOffset: number = 0, preloadTime: number = 4, attributes: Object = {}): DashNode {
        const videoElement = document.createElement('video');
        attributes.crossorigin = 'anonymous';
        // $FlowIgnore
        const videoNode: Object = this.video(videoElement, sourceOffset, preloadTime, attributes);

        videoNode.registerCallback('load', async () => {
            const mpdUrl = await mpd;
            videoNode.dashplayer = MediaPlayer().create();
            videoNode.dashplayer.getDebug().setLogToBrowserConsole(false); // TODO toggle via dev env
            videoNode.dashplayer.initialize(videoElement, mpdUrl, false);

            let currentTimeOffset = 0;
            if (videoNode._currentTime > videoNode._startTime) {
                currentTimeOffset = videoNode._currentTime - videoNode._startTime;
            }
            videoNode.dashplayer.seek(videoNode._sourceOffset + currentTimeOffset);

            videoNode.dashplayer.setAutoSwitchQualityFor('video', false);
            videoNode.dashplayer.on('playbackMetaDataLoaded', () => {
                const videoQualities = videoNode.dashplayer.getBitrateInfoListFor('video');
                videoNode.dashplayer.setQualityFor('video', videoQualities.length - 1);
            });
            videoNode.dashplayer.setVolume(0.0);
        });

        videoNode.registerCallback('play', () => {
        });

        videoNode.registerCallback('destroy', (node: Object) => {
            if (node.dashplayer) {
                node.dashplayer.reset();
            }
        });
        return videoNode;
    }
*/
    /* eslint-disable no-param-reassign */

    hls(m3u8: Promise<string>, sourceOffset: number = 0, preloadTime: number = 4, attributes: Object = {}) {
        const videoElement = document.createElement('video');
        attributes.crossorigin = 'anonymous';
        // $FlowIgnore
        const videoNode: Object = this.video(videoElement, sourceOffset, preloadTime, attributes);

        videoNode.registerCallback('load', async () => {
            /* eslint-disable no-debugger */
            // debugger;

            const manifestUrl = await m3u8;

            videoNode.hlsplayer = new Hls();


            // let currentTimeOffset = 0;
            // if (videoNode._currentTime > videoNode._startTime) {
            //     currentTimeOffset = videoNode._currentTime - videoNode._startTime;
            // }

            if (manifestUrl.indexOf('.m3u8') !== -1) {
                videoNode.hlsplayer.loadSource(manifestUrl);
                videoNode.hlsplayer.attachMedia(videoElement);
                videoNode.hlsplayer.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoElement.play();
                });
            }

            // videoNode.hlsplayer.seek(videoNode._sourceOffset + currentTimeOffset);

            //   videoNode.hlsplayer.setAutoSwitchQualityFor('video', false);
            // videoNode.hlsplayer.on('playbackMetaDataLoaded', () => {
            //     const videoQualities = videoNode.dashplayer.getBitrateInfoListFor('video');
            //     videoNode.hlsplayer.setQualityFor('video', videoQualities.length - 1);
            // });
            // videoNode.hlsplayer.setVolume(0.0);
        });

        videoNode.registerCallback('play', () => {
        });

        videoNode.registerCallback('destroy', (node: Object) => {
            if (node.dashplayer) {
                node.dashplayer.reset();
            }
        });
        return videoNode;
    }
}
