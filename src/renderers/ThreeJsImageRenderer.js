// @flow

import Player from '../Player';
import ThreeJsBaseRenderer from './ThreeJsBaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import logger from '../logger';
import { RENDERER_PHASES } from './BaseRenderer';

const THREE = require('three');

const TIMER_INTERVAL = 100;

export default class ThreeJsVideoRenderer extends ThreeJsBaseRenderer {
    _fetchMedia: MediaFetcher;

    _imageTimer: ?IntervalID;

    _timeElapsed: number;

    _duration: number;

    _timedEvents: { [key: string]: Object };

    _disablePlayButton: Function;

    _disableScrubBar: Function;

    _enablePlayButton: Function;

    _enableScrubBar: Function;

    _imageMesh: THREE.Mesh;

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

        this._disablePlayButton = () => { this._player.disablePlayButton(); };
        this._enablePlayButton = () => { this._player.enablePlayButton(); };
        this._disableScrubBar = () => { this._player.disableScrubBar(); };
        this._enableScrubBar = () => { this._player.enableScrubBar(); };
        this._timeElapsed = 0;
        this._duration = Infinity;
        this._timedEvents = {};
    }

    async init() {
        try {
            await this.renderImageElement();
            this._setPhase(RENDERER_PHASES.CONSTRUCTED);
        }
        catch(e) {
            logger.error(e, 'could not initiate 360 image renderer');
        }
    }

    start() {
        super.start();
        logger.info('Starting ThreeJs image');
        this._setPhase(RENDERER_PHASES.MAIN);
        this._showImage();
        if (this._representation.duration && this._representation.duration > 0){
            this._duration = this._representation.duration;
            this._timeElapsed = 0;
            // eslint-disable-next-line max-len
            logger.info(`360 Image representation ${this._representation.id} timed for ${this._representation.duration}s, starting now`);
        }
        if (this._representation.duration && this._representation.duration === 0) {
            this.complete();
        } else {
            this._setPhase(RENDERER_PHASES.MEDIA_FINISHED);
            this._startTimer();
        }
        this._disableScrubBar();
        this._disablePlayButton();
    }

    pause() {
        clearInterval(this._imageTimer);
    }

    _startTimer() {
        this._imageTimer = setInterval(() => {
            this._timeElapsed += TIMER_INTERVAL/1000;
            if (this._timeElapsed >= this._duration) {
                // eslint-disable-next-line max-len
                logger.info(`Image representation ${this._representation.id} completed timeout`);
                this.complete();
            }
            Object.keys(this._timedEvents).forEach((timeEventId) => {
                const { time, callback } = this._timedEvents[timeEventId];
                if (this._timeElapsed >= time){
                    delete this._timedEvents[timeEventId];
                    callback();
                }
            });
        }, TIMER_INTERVAL);
    }

    getCurrentTime(): Object {
        if (this._representation.duration && this._representation.duration > 0) {
            const timeObject = {
                timeBased: true,
                currentTime: this._timeElapsed,
                remainingTime: this._duration - this._timeElapsed,
            };
            return timeObject;
        }
        return super.getCurrentTime();
    }

    play(){
        this._startTimer();
    }

    addTimeEventListener(listenerId: string, time: number, callback: Function) {
        this._timedEvents[listenerId] = { time, callback };
    }

    deleteTimeEventListener(listenerId: string) {
        if (listenerId in this._timedEvents) {
            delete this._timedEvents[listenerId];
        }
    }

    end() {
        const needToEnd = super.end();
        if (!needToEnd) return false;

        this._setPhase(RENDERER_PHASES.ENDED);
        if (this._imageTimer){
            clearInterval(this._imageTimer);
        }
        this._timedEvents = {};
        return true;
    }

    _showImage() {
        this._scene.add(this._imageMesh);
        this._animate();
    }

    async renderImageElement() {
        // set image source
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(this._representation.asset_collections.foreground_id);
            if (fg.assets.image_src) {
                try {
                    const mediaUrl = await this._fetchMedia(fg.assets.image_src);
                    this.populateImageElement(mediaUrl)
                } catch(err) {
                    throw new Error('Could not resolve media source for 360 image');
                }
            } else {
                throw new Error('No image source for 360 image asset collectoin');
            }
        }
    }

    populateImageElement(mediaUrl: string) {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('');
        const texture = loader.load(mediaUrl);
        const material = new THREE.MeshBasicMaterial({ map: texture });

        const geometry = new THREE.SphereBufferGeometry(500, 60, 40);
        // invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale(-1, 1, 1);

        this._imageMesh = new THREE.Mesh(geometry, material);
    }
}
