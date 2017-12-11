// @flow

import EventEmitter from 'events';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

export default class StoryRenderer extends EventEmitter {
    _representationList: Array<Representation>;
    _iconAssetList: Array<?string>;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _target: HTMLElement;
    _iconElementList: Array<HTMLImageElement>;
    _iconElementMap: { [key: string]: ?HTMLElement }
    _currentRepresentation: string;

    constructor(
        representationList: Array<Representation>,
        fetchAssetCollection: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super();
        this._representationList = representationList;
        this._fetchAssetCollection = fetchAssetCollection;
        this._fetchMedia = fetchMedia;
        this._target = target;
        this._iconAssetList = [];
        this._iconElementList = [];
        this._iconElementMap = {};
    }

    start() {
        // console.log('starting story renderer');
        this.collectAssets();
        this.buildAssets().then(() => {
            // console.log(this._iconElementList);
            const iconlist = document.createElement('ul');
            iconlist.id = 'chapterIcons';
            this._iconElementList.forEach((iconImageElement) => {
                const iconListItem = document.createElement('li');
                iconListItem.appendChild(iconImageElement);
                iconlist.appendChild(iconListItem);
            });
            this._target.appendChild(iconlist);
        });
        this._currentRepresentation = this._representationList[0].id;
    }

    // go through the representation list and build a list of asset collection ids for icon assets
    // contain null if no icon, or asset_collection id
    collectAssets() {
        this._representationList.forEach((repitem) => {
            if (repitem.asset_collection.icon) {
                const iconAsset = repitem.asset_collection.icon;
                this._iconAssetList.push(iconAsset);
            } else {
                this._iconAssetList.push(null);
            }
        });
        console.log('icons', this._iconElementMap);
    }

    // handle click on icon - emit message including representation id
    iconClickHandler(repId: string) {
        // console.log('selected representation', repId);
        this.emit('pathShift', repId);
    }

    // go thtough the list of icon assets and build some icons, appending them
    // to the target div with some click handling
    buildAssets(): Promise<> {
        const promises = [];
        let i = 0;
        this._iconAssetList.forEach((iconAssetId) => {
            const index = i;
            const repId = this._representationList[index].id;
            if (!iconAssetId) {
                // nowt
                promises.push(() => { this._iconElementMap[repId] = null; });
            } else {
                promises.push(this._fetchAssetCollection(iconAssetId)
                    .then((iconAsset) => {
                        if (iconAsset.assets.image_src) {
                            const newIcon = document.createElement('img');
                            newIcon.src = iconAsset.assets.image_src;
                            this._iconElementList.push(newIcon);
                            this._iconElementMap[repId] = newIcon;
                            newIcon.addEventListener('click', () => this.iconClickHandler(repId));
                        }
                    }));
            }
            i += 1;
        });
        return Promise.all(promises).then();
    }
}
