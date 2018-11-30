// @flow

import AFRAME from 'aframe';
// uncomment next line when dynamic-audio-smp360 is available on Artifactory
// import dynamicAudio from 'dynamicaudio';

import EventEmitter from 'events';

import logger from '../logger';
import '../assets/images/media-play-8x.png';
import '../assets/images/media-pause-8x.png';
import '../assets/images/media-step-forward-8x.png';
import '../assets/images/media-step-backward-8x.png';

let _vrMode = false;

class AFrameRenderer extends EventEmitter {
    aFrameSceneElement: any;
    _aFrameAssetsElement: HTMLElement;
    _aFrameCamera: any;
    _controlBar: HTMLElement;
    _cursor: HTMLElement;

    sceneElements: Array<HTMLElement>;


    constructor() {
        super();
        AFrameRenderer._registerAframeComponents();
        this.buildBaseAframeScene();
        this.sceneElements = [];
    }

    // build vanilla aFrame infrastructure
    // these would need to persist across NEs for continuous headset playback
    buildBaseAframeScene() {
        logger.info('Building aFrame infrastructure');
        if (this.aFrameSceneElement) {
            return;
        }

        // scene
        this.aFrameSceneElement = document.createElement('a-scene');
        this.aFrameSceneElement.id = 'romperascene';
        this.aFrameSceneElement.setAttribute('embedded', '');
        this.aFrameSceneElement.classList.add('romper-aframe-scene');

        // camera
        const cameraEntity = document.createElement('a-entity');
        cameraEntity.id = 'romper-camera-entity';
        cameraEntity.setAttribute('position', '0 0 0');
        cameraEntity.setAttribute('rotation', '0 0 0');
        this._aFrameCamera = document.createElement('a-camera');
        cameraEntity.appendChild(this._aFrameCamera);
        this.aFrameSceneElement.appendChild(cameraEntity);

        this._cursor = document.createElement('a-entity');
        this._cursor.setAttribute('cursor', 'fuse: true; maxDistance: 30; timeout: 500');
        this._cursor.setAttribute('position', '0 0 -2');
        this._cursor.setAttribute(
            'geometry',
            'primitive: ring; radiusInner: 0.02; radiusOuter: 0.03',
        );
        this._cursor.setAttribute('material', 'color: white; shader: flat');
        this._cursor.setAttribute('visible', 'false');
        this._aFrameCamera.appendChild(this._cursor);

        // assets (add our video div)
        this._aFrameAssetsElement = document.createElement('a-assets');
        this.aFrameSceneElement.appendChild(this._aFrameAssetsElement);

        this.aFrameSceneElement.addEventListener('renderstart', () =>
            this.aFrameSceneElement.camera.layers.enable(1));

        this.aFrameSceneElement.addEventListener('enter-vr', () => {
            logger.info('Entering VR mode');
            this._controlBar.setAttribute('visible', 'true');
            this._cursor.setAttribute('visible', 'true');
            this.emit('aframe-vr-toggle');
            _vrMode = true;
        });
        this.aFrameSceneElement.addEventListener('exit-vr', () => {
            logger.info('Exiting VR mode');
            this._controlBar.setAttribute('visible', 'false');
            this._cursor.setAttribute('visible', 'false');
            this.emit('aframe-vr-toggle');
            _vrMode = false;
        });

        this.buildControlBar();
        this.addNextPreviousImageAssets();
        this.addPlayPauseImageAssets();
    }

    addAFrameToRenderTarget(target: HTMLElement) {
        if (this.aFrameSceneElement.parentNode !== target) {
            target.appendChild(this.aFrameSceneElement);
        }
    }

    addAsset(assetElement: HTMLElement) {
        this._aFrameAssetsElement.appendChild(assetElement);
    }

    addElementToScene(sceneElement: HTMLElement) {
        if (sceneElement.parentNode !== this.aFrameSceneElement) {
            this.aFrameSceneElement.appendChild(sceneElement);
            this.sceneElements.push(sceneElement);
        }
    }

