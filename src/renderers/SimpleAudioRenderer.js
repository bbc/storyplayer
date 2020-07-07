// @flow

// import Player from '../Player';
import TimedMediaRenderer from './TimedMediaRenderer';
import { RENDERER_PHASES } from './BaseRenderer';
import type { MediaFetcher } from '../romper';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';

import logger from '../logger';

export default class SimpleAudioRenderer extends TimedMediaRenderer {
    _fetchMedia: MediaFetcher;

    _backgroundImage: ?HTMLElement;

    async init() {
        try {
            await Promise.all([
                this._queueMedia({ type: MEDIA_TYPES.FOREGROUND_A }, "audio_src"),
                this._renderBackgroundImage(),
            ]);
            this.phase = RENDERER_PHASES.CONSTRUCTED;
        } catch(e) {
            logger.error(e, 'could not initiate audio renderer');
        }
    }

    async _renderBackgroundImage() {
        // eslint-disable-next-line max-len
        logger.info(`Rendering background image for audio representation ${this._representation.id}`);
        if (this._representation.asset_collections.background_image) {
            try {
                const assetCollectionId = this._representation.asset_collections.background_image;
                const image = await this._fetchAssetCollection(assetCollectionId);
                if (image.assets.image_src) {
                    const imageUrl = await this._fetchMedia(image.assets.image_src);
                    this._backgroundImage = document.createElement('img');
                    this._backgroundImage.className = 'romper-render-image';
                    this._backgroundImage.src = imageUrl;
                    if (this.phase !== RENDERER_PHASES.MAIN) {
                        this._setImageVisibility(false);
                    } else {
                        this._setImageVisibility(true);
                    }
                    this._target.appendChild(this._backgroundImage);
                }
            } catch (err) {
                logger.error(err, 'Background image not found');
            }
        }
    }

    start() {
        super.start();
        this._setImageVisibility(true);
    }

    end() {
        const needToEnd = super.end();
        if (!needToEnd) return false;

        this._setImageVisibility(false);
        return true;
    }

    // show/hide the background image
    _setImageVisibility(visible: boolean) {
        if (this._backgroundImage) this._backgroundImage.style.opacity = visible ? '1' : '0';
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    destroy() {
        const needToDestroy = super.destroy();
        if(!needToDestroy) return false;

        if (this._backgroundImage) this._target.removeChild(this._backgroundImage);
        return true;
    }
}
