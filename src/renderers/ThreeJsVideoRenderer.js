// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
import logger from '../logger';

const THREE = require('three');

const ORIENTATION_POLL_INTERVAL = 2000;

export default class ThreeJsVideoRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;

    _outTimeEventListener: Function;

    _playEventListener: Function;

    _pauseEventListener: Function;

    _handlePlayPauseButtonClicked: Function;

    _setOrientationVariable: Function;

    _onMouseDown: Function;

    _onMouseMove: Function;

    _onMouseUp: Function;

    _orientationWatcher: ?IntervalID;

    _videoDivId: string;

    _videoAssetElement: HTMLVideoElement;

    _initialRotation: string;

    _videoTypeString: string;

    _videoType: Object;

    _view: Object;

    _userInteracting: boolean;

    _sceneElements: Array<HTMLElement>;

    _ambisonic: string;

    _lastSetTime: number;

    _inTime: number;

    _outTime: number;

    _setOutTime: Function;

    _setInTime: Function;

    _hasEnded: boolean;

    _started: boolean;

    _rendered: boolean;

    _domElement: HTMLElement;

    _oldOrientation: Object;

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
        this._setOrientationVariable = this._setOrientationVariable.bind(this);
        this._outTimeEventListener = this._outTimeEventListener.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);

        this._orientationWatcher = null;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_AV,
        });

        this._setInTime = this._setInTime.bind(this);
        this._setOutTime = this._setOutTime.bind(this);
        this._inTime = 0;
        this._outTime = -1;
        this._lastSetTime = 0;

        this._ambisonic = '';
        this._initialRotation = '0 0 0';
        this._videoTypeString = '360_mono';

        // this is what we refer to
        this._videoDivId = `threesixtyvideo-${this._rendererId}`;

        this._rendered = false;

        this._view = {
            onPointerDownPointerX: 0,
            onPointerDownPointerY: 0,
            onPointerDownLon: 0,
            onPointerDownLat: 0,
            lon: 0,
            lat: 0,
            distance: 50,
        };

        this._oldOrientation = {
            phi: 0,
            theta: 0,
        };

        this._userInteracting = false;

        // this._collectElementsToRender();
        this.renderVideoElement();
    }

    _endedEventListener() {
        logger.info('360 video ended');
        if (!this._hasEnded) {
            this._hasEnded = true;
            this._player.getLinkChoiceElement().style.visibility = 'visible';
            super.complete();
        }
    }

    _outTimeEventListener() {
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (videoElement) {
            if (this._outTime > 0 && videoElement.currentTime >= this._outTime) {
                videoElement.pause();
                this._endedEventListener();
            }
        }
    }

    start() {
        super.start();
        // TODO: problems with this type of representation as first element:
        // starts video, but see nothing unless you enter VR mode...
        logger.info(`Started: ${this._representation.id}`);
        // if (this._rendered) {
        // }
        this._startThreeSixtyVideo();
        this.setCurrentTime(this._lastSetTime);
        this._hasEnded = false;
        this._started = true;
        // AFrameRenderer.addPlayPauseButton();
    }

    _startThreeSixtyVideo() {
        const target = this._player.mediaTarget;
        logger.info('Starting 3js video scene');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 16/9, 1, 1000);
        camera.layers.enable(1); // render left view when no stereo available
        camera.target = new THREE.Vector3(0, 0, 0);

        const webGlRenderer = new THREE.WebGLRenderer();
        webGlRenderer.setPixelRatio(window.devicePixelRatio);
        // webGlRenderer.vr.enabled = true;

        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        const texture = new THREE.VideoTexture(videoElement);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        // scene.background = new THREE.Color(0x101010);

        const geometry = new THREE.SphereBufferGeometry(500, 60, 40);
        // invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale(-1, 1, 1);

        const mesh = new THREE.Mesh(geometry, material);
        // mesh.rotation.y = -Math.PI / 2;
        scene.add(mesh);

        this._domElement = webGlRenderer.domElement;
        this._domElement.classList.add('romper-threejs');

        const uiLayer = this._player._overlays;
        uiLayer.addEventListener('mousedown', this._onMouseDown, false);
        uiLayer.addEventListener('mouseup', this._onMouseUp, false);
        uiLayer.addEventListener('mousemove', this._onMouseMove, false);

        target.appendChild(this._domElement);
        webGlRenderer.setSize(1600, 900);

        this._playoutEngine.setPlayoutActive(this._rendererId);
        videoElement.style.visibility = 'hidden';
        // videoElement.style.width = 'unset';

        const update = () => {
            const lat = Math.max(-85, Math.min(85, this._view.lat));
            const phi = THREE.Math.degToRad(90 - lat);
            const theta = THREE.Math.degToRad(this._view.lon);
            camera.position.x = this._view.distance * Math.sin(phi) * Math.cos(theta);
            camera.position.y = this._view.distance * Math.cos(phi);
            camera.position.z = this._view.distance * Math.sin(phi) * Math.sin(theta);
            camera.lookAt( camera.target );

            webGlRenderer.render( scene, camera );
        };

        const animate = () => {
            requestAnimationFrame(animate);
            update();
        };

        animate();
        this._domElement.style.width = '100%';
        this._domElement.style.height = '100%';

        this._orientationWatcher = setInterval(
            this._setOrientationVariable,
            ORIENTATION_POLL_INTERVAL,
        );
    }

    _onMouseDown(event: MouseEvent) {
        this._userInteracting = true;
        this._view.onPointerDownPointerX = event.clientX;
        this._view.onPointerDownPointerY = event.clientY;
        this._view.onPointerDownLon = this._view.lon;
        this._view.onPointerDownLat = this._view.lat;
    }

    _onMouseMove(event: MouseEvent) {
        if (this._userInteracting) {
            this._view.lon = (this._view.onPointerDownPointerX - event.clientX) * 0.1 + this._view.onPointerDownLon; // eslint-disable-line max-len
            this._view.lat = (event.clientY - this._view.onPointerDownPointerY) * 0.1 + this._view.onPointerDownLat; // eslint-disable-line max-len
        }
    }

    _onMouseUp() {
        this._userInteracting = false;
    }

    renderVideoElement() {
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                            this._setInTime(parseFloat(fg.meta.romper.in));
                        }
                        if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                            this._setOutTime(parseFloat(fg.meta.romper.out));
                        }
                        this._fetchMedia(fg.assets.av_src)
                            .then((mediaUrl) => {
                                let appendedUrl = mediaUrl;
                                if (this._inTime > 0 || this._outTime > 0) {
                                    let mediaFragment = `#t=${this._inTime}`;
                                    if (this._outTime > 0) {
                                        mediaFragment = `${mediaFragment},${this._outTime}`;
                                    }
                                    appendedUrl = `${mediaUrl}${mediaFragment}`;
                                }
                                this.populateVideoElement(appendedUrl);
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
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                url: mediaUrl,
            });
        }
    }

    _handlePlayPauseButtonClicked(): void {
        this.logUserInteraction(AnalyticEvents.names.PLAY_PAUSE_BUTTON_CLICKED);
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (videoElement) {
            if (videoElement.paused === true) {
                this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            } else {
                this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            }
            // AFrameRenderer.togglePlayPause(videoElement.paused);
        }
    }

    _setOrientationVariable(): void {
        const { lat, lon } = this._view;
        const phi = parseInt(lon, 10);
        const theta = parseInt(lat, 10);

        if (phi === this._oldOrientation.phi && theta === this._oldOrientation.theta) {
            return;
        }

        this._oldOrientation = {
            phi,
            theta,
        };

        this._controller.setVariables({
            _threejs_orientation_lon: phi,
            _threejs_orientation_lat: theta,
        });

        // and log analytics
        const logData = {
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names.VR_ORIENTATION_CHANGED,
            from: 'not_set',
            to: `${phi} ${theta}`,
        };
        this._analytics(logData);
    }

    getCurrentTime(): Object {
        let videoTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if (videoTime === undefined) {
            videoTime = this._lastSetTime;
        } else {
            // convert to time into segment
            videoTime -= this._inTime;
        }
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        let remaining = videoElement.duration;
        if (this._outTime > 0) {
            remaining = this._outTime;
        }
        remaining -= videoElement.currentTime;
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
            remainingTime: remaining,
        };
        return timeObject;
    }

    // set how far into the segment this video should be (relative to in-point)
    setCurrentTime(time: number) {
        this._lastSetTime = time; // time into segment
        // convert to absolute time into video
        this._playoutEngine.setCurrentTime(this._rendererId, time + this._inTime);
    }

    _setInTime(time: number) {
        this._inTime = time;
    }

    _setOutTime(time: number) {
        this._outTime = time;
    }

    switchFrom() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);
    }

    switchTo() {
        // if (this._started) {
        //     AFrameRenderer.showVideo(this._videoDivId, this._videoType);
        //     this._playoutEngine.setPlayoutActive(this._rendererId);
        //     AFrameRenderer.setSceneHidden(false);
        // } else {
        this.start();
        // }
    }

    // eslint-disable-next-line class-methods-use-this
    isVRViewable(): boolean {
        return false;
    }

    end() {
        // only if this is being rendered
        if (this._started) {
            this._player.getLinkChoiceElement().style.visibility = 'visible';
        }

        // put video element back
        this._target.appendChild(this._playoutEngine.getMediaElement(this._rendererId));

        if (this._domElement.parentNode) {
            this._domElement.parentNode.removeChild(this._domElement);
        }

        this._playoutEngine.setPlayoutInactive(this._rendererId);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        const uiLayer = this._player._overlays;
        uiLayer.removeEventListener('mousedown', this._onMouseDown);
        uiLayer.removeEventListener('mouseup', this._onMouseUp);
        uiLayer.removeEventListener('mousemove', this._onMouseMove);

        if (this._orientationWatcher) {
            clearInterval(this._orientationWatcher);
        }

        this._started = false;
        this._rendered = false;
    }

    destroy() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        super.destroy();
    }
}
