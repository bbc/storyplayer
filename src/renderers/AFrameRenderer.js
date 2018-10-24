// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';

import logger from '../logger';

export default class AFrameRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;
    _playEventListener: Function;

    _aFrameSceneElement: HTMLElement;
    _aFrameScriptElement: HTMLScriptElement;
    _videoAssetElement: HTMLElement;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player, analytics);
        this._endedEventListener = this._endedEventListener.bind(this);
        // this._playEventListener = this._playEventListener.bind(this);
    }

    _endedEventListener() {
        console.log('360 video ended');
        super.complete();
    }

    // _playEventListener() {
    //     this._player.setPlaying(true);
    // }

    // _pauseEventListener() {
    //     this._player.setPlaying(false);
    // }

    start() {
        super.start();
        logger.info(`Started: ${this._representation.id}`);
        this.renderVideoElement();

        // automatically move on at video end
        // videoElement.addEventListener('play', this._playEventListener);
        // videoElement.addEventListener('pause', this._pauseEventListener);
    }

    end() {
        this._videoAssetElement.removeEventListener('ended', this._endedEventListener);
        // videoElement.removeEventListener('play', this._playEventListener);
        // videoElement.removeEventListener('pause', this._pauseEventListener);

        // const player = this._player;
        this._target.removeChild(this._aFrameSceneElement);
        this._target.removeChild(this._aFrameScriptElement);
        // player.removeVolumeControl(this._representation.id);
        // player.disconnectScrubBar();
        // player.removeListener(
        //     PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
        //     this._handlePlayPauseButtonClicked,
        // );
        // player.removeListener(
        //     PlayerEvents.VOLUME_CHANGED,
        //     this._handleVolumeClicked,
        // );
        // player.removeListener(
        //     PlayerEvents.SUBTITLES_BUTTON_CLICKED,
        //     this._handleSubtitlesClicked,
        // );
    }

    renderVideoElement() {
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        this._fetchMedia(fg.assets.av_src)
                            .then((mediaUrl) => {
                                this.populateVideoElement(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Video not found');
                            });
                    }
                });
        }
    }

    populateVideoElement(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
            return;
        }
        // create AFrame entities in here to display 360 video
        this._addAFrameScripts();
        this._aFrameSceneElement = document.createElement('a-scene');
        this._aFrameSceneElement.setAttribute('embedded', '');
        this._aFrameSceneElement.classList.add('romper-aframe-scene');
        this._target.appendChild(this._aFrameSceneElement);

        const aFrameVideoSphere = document.createElement('a-videosphere');
        aFrameVideoSphere.setAttribute('src', '#video');
        this._aFrameSceneElement.appendChild(aFrameVideoSphere);

        const aFrameAssetsElement = document.createElement('a-assets');
        this._aFrameSceneElement.appendChild(aFrameAssetsElement);

        this._videoAssetElement = document.createElement('video');
        this._videoAssetElement.id = 'video';
        this._videoAssetElement.className = 'romper-video-element';
        this._videoAssetElement.setAttribute('autoplay', '');
        this._videoAssetElement.addEventListener('ended', this._endedEventListener);

        const videoAssetSource = document.createElement('source');
        videoAssetSource.setAttribute('type', 'video/mp4');
        videoAssetSource.setAttribute('src', mediaUrl);
        this._videoAssetElement.appendChild(videoAssetSource);
        aFrameAssetsElement.appendChild(this._videoAssetElement);
    }

    _addAFrameScripts(): void {
        this._aFrameScriptElement = document.createElement('script');
        this._aFrameScriptElement.setAttribute('src', 'https://aframe.io/releases/0.7.1/aframe.min.js');
        this._target.appendChild(this._aFrameScriptElement);
    }
    
    _handlePlayPauseButtonClicked(): void {
        const videoElement = this._mediaInstance.getMediaElement();
        if (videoElement.paused === true) {
            this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            this._mediaInstance.play();
        } else {
            this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            this._mediaInstance.pause();
        }
    }

    _handleVolumeClicked(event: Object): void {
        if (event.id === this._representation.id) {
            this._mediaInstance.setVolume(event.value);
        }
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    destroy() {
        this.end();
        super.destroy();
    }
}
