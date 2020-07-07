// @flow

import Player from '../Player';
import TimedMediaRenderer from './TimedMediaRenderer';
import { RENDERER_PHASES } from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

import { MediaFormats } from '../browserCapabilities';
import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
import { VIDEO } from '../utils';

import logger from '../logger';

export default class SimpleAVRenderer extends TimedMediaRenderer {
    _fetchMedia: MediaFetcher;

    _applyBlurBehaviour: Function;


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

        // eslint-disable-next-line max-len
        this._behaviourRendererMap['urn:x-object-based-media:representation-behaviour:blur/v1.0'] = this._applyBlurBehaviour;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_AV,
        });
    }

    async init() {
        try {
            await this.queueVideoElement();
            this.phase = RENDERER_PHASES.CONSTRUCTED;
        }
        catch(e) {
            logger.error(e, 'could not initiate video renderer');
            // TODO: need to work out how we handle these
            // if this renderer is used, it will break the experience
            // might get away with it if this is in a branch that isn't taken
        }
    }

    async queueVideoElement() {
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(
                this._representation.asset_collections.foreground_id,
            );
            this._testShowScrubBar(fg);
            if (fg.assets.av_src) {
                if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                    this._setInTime(parseFloat(fg.meta.romper.in));
                }
                if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                    this._setOutTime(parseFloat(fg.meta.romper.out));
                }
                const options = { mediaFormat: MediaFormats.getFormat(), mediaType: VIDEO };
                try {
                    const mediaUrl = await this._fetchMedia(fg.assets.av_src, options);
                    let appendedUrl = mediaUrl;
                    if (this._inTime > 0 || this._outTime > 0) {
                        let mediaFragment = `#t=${this._inTime}`;
                        if (this._outTime > 0) {
                            mediaFragment = `${mediaFragment},${this._outTime}`;
                        }
                        appendedUrl = `${mediaUrl}${mediaFragment}`;
                    }
                    this.populateVideoElement(appendedUrl, fg.loop, fg.id);
                }
                catch(err) {
                    logger.error(err, 'Video not found');
                    throw new Error('Video not found');
                }
            } else {
                throw new Error('No av source for video');
            }
            if (fg.assets.sub_src) {
                this._fetchMedia(fg.assets.sub_src)
                    .then((mediaUrl) => {
                        this.populateVideoSubs(mediaUrl);
                    })
                    .catch((err) => {
                        logger.error(err, 'Subs not found');
                    });
            }
        } else {
            throw new Error('No foreground asset id for video');
        }
    }

    populateVideoElement(mediaUrl: string, loop :?boolean, id: ?string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                url: mediaUrl,
                loop,
                id,
                inTime: this._inTime,
            });
        }
    }

    populateVideoSubs(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                subs_url: mediaUrl,
            });
        }
    }

    _applyBlurBehaviour(behaviour: Object, callback: () => mixed) {
        const { blur } = behaviour;
        this._playoutEngine.applyStyle(this._rendererId, "filter", `blur(${blur}px)`)
        callback();
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    _clearBehaviourElements() {
        super._clearBehaviourElements();
        this._playoutEngine.clearStyle(this._rendererId, "filter")
    }
}
