// @flow

import Player from '../Player';
import ThreeJsBaseRenderer from './ThreeJsBaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import logger from '../logger';

const THREE = require('three');

export default class ThreeJsVideoRenderer extends ThreeJsBaseRenderer {
    _fetchMedia: MediaFetcher;

    _imageElement: HTMLImageElement;

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

        this.renderImageElement();
    }

    start() {
        super.start();
        logger.info('Starting ThreeJs image');
        if(this._rendered) {
            this._showImage();
        }
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
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.image_src) {
                        this._fetchMedia(fg.assets.image_src)
                            .then(mediaUrl =>
                                this.populateImageElement(mediaUrl)
                            )
                            .catch((err) => {
                                logger.error(err, 'Video not found');
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
