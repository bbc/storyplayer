// @flow

import Player from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import logger from '../logger';

const THREE = require('three');

const ORIENTATION_POLL_INTERVAL = 2000;
const RETICLE_RADIUS = 15;

export type ThreeIcon = {
    iconPlane: THREE.Mesh,
    viewCount: number,
};

export default class ThreeJsBaseRenderer extends BaseRenderer {
    _setOrientationVariable: Function;

    _onMouseDown: Function;

    _onMouseMove: Function;

    _onMouseUp: Function;

    _orientationWatcher: ?IntervalID;

    _initialRotation: string;

    _view: Object;

    _userInteracting: boolean;

    _userDragging: boolean;

    _hasEnded: boolean;

    _started: boolean;

    _rendered: boolean;

    _domElement: HTMLElement;

    _sceneReticle: THREE.Mesh;

    _oldOrientation: Object;

    _scene: THREE.Scene;

    _update: Function;

    _icons: {[key:string]: ThreeIcon};

    _readyToShowIcons: boolean;

    _raycaster: THREE.Raycaster;

    _camera: THREE.PerspectiveCamera;

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
        this._setOrientationVariable = this._setOrientationVariable.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);

        this._orientationWatcher = null;

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
        this._userDragging = false;

        this._icons = {};
        this._readyToShowIcons = false;
        this._raycaster = new THREE.Raycaster();
    }

    start() {
        super.start();
        logger.info(`Started: ${this._representation.id}`);
        this._hasEnded = false;
        this._started = true;
        this._createScene();
    }

    _addReticle() {
        const reticleGeometry = new THREE.CircleGeometry( 1, 32 );
        const materialSpec = {
            color: 0x37566a,
            transparent: true,
            opacity: 0.8,
        };
        const material = new THREE.MeshBasicMaterial(materialSpec);

        this._sceneReticle = new THREE.Mesh(reticleGeometry, material);
        const vphi = Math.PI / 2;
        const vtheta = 0;
        const xpos = RETICLE_RADIUS * Math.sin(vphi) * Math.cos(vtheta);
        const ypos = RETICLE_RADIUS * Math.cos(vphi);
        const zpos = RETICLE_RADIUS * Math.sin(vphi) * Math.sin(vtheta);
        this._sceneReticle.rotateY((1.5 * Math.PI) - vtheta);
        this._sceneReticle.position.set(xpos, ypos, zpos);
        this._scene.add( this._sceneReticle );
    }

    _positionReticle(phi: number, theta: number) {
        const xpos = RETICLE_RADIUS * Math.sin(phi) * Math.cos(theta);
        const ypos = RETICLE_RADIUS * Math.cos(phi);
        const zpos = RETICLE_RADIUS * Math.sin(phi) * Math.sin(theta);
        this._sceneReticle.rotation.y = (1.5 * Math.PI) - theta;
        this._sceneReticle.position.set(xpos, ypos, zpos);
    }

    _createScene() {
        // maintain view direction
        this._applyPreviousOrientation();

        const target = this._player.mediaTarget;
        logger.info('Starting 3js video scene');
        this._scene = new THREE.Scene();
        this._camera = new THREE.PerspectiveCamera(75, 16/9, 1, 1000);
        this._camera.layers.enable(1); // render left view when no stereo available
        this._camera.target = new THREE.Vector3(0, 0, 0);

        const webGlRenderer = new THREE.WebGLRenderer();
        webGlRenderer.setPixelRatio(window.devicePixelRatio);

        this._domElement = webGlRenderer.domElement;
        this._domElement.classList.add('romper-threejs');

        this._addReticle();

        const uiLayer = this._player._overlays;
        uiLayer.addEventListener('mousedown', this._onMouseDown, false);
        uiLayer.addEventListener('mouseup', this._onMouseUp, false);
        uiLayer.addEventListener('mousemove', this._onMouseMove, false);
        uiLayer.addEventListener('mouseout', this._onMouseUp, false);

        target.appendChild(this._domElement);
        webGlRenderer.setSize(1600, 900);

        this._update = () => {
            const lat = Math.max(-85, Math.min(85, this._view.lat));
            const phi = THREE.Math.degToRad(90 - lat);
            const theta = THREE.Math.degToRad(this._view.lon);
            const viewTarget = new THREE.Vector3(
                this._view.distance * Math.sin(phi) * Math.cos(theta),
                this._view.distance * Math.cos(phi),
                this._view.distance * Math.sin(phi) * Math.sin(theta),
            );
            this._positionReticle(phi, theta);
            this._camera.lookAt( viewTarget );
            webGlRenderer.render( this._scene, this._camera );
            this._testIfViewingIcon();
        };
    }

    // retrieve previous lat and long values from the variable store and apply
    _applyPreviousOrientation() {
        this._controller.getVariableValue('_threejs_orientation_lon')
            .then((lon) => {
                if (lon !== null) {
                    logger.info(`Maintaining 360 orientation at ${lon} longitude`);
                    this._view.lon = lon; 
                }
            });
        this._controller.getVariableValue('_threejs_orientation_lat')
            .then((lat) => { 
                if (lat !== null) {
                    logger.info(`Maintaining 360 orientation at ${lat} latitude`);
                    this._view.lat = lat;
                }
            });
    }

    _animate() {
        const animate = () => {
            requestAnimationFrame(animate);
            this._update();
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
        this._userDragging = false;
        this._view.onPointerDownPointerX = event.clientX;
        this._view.onPointerDownPointerY = event.clientY;
        this._view.onPointerDownLon = this._view.lon;
        this._view.onPointerDownLat = this._view.lat;
    }

    _onMouseMove(event: MouseEvent) {
        if (this._userInteracting) {
            this._userDragging = true;
            this._view.lon = (this._view.onPointerDownPointerX - event.clientX) * 0.1 + this._view.onPointerDownLon; // eslint-disable-line max-len
            this._view.lon = (360 + this._view.lon) % 360;
            this._view.lat = (event.clientY - this._view.onPointerDownPointerY) * 0.1 + this._view.onPointerDownLat; // eslint-disable-line max-len
        }
    }

    _onMouseUp(event: MouseEvent) {
        this._userInteracting = false;
        if (this._userDragging) {
            return;
        }
        const vector = new THREE.Vector3(
            (event.offsetX/this._domElement.clientWidth) * 2 - 1,
            -(event.offsetY/this._domElement.clientHeight) * 2 + 1,
            0.5,
        );
        const raycaster = new THREE.Raycaster();
        // @flowignore
        const icons = Object.values(this._icons).map(i => i.iconPlane);
        raycaster.setFromCamera(vector, this._camera);

        const intersects = raycaster.intersectObjects(icons);
        if (intersects.length > 0) {
            const firstIntersectObject = intersects[0].object;
            Object.keys(this._icons).forEach((targetId) => {
                const iconObj = this._icons[targetId];
                // const { iconPlane } = iconObj;
                if (iconObj && firstIntersectObject === iconObj.iconPlane) {
                    logger.info(`User has clicked icon for ${targetId} - following link`);
                    this._followLink(targetId);
                }
            });
        }
    }

    _testIfViewingIcon() {
        const origin = new THREE.Vector3(0, 0, 0);
        const target = new THREE.Vector3(0, 0, 0);
        this._camera.getWorldDirection(target);
        this._raycaster.set(origin, target);

        // @flowignore
        const icons = Object.values(this._icons).map(i => i.iconPlane);
        const intersects = this._raycaster.intersectObjects(icons);
        if (intersects.length > 0) {
            this._sceneReticle.visible = true;
            const intersectObjects = intersects.map(i => i.object);
            Object.keys(this._icons).forEach((targetId) => {
                const iconObj = this._icons[targetId];
                const { iconPlane } = iconObj;
                if (intersectObjects.includes(iconPlane)) {
                    iconObj.viewCount += 1;
                    const scale = 1 - (iconObj.viewCount / 50);
                    this._sceneReticle.scale.set(scale, scale, scale);
                } else {
                    iconObj.viewCount = 0;
                }
                if (iconObj.viewCount > 50) {
                    logger.info(`User has viewed icon for ${targetId} for 2s - following link`);
                    this._followLink(targetId);
                    iconObj.viewCount = 0;
                }
            });
        } else {
            this._sceneReticle.visible = false;
            this._sceneReticle.scale.set(1, 1, 1);
            Object.keys(this._icons).forEach((targetId) => {
                const iconObj = this._icons[targetId];
                iconObj.viewCount = 0;
            });
        }
    }

    _setOrientationVariable(): void {
        const { lat, lon } = this._view;
        const phi = parseInt(lon, 10);
        const theta = parseInt(lat, 10);

        if (phi === this._oldOrientation.phi && theta === this._oldOrientation.theta) {
            return;
        }

        const oldOrientationString = `${this._oldOrientation.phi}, ${this._oldOrientation.theta}`;
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
            from: oldOrientationString,
            to: `${phi} ${theta}`,
        };
        this._analytics(logData);
    }

    _addIcon(iconSrc: string, position: Object, size: Object, targetId: string) {
        const { lat, long, radius } = position;
        const { width, height } = size;
        logger.info(`Adding threejs icon for ${targetId}, src ${iconSrc}, at (${lat}, ${long})`);

        const vphi = THREE.Math.degToRad(90 - lat);
        const vtheta = THREE.Math.degToRad(long);
        const xpos = radius * Math.sin(vphi) * Math.cos(vtheta);
        const ypos = radius * Math.cos(vphi);
        const zpos = radius * Math.sin(vphi) * Math.sin(vtheta);

        const bmLoader = new THREE.ImageBitmapLoader();
        const geometry = new THREE.PlaneGeometry( width, height );
        bmLoader.load(iconSrc, (imageBitmap) => {
            const imTexture = new THREE.CanvasTexture( imageBitmap );
            const imMaterial = new THREE.MeshBasicMaterial( { map: imTexture } );
            const iconPlane = new THREE.Mesh( geometry, imMaterial );
            iconPlane.rotateY((1.5*Math.PI)-vtheta);
            iconPlane.position.set(xpos, ypos, zpos);
            this._icons[targetId] = {
                iconPlane,
                viewCount: 0,
            };
            if(this._readyToShowIcons) {
                this._scene.add(iconPlane);
            }
        });
    }

    _showChoiceIcons(iconDataObject: Object) {
        super._showChoiceIcons(iconDataObject);
        this._readyToShowIcons = true;
        Object.keys(this._icons).forEach((targetId) => {
            const { iconPlane } = this._icons[targetId];
            if (!this._scene.children.includes(iconPlane)) {
                this._scene.add(iconPlane);
            }
        });
    }

    _hideChoiceIcons(narrativeElementId: ?string) {
        super._hideChoiceIcons(narrativeElementId);
        Object.keys(this._icons).forEach((targetId) => {
            const { iconPlane } = this._icons[targetId];
            if (this._scene.children.includes(iconPlane)) {
                this._scene.remove(iconPlane);
            }
        });
        this._icons = {};
    }

    end() {
        // only if this is being rendered
        if (this._started) {
            this._player.getLinkChoiceElement()[0].style.visibility = 'visible';
        }

        if (this._domElement && this._domElement.parentNode) {
            this._domElement.parentNode.removeChild(this._domElement);
        }

        this._icons = {};
        this._readyToShowIcons = false;

        // remove drag view handler
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
        super.destroy();
    }
}
