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
const AFRAME = require('aframe');

let componentRegistered = false;

export default class AFrameRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;
    _playEventListener: Function;
    _pauseEventListener: Function;
    _handlePlayPauseButtonClicked: Function;

    _aFrameSceneElement: any;
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
        AFrameRenderer._registerAframeComponents();

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
        let videoTypeString = '360_mono';
        if (this._representation.representation_type ===
            'urn:x-object-based-media:representation-types:360-stereo/v1.0') {
            videoTypeString = '360_stereo';
        }

        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
            return;
        }

        const cameraEntity = document.createElement('a-entity');
        cameraEntity.setAttribute('position', '0 0 0');

        cameraEntity.setAttribute('rotation', this._initialRotation);
        this._aFrameCamera = document.createElement('a-camera');
        cameraEntity.appendChild(this._aFrameCamera);
        this._aFrameSceneElement.appendChild(cameraEntity);

        const videoType = {
            coverage: 'full',
            stereo: false,
            split: 'horizontal',
            mode: 'full',
        };
        const videoDivId = 'threesixtyvideo';

        // Get types from type
        if (videoTypeString.includes('180')) videoType.coverage = 'half';
        if (videoTypeString.includes('stereo')) videoType.stereo = true;
        if (videoTypeString.includes('vertical')) videoType.split = 'vertical';

        this._playoutEngine.queuePlayout(this._rendererId, {
            url: mediaUrl,
        });

        // If stereo video
        if (videoType.stereo) {
            logger.info('360 rendering stereo');

            // ACTIVATE layer 1 (left eye) for camera on monoscopic view
            // Camera is not existent at this point. If wait for scene "loaded", still is undefined.
            // So, should wait for scene 'renderstart', set a flag and fire component 'update'
            this._aFrameSceneElement.addEventListener('renderstart', () => {
                // Enable left eye on camera layers (1 == left, 2 == right)
                // this._aFrameSceneElement.camera.layers.enable(1);
            });

            //    // Emit event for attaching to a menu or player from the outside
            // this.el.emit("asset_added", {'id': videoDivId}, false);

            const sphereL = document.createElement('a-entity');
            sphereL.setAttribute('class', 'videospheres');
            sphereL.setAttribute(
                'geometry',
                'primitive:sphere; radius:100; segmentsWidth: 64; segmentsHeight:64',
            );
            AFRAME.utils.entity.setComponentProperty(sphereL, 'material', {
                shader: 'flat',
                src: `#${videoDivId}`,
                side: 'back',
            });
            sphereL.setAttribute('scale', '-1 1 1');

            // Sync rotation with 'camera landing rotation'
            AFRAME.utils.entity.setComponentProperty(sphereL, 'rotation', { x: 0, y: 0, z: 0 });
            AFRAME.utils.entity.setComponentProperty(
                sphereL,
                'stereo',
                { eye: 'left', mode: videoType.mode, split: videoType.split },
            );
            this._aFrameSceneElement.appendChild(sphereL);

            const sphereR = document.createElement('a-entity');
            sphereR.setAttribute('class', 'videospheres');
            sphereR.setAttribute(
                'geometry',
                'primitive:sphere; radius:100; segmentsWidth: 64; segmentsHeight:64',
            );
            AFRAME.utils.entity.setComponentProperty(sphereR, 'material', {
                shader: 'flat',
                src: `#${videoDivId}`,
                side: 'back',
            });
            sphereR.setAttribute('scale', '-1 1 1');

            // sphereR.addEventListener('materialvideoloadeddata', () => {
            //     // this.el.emit("video_loaded", null, false);
            //     console.log('loaded');
            // });

            AFRAME.utils.entity.setComponentProperty(
                sphereR,
                'stereo',
                { eye: 'right', mode: videoType.mode, split: videoType.split },
            );

            this._aFrameSceneElement.appendChild(sphereR);
        } else {
            logger.info('360 rendering mono');
            const sphereMono = document.createElement('a-entity');
            sphereMono.setAttribute('class', 'videospheres');
            sphereMono.setAttribute(
                'geometry',
                'primitive:sphere; radius:100; segmentsWidth: 64; segmentsHeight:64',
            );
            sphereMono.setAttribute('scale', '-1 1 1');
            AFRAME.utils.entity.setComponentProperty(sphereMono, 'material', {
                shader: 'flat',
                src: `#${videoDivId}`,
                side: 'back',
            });
            this._aFrameSceneElement.appendChild(sphereMono);
        }

        // create AFrame entities in here to display 360 video
        this._aFrameSceneElement.setAttribute('embedded', '');
        this._aFrameSceneElement.classList.add('romper-aframe-scene');

        const aFrameAssetsElement = document.createElement('a-assets');
        this._aFrameSceneElement.appendChild(aFrameAssetsElement);

        this._playoutEngine.getMediaElement(this._rendererId).id = videoDivId;
        aFrameAssetsElement.appendChild(this._playoutEngine.getMediaElement(this._rendererId));
        // this may break stuff!!!
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

        this._aFrameSceneElement.addEventListener('renderstart', () => {
            // console.log('layers');
            this._aFrameSceneElement.camera.layers.enable(1);
        });

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

    static _registerAframeComponents() {
        if (componentRegistered) {
            logger.info('aFrame stereo component already registered');
            return;
        }

        AFRAME.registerComponent('stereo', {
            schema: {
                eye: { type: 'string', default: 'left' },
                mode: { type: 'string', default: 'full' },
                split: { type: 'string', default: 'horizontal' },
            },

            init() {
                // Flag for video
                this.materialIsAVideo = false;

                // Check if material is a video from html tag (object3D.material.map
                // instanceof THREE.VideoTexture does not always work
                if (this.el.getAttribute('material') !== null
                    && 'src' in this.el.getAttribute('material')
                    && this.el.getAttribute('material').src !== '') {
                    // eslint-disable-next-line prefer-destructuring
                    const src = this.el.getAttribute('material').src;
                    // If src is an object and its tagName is video...
                    if (typeof src === 'object' && ('tagName' in src && src.tagName === 'VIDEO')) {
                        this.materialIsAVideo = true;
                    }
                }

                const object3D = this.el.object3D.children[0];

                // In A-Frame 0.2.0, objects are all groups so sphere is the first children
                // Check if it's a sphere w/ video material, and if so
                // Note that in A-Frame 0.2.0, sphere entities are THREE.SphereBufferGeometry,
                // while in A-Frame 0.3.0, sphere entities are THREE.BufferGeometry.

                const validGeometries = [
                    THREE.SphereGeometry, // eslint-disable-line no-undef
                    THREE.SphereBufferGeometry, // eslint-disable-line no-undef
                    THREE.BufferGeometry, // eslint-disable-line no-undef
                ];
                const isValidGeometry = validGeometries.some(geometry =>
                    object3D.geometry instanceof geometry);

                let geometry;
                if (isValidGeometry && this.materialIsAVideo) {
                    // if half-dome mode, rebuild geometry
                    // (with default 100, radius, 64 width segments and 64 height segments)
                    if (this.data.mode === 'half') {
                        const geoDef = this.el.getAttribute('geometry');
                        // eslint-disable-next-line no-undef
                        geometry = new THREE.SphereGeometry(
                            geoDef.radius || 100,
                            geoDef.segmentsWidth || 64,
                            geoDef.segmentsHeight || 64,
                            Math.PI / 2, Math.PI, 0, Math.PI,
                        );
                    } else {
                        const geoDef = this.el.getAttribute('geometry');
                        // eslint-disable-next-line no-undef
                        geometry = new THREE.SphereGeometry(
                            geoDef.radius || 100,
                            geoDef.segmentsWidth || 64,
                            geoDef.segmentsHeight || 64,
                        );
                    }

                    // Panorama in front
                    object3D.rotation.y = Math.PI / 2;

                    // If left eye is set, and the split is horizontal,
                    // take the left half of the video texture. If the split
                    // is set to vertical, take the top/upper half of the video texture.
                    if (this.data.eye === 'left') {
                        const uvs = geometry.faceVertexUvs[0];
                        const axis = this.data.split === 'vertical' ? 'y' : 'x';
                        for (let i = 0; i < uvs.length; i += 1) {
                            for (let j = 0; j < 3; j += 1) {
                                if (axis === 'x') {
                                    uvs[i][j][axis] *= 0.5;
                                } else {
                                    uvs[i][j][axis] *= 0.5;
                                    uvs[i][j][axis] += 0.5;
                                }
                            }
                        }
                    }

                    // If right eye is set, and the split is horizontal,
                    // take the right half of the video texture. If the split
                    // is set to vertical, take the bottom/lower half of the video texture.
                    if (this.data.eye === 'right') {
                        const uvs = geometry.faceVertexUvs[0];
                        const axis = this.data.split === 'vertical' ? 'y' : 'x';
                        for (let i = 0; i < uvs.length; i += 1) {
                            for (let j = 0; j < 3; j += 1) {
                                if (axis === 'x') {
                                    uvs[i][j][axis] *= 0.5;
                                    uvs[i][j][axis] += 0.5;
                                } else {
                                    uvs[i][j][axis] *= 0.5;
                                }
                            }
                        }
                    }

                    // As AFrame 0.2.0 builds bufferspheres from sphere entities, transform
                    // into buffergeometry for coherence
                    // eslint-disable-next-line no-undef
                    object3D.geometry = new THREE.BufferGeometry().fromGeometry(geometry);
                }
            },

            // On element update, put in the right layer, 0:both, 1:left, 2:right (spheres or not)
            update() {
                const object3D = this.el.object3D.children[0];
                // eslint-disable-next-line prefer-destructuring
                const data = this.data;
                if (data.eye === 'both') {
                    object3D.layers.set(0);
                } else {
                    object3D.layers.set(data.eye === 'left' ? 1 : 2);
                }
            },

            tick() {},
        });
        componentRegistered = true;
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
