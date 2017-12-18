// @flow

import EventEmitter from 'events';
import type { AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { StoryPathItem } from '../StoryPathWalker';

// Render story data (i.e., not refreshed every NE)
// currently focused on chapter icons
export default class StoryIconRenderer extends EventEmitter {
    _pathItemList: Array<StoryPathItem>;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _target: HTMLDivElement;
    _iconElementMap: { [key: string]: ?HTMLElement } // map of representationIds to icon <img>s
    _currentRepresentationId: string; // the id of the current representation
    _deepestCommonSubstory: string; // the story id of the deepest story with all icons
    _iconListElement: HTMLElement; // the <ul> containing the icons

    /**
     * Create a new instance of a StoryIconRenderer
     *
     * @param {Array<StoryPathItem} pathItemList - an array of StoryPathItems that make a
     *      linear story
     * @param {AssetCollectionFetcher} fetchAssetCollection a function for collecting
     *      AssetCollections
     * @param {MediaFetcher} fetchMedia a function for fetching Media
     * @param {HTMLDivElement} target - an HTML element within which to render the story icons
     */
    constructor(
        pathItemList: Array<StoryPathItem>,
        fetchAssetCollection: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLDivElement,
    ) {
        super();
        this._pathItemList = pathItemList;
        this._fetchAssetCollection = fetchAssetCollection;
        this._fetchMedia = fetchMedia;
        this._target = target;
        this._iconElementMap = {};
    }

    start() {
        this._currentRepresentationId = this._pathItemList[0].representation.id;
        this._buildAssets().then((iconImgElements) => {
            this._deepestCommonSubstory = this._findSubStories();
            this._iconListElement = document.createElement('ul');
            this._iconListElement.id = 'chapterIcons';
            iconImgElements.forEach((iconImageElement) => {
                const iconListItem = document.createElement('li');
                iconListItem.appendChild(iconImageElement);
                this._iconListElement.appendChild(iconListItem);
            });
            this._target.appendChild(this._iconListElement);
            this._showHideTarget();
        });
    }

    // handle click on icon - emit message including narrative element id
    _iconClickHandler(representationId: string) {
        const storyPathItems = this._pathItemList.filter(pathitem =>
            pathitem.representation && (pathitem.representation.id === representationId));
        if (storyPathItems.length === 1) {
            this.emit('jumpToNarrativeElement', storyPathItems[0].narrative_element.id);
        }
    }

    // go thtough the list of path items and build some icons, appending them
    // to the target div with some click handling
    _buildAssets(): Promise<> {
        const promises = [];
        this._pathItemList.forEach((pathItem) => {
            if (!pathItem.representation.asset_collection.icon) {
                promises.push(Promise.resolve(null));
            } else {
                const iconAssetId = pathItem.representation.asset_collection.icon;
                promises.push(this._fetchAssetCollection(iconAssetId));
            }
        });

        const iconElementList = []; // list of icon <IMG> elements
        // populate this list and...
        // build map to work out which representations have which icons
        return Promise.all(promises).then((iconAssets) => {
            iconAssets.forEach((iconAsset, i) => {
                const representationId = this._pathItemList[i].representation.id;
                if (iconAsset === null) {
                    this._iconElementMap[representationId] = null;
                } else if (iconAsset.assets.image_src) {
                    const newIcon = this._buildIconImgElement(
                        representationId,
                        iconAsset.assets.image_src,
                    );
                    iconElementList.push(newIcon);
                    this._iconElementMap[representationId] = newIcon;
                }
            });
            return Promise.resolve(iconElementList);
        });
    }

    // build icon with click handler
    _buildIconImgElement(representationId: string, sourceUrl: string): HTMLImageElement {
        const newIcon = document.createElement('img');
        newIcon.setAttribute('src', sourceUrl);
        newIcon.addEventListener('click', () => this._iconClickHandler(representationId));
        if (representationId === this._currentRepresentationId) {
            newIcon.className = 'activeIcon';
        } else {
            newIcon.className = 'inactiveIcon';
        }
        return newIcon;
    }

    /**
     * Handle a change in the main story state - moved to a new NarrativeElement
     *
     * @param {string} representationId the id of the representation being rendered
     * for the current narrative element
     */
    handleNarrativeElementChanged(representationId: string) {
        // probably also want to check that the representations in our path map
        // are still those that the reasoner is selecting
        this._currentRepresentationId = representationId;
        Object.keys(this._iconElementMap).forEach((mapKey) => {
            if (this._iconElementMap[mapKey]) {
                this._iconElementMap[mapKey].className = 'inactiveIcon';
            }
        });
        if (this._iconElementMap[representationId]) {
            this._iconElementMap[representationId].className = 'activeIcon';
        }
        this._showHideTarget();
    }

    // get the position of the given representation in the story path
    _getRepresentationIndex(representationId: string): number {
        let index = -1;
        this._pathItemList.forEach((storyPathItem, i) => {
            if (storyPathItem.representation
                && storyPathItem.representation.id === representationId) {
                index = i;
            }
        });
        return index;
    }

    // show or hide the target of this renderer according to whether we are in a substory
    _showHideTarget() {
        const currentRepIndex = this._getRepresentationIndex(this._currentRepresentationId);
        const currentPathItem = this._pathItemList[currentRepIndex];
        // console.log('in', currentPathItem, '- icon story is:', this._deepestCommonSubstory);

        this._target.classList.remove('active');
        this._target.classList.remove('inactive');
        if (currentPathItem.stories.indexOf(this._deepestCommonSubstory) === -1) {
            this._target.classList.add('inactive');
        } else {
            this._target.classList.add('active');
        }
    }

    // find the deepest substory that includes all the representations with icons
    _findSubStories(): string {
        const activeElements = [];
        Object.keys(this._iconElementMap).forEach((representationId, index) => {
            if (this._iconElementMap[representationId] !== null) { // there is an icon
                const pathItem = this._pathItemList[index]; // get the corresponding path icon
                activeElements.push(pathItem.stories.slice(0)); // add the stories
            }
        });
        const commonPath = StoryIconRenderer._findLongestCommonList(activeElements);
        return commonPath[commonPath.length - 1];
    }

    // find the longest common start shared by all arrays
    static _findLongestCommonList(list: Array<Array<string>>): Array<string> {
        const commonPath = list[0];
        list.forEach((ae) => {
            // trim common to same length
            while (commonPath.length > ae.length) commonPath.pop();
            // trim uncommon stories from end
            for (let i = commonPath.length - 1; i > 0; i -= 1) {
                if (commonPath[i] !== ae[i]) commonPath.pop();
            }
        });
        return commonPath;
    }
}
