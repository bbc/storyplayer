// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

import EventEmitter from 'events';
import uuid from 'uuid/v4';
import type { AssetCollection, MediaFetcher } from '../romper';
import Player from '../gui/Player';
import PlayoutEngine from '../playoutEngines/BasePlayoutEngine';
import { RENDERER_PHASES } from './BaseRenderer';
import logger from '../logger';

export default class BackgroundRenderer extends EventEmitter {
    _rendererId: string;

    _assetCollection: AssetCollection;

    _fetchMedia: MediaFetcher;

    _player: Player;

    _playoutEngine: PlayoutEngine;

    phase: string;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super();
        this._fetchMedia = mediaFetcher;
        this._rendererId = uuid();
        this._player = player;
        this._playoutEngine = player.playoutEngine;
        this._assetCollection = assetCollection;
        this._setPhase(RENDERER_PHASES.CONSTRUCTING);
        this.init();
    }

    async init() {
        // eslint-disable-next-line max-len
        throw new Error('Need to override this class to run async code and set renderer phase to CONSTRUCTED');
    }

    start() { 
        if (this.phase === RENDERER_PHASES.CONSTRUCTING) {
            setTimeout(() => this.start(), 100);
            return false;
        }
        return true;
    }

    end() {
        switch (this.phase) {
        case (RENDERER_PHASES.ENDED):
        case (RENDERER_PHASES.DESTROYED):
            return false;
        default:
            break;
        };
        return true;
    }

    cancelFade() { }

    fadeOut(duration: number) { }

    pauseFade() { }

    resumeFade() { }

    destroy() {
        if (this.phase === RENDERER_PHASES.DESTROYED) {
            return false;
        }
        if (this.phase !== RENDERER_PHASES.ENDED) {
            this.end();
        }
        return true;
    }

    _setPhase(phase: string) {
        logger.info(`Background Renderer ${this._rendererId}  in ${phase}`);
        this.phase = phase;
    }
}
