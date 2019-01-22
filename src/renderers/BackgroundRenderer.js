// @flow
/* eslint-disable class-methods-use-this */

import EventEmitter from 'events';
import uuid from 'uuid/v4';
import type { AssetCollection, MediaFetcher } from '../romper';
import Player from '../Player';
import PlayoutEngine from '../playoutEngines/BasePlayoutEngine';

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

    // eslint-disable-next-line no-unused-vars
    setFade(fade: boolean, timeRemaining: ?number) { }

    destroy() {
        this._disabled = true;
    }
}
