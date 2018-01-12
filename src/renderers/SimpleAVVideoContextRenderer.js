// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

import CustomVideoContext, { getVideoContext, getCanvas } from '../utils/custom-video-context';

import RendererEvents from './RendererEvents';


export default class SimpleAVVideoContextRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _canvas: HTMLCanvasElement;
    _videoNodes: Array<Object>;
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
        this._videoNodes = [];
        this.NODE_CREATED = false;

        this.renderVideoElement();

        this.on('videoContextNodeCreated', () => { console.log('vctx node created 2'); this.NODE_CREATED = true; });
    }

    start() {
        super.start();
        // render the video div
        // and control bar
        // this.renderControlBar();
        // start the video
        this.playVideo();


        // this.renderDataModelInfo();
    }

    playVideo() {
        if (this.NODE_CREATED) {
            const node = this._videoNodes.shift();
            // console.log('VCtx current time:', this._videoCtx.currentTime);
            node.start(0);
            this.emit(RendererEvents.STARTED);
            this._videoCtx.play();
        } else {
            const that = this;
            this.on('videoContextNodeCreated', () => { console.log('vctx node created'); that.NODE_CREATED = true; that.playVideo(); });
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
        // videoNode1.start(0);
        videoNode1.connect(this._videoCtx.destination);

        videoNode1.registerCallback('ended', this.complete);

        this._videoNodes.push(videoNode1);
        this.emit('videoContextNodeCreated');
        console.log('vctx node created. loaded.');
    }

    renderVideoElement() {
        /* TEST VIDEO CTX HERE>... */


        // set CSS classname
        // ????

        // set its source
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

        // automatically move on at video end


        // Switch this on to play with video context
        // this.videoContextExperiment();
    }

    // Add player controls to the DOM and listen for events
    renderControlBar() {
        // target element by its class name rather than ID as there will be multiple videos on the page...
        const video = this._videoElement;

        // buttons
        const playPause = document.createElement('button');
        playPause.className = 'play-pause--playing';
        const playVideo = () => {
            video.play();
            playPause.className = 'play-pause--playing';
        };
        const pauseVideo = () => {
            video.pause();
            playPause.className = 'play-pause--paused';
        };

        playPause.addEventListener('click', () => {
            if (video.paused === true) {
                playVideo();
            } else {
                pauseVideo();
            }
        });

        const mute = document.createElement('button');
        mute.className = 'mute-button--unmuted';
        mute.addEventListener('click', () => {
            if (!video.muted) {
                // Mute the video
                video.muted = true;
                mute.className = 'mute-button--muted';
            } else {
                // Unmute the video
                video.muted = false;
                mute.className = 'mute-button--unmuted';
            }
        });

        const fullscreen = document.createElement('button');
        fullscreen.className = 'fullscreen';
        // Event listener for the full-screen button
        fullscreen.addEventListener('click', () => {
            if (video.requestFullscreen) {
                // @flowignore
                video.requestFullscreen();
            } else if (video.mozRequestFullScreen) {
                // @flowignore
                video.mozRequestFullScreen(); // Firefox
            } else if (video.webkitRequestFullscreen) {
                // @flowignore
                video.webkitRequestFullscreen(); // Chrome and Safari
            }
        });

        // ranges
        const volume = document.createElement('input');
        volume.type = 'range';
        volume.className = 'volume-range';

        const scrubBar = document.createElement('input');
        scrubBar.type = 'range';
        scrubBar.className = 'scrub-bar';

        // update scrub bar position as video plays
        scrubBar.addEventListener('change', () => {
            // Calculate the new time
            const time = video.duration * (parseInt(scrubBar.value, 10) / 100);

            // Update the video time
            video.currentTime = time;
        });

        // allow clicking the scrub bar to seek to a video position
        function seek(e: MouseEvent) {
            const percent = e.offsetX / this.offsetWidth;
            video.currentTime = percent * video.duration;
        }

        scrubBar.addEventListener('click', seek);

        // Update the seek bar as the video plays
        video.addEventListener('timeupdate', () => {
            // Calculate the slider value
            const value = (100 / video.duration) * video.currentTime;

            // Update the slider value
            scrubBar.value = value.toString();
        });

        // Pause the video when the slider handle is being dragged
        scrubBar.addEventListener('mousedown', () => {
            pauseVideo();
        });

        // Play the video when the slider handle is dropped
        scrubBar.addEventListener('mouseup', () => {
            playVideo();
        });

        // container to hold all controls
        const controls = document.createElement('div');
        controls.className = 'video-controls';

        controls.appendChild(playPause);
        controls.appendChild(volume);
        controls.appendChild(mute);
        controls.appendChild(fullscreen);
        this._target.appendChild(scrubBar);
        this._target.appendChild(controls);
    }

    // How to use Video Context:
    videoContextExperiment() {
        this._canvas = document.createElement('canvas');
        const canvas = this._canvas;
        const videoCtx = new CustomVideoContext(canvas);
        const videoNode1 = videoCtx.hls('https://vod-hls-uk-live.akamaized.net/usp/auth/vod/piff_abr_full_sd/56932b-p04p74yq/vf_p04p74yq_aca390f5-5078-4a28-a464-527d3212c59e.ism/mobile_wifi_main_sd_abr_v2_hls_master.m3u8?__gda__=1515598679_1246b8952e23432dcb5b5ea55ff60c28', 0, 4);
        videoNode1.start(0);
        videoNode1.connect(videoCtx.destination);
        videoCtx.play();
        this._target.appendChild(canvas);
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

    getCurrentTime(): number {
        if (!this._videoElement || this._videoElement.readyState < this._videoElement.HAVE_CURRENT_DATA) return 0;
        return this._videoElement.currentTime;
    }

    setCurrentTime(time: number) {
        this._videoElement.currentTime = time;
    }

    setStartTime(time: number) {
        if (this._videoElement.readyState >= this._videoElement.HAVE_CURRENT_DATA) {
            this.setCurrentTime(time);
        } else if (this._hls) {
            this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.setCurrentTime(time);
            });
        } else {
            this._videoElement.addEventListener('loadeddata', () => {
                this.setCurrentTime(time);
            });
        }
    }

    destroy() {
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }
        super.destroy();
    }
}
