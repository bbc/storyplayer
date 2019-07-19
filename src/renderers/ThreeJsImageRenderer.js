// @flow

import Player from '../Player';
import ThreeJsBaseRenderer from './ThreeJsBaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import logger from '../logger';

const THREE = require('three');

const TIMER_INTERVAL = 100;

export default class ThreeJsVideoRenderer extends ThreeJsBaseRenderer {
    _fetchMedia: MediaFetcher;

    _imageElement: HTMLImageElement;

    _imageTimer: ?IntervalID;

    _timeRemaining: number;

    _disablePlayButton: Function;

    _enablePlayButton: Function;

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
        this.renderImageElement();
    }

    start() {
        super.start();
        logger.info('Starting ThreeJs image');
        if (this._rendered) {
            this._showImage();
        }
        if (this._representation.duration && this._representation.duration > 0){
            this._timeRemaining = this._representation.duration * 1000;
            // eslint-disable-next-line max-len
            logger.info(`Image representation ${this._representation.id} timed for ${this._representation.duration}s, starting now`);
            this._startTimer();
        } else if (this._representation.duration && this._representation.duration === 0) {
            this.complete();
        }
        this._disablePlayButton();
    }

    pause() {
        // if timed image, pause timeout
        if (this._timeRemaining > 0) {
            clearInterval(this._imageTimer);
        }
    }

    _startTimer() {
        this._imageTimer = setInterval(() => {
            this._timeRemaining -= TIMER_INTERVAL;
            if (this._timeRemaining <= 0) {
                // eslint-disable-next-line max-len
                logger.info(`Image representation ${this._representation.id} completed timeout`);
                this.complete();
            }
        }, TIMER_INTERVAL);
    }

    getCurrentTime(): Object {
        if (this._representation.duration && this._representation.duration > 0) {
            const timeObject = {
                timeBased: true,
                currentTime: this._representation.duration,
                remainingTime: this._timeRemaining,
            };
            return timeObject;
        }
        return super.getCurrentTime();
    }

    play(){
        // if timed image, resume timeout
        if (this._timeRemaining > 0){
            this._startTimer();
        }
    }

    end() {
        super.end();
        if (this._imageTimer){
            clearInterval(this._imageTimer);
        }
        this._enablePlayButton();
    }

    _showImage() {
        const texture = new THREE.TextureLoader().load(this._imageElement.src);
        const material = new THREE.MeshBasicMaterial({ map: texture });

        const geometry = new THREE.SphereBufferGeometry(500, 60, 40);
        // invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale(-1, 1, 1);

        const mesh = new THREE.Mesh(geometry, material);
        this._scene.add(mesh);

        this._animate();
    }

    renderImageElement() {
        // set image source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        this._fetchMedia(fg.assets.image_src)
                            .then(mediaUrl =>
                                this.populateImageElement(mediaUrl)
                            )
                            .catch((err) => {
                                logger.error(err, 'Image not found');
                            });
                    }
                });
        }
    }

    populateImageElement(mediaUrl: string) {
        this._imageElement = document.createElement('img');
        this._imageElement.src = mediaUrl;
        this._rendered = true;
        if(this._started) {
            this._showImage();
        }
    }
}
