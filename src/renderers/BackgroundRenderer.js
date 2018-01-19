// @flow
/* eslint-disable class-methods-use-this */

import EventEmitter from 'events';
import type { AssetCollection, MediaFetcher } from '../romper';

export default class BackgroundRenderer extends EventEmitter {
    _assetCollection: AssetCollection;
    _fetchMedia: MediaFetcher;
    _player: HTMLElement;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super();
        this._fetchMedia = mediaFetcher;
        this._player = player;
        this._assetCollection = assetCollection;
    }

    start() { }

    destroy() { }
}
