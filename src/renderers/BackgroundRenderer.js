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
        this._getBackgroundAssetCollections();
    }

    _getBackgroundAssetCollections(): Promise<?AssetCollection> {
        if (this._representation.asset_collection.background
            && this._representation.asset_collection.background.length > 0) {
            const assetCollectionId = this._representation.asset_collection.background[0];
            return this._fetchAssetCollection(assetCollectionId);
        }
        return Promise.resolve(null);
    }
}
