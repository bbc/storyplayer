// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

import EventEmitter from 'events';
import uuid from 'uuid/v4';
import type { AssetCollection, MediaFetcher } from '../romper';
import Player from '../Player';
import PlayoutEngine from '../playoutEngines/BasePlayoutEngine';

export const FADE_OUT_TIME = 2000; // time over which audio fades in ms

export default class BackgroundRenderer extends EventEmitter {
    _rendererId: string;
    _assetCollection: AssetCollection;
    _fetchMedia: MediaFetcher;
    _player: Player;
    _playoutEngine: PlayoutEngine;
    _disabled: boolean;

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
        this._disabled = false;
    }

    start() { }

    cancelFade() { }

    fadeOut(timeRemaining: number) { }

    pauseFade() { }

    resumeFade() { }

    destroy() {
        this._disabled = true;
    }
}
