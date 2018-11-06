// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import logger from '../logger';
// @flowignore
import * as THREE from 'three';

const scene = new THREE.Scene();

export default class ThreeJsRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;
    _playEventListener: Function;
    _pauseEventListener: Function;
    _handlePlayPauseButtonClicked: Function;

    _threeJsDiv: HTMLDivElement;
    _videoElement: HTMLVideoElement;
    _scene: any;
    _camera: any;
    _texture: any;
    _threeRenderer: THREE.WebGLRenderer;
    render: Function;
    animate: Function;

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
        this._playEventListener = this._playEventListener.bind(this);
        this._pauseEventListener = this._pauseEventListener.bind(this);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this.animate = this.animate.bind(this);
        this.render = this.render.bind(this);
    }

    _endedEventListener() {
        logger.info('360 video ended');
        super.complete();
    }

    _playEventListener() {
        this._player.setPlaying(true);
    }

    _pauseEventListener() {
        this._player.setPlaying(false);
    }

    start() {
        super.start();
        logger.info(`Started: ${this._representation.id}`);
        this.renderVideoElement();
    }

    end() {
        this._videoElement.removeEventListener('ended', this._endedEventListener);
        this._videoElement.removeEventListener('play', this._playEventListener);
        this._videoElement.removeEventListener('pause', this._pauseEventListener);

        if (this._threeJsDiv.parentNode !== null) {
            this._target.removeChild(this._threeJsDiv);
        }

        // player.removeVolumeControl(this._representation.id);
        this._player.disconnectScrubBar();
        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        // player.removeListener(
        //     PlayerEvents.VOLUME_CHANGED,
        //     this._handleVolumeClicked,
        // );
        // player.removeListener(
        //     PlayerEvents.SUBTITLES_BUTTON_CLICKED,
        //     this._handleSubtitlesClicked,
        // );
    }

    renderVideoElement() {
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        this._fetchMedia(fg.assets.av_src)
                            .then((mediaUrl) => {
                                this.populateVideoElement(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Video not found');
                            });
                    }
                });
        }
    }

    populateVideoElement(mediaUrl: string) {
        this.init(mediaUrl);//MaryOculus.webm');
        this.startThreeSixtyVideo();

        /*
        const scene = new THREE.Scene();
        this._threeJsDiv = document.createElement('div');
        this._threeJsDiv.className = 'romper-video-element';
        this._target.appendChild(this._threeJsDiv);
        var camera = new THREE.PerspectiveCamera( 75, this._target.offsetWidth/this._target.offsetHeight, 0.1, 1000 );

        var renderer = new THREE.WebGLRenderer();
        renderer.setSize( this._target.offsetWidth, this._target.offsetHeight );
        this._threeJsDiv.appendChild( renderer.domElement );

        var geometry = new THREE.BoxGeometry( 1, 1, 1 );
        var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        var cube = new THREE.Mesh( geometry, material );
        scene.add( cube );

        camera.position.z = 5;

        var animate = function () {
            requestAnimationFrame( animate );

            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;

            renderer.render( scene, camera );
        };
        */
        this.animate();

        // this.startThreeSixtyVideo();
    }

    init(videoUrl: string) {

        this._threeJsDiv = document.createElement('div');
        this._threeJsDiv.className = 'romper-video-element';
        this._target.appendChild(this._threeJsDiv);

        var container = this._threeJsDiv;
    
        this._camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 2000 );
        this._camera.layers.enable( 1 ); // render left view when no stereo available

        // video

        this._videoElement = document.createElement( 'video' );
        this._videoElement.crossOrigin = 'anonymous';
        // this._videoElement.loop = true;
        // this._videoElement.muted = true;
        this._videoElement.src = videoUrl;
        this._videoElement.setAttribute( 'webkit-playsinline', 'webkit-playsinline' );
        this._videoElement.play();

        this._texture = new THREE.Texture( this._videoElement );
        this._texture.generateMipmaps = false;
        this._texture.minFilter = THREE.NearestFilter;
        this._texture.maxFilter = THREE.NearestFilter;
        this._texture.format = THREE.RGBFormat;

        setInterval( () => {
            if ( this._videoElement.readyState >= this._videoElement.HAVE_CURRENT_DATA ) {
                this._texture.needsUpdate = true;
            }
        }, 1000 / 24 );
        this._scene = new THREE.Scene();
        scene.background = new THREE.Color( 0x101010 );

        // left

        var geometry = new THREE.SphereBufferGeometry( 500, 60, 40 );
        // invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale( - 1, 1, 1 );

        var uvs = geometry.attributes.uv.array;

        for ( var i = 0; i < uvs.length; i += 2 ) {

            uvs[ i ] *= 0.5;

        }

        var material = new THREE.MeshBasicMaterial( { map: this._texture } );

        var mesh = new THREE.Mesh( geometry, material );
        mesh.rotation.y = - Math.PI / 2;
        mesh.layers.set( 1 ); // display in left eye only
        scene.add( mesh );

        // right

        var geometry = new THREE.SphereBufferGeometry( 500, 60, 40 );
        geometry.scale( - 1, 1, 1 );

        var uvs = geometry.attributes.uv.array;

        for ( var i = 0; i < uvs.length; i += 2 ) {

            uvs[ i ] *= 0.5;
            uvs[ i ] += 0.5;

        }

        var material = new THREE.MeshBasicMaterial( { map: this._texture } );

        var mesh = new THREE.Mesh( geometry, material );
        mesh.rotation.y = - Math.PI / 2;
        mesh.layers.set( 2 ); // display in right eye only
        scene.add( mesh );

        //

        this._threeRenderer = new THREE.WebGLRenderer();
        this._threeRenderer.setPixelRatio( this._target.offsetWidth/this._target.offsetHeight );
        this._threeRenderer.setSize( this._target.offsetWidth, this._target.offsetHeight );
        this._threeRenderer.vr.enabled = true;
        container.appendChild( this._threeRenderer.domElement );

        // container.appendChild( WEBVR.createButton( this._threeRenderer, { frameOfReferenceType: 'head-model' } ) );

        window.addEventListener( 'resize', () => {
            this._camera.aspect = this._target.offsetWidth/this._target.offsetHeight;
            console.log('resize', this._target.offsetWidth, this._target.offsetHeight);
            this._camera.updateProjectionMatrix();
            this._threeRenderer.setSize( this._target.offsetWidth, this._target.offsetHeight );
        }, false );

    }

    animate() {
        this._threeRenderer.setAnimationLoop( this.render );
    }

    render() {
        this._threeRenderer.render( scene, this._camera );
    }

    startThreeSixtyVideo() {
        this._player.connectScrubBar(this._videoElement);
        this._player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        // automatically move on at video end
        this._videoElement.addEventListener('play', this._playEventListener);
        this._videoElement.addEventListener('pause', this._pauseEventListener);
        this._videoElement.addEventListener('ended', this._endedEventListener);
        logger.info('360 video playing');
        this._videoElement.play();
     }

    _handlePlayPauseButtonClicked(): void {
        if (this._videoElement.paused === true) {
            this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            this._videoElement.play();
        } else {
            this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            this._videoElement.pause();
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
        super.destroy();
    }
}
