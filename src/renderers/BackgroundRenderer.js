// @flow

import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, AssetCollection, MediaFetcher } from '../romper';

export default class BackgroundRenderer extends BaseRenderer {
    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target);
        this._getBackgroundAssetCollection();
    }

    _getBackgroundAssetCollection(): Promise<?AssetCollection> {
        if (this._representation.asset_collection.background) {
            const assetCollectionId = this._representation.asset_collection.background;
            return this._fetchAssetCollection(assetCollectionId);
        }
        return Promise.resolve(null);
    }
}
