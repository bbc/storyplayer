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

export default class ThreeJsBaseRenderer extends BaseRenderer {
    _setOrientationVariable: Function;

    _onMouseDown: Function;

    _onMouseMove: Function;

    _onMouseUp: Function;

    _orientationWatcher: ?IntervalID;

    _initialRotation: string;

    _view: Object;

    _userInteracting: boolean;

    _hasEnded: boolean;

    _started: boolean;

    _rendered: boolean;

    _domElement: HTMLElement;

    _oldOrientation: Object;

    _scene: THREE.Scene;

    _update: Function;

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
    }

    start() {
        super.start();
        logger.info(`Started: ${this._representation.id}`);
        this._hasEnded = false;
        this._started = true;
        this._createScene();
    }

    _createScene() {
        const target = this._player.mediaTarget;
        logger.info('Starting 3js video scene');
        this._scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 16/9, 1, 1000);
        camera.layers.enable(1); // render left view when no stereo available
        camera.target = new THREE.Vector3(0, 0, 0);

        const webGlRenderer = new THREE.WebGLRenderer();
        webGlRenderer.setPixelRatio(window.devicePixelRatio);

        // const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        // const texture = new THREE.VideoTexture(videoElement);
        // const material = new THREE.MeshBasicMaterial({ map: texture });

        // const geometry = new THREE.SphereBufferGeometry(500, 60, 40);
        // // invert the geometry on the x-axis so that all of the faces point inward
        // geometry.scale(-1, 1, 1);

        // const mesh = new THREE.Mesh(geometry, material);
        // scene.add(mesh);

        this._domElement = webGlRenderer.domElement;
        this._domElement.classList.add('romper-threejs');

        const uiLayer = this._player._overlays;
        uiLayer.addEventListener('mousedown', this._onMouseDown, false);
        uiLayer.addEventListener('mouseup', this._onMouseUp, false);
        uiLayer.addEventListener('mousemove', this._onMouseMove, false);

        target.appendChild(this._domElement);
        webGlRenderer.setSize(1600, 900);

        this._playoutEngine.setPlayoutActive(this._rendererId);

        this._update = () => {
            const lat = Math.max(-85, Math.min(85, this._view.lat));
            const phi = THREE.Math.degToRad(90 - lat);
            const theta = THREE.Math.degToRad(this._view.lon);
            camera.position.x = this._view.distance * Math.sin(phi) * Math.cos(theta);
            camera.position.y = this._view.distance * Math.cos(phi);
            camera.position.z = this._view.distance * Math.sin(phi) * Math.sin(theta);
            camera.lookAt( camera.target );

            webGlRenderer.render( this._scene, camera );
        };
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

    end() {
        // only if this is being rendered
        if (this._started) {
            this._player.getLinkChoiceElement().style.visibility = 'visible';
        }

        if (this._domElement && this._domElement.parentNode) {
            this._domElement.parentNode.removeChild(this._domElement);
        }

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