    buildControlBar() {
        // const position = { phi: -90, theta: -20, rad: 8 };
        // const cartesian = AFrameRenderer
        //     .polarToCartesian(position.phi, position.theta, position.rad);

        this._controlBar = document.createElement('a-plane');
        this._controlBar.setAttribute('position', '0 -10 -10');
        this._controlBar.setAttribute('rotation', '-50 0 0');
        this._controlBar.id = 'aframe-control-bar';
        this._controlBar.setAttribute('color', '#CCC');
        this._controlBar.setAttribute('width', '6');
        this._controlBar.setAttribute('height', '1.5');
        // only display in vr mode
        this._controlBar.setAttribute('visible', 'false');
        this.aFrameSceneElement.appendChild(this._controlBar);
    }

    addLinkIcon(iconUrl: string, number: number, callback: Function) {
        const img = document.createElement('img');
        img.src = '../dist/images/media-step-forward-8x.png'; // iconUrl;
        img.id = `icon-image-${number}`;
        this.addAsset(img);

        const iconImageEntity = document.createElement('a-image');
        iconImageEntity.addEventListener('click', callback);

        // cunningly render in the control bar
        iconImageEntity.setAttribute('position', `${2 * number} 0 0.05`);
        iconImageEntity.setAttribute('width', '1');
        iconImageEntity.setAttribute('height', '1');
        iconImageEntity.setAttribute('src', `#icon-image-${number}`);

        if (number > 1) {
            // resize control bar to fit
            this._controlBar.setAttribute('width', `${(number * 2.5) + 5}`);
        }

        this.sceneElements.push(iconImageEntity);
        this._controlBar.appendChild(iconImageEntity);
    }

    addNextPreviousImageAssets() {
        const nextImg = document.createElement('img');
        nextImg.src = '../dist/images/media-step-forward-8x.png';
        nextImg.id = 'next-image';
        this.addAsset(nextImg);

        const prevImg = document.createElement('img');
        prevImg.src = '../dist/images/media-step-backward-8x.png';
        prevImg.id = 'prev-image';
        this.addAsset(prevImg);
    }

    addPlayPauseImageAssets() {
        const playImg = document.createElement('img');
        playImg.src = '../dist/images/media-play-8x.png';
        playImg.id = 'play-image';
        this.addAsset(playImg);

        const pauseImg = document.createElement('img');
        pauseImg.src = '../dist/images/media-pause-8x.png';
        pauseImg.id = 'pause-image';
        this.addAsset(pauseImg);
    }

    addPlayPauseButton(callback: Function) {
        const playPauseEntity = document.createElement('a-image');
        playPauseEntity.id = 'romper-aframe-playpause';
        playPauseEntity.setAttribute('position', '0 0 0.05');
        playPauseEntity.setAttribute('width', '1');
        playPauseEntity.setAttribute('height', '1');
        playPauseEntity.setAttribute('src', '#pause-image');
        playPauseEntity.addEventListener('click', callback);
        this.sceneElements.push(playPauseEntity);
        this._controlBar.appendChild(playPauseEntity);
    }

    // eslint-disable-next-line class-methods-use-this
    togglePlayPause(showPlay: boolean) {
        const playPauseEntity = document.getElementById('romper-aframe-playpause');
        if (playPauseEntity) {
            playPauseEntity.removeAttribute('src');
            playPauseEntity.setAttribute('src', showPlay ? '#play-image' : '#pause-image');
        }
    }

    addNext(callback: Function) {
        const nextEntity = document.createElement('a-image');
        nextEntity.id = 'romper-aframe-next';
        nextEntity.setAttribute('position', '2 0 0.05');
        nextEntity.setAttribute('width', '1');
        nextEntity.setAttribute('height', '1');
        nextEntity.setAttribute('src', '#next-image');
        nextEntity.addEventListener('click', callback);
        this.sceneElements.push(nextEntity);
        this._controlBar.appendChild(nextEntity);
    }

