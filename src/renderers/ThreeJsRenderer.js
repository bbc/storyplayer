// @flow

// @flowignore
import * as THREE from 'three';
import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
import logger from '../logger';

export default class ThreeJsRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;
    _mouseDownListener: Function;
    _mouseUpListener: Function;
    _mouseMoveListener: Function;
    _handlePlayPauseButtonClicked: Function;

    _threeJsDiv: HTMLDivElement;
    _videoElement: HTMLMediaElement;
    _scene: any;
    _camera: any;
    _texture: any;
    _threeRenderer: THREE.WebGLRenderer;
    render: Function;
    animate: Function;
    _manualControl: boolean;
    _longitude: number;
    _latitude: number;
    _savedX: number;
    _savedY: number;
    _savedLongitude: number;
    _savedLatitude: number;


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
        this._mouseDownListener = this._mouseDownListener.bind(this);
        this._mouseMoveListener = this._mouseMoveListener.bind(this);
        this._mouseUpListener = this._mouseUpListener.bind(this);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this.animate = this.animate.bind(this);
        this.render = this.render.bind(this);
        this._manualControl = false;
        this._longitude = 0;
        this._latitude = 0;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_AV,
        });
        this.renderVideoElement();
    }

    _endedEventListener() {
        logger.info('360 video ended');
        super.complete();
    }

    start() {
        super.start();
        logger.info(`Started: ${this._representation.id}`);

        this._target.appendChild(this._threeJsDiv);

        this._player.connectScrubBar(this._videoElement);
        this._player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );

        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);

        logger.info('360 stereo video playing');
        this._playoutEngine.setPlayoutActive(this._rendererId);
        this._addDragControl();
        this.animate();
    }

    end() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);

        // this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);

        if (this._threeJsDiv.parentNode !== null) {
            this._target.removeChild(this._threeJsDiv);
        }

        // remove drag listeners
        this._target.removeEventListener('mousedown', this._mouseDownListener);
        this._target.removeEventListener('mousemove', this._mouseMoveListener);
        this._target.removeEventListener('mouseup', this._mouseUpListener);

        this._player.disconnectScrubBar();
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
                                this._buildThreeScene(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Video not found');
                            });
                    }
                });
        }
    }

    _buildThreeScene(mediaUrl: string) {
        this._playoutEngine.queuePlayout(this._rendererId, {
            url: mediaUrl,
        });

        this._threeJsDiv = document.createElement('div');
        this._threeJsDiv.className = 'romper-aframe-scene romper-video-element';

        this._camera = new THREE.PerspectiveCamera(
            75,
            this._target.offsetWidth / this._target.offsetHeight,
            1,
            2000,
        );
        this._camera.layers.enable(1); // render left view when no stereo available
        this._camera.target = new THREE.Vector3(0, 0, 0);

        // video
        this._videoElement = this._playoutEngine.getMediaElement(this._rendererId);

        this._texture = new THREE.Texture(this._videoElement);
        this._texture.generateMipmaps = false;
        this._texture.minFilter = THREE.NearestFilter;
        this._texture.maxFilter = THREE.NearestFilter;
        this._texture.format = THREE.RGBFormat;

        setInterval(() => {
            if (this._videoElement.readyState >= this._videoElement.HAVE_CURRENT_DATA) {
                this._texture.needsUpdate = true;
            }
        }, 1000 / 24);

        this._scene = new THREE.Scene();
        this._scene.background = new THREE.Color(0x101010);

        // left
        const geometryLeft = new THREE.SphereBufferGeometry(500, 60, 40);
        // invert the geometry on the x-axis so that all of the faces point inward
        geometryLeft.scale(-1, 1, 1);

        const uvsLeft = geometryLeft.attributes.uv.array;
        for (let i = 0; i < uvsLeft.length; i += 2) {
            uvsLeft[i] *= 0.5;
        }

        const materialLeft = new THREE.MeshBasicMaterial({ map: this._texture });
        const meshLeft = new THREE.Mesh(geometryLeft, materialLeft);
        meshLeft.rotation.y = -(Math.PI / 2);
        meshLeft.layers.set(1); // display in left eye only
        this._scene.add(meshLeft);

        // right
        const geometryRight = new THREE.SphereBufferGeometry(500, 60, 40);
        geometryRight.scale(-1, 1, 1);

        const uvsRight = geometryRight.attributes.uv.array;
        for (let i = 0; i < uvsRight.length; i += 2) {
            uvsRight[i] *= 0.5;
            uvsRight[i] += 0.5;
        }

        const materialRight = new THREE.MeshBasicMaterial({ map: this._texture });
        const meshRight = new THREE.Mesh(geometryRight, materialRight);
        meshRight.rotation.y = -(Math.PI / 2);
        meshRight.layers.set(2); // display in right eye only
        this._scene.add(meshRight);

        //

        this._threeRenderer = new THREE.WebGLRenderer();
        this._threeRenderer.setPixelRatio(this._target.offsetWidth / this._target.offsetHeight);
        this._threeRenderer.setSize(this._target.offsetWidth, this._target.offsetHeight);
        this._threeRenderer.vr.enabled = true;
        this._threeJsDiv.appendChild(this._threeRenderer.domElement);

        // this._threeJsDiv.appendChild(WEBVR.createButton(
        //     this._threeRenderer,
        //     { frameOfReferenceType: 'head-model' },
        // ));

        window.addEventListener('resize', () => {
            this._camera.aspect = this._target.offsetWidth / this._target.offsetHeight;
            this._camera.updateProjectionMatrix();
            this._threeRenderer.setSize(this._target.offsetWidth, this._target.offsetHeight);
        }, false);
    }

    animate() {
        this._threeRenderer.setAnimationLoop(this.render);
    }

    render() {
        // moving the camera according to current latitude and longitude
        this._latitude = Math.max(-85, Math.min(85, this._latitude)); // limit up/down
        this._camera.target.y = 500 * Math.cos(THREE.Math.degToRad(90 - this._latitude));
        this._camera.target.x = 500 *
                Math.sin(THREE.Math.degToRad(90 - this._latitude)) *
                Math.cos(THREE.Math.degToRad(this._longitude));
        this._camera.target.z = 500 *
            Math.sin(THREE.Math.degToRad(90 - this._latitude)) *
            Math.sin(THREE.Math.degToRad(this._longitude));
        this._camera.lookAt(this._camera.target);
        this._threeRenderer.render(this._scene, this._camera);
    }

    // allow the user to drag the scene around with the mouse
    _addDragControl() {
        this._target.addEventListener('mousedown', this._mouseDownListener, false);
        this._target.addEventListener('mousemove', this._mouseMoveListener, false);
        this._target.addEventListener('mouseup', this._mouseUpListener, false);
    }

    _mouseDownListener(event: MouseEvent) {
        event.preventDefault();
        this._manualControl = true;
        this._savedX = event.clientX;
        this._savedY = event.clientY;

        this._savedLongitude = this._longitude;
        this._savedLatitude = this._latitude;
    }

    _mouseMoveListener(event: MouseEvent) {
        if (this._manualControl) {
            this._longitude = ((this._savedX - event.clientX) * 0.1) + this._savedLongitude;
            this._latitude = ((event.clientY - this._savedY) * 0.1) + this._savedLatitude;
        }
    }

    _mouseUpListener() {
        this._manualControl = false;
    }

    _handlePlayPauseButtonClicked(): void {
        if (this._videoElement.paused === true) {
            this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
        } else {
            this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
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
        this._playoutEngine.unqueuePlayout(this._rendererId);
        super.destroy();
    }
}
