// @flow
/* eslint-disable class-methods-use-this */

import EventEmitter from 'events';
import type { AssetCollection, MediaFetcher } from '../romper';

export default class BackgroundRenderer extends EventEmitter {
    _assetCollection: AssetCollection;
    _fetchMedia: MediaFetcher;
    _target: HTMLElement;

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        target: HTMLElement,
    ) {
        super();
        this._fetchMedia = mediaFetcher;
        this._target = target;
        this._assetCollection = assetCollection;
    }

    start() { }

    destroy() { }
}
