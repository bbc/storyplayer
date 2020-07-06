// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

import EventEmitter from 'events';
import uuid from 'uuid/v4';
import type { AssetCollection, MediaFetcher } from '../romper';
import Player from '../Player';
import PlayoutEngine from '../playoutEngines/BasePlayoutEngine';
import { RENDERER_PHASES } from './BaseRenderer';

export default class BackgroundRenderer extends EventEmitter {
    _rendererId: string;

    _assetCollection: AssetCollection;

    _fetchMedia: MediaFetcher;

    _player: Player;

    _playoutEngine: PlayoutEngine;

    _disabled: boolean;

    phase: string;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super();
        this.phase = RENDERER_PHASES.CONSTRUCTING;
        this._fetchMedia = mediaFetcher;
        this._rendererId = uuid();
        this._player = player;
        this._playoutEngine = player.playoutEngine;
        this._assetCollection = assetCollection;
        this._disabled = false;
    }

    async init() {
        // TODO: use init and phases in background renderers
        // throw new Error('Need to override this class to run async code and set renderer phase to CONSTRUCTED');
        this.phase = RENDERER_PHASES.CONSTRUCTED;
    }

    start() { }

    end() { }

    cancelFade() { }

    fadeOut(duration: number) { }

    pauseFade() { }

    resumeFade() { }

    destroy() {
        this._disabled = true;
    }
}
