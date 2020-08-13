// @flow

import Player from '../gui/Player';
import TimedMediaRenderer from './TimedMediaRenderer';
import { RENDERER_PHASES } from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';

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
    }

    async init() {
        try {
            await this._queueMedia({ type: MEDIA_TYPES.FOREGROUND_AV }, "av_src");
            this._setPhase(RENDERER_PHASES.CONSTRUCTED);
        }
        catch(e) {
            logger.error(e, 'could not initiate video renderer');
            // TODO: need to work out how we handle these
            // if this renderer is used, it will break the experience
            // might get away with it if this is in a branch that isn't taken
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
