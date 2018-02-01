// @flow

import EventEmitter from 'events';
import Player, { PlayerEvents } from '../Player';
import type { AssetCollection, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { StoryPathItem } from '../StoryPathWalker';

export type AssetCollectionPair = {
    default: ?AssetCollection,
    active: ?AssetCollection,
};

// Render story data (i.e., not refreshed every NE)
// currently focused on chapter icons
export default class StoryIconRenderer extends EventEmitter {
    _pathItemList: Array<StoryPathItem>;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _currentRepresentationId: string; // the id of the current representation
    _deepestCommonSubstory: string; // the story id of the deepest story with all icons
    _iconUrlMap: { [key: string]: { default: ?string, active: ?string } };
    _player: Player;
    _handleIconClicked: Function;

    /**
     * Create a new instance of a StoryIconRenderer
     *
     * @param {Array<StoryPathItem} pathItemList - an array of StoryPathItems that make a
     *      linear story
     * @param {AssetCollectionFetcher} fetchAssetCollection a function for collecting
     *      AssetCollections
     * @param {MediaFetcher} fetchMedia a function for fetching Media
     * @param {Player} player - an HTML element within which to render the story icons
     */
    constructor(
        pathItemList: Array<StoryPathItem>,
        fetchAssetCollection: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
    ) {
        super();
        this._handleIconClicked = this._handleIconClicked.bind(this);

        this._pathItemList = pathItemList;
        this._fetchAssetCollection = fetchAssetCollection;
        this._fetchMedia = fetchMedia;
        this._player = player;
        this._iconUrlMap = {};
    }

    start() {
        this._currentRepresentationId = this._pathItemList[0].representation.id;
        this._getIconAssets().then((iconAssets) => {
            this._iconUrlMap = StoryIconRenderer._buildUrlMap(this._pathItemList, iconAssets);
            this._deepestCommonSubstory = this._findSubStories();
            this._pathItemList.forEach((pathItem) => {
                const representationId = pathItem.representation.id;
                const iconUrls = this._iconUrlMap[representationId];

                if (iconUrls && iconUrls.default) {
                    this._player.addIconControl(representationId, iconUrls.default);
                }
            });
            this._showHideTarget();
        });

        this._player.on(PlayerEvents.ICON_CLICKED, this._handleIconClicked);
    }

    _handleIconClicked(event: Object) {
        const pathItem = this._pathItemList
            .find(i => i.representation && i.representation.id === event.id);
        if (pathItem) {
            this.emit('jumpToNarrativeElement', pathItem.narrative_element.id);
        }
    }

    // go through the list of path items and collect the AssetCollection for the
    // default and active icons of each
    _getIconAssets(): Promise<Array<AssetCollectionPair>> {
        const promises = [];
        this._pathItemList.forEach((pathItem) => {
            if (pathItem.representation.asset_collection.icon) {
                // eslint-disable-next-line prefer-destructuring
                const icon = pathItem.representation.asset_collection.icon;
                const defaultAssetCollectionId = icon.default;
                promises.push(this._fetchAssetCollection(defaultAssetCollectionId));
                if (icon.active) {
                    promises.push(this._fetchAssetCollection(icon.active));
                } else {
                    promises.push(Promise.resolve(null));
                }
            } else {
                promises.push(Promise.resolve(null));
                promises.push(Promise.resolve(null));
            }
        });

        const iconAssetList = []; // list of icon asset collections in AssetCollectionPair objects
        return Promise.all(promises).then((iconAssets) => {
            for (let i = 0; i < iconAssets.length; i += 2) {
                const urls = {
                    default: iconAssets[i],
                    active: iconAssets[i + 1],
                };
                iconAssetList.push(urls);
            }
            return Promise.resolve(iconAssetList);
        });
    }

    // go through the list of AssetCollections for icons and
    // and build a map of urls of default and active icons for each representationId
    static _buildUrlMap(
        pathItems: Array<StoryPathItem>,
        assets: Array<AssetCollectionPair>,
    ): { [key: string]: { default: ?string, active: ?string } } {
        // Build a map of representationIds to asset urls.
        return assets.reduce((urlMap, icon, idx) => {
            const representationId = pathItems[idx].representation.id;

            // eslint-disable-next-line no-param-reassign
            urlMap[representationId] = {
                default: icon.default && icon.default.assets.image_src ?
                    icon.default.assets.image_src : null,
                active: icon.active && icon.active.assets.image_src ?
                    icon.active.assets.image_src : null,
            };

            return urlMap;
        }, {});
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
        Object.keys(this._iconUrlMap).forEach((mapKey) => {
            const iconUrls = this._iconUrlMap[mapKey];

            if (mapKey === representationId && iconUrls && iconUrls.active) {
                this._player.setIconControl(mapKey, iconUrls.active, true);
            } else if (mapKey === representationId && iconUrls && iconUrls.default) {
                this._player.setIconControl(mapKey, iconUrls.default, true);
            } else if (iconUrls && iconUrls.default) {
                this._player.setIconControl(mapKey, iconUrls.default, false);
            }
        });

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

        if (currentPathItem.stories.indexOf(this._deepestCommonSubstory) === -1) {
            // this._player.setIconsVisible(false);
        } else {
            // this._player.setIconsVisible(true);
        }
    }

    // find the deepest substory that includes all the representations with icons
    _findSubStories(): string {
        const activeElements = [];
        Object.keys(this._iconUrlMap).forEach((representationId, index) => {
            if (this._iconUrlMap[representationId] !== null) { // there is an icon
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
