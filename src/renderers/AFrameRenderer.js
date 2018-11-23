// @flow

import AFRAME from 'aframe';
import dynamicAudio from 'dynamicaudio';

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
import logger from '../logger';

let componentRegistered = false;

export default class AFrameRenderer extends BaseRenderer {
    static _aFrameSceneElement: any;
    static _aFrameAssetsElement: HTMLElement;
    static _aFrameCamera: any;

    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;
    _outTimeEventListener: Function;
    _playEventListener: Function;
    _pauseEventListener: Function;
    _handlePlayPauseButtonClicked: Function;

    _videoDivId: string;
    _videoAssetElement: HTMLVideoElement;
    _initialRotation: string;
    _videoTypeString: string;
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
        this._outTimeEventListener = this._outTimeEventListener.bind(this);

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
        AFrameRenderer._buildBaseAframeScene();
        this.collectElementsToRender();
    }

    _endedEventListener() {
        logger.info('360 video ended');
        if (!this._hasEnded) {
            this._hasEnded = true;
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
        logger.info(`Started: ${this._representation.id}`);
        if (this._rendered) {
            this._startThreeSixtyVideo();
        } else {
            this.collectElementsToRender();
        }
        this.setCurrentTime(this._lastSetTime);
        this._hasEnded = false;
        this._started = true;
    }

    collectElementsToRender() {
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        // get meta
                        if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                            this._setInTime(parseFloat(fg.meta.romper.in));
                        }
                        if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                            this._setOutTime(parseFloat(fg.meta.romper.out));
                        }
                        if (fg.meta && fg.meta.romper && fg.meta.romper.video_type) {
                            // mono/stereo, vertical/horizontal split
                            this._videoTypeString = fg.meta.romper.video_type;
                        }
                        if (fg.meta && fg.meta.romper && fg.meta.romper.rotation) {
                            // starting rotation
                            this._initialRotation = fg.meta.romper.rotation;
                        }
                        if (fg.meta && fg.meta.romper && fg.meta.romper.audio) {
                            // starting rotation
                            this._ambisonic = fg.meta.romper.audio;
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
                                this._buildAframeVideoScene(appendedUrl);
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

        const videoElements = [];

        // test how we might add other aFrame components specified in DM
        if (this._representation.meta
            && this._representation.meta.romper
            && this._representation.meta.romper.aframe
            && this._representation.meta.romper.aframe.extras) {
            videoElements.push(AFrameRenderer
                ._buildAframeComponents(this._representation.meta.romper.aframe.extras));
        }

        this._playoutEngine.getMediaElement(this._rendererId).id = this._videoDivId;
        AFrameRenderer._aFrameAssetsElement
            .appendChild(this._playoutEngine.getMediaElement(this._rendererId));

        // identify video type and set parameters
        // now build bits specific for video/type
        const videoType = { // defaults
            coverage: 'full',
            stereo: false,
            split: 'horizontal',
            mode: 'full',
        };

        if (this._ambisonic !== '') {
            logger.info(`${this._ambisonic} ambisonic audio`);
            const audio = document.createElement('a-entity');
            audio.setAttribute('src', this._videoDivId);
            audio.setAttribute('ambiOrder', this._ambisonic);
            audio.setAttribute('spatialaudio', '');
            videoElements.push(audio);
        }

        // parse video type from string
        if (this._videoTypeString.includes('180')) videoType.coverage = 'half';
        if (this._videoTypeString.includes('stereo')) videoType.stereo = true;
        if (this._videoTypeString.includes('vertical')) videoType.split = 'vertical';

        // get components for video depending on type
        // these are the bits that would need to be replaced for each scene
        if (videoType.stereo) {
            const stereoElements = this._getStereoComponents(videoType);
            this._sceneElements = videoElements.concat(stereoElements);
        } else {
            const monoElements = this._getMonoComponents();
            this._sceneElements = videoElements.concat(monoElements);
        }

        // all done - start playing if start has been called
        // if not, we're ready
        this._rendered = true;
        if (this._started) {
            this._startThreeSixtyVideo();
        }
    }

    // build vanilla aFrame infrastructure
    // these would need to persist across NEs for continuous headset playback
    static _buildBaseAframeScene() {
        if (AFrameRenderer._aFrameSceneElement) {
            return;
        }

        AFrameRenderer._registerAframeComponents();

        // scene
        AFrameRenderer._aFrameSceneElement = document.createElement('a-scene');
        AFrameRenderer._aFrameSceneElement.id = 'romperascene';
        AFrameRenderer._aFrameSceneElement.setAttribute('embedded', '');
        AFrameRenderer._aFrameSceneElement.classList.add('romper-aframe-scene');

        // camera
        const cameraEntity = document.createElement('a-entity');
        cameraEntity.id = 'romper-camera-entity';
        cameraEntity.setAttribute('position', '0 0 0');
        cameraEntity.setAttribute('rotation', '0 0 0');
        AFrameRenderer._aFrameCamera = document.createElement('a-camera');
        cameraEntity.appendChild(AFrameRenderer._aFrameCamera);
        AFrameRenderer._aFrameSceneElement.appendChild(cameraEntity);

        // assets (add our video div)
        AFrameRenderer._aFrameAssetsElement = document.createElement('a-assets');
        AFrameRenderer._aFrameSceneElement.appendChild(AFrameRenderer._aFrameAssetsElement);

        AFrameRenderer._aFrameSceneElement.addEventListener('renderstart', () =>
            AFrameRenderer._aFrameSceneElement.camera.layers.enable(1));
    }

    // return components needed to render mono 360 video
    _getMonoComponents(): Array<HTMLElement> {
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
            src: `#${this._videoDivId}`,
            side: 'back',
        });
        return [sphereMono];
    }

    // return components needed to render stereo 360 video
    _getStereoComponents(videoType: Object): Array<HTMLElement> {
        logger.info('360 rendering stereo');

        const sphereL = document.createElement('a-entity');
        sphereL.setAttribute('class', 'videospheres');
        sphereL.setAttribute(
            'geometry',
            'primitive:sphere; radius:100; segmentsWidth: 64; segmentsHeight:64',
        );
        AFRAME.utils.entity.setComponentProperty(sphereL, 'material', {
            shader: 'flat',
            src: `#${this._videoDivId}`,
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

        const sphereR = document.createElement('a-entity');
        sphereR.setAttribute('class', 'videospheres');
        sphereR.setAttribute(
            'geometry',
            'primitive:sphere; radius:100; segmentsWidth: 64; segmentsHeight:64',
        );
        AFRAME.utils.entity.setComponentProperty(sphereR, 'material', {
            shader: 'flat',
            src: `#${this._videoDivId}`,
            side: 'back',
        });
        sphereR.setAttribute('scale', '-1 1 1');

        AFRAME.utils.entity.setComponentProperty(
            sphereR,
            'stereo',
            { eye: 'right', mode: videoType.mode, split: videoType.split },
        );

        return [sphereL, sphereR];
    }

    _startThreeSixtyVideo() {
        // add elements
        this._sceneElements.forEach((el) => {
            if (el.parentNode !== AFrameRenderer._aFrameSceneElement) {
                AFrameRenderer._aFrameSceneElement.appendChild(el);
            }
        });

        if (AFrameRenderer._aFrameSceneElement.parentNode !== this._target) {
            this._target.appendChild(AFrameRenderer._aFrameSceneElement);
        }

        this._player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );

        this._target.addEventListener('mouseup', () => { AFrameRenderer.getOrientation(); }, false);

        const cameraContainer = document.getElementById('romper-camera-entity');
        if (cameraContainer) {
            cameraContainer.setAttribute('rotation', this._initialRotation);
        }

        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.setPlayoutActive(this._rendererId);
        AFrameRenderer._aFrameSceneElement.style.height = '100%';
    }

    // get the direction of view
    static getOrientation(): Object {
        const rot = AFrameRenderer._aFrameCamera.getAttribute('rotation');
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
                    window.THREE.SphereGeometry,
                    window.THREE.SphereBufferGeometry, // eslint-disable-line no-undef
                    window.THREE.BufferGeometry, // eslint-disable-line no-undef
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
                        geometry = new window.THREE.SphereGeometry(
                            geoDef.radius || 100,
                            geoDef.segmentsWidth || 64,
                            geoDef.segmentsHeight || 64,
                            Math.PI / 2, Math.PI, 0, Math.PI,
                        );
                    } else {
                        const geoDef = this.el.getAttribute('geometry');
                        // eslint-disable-next-line no-undef
                        geometry = new window.THREE.SphereGeometry(
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
                    object3D.geometry = new window.THREE.BufferGeometry().fromGeometry(geometry);
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

        AFRAME.registerComponent('spatialaudio', {
            schema: {},
            init() {
                console.log('ANDY got spatial audio');
                const source = this.el.getAttribute('src');
                const ambiOrder = this.el.getAttribute('ambiOrder');
                const videoElement = document.getElementById(source);
                // eslint-disable-next-line new-cap
                this.spatialAudio = new dynamicAudio({ videoElement, ambiOrder });
                // Throttle soundfield rotation tick to 50ms, rather than every frame
                this.tick = AFRAME.utils.throttleTick(this.tick, 50, this);
                logger.info('initialised spatialAudio component');
            },
            tick() {
                const cameraEl = this.el.sceneEl.camera.el;
                const rot = cameraEl.getAttribute('rotation');
                this.spatialAudio.updateRotation(rot, true);
            },
            remove() {
                logger.info('Removing spatial audio component');
            },
        });

        componentRegistered = true;
    }

    getCurrentTime(): Object {
        let videoTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if (videoTime === undefined) {
            videoTime = this._lastSetTime;
        } else {
            // convert to time into segment
            videoTime -= this._inTime;
        }
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
        };
        return timeObject;
    }

    // set how far into the segment this video should be (relative to in-point)
    setCurrentTime(time: number) {
        this._lastSetTime = time; // time into segment
        // convert to absolute time into video
        this._playoutEngine.setCurrentTime(this._rendererId, time + this._inTime);
    }

    // add bunch of aFrame components, maybe from Data model?
    static _buildAframeComponents(objectSpecs: string): HTMLElement {
        const ent = document.createElement('a-entity');
        ent.id = 'addedExtras';
        ent.innerHTML = objectSpecs;
        return ent;
    }

    _setInTime(time: number) {
        this._inTime = time;
    }

    _setOutTime(time: number) {
        this._outTime = time;
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    end() {
        // hide
        AFrameRenderer._aFrameSceneElement.style.height = '0px';

        this._playoutEngine.setPlayoutInactive(this._rendererId);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );

        if (this._rendered) {
            // remove scene specific elements
            this._sceneElements.forEach((se) => {
                if (se.parentNode) {
                    se.parentNode.removeChild(se);
                }
            });
        }

        this._started = false;
        this._rendered = false;

        // AFrameRenderer._aFrameSceneElement.exitVR();
    }

    static exitVR() {
        AFrameRenderer._aFrameSceneElement.exitVR();
        AFrameRenderer._aFrameSceneElement.style.height = '0px';
    }

    destroy() {
        this.end();
        super.destroy();
    }
}
