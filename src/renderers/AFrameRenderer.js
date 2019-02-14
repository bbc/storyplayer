// @flow

import AFRAME from 'aframe';
// uncomment next line when dynamic-audio-smp360 is available on Artifactory
// import dynamicAudio from 'dynamicaudio';

import EventEmitter from 'events';

import logger from '../logger';
import AnalyticEvents from '../AnalyticEvents';
import Player, { PlayerEvents } from '../Player';
import type { AnalyticsLogger } from '../AnalyticEvents';
import '../assets/images/media-play-8x.png';
import '../assets/images/media-pause-8x.png';
import '../assets/images/media-step-forward-8x.png';
import '../assets/images/media-step-backward-8x.png';

let _vrMode: boolean = false;
let _analytics: ?AnalyticsLogger = null;
let _player: ?Player = null;
let _iconCount: number = 0;

class AFrameRenderer extends EventEmitter {
    aFrameSceneElement: any;
    _aFrameAssetsElement: HTMLElement;
    _aFrameCamera: any;
    _controlBar: HTMLElement;
    _cursor: HTMLElement;
    _analytics: ?AnalyticsLogger;

    sceneElements: Array<HTMLElement>;
    linkElements: Array<HTMLElement>;
    _choiceIconSet: { [key: string]: { entity: HTMLElement, control: boolean } };

    constructor() {
        super();
        AFrameRenderer._registerAframeComponents();
        this.buildBaseAframeScene();
        this.sceneElements = [];
        this.linkElements = [];
        this._choiceIconSet = {};
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
        // won't load scene until assets loaded, but video doesn't emit loaded event...
        this._aFrameAssetsElement.setAttribute('timeout', '5');
        this.aFrameSceneElement.appendChild(this._aFrameAssetsElement);

        this.aFrameSceneElement.addEventListener('renderstart', () =>
            this.aFrameSceneElement.camera.layers.enable(1));

        this.aFrameSceneElement.addEventListener('enter-vr', () => {
            // ANALYTICS
            logger.info('Entering VR mode');
            this._controlBar.setAttribute('visible', 'true');
            this._cursor.setAttribute('visible', 'true');
            this.emit('aframe-vr-toggle');
            _vrMode = true;
            this._logVrChange();
        });
        this.aFrameSceneElement.addEventListener('exit-vr', () => {
            // ANALYTICS
            logger.info('Exiting VR mode');
            this._controlBar.setAttribute('visible', 'false');
            this._cursor.setAttribute('visible', 'false');
            this.emit('aframe-vr-toggle');
            _vrMode = false;
        });

        this._buildControlBar();
        this._addNextPreviousImageAssets();
        this._addPlayPauseImageAssets();
    }

