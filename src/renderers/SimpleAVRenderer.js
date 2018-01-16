// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

// @flowignore
import Hls from '../../node_modules/hls.js/dist/hls';

export default class SimpleAVRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _hls: Object;
    _videoElement: HTMLVideoElement;
    _canvas: HTMLCanvasElement;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target);
        if (Hls.isSupported()) {
            this._hls = new Hls();
        }
        this.renderVideoElement();
    }

    start() {
        super.start();
        // render the video div
        this._target.appendChild(this._videoElement);
        // and control bar
        // this.renderControlBar();
        // start the video
        this.playVideo();
        // this.renderDataModelInfo();
    }

    playVideo() {
        if (this._videoElement.readyState >= this._videoElement.HAVE_CURRENT_DATA) {
            this._videoElement.play();
        } else if (this._videoElement.src.indexOf('m3u8') !== -1) {
            this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this._videoElement.play();
            });
        } else {
            this._videoElement.addEventListener('loadeddata', () => {
                this._videoElement.play();
            });
        }
    }

    renderVideoElement() {
        this._videoElement = document.createElement('video');

        // set CSS classname
        this._videoElement.className = 'romper-video-element';

        // set its source
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground).then((fg) => {
                if (fg.assets.av_src) {
                    this._fetchMedia(fg.assets.av_src)
                        .then((mediaUrl) => {
                            this.populateVideoElement(this._videoElement, mediaUrl);
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
        this._videoElement.addEventListener('ended', () => {
            super.complete();
        });
    }

    populateVideoElement(videoElement: HTMLVideoElement, mediaUrl: string) {
        // if mediaUrl is hls
        if (mediaUrl.indexOf('.m3u8') !== -1) {
            this._hls.loadSource(mediaUrl);
            this._hls.attachMedia(videoElement);
        } else {
            videoElement.setAttribute('src', mediaUrl);
        }
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
        let videoTime;
        if (!this._videoElement || this._videoElement.readyState < this._videoElement.HAVE_CURRENT_DATA) {
            videoTime = 0;
        } else {
            videoTime = this._videoElement.currentTime;
        }
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        if (this._videoElement.readyState >= this._videoElement.HAVE_CURRENT_DATA) {
            this._videoElement.currentTime = time;
        } else if (this._videoElement.src.indexOf('m3u8') !== -1) {
            this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this._videoElement.currentTime = time;
            });
        } else {
            this._videoElement.addEventListener('loadeddata', () => {
                this._videoElement.currentTime = time;
            });
        }
    }

    switchFrom() {
        this.destroy();
    }

    switchTo() {
        this.start();
    }

    destroy() {
        try {
            this._target.removeChild(this._videoElement);
        } catch (e) {
            // console.warn('simple video not on target');
        }
        super.destroy();
    }
}
