// @flow

import EventEmitter from 'events';
import type { AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { PathItem } from '../StoryPathWalker';

export default class StoryRenderer extends EventEmitter {
    _pathItemList: Array<PathItem>;
    _iconAssetList: Array<?string>;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _target: HTMLElement;
    _iconElementList: Array<HTMLImageElement>;
    _iconElementMap: { [key: string]: ?HTMLElement }
    _currentRepresentation: string;

    constructor(
        pathItemList: Array<PathItem>,
        fetchAssetCollection: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super();
        this._pathItemList = pathItemList;
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
        this._currentRepresentation = this._pathItemList[0].representation.id;
    }

    // go through the representation list and build a list of asset collection ids for icon assets
    // contain null if no icon, or asset_collection id
    collectAssets() {
        console.log(this._pathItemList);
        this._pathItemList.forEach((repitem) => {
            if (repitem.representation && repitem.representation.asset_collection.icon) {
                const iconAsset = repitem.representation.asset_collection.icon;
                this._iconAssetList.push(iconAsset);
            } else {
                this._iconAssetList.push(null);
            }
        });
        // console.log('icons', this._iconElementMap);
    }

    // handle click on icon - emit message including narrative element id
    iconClickHandler(repId: string) {
        const pitem = this._pathItemList.filter(pathitem => pathitem.representation.id === repId)[0];
        // console.log('chandle pathshift ne', pitem.narrative_element.id);
        this.emit('pathShift', pitem.narrative_element.id);
    }

    // go thtough the list of icon assets and build some icons, appending them
    // to the target div with some click handling
    buildAssets(): Promise<> {
        const promises = [];
        let i = 0;
        this._iconAssetList.forEach((iconAssetId) => {
            const index = i;
            const repId = this._pathItemList[index].representation.id;
            if (!iconAssetId) {
                promises.push(() => { this._iconElementMap[repId] = null; });
            } else {
                promises.push(this._fetchAssetCollection(iconAssetId)
                    .then((iconAsset) => {
                        if (iconAsset.assets.image_src) {
                            const newIcon = document.createElement('img');
                            newIcon.setAttribute('src', iconAsset.assets.image_src);
                            this._iconElementList.push(newIcon);
                            this._iconElementMap[repId] = newIcon;
                            newIcon.addEventListener('click', () => this.iconClickHandler(repId));
                            if (repId === this._currentRepresentation) {
                                newIcon.className = 'activeIcon';
                            } else {
                                newIcon.className = 'inactiveIcon';
                            }
                        }
                    }));
            }
            i += 1;
        });
        return Promise.all(promises).then();
    }

    handleNarrativeElementChanged(repid: string) {
        console.log('changed ne to ', repid);
        this._currentRepresentation = repid;
        Object.keys(this._iconElementMap).forEach((mapKey) => {
            if (this._iconElementMap[mapKey]) {
                this._iconElementMap[mapKey].className = 'inactiveIcon';
            }
        });
        if (this._iconElementMap[repid]) {
            this._iconElementMap[repid].className = 'activeIcon';
        }
    }
}
