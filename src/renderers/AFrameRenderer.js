// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import logger from '../logger';

// @flowignore
require('aframe');

export default class AFrameRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;
    _playEventListener: Function;
    _pauseEventListener: Function;
    _handlePlayPauseButtonClicked: Function;

    _aFrameSceneElement: HTMLElement;
    _videoAssetElement: HTMLVideoElement;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player, analytics);
        this._endedEventListener = this._endedEventListener.bind(this);
        this._playEventListener = this._playEventListener.bind(this);
        this._pauseEventListener = this._pauseEventListener.bind(this);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
    }

    _endedEventListener() {
        logger.info('360 video ended');
        super.complete();
    }

    _playEventListener() {
        this._player.setPlaying(true);
    }

    _pauseEventListener() {
        this._player.setPlaying(false);
    }

    start() {
        super.start();
        logger.info(`Started: ${this._representation.id}`);
        this.renderVideoElement();
    }

    end() {
        this._videoAssetElement.removeEventListener('ended', this._endedEventListener);
        this._videoAssetElement.removeEventListener('play', this._playEventListener);
        this._videoAssetElement.removeEventListener('pause', this._pauseEventListener);

        // const player = this._player;
        this._target.removeChild(this._aFrameSceneElement);
        // player.removeVolumeControl(this._representation.id);
        this._player.disconnectScrubBar();
        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
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
        this._aFrameSceneElement = document.createElement('a-scene');
        this._aFrameSceneElement.setAttribute('embedded', '');
        this._aFrameSceneElement.classList.add('romper-aframe-scene');
        this._target.appendChild(this._aFrameSceneElement);

        const aFrameVideoSphere = document.createElement('a-videosphere');
        aFrameVideoSphere.setAttribute('src', '#threesixtyvideo');
        this._aFrameSceneElement.appendChild(aFrameVideoSphere);

        const aFrameAssetsElement = document.createElement('a-assets');
        this._aFrameSceneElement.appendChild(aFrameAssetsElement);

        this._videoAssetElement = document.createElement('video');
        this._videoAssetElement.id = 'threesixtyvideo';
        this._videoAssetElement.className = 'romper-video-element';
        this._videoAssetElement.setAttribute('crossorigin', '');
        this._videoAssetElement.addEventListener('ended', this._endedEventListener);

        const videoAssetSource = document.createElement('source');
        videoAssetSource.setAttribute('type', 'video/mp4');
        videoAssetSource.setAttribute('src', mediaUrl);
        this._videoAssetElement.appendChild(videoAssetSource);
        aFrameAssetsElement.appendChild(this._videoAssetElement);
        this.startThreeSixtyVideo();
    }

    startThreeSixtyVideo() {
        this._player.connectScrubBar(this._videoAssetElement);
        this._player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        // automatically move on at video end
        this._videoAssetElement.addEventListener('play', this._playEventListener);
        this._videoAssetElement.addEventListener('pause', this._pauseEventListener);
        this._videoAssetElement.addEventListener('ended', this._endedEventListener);
        logger.info('360 video playing');
        this._videoAssetElement.play();
    }

    _handlePlayPauseButtonClicked(): void {
        if (this._videoAssetElement.paused === true) {
            this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            this._videoAssetElement.play();
        } else {
            this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            this._videoAssetElement.pause();
        }
    }

    // _handleVolumeClicked(event: Object): void {
    //     if (event.id === this._representation.id) {
    //         this._mediaInstance.setVolume(event.value);
    //     }
    // }

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
