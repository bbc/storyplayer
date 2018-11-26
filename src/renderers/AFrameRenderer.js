// @flow

import AFRAME from 'aframe';
import dynamicAudio from 'dynamicaudio';

import logger from '../logger';

let componentRegistered = false;

export default class AFrameRenderer {
    static aFrameSceneElement: any;
    static _aFrameAssetsElement: HTMLElement;
    static _aFrameCamera: any;

    // build vanilla aFrame infrastructure
    // these would need to persist across NEs for continuous headset playback
    static buildBaseAframeScene() {
        if (AFrameRenderer.aFrameSceneElement) {
            return;
        }

        AFrameRenderer._registerAframeComponents();

        // scene
        AFrameRenderer.aFrameSceneElement = document.createElement('a-scene');
        AFrameRenderer.aFrameSceneElement.id = 'romperascene';
        AFrameRenderer.aFrameSceneElement.setAttribute('embedded', '');
        AFrameRenderer.aFrameSceneElement.classList.add('romper-aframe-scene');

        // camera
        const cameraEntity = document.createElement('a-entity');
        cameraEntity.id = 'romper-camera-entity';
        cameraEntity.setAttribute('position', '0 0 0');
        cameraEntity.setAttribute('rotation', '0 0 0');
        AFrameRenderer._aFrameCamera = document.createElement('a-camera');
        cameraEntity.appendChild(AFrameRenderer._aFrameCamera);
        AFrameRenderer.aFrameSceneElement.appendChild(cameraEntity);

        // assets (add our video div)
        AFrameRenderer._aFrameAssetsElement = document.createElement('a-assets');
        AFrameRenderer.aFrameSceneElement.appendChild(AFrameRenderer._aFrameAssetsElement);

        AFrameRenderer.aFrameSceneElement.addEventListener('renderstart', () =>
            AFrameRenderer.aFrameSceneElement.camera.layers.enable(1));
    }

    static addAFrameToRenderTarget(target: HTMLElement) {
        if (AFrameRenderer.aFrameSceneElement.parentNode !== target) {
            target.appendChild(AFrameRenderer.aFrameSceneElement);
        }
    }

    static addAsset(assetElement: HTMLElement) {
        AFrameRenderer._aFrameAssetsElement.appendChild(assetElement);
    }

    static addElementToScene(sceneElement: HTMLElement) {
        if (sceneElement.parentNode !== AFrameRenderer.aFrameSceneElement) {
            AFrameRenderer.aFrameSceneElement.appendChild(sceneElement);
        }
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
                logger.info('AFrame registering spatial audio component');
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

    // createa bunch of aFrame components, maybe from Data model?
    static buildAframeComponents(objectSpecs: string): HTMLElement {
        const ent = document.createElement('a-entity');
        ent.id = 'addedExtras';
        ent.innerHTML = objectSpecs;
        return ent;
    }

    static setSceneHidden(visible: boolean) {
        AFrameRenderer.aFrameSceneElement.style.height = visible ? '0px' : '100%';
    }

    static exitVR() {
        AFrameRenderer.aFrameSceneElement.exitVR();
        AFrameRenderer.aFrameSceneElement.style.height = '0px';
    }
}
