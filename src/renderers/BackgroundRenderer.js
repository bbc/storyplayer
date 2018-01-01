// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, AssetCollection, MediaFetcher } from '../romper';

export default class BackgroundRenderer extends BaseRenderer {
    _assetCollection: AssetCollection;
    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        assetCollection: AssetCollection,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target);
        this._assetCollection = assetCollection;
    }
}
