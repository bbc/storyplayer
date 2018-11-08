// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
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
    _aFrameCamera: any;
    _initialRotation: string;

    _started: boolean;
    _rendered: boolean;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
        controller: Controller,
    ) {
        super(
            representation,
            assetCollectionFetcher,
            fetchMedia,
            player,
            analytics,
            controller,
        );
        this._endedEventListener = this._endedEventListener.bind(this);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_AV,
        });
        this._aFrameSceneElement = document.createElement('a-scene');
        this._initialRotation = '0 90 0';
        this.renderVideoElement();
    }

    _endedEventListener() {
        logger.info('360 video ended');
        super.complete();
    }

    start() {
        super.start();
        logger.info(`Started: ${this._representation.id}`);
        if (this._rendered) {
            this._startThreeSixtyVideo();
        }
        this._started = true;
    }

    end() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);

        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);

        if (this._aFrameSceneElement.parentNode !== null) {
            this._target.removeChild(this._aFrameSceneElement);
        }

        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
    }

    renderVideoElement() {
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        this._fetchMedia(fg.assets.av_src)
                            .then((mediaUrl) => {
                                this._buildAframeVideoScene(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Video not found');
                            });
                    }
                });
        }
    }

    _buildAframeVideoScene(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
            return;
        }

        this._playoutEngine.queuePlayout(this._rendererId, {
            url: mediaUrl,
        });

        // create AFrame entities in here to display 360 video
        this._aFrameSceneElement.setAttribute('embedded', '');
        this._aFrameSceneElement.classList.add('romper-aframe-scene');

        const aFrameVideoSphere = document.createElement('a-videosphere');
        aFrameVideoSphere.setAttribute('src', '#threesixtyvideo');
        this._aFrameSceneElement.appendChild(aFrameVideoSphere);

        const cameraEntity = document.createElement('a-entity');
        cameraEntity.setAttribute('position', '0 0 0');

        cameraEntity.setAttribute('rotation', this._initialRotation);
        this._aFrameCamera = document.createElement('a-camera');
        cameraEntity.appendChild(this._aFrameCamera);
        this._aFrameSceneElement.appendChild(cameraEntity);

        const aFrameAssetsElement = document.createElement('a-assets');
        this._aFrameSceneElement.appendChild(aFrameAssetsElement);

        this._playoutEngine.getMediaElement(this._rendererId).id = 'threesixtyvideo';
        // this may break stuff!!!
        aFrameAssetsElement.appendChild(this._playoutEngine.getMediaElement(this._rendererId));
        this._rendered = true;
        if (this._started) {
            this._startThreeSixtyVideo();
        }
    }

    _startThreeSixtyVideo() {
        this._target.appendChild(this._aFrameSceneElement);
        this._player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );

        this._target.addEventListener('mouseup', () => { this.getOrientation(); }, false);

        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.setPlayoutActive(this._rendererId);
    }

    // get the direction of view
    getOrientation(): Object {
        const rot = this._aFrameCamera.getAttribute('rotation');
        let phi = -rot.y;
        if (phi < 0) { phi += 360; }
        const coords = {
            phi: Math.round(phi),
            theta: Math.round(rot.x),
        };
        logger.info(`Current view direction: ${coords.phi}, ${coords.theta}`);
        return coords;
    }

    _handlePlayPauseButtonClicked(): void {
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (videoElement) {
            if (videoElement.paused === true) {
                this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            } else {
                this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            }
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