    addPrevious(callback: Function) {
        const prevEntity = document.createElement('a-image');
        prevEntity.id = 'romper-aframe-prev';
        prevEntity.setAttribute('position', '-2 0 0.05');
        prevEntity.setAttribute('width', '1');
        prevEntity.setAttribute('height', '1');
        prevEntity.setAttribute('src', '#prev-image');
        prevEntity.addEventListener('click', callback);
        this.sceneElements.push(prevEntity);
        this._controlBar.appendChild(prevEntity);
    }

    clearPrevious() {
        this._clearEl(document.getElementById('romper-aframe-prev'));
    }

    clearNext() {
        this._clearEl(document.getElementById('romper-aframe-next'));
    }

    clearPlayPause() {
        this._clearEl(document.getElementById('romper-aframe-playpause'));
    }

    _clearEl(element: ?HTMLElement) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
        const index = this.sceneElements.indexOf(element);
        if (index >= 0) {
            this.sceneElements.splice(index, 1);
        }
    }

    clearSceneElements() {
        while (this.sceneElements.length > 0) {
            const el = this.sceneElements.pop();
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
        this._controlBar.setAttribute('width', '6');
    }

    /*
    *  Convert polar coordinates to cartesian ones, and apply offsets for device
    */
    static polarToCartesian(phi: number, theta: number, radius: number): Object {
        const phiRad = ((phi - 90) / 180) * Math.PI;
        const thetaRad = (theta / 180) * Math.PI;
        const x = Math.cos(phiRad) * radius;
        const z = Math.sin(phiRad) * radius;
        const y = Math.sin(thetaRad) * radius * 1.6;
        // if(device == DEV_CARDBOARD){ y +=1.6; }
        // if(device == DEV_OCULUS){
        //     y +=1;
        //     x *= 1.5;
        //     y *= 1.5;
        //     z *= 1.5;
        // }
        return { x, y, z };
    }

    // eslint-disable-next-line class-methods-use-this
    isInVR(): boolean {
        return _vrMode;
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
        return coords;
    }

    static _registerAframeComponents() {
        logger.info('registering components for aFrame stereo and ambisonic');

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

        // AFRAME.registerComponent('spatialaudio', {
        //     schema: {},
        //     init() {
        //         logger.info('AFrame registering spatial audio component');
        //         const source = this.el.getAttribute('src');
        //         const ambiOrder = this.el.getAttribute('ambiOrder');
        //         const videoElement = document.getElementById(source);
        //         // eslint-disable-next-line new-cap
        //         this.spatialAudio = new dynamicAudio({ videoElement, ambiOrder });
        //         // Throttle soundfield rotation tick to 50ms, rather than every frame
        //         this.tick = AFRAME.utils.throttleTick(this.tick, 50, this);
        //         logger.info('initialised spatialAudio component');
        //     },
        //     tick() {
        //         const cameraEl = this.el.sceneEl.camera.el;
        //         const rot = cameraEl.getAttribute('rotation');
        //         this.spatialAudio.updateRotation(rot, true);
        //     },
        //     remove() {
        //         logger.info('Removing spatial audio component');
        //     },
        // });
    }

    // create a bunch of aFrame components, maybe from Data model?
    // eslint-disable-next-line class-methods-use-this
    buildAframeComponents(objectSpecs: string): HTMLElement {
        const ent = document.createElement('a-entity');
        ent.id = 'addedExtras';
        ent.innerHTML = objectSpecs;
        return ent;
    }

    setSceneHidden(visible: boolean) {
        this.aFrameSceneElement.style.height = visible ? '0px' : '100%';
    }

    exitVR() {
        this.aFrameSceneElement.exitVR();
    }
}

const instance = new AFrameRenderer();
Object.freeze(instance);

export default instance;
