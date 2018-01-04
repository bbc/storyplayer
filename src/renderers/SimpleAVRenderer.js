// @flow

import BaseRenderer from './BaseRenderer';
import mediaFetcher from '../fetchers/MediaFetcher';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

// @flowignore
import Hls from '../../node_modules/hls.js/dist/hls';

export default class SimpleAVRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _hls: Object;
    _videoElement: HTMLVideoElement;

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
    }

    start() {
        super.start();
        this.renderVideoElement();
        this.renderControlBar();
        this.renderDataModelInfo();
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

        // render it
        this._target.appendChild(this._videoElement);

        // automatically move on at video end
        this._videoElement.addEventListener('ended', () => {
            super.complete();
        });
    }

    populateVideoElement(videoElement: HTMLVideoElement, mediaUrl: string) {
        // if mediaUrl is hls
        videoElement.muted = true;

        if (mediaUrl.indexOf('.m3u8') !== -1) {
            this._hls.loadSource(mediaUrl);
            this._hls.attachMedia(videoElement);
            this._hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoElement.play();
            });
        } else {
            videoElement.setAttribute('src', mediaUrl);
            videoElement.addEventListener('loadeddata', () => {
                videoElement.play();
            });
        }
    }

    renderControlBar() {
        const video = document.getElementsByClassName('romper-video-element')[0]; // this is probably very bad
        // buttons
        const playPause = document.createElement('button');
        playPause.className = 'play-pause';
        playPause.addEventListener('click', () => {
            if (video.paused === true) {
                // Play the video
                video.play();
            } else {
                // Pause the video
                video.pause();
            }
        });

        const mute = document.createElement('button');
        mute.className = 'mute';
        mute.addEventListener('click', () => {
            if (!video.muted) {
                // Mute the video
                video.muted = true;
            } else {
                // Unmute the video
                video.muted = false;
            }
        });

        const fullscreen = document.createElement('button');
        fullscreen.className = 'fullscreen';
        // Event listener for the full-screen button
        fullscreen.addEventListener('click', () => {
            if (video.requestFullscreen) {
                video.requestFullscreen();
            } else if (video.mozRequestFullScreen) {
                video.mozRequestFullScreen(); // Firefox
            } else if (video.webkitRequestFullscreen) {
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
        scrubBar.setAttribute('value', '0');
        // Event listener for the seek bar
        scrubBar.addEventListener('change', () => {
            // Calculate the new time
            const time = video.duration * (scrubBar.value / 100);

            // Update the video time
            video.currentTime = time;
        });

        // Update the seek bar as the video plays
        video.addEventListener('timeupdate', () => {
            // Calculate the slider value
            const value = 100 / video.duration * video.currentTime;

            // Update the slider value
            scrubBar.value = value;
        });

        // Pause the video when the slider handle is being dragged
        scrubBar.addEventListener('mousedown', () => {
            video.pause();
        });

        // Play the video when the slider handle is dropped
        scrubBar.addEventListener('mouseup', () => {
            video.play();
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
        const parentElement = this._target.parentElement; // eslint-disable-line
        const assetList = document.createElement('ul');
        const foregroundItem = document.createElement('li');
        const backgroundItem = document.createElement('li');
        const iconItem = document.createElement('li');
        assetList.appendChild(foregroundItem);
        assetList.appendChild(backgroundItem);
        assetList.appendChild(iconItem);
        if (parentElement) parentElement.appendChild(assetList);

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
        return this._videoElement.currentTime;
    }

    setCurrentTime(time: number) {
        this._videoElement.currentTime = time;
    }

    setStartTime(time: number) {
        this._videoElement.addEventListener('loadeddata', () => {
            this.setCurrentTime(time);
        });
    }

    destroy() {
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }
        super.destroy();
    }
}
