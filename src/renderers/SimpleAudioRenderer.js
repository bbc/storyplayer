// @flow

import Player from '../Player';
import TimedMediaRenderer from './TimedMediaRenderer';
import { RENDERER_PHASES } from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

import { MediaFormats } from '../browserCapabilities';
import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
import { AUDIO } from '../utils';

import logger from '../logger';

export default class SimpleAudioRenderer extends TimedMediaRenderer {
    _fetchMedia: MediaFetcher;

    _backgroundImage: ?HTMLElement;

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
        
        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_A,
            id: this._representation.asset_collections.foreground_id,
        });
    }

    async init() {
        try {
            await Promise.all([
                this._renderAudioElement(),
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

    async _renderAudioElement() {
        // set audio source
        if (this._representation.asset_collections.foreground_id) {
            try {
                const fg = await this._fetchAssetCollection(
                    this._representation.asset_collections.foreground_id);
                if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                    this._setInTime(parseFloat(fg.meta.romper.in));
                }
                if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                    this._setOutTime(parseFloat(fg.meta.romper.out));
                }
                if (fg.assets.audio_src) {
                    this._fetchMedia(fg.assets.audio_src, {
                        mediaFormat: MediaFormats.getFormat(),
                        mediaType: AUDIO
                    })
                        .then((mediaUrl) => {
                            this.populateAudioElement(mediaUrl, fg.loop);
                        })
                        .catch((err) => {
                            logger.error(err, 'audio not found');
                        });
                }
                if (fg.assets.sub_src) {
                    this._fetchMedia(fg.assets.sub_src)
                        .then((mediaUrl) => {
                            this.populateAudioSubs(mediaUrl);
                        })
                        .catch((err) => {
                            logger.error(err, 'Subs not found');
                            // this._subtitlesExist = false;
                        });
                } else {
                    // this._subtitlesExist = false;
                }
            } catch (err) {
                throw new Error('Could not get audio assets');
            }
        } else {
            throw new Error('No foreground asset collection for audio representation');
        }
    }

    // show/hide the background image
    _setImageVisibility(visible: boolean) {
        if (this._backgroundImage) this._backgroundImage.style.opacity = visible ? '1' : '0';
    }

    populateAudioElement(mediaUrl: string, loop: ?boolean) {
        if (this._destroyed) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                url: mediaUrl,
                loop,
            });
        }
    }

    // eslint-disable-next-line
    populateAudioSubs(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                subs_url: mediaUrl,
            });
        }
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
