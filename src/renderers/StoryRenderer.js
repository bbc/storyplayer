// @flow

import EventEmitter from 'events';
import type { AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { StoryPathItem } from '../StoryPathWalker';

export default class StoryRenderer extends EventEmitter {
    _pathItemList: Array<StoryPathItem>;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _target: HTMLElement;
    _iconElementList: Array<HTMLImageElement>;
    _iconElementMap: { [key: string]: ?HTMLElement }
    _currentRepresentation: string;

    constructor(
        pathItemList: Array<StoryPathItem>,
        fetchAssetCollection: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super();
        this._pathItemList = pathItemList;
        this._fetchAssetCollection = fetchAssetCollection;
        this._fetchMedia = fetchMedia;
        this._target = target;
        this._iconElementList = [];
        this._iconElementMap = {};
    }

    start() {
        // console.log('starting story renderer');
        // this.collectAssets();
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
        if (this._pathItemList[0].representation) {
            this._currentRepresentation = this._pathItemList[0].representation.id;
        }
    }

    // handle click on icon - emit message including narrative element id
    iconClickHandler(repId: string) {
        const pitems = this._pathItemList.filter(pathitem =>
            pathitem.representation && (pathitem.representation.id === repId));
        // console.log('chandle pathshift ne', pitem.narrative_element.id);
        if (pitems.length === 1) this.emit('pathShift', pitems[0].narrative_element.id);
    }

    // go thtough the list of path items and build some icons, appending them
    // to the target div with some click handling
    buildAssets(): Promise<> {
        const promises = [];
        this._pathItemList.forEach((pathItem) => {
            const rep = pathItem.representation;
            if (!rep) {
                console.error('Story renderer has no representation for path item');
            } else if (!rep.asset_collection.icon) {
                promises.push(() => { this._iconElementMap[rep.id] = null; });
            } else {
                const iconAssetId = rep.asset_collection.icon;
                promises.push(this._fetchAssetCollection(iconAssetId)
                    .then((iconAsset) => {
                        if (iconAsset.assets.image_src) {
                            const newIcon = document.createElement('img');
                            newIcon.setAttribute('src', iconAsset.assets.image_src);
                            this._iconElementList.push(newIcon);
                            this._iconElementMap[rep.id] = newIcon;
                            newIcon.addEventListener('click', () => this.iconClickHandler(rep.id));
                            if (rep.id === this._currentRepresentation) {
                                newIcon.className = 'activeIcon';
                            } else {
                                newIcon.className = 'inactiveIcon';
                            }
                        }
                    }));
            }
        });
        return Promise.all(promises).then();
    }

    handleNarrativeElementChanged(repid: string) {
        // probably also want to check that the representations in our path map
        // are still those that the reasoner is selecting
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
