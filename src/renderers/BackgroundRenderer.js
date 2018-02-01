// @flow


import EventEmitter from 'events';
import type { AssetCollection, MediaFetcher } from '../romper';
import Player from '../Player';

export default class BackgroundRenderer extends EventEmitter {
    _assetCollection: AssetCollection;
    _fetchMedia: MediaFetcher;
    _player: Player;
    _disabled: boolean;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super();
        this._fetchMedia = mediaFetcher;
        this._player = player;
        this._assetCollection = assetCollection;
        this._disabled = false;
    }

    // eslint-disable-next-line class-methods-use-this
    start() { }

    destroy() {
        this._disabled = true;
    }
}