    addAFrameToRenderTarget(target: HTMLElement, player: Player, analytics: AnalyticsLogger) {
        if (this.aFrameSceneElement.parentNode !== target) {
            target.appendChild(this.aFrameSceneElement);
        }
        _analytics = analytics;
        _player = player;
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

    _buildControlBar() {
        const position = { phi: -90, theta: 0, rad: 10 };
        const cartesian = AFrameRenderer
            .polarToCartesian(position.phi, position.theta, position.rad);

        this._controlBar = document.createElement('a-plane');
        this._controlBar.setAttribute('position', `${cartesian.x} -10 ${cartesian.z}`);
        this._controlBar.setAttribute('rotation', `-50 ${-position.phi} 0`);
        this._controlBar.id = 'aframe-control-bar';
        this._controlBar.setAttribute('color', '#999');
        this._controlBar.setAttribute('width', '6');
        this._controlBar.setAttribute('height', '1.5');
        // only display in vr mode
        this._controlBar.setAttribute('visible', 'false');
        this.aFrameSceneElement.appendChild(this._controlBar);
    }

    setControlBarPosition(angle: number) {
        const position = { phi: angle, theta: 0, rad: 10 };
        const cartesian = AFrameRenderer
            .polarToCartesian(position.phi, position.theta, position.rad);
        this._controlBar.setAttribute('position', `${cartesian.x} -10 ${cartesian.z}`);
        this._controlBar.setAttribute('rotation', `-50 ${-position.phi} 0`);
    }

    addLinkIcon(neId: string, iconUrl: string, iconDataObject: Object) {
        _iconCount += 1;
        const img = document.createElement('img');
        // TODO: aframe doesn't like svg images ...
        if (iconUrl.indexOf('.svg') !== -1 || iconUrl === '') {
            img.src = '/dist/images/media-step-forward-8x.png';
        } else {
            img.src = iconUrl;
        }
        img.id = `icon-image-${_iconCount}`;
        img.setAttribute('crossorigin', 'anonymous');
        this.addAsset(img);

        const callback = () => {
            if (_player) {
                _player.emit(PlayerEvents.LINK_CHOSEN, { id: neId });
                _player.disableLinkChoiceControl();
                if (_analytics) {
                    _analytics({
                        type: AnalyticEvents.types.USER_ACTION,
                        name: AnalyticEvents.names.LINK_CHOICE_CLICKED,
                        from: '',
                        to: neId,
                    });
                }
            }
        };

        let placeInControl = true;
        const iconImageEntity = document.createElement('a-image');
        iconImageEntity.addEventListener('click', callback);
        iconImageEntity.setAttribute('src', `#icon-image-${_iconCount}`);

        // default position depends on how many already in control bar
        const numInControl = Object.keys(this._choiceIconSet).filter(neid =>
            this._choiceIconSet[neid].control).length + 1;
        let position = `${2 * numInControl} 0 0.05`;
        let iconWidth = 1;
        let iconHeight = 1;

        // now see if have 3D position
        if (iconDataObject.position && iconDataObject.position.three_d) {
            placeInControl = false;
            const positionSpec = iconDataObject.position.three_d;
            if (positionSpec.hasOwnProperty('phi') && positionSpec.hasOwnProperty('theta')) {
                const { phi, theta } = positionSpec;
                let iconRadius = 8;
                if (positionSpec.hasOwnProperty('radius')) {
                    const { radius } = positionSpec;
                    iconRadius = radius;
                }
                const { x, y, z } = AFrameRenderer.polarToCartesian(phi, theta, iconRadius);
                // const { x, y, z } = cartPos;
                position = `${x} ${y} ${z}`;
            } else if (positionSpec.hasOwnProperty('x')
                && positionSpec.hasOwnProperty('y')
                && positionSpec.hasOwnProperty('z')) {
                const { x, y, z } = positionSpec;
                position = `${x} ${y} ${z}`;
            } else {
                placeInControl = true;
            }
            // override if w and h specified, but not if going in control bar
            if (!placeInControl
                && positionSpec.hasOwnProperty('width')
                && positionSpec.hasOwnProperty('height')) {
                const { width, height } = positionSpec;
                iconHeight = height;
                iconWidth = width;
            }
        }

        iconImageEntity.setAttribute('position', position);
        iconImageEntity.setAttribute('width', `${iconWidth}`);
        iconImageEntity.setAttribute('height', `${iconHeight}`);

        this.sceneElements.push(iconImageEntity);
        this.linkElements.push(img);
        this.linkElements.push(iconImageEntity);
        this._choiceIconSet[neId] = { entity: iconImageEntity, control: placeInControl };
    }

    showLinkIcons() {
        // work out size of the control bar
        const numInControl = Object.keys(this._choiceIconSet).filter(neid =>
            this._choiceIconSet[neid].control).length;
        if (numInControl > 1) {
            this._controlBar.setAttribute('width', `${(numInControl * 2.5) + 5}`);
        }
        Object.keys(this._choiceIconSet).forEach((neId) => {
            const iconImageObject = this._choiceIconSet[neId];
            if (iconImageObject.control) {
                this._controlBar.appendChild(iconImageObject.entity);
            } else {
                this.aFrameSceneElement.appendChild(iconImageObject.entity);
            }
        });
    }

    clearLinkIcons() {
        while (this.linkElements.length > 0) {
            const el = this.linkElements.pop();
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
        this._controlBar.setAttribute('width', '6');
        Object.keys(this._choiceIconSet).forEach((neId) => {
            delete this._choiceIconSet[neId];
        });
        _iconCount = 0;
    }

    // eslint-disable-next-line class-methods-use-this
    hideVRButton(hide: boolean) {
        const buttons = document.getElementsByClassName('a-enter-vr-button');
        for (let i = 0; i < buttons.length; i += 1) {
            if (hide) {
                buttons[i].classList.add('romper-inactive');
            } else {
                buttons[i].classList.remove('romper-inactive');
            }
        }
    }

    _addNextPreviousImageAssets() {
        const nextImg = document.createElement('img');
        nextImg.src = '/dist/images/media-step-forward-8x.png';
        nextImg.id = 'next-image';
        this.addAsset(nextImg);

        const prevImg = document.createElement('img');
        prevImg.src = '/dist/images/media-step-backward-8x.png';
        prevImg.id = 'prev-image';
        this.addAsset(prevImg);
    }

    _addPlayPauseImageAssets() {
        const playImg = document.createElement('img');
        playImg.src = '/dist/images/media-play-8x.png';
        playImg.id = 'play-image';
        this.addAsset(playImg);

        const pauseImg = document.createElement('img');
        pauseImg.src = '/dist/images/media-pause-8x.png';
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

    // remove all elements specific to the scene
    clearSceneElements() {
        while (this.sceneElements.length > 0) {
            const el = this.sceneElements.pop();
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
        this._controlBar.setAttribute('width', '6');
        _iconCount = 0;
    }

    // Convert polar coordinates to cartesian ones, and apply offsets for device
    static polarToCartesian(phi: number, theta: number, radius: number): Object {
        const phiRad = ((phi - 90) / 180) * Math.PI;
        const thetaRad = (theta / 180) * Math.PI;
        const x = Math.cos(phiRad) * radius;
        const z = Math.sin(phiRad) * radius;
        const y = Math.sin(thetaRad) * radius; // * 1.6;
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
    // turns an html aframe string into an entity that can be added to the scene
    // returns the entity
    //
    // eslint-disable-next-line class-methods-use-this
    buildAframeComponents(objectSpecs: string): HTMLElement {
        const ent = document.createElement('a-entity');
        ent.id = 'addedExtras';
        ent.innerHTML = objectSpecs;
        return ent;
    }

    // toggle whether aFrame scene is visible
    setSceneHidden(visible: boolean) {
        // ANALYTICS
        if (_analytics) {
            _analytics({
                type: AnalyticEvents.types.RENDERER_ACTION,
                name: AnalyticEvents.names.VR_SCENE_TOGGLE_HIDDEN,
                from: visible ? 'visible' : 'hidden',
                to: visible ? 'hidden' : 'visible',
            });
        }
        this.aFrameSceneElement.style.height = visible ? '0px' : '100%';
    }

    // exit VR mode
    exitVR() {
        // ANALYTICS
        if (_analytics) {
            _analytics({
                type: AnalyticEvents.types.RENDERER_ACTION,
                name: AnalyticEvents.names.CHANGE_VR_MODE,
                from: 'vr',
                to: 'non-vr',
            });
        }
        this.aFrameSceneElement.exitVR();
    }

    // eslint-disable-next-line class-methods-use-this
    _logVrChange() {
        if (_analytics) {
            _analytics({
                type: AnalyticEvents.types.USER_ACTION,
                name: AnalyticEvents.names.CHANGE_VR_MODE,
                from: _vrMode ? 'non-vr' : 'vr',
                t0: _vrMode ? 'vr' : 'non-vr',
            });
        }
    }
}

const instance = new AFrameRenderer();
Object.seal(instance);

export default instance;
