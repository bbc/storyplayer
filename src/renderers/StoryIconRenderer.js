// @flow

import EventEmitter from 'events';
import Player, { PlayerEvents } from '../gui/Player';
import type { AssetCollectionFetcher, MediaFetcher } from '../romper';
import { REASONER_EVENTS } from '../Events';
import type { StoryPathItem } from '../StoryPathWalker';

export type IconUrlPair = {
    default: ?string,
    active: ?string,
};

// Render story data (i.e., not refreshed every NE)
// currently focused on chapter icons
export default class StoryIconRenderer extends EventEmitter {
    _pathItemList: Array<StoryPathItem>;

    _fetchAssetCollection: AssetCollectionFetcher;

    _fetchMedia: MediaFetcher;

    _currentRepresentationId: string;

    // the id of the current representation
    _deepestCommonSubstory: string;

    // the story id of the deepest story with all icons
    _iconUrlMap: { [key: string]: { default: ?string, active: ?string } };

    _player: Player;

    _handleIconClicked: Function;

    _preloadedIcons: Array<Image>

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
        this._preloadedIcons = [];
    }

    start(startingRepresentationId: string) {
        if (this._pathItemList.length <= 0) { return; }
        this._currentRepresentationId = this._pathItemList[0].representation.id;
        this._getIconAssets().then((iconAssets) => {
            this._iconUrlMap = StoryIconRenderer._buildUrlMap(this._pathItemList, iconAssets);
            this.preloadIcons();
            this._deepestCommonSubstory = this._findSubStories();
            this._pathItemList.forEach((pathItem, index) => {
                const representationId = pathItem.representation.id;
                const iconUrls = this._iconUrlMap[representationId];
                const iconName = pathItem.representation.name ?
                    `${pathItem.representation.name}` : `Chapter ${index + 1}`;
                if (iconUrls) {
                    this._player.addIconControl(
                        representationId,
                        iconUrls.default ? iconUrls.default : '',
                        false,
                        iconName,
                        `${index}`,
                    );
                }
            });
            this._showHideTarget();
            this.handleNarrativeElementChanged(startingRepresentationId);
        });

        this._player.on(PlayerEvents.ICON_CLICKED, this._handleIconClicked);
    }


    preloadIcons() {
        this._preloadedIcons = [];
        Object.keys(this._iconUrlMap).forEach((iconUrlMapKey) => {
            const defaultIconUrl = this._iconUrlMap[iconUrlMapKey].default;
            const activeIconUrl = this._iconUrlMap[iconUrlMapKey].active;

            if (defaultIconUrl) {
                const image = new Image();
                image.src = defaultIconUrl;
                this._preloadedIcons.push(image);
            }
            if (activeIconUrl) {
                const image = new Image();
                image.src = activeIconUrl;
                this._preloadedIcons.push(image);
            }
        });
    }

    _handleIconClicked(event: Object) {
        const pathItem = this._pathItemList
            .find(i => i.representation && i.representation.id === event.id);
        if (pathItem) {
            this.emit(REASONER_EVENTS.JUMP_TO_NARRATIVE_ELEMENT, pathItem.narrative_element.id);
        }
    }

    // go through the list of path items and collect the AssetCollection for the
    // default and active icons of each
    // then resolve the image_urls of each
    _getIconAssets(): Promise<Array<IconUrlPair>> {
        const promises = [];
        this._pathItemList.forEach((pathItem) => {
            if (pathItem.representation.asset_collections.icon) {
                // eslint-disable-next-line prefer-destructuring
                const icon = pathItem.representation.asset_collections.icon;
                if (icon.default_id) {
                    promises.push(this._fetchAssetCollection(icon.default_id));
                } else {
                    promises.push(Promise.resolve(null));
                }
                if (icon.active_id) {
                    promises.push(this._fetchAssetCollection(icon.active_id));
                } else {
                    promises.push(Promise.resolve(null));
                }
            } else {
                promises.push(Promise.resolve(null));
                promises.push(Promise.resolve(null));
            }
        });

        return Promise.all(promises).then((iconAssets) => {
            const resolvePromises = [];
            iconAssets.forEach((assetUrl) => {
                if (assetUrl && assetUrl.assets.image_src) {
                    resolvePromises.push(this._fetchMedia(assetUrl.assets.image_src));
                } else {
                    resolvePromises.push(Promise.resolve(null));
                }
            });
            return Promise.all(resolvePromises);
        }).then((resolvedUrls) => {
            const resolvedAssetList = [];
            for (let i = 0; i < resolvedUrls.length; i += 2) {
                const urls = {
                    default: resolvedUrls[i],
                    active: resolvedUrls[i + 1],
                };
                resolvedAssetList.push(urls);
            }
            return resolvedAssetList;
        });
    }

    // go through the list of AssetCollections for icons and
    // and build a map of urls of default and active icons for each representationId
    static _buildUrlMap(
        pathItems: Array<StoryPathItem>,
        assets: Array<IconUrlPair>,
    ): { [key: string]: { default: ?string, active: ?string } } {
        // Build a map of representationIds to asset urls.
        return assets.reduce((urlMap, icon, idx) => {
            const representationId = pathItems[idx].representation.id;

            // eslint-disable-next-line no-param-reassign
            urlMap[representationId] = {
                default: icon.default,
                active: icon.active,
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

            if (mapKey === representationId && iconUrls) {
                this._player.setIconControl(
                    mapKey,
                    iconUrls.active ? iconUrls.active : '',
                    true,
                );
            } else if (mapKey === representationId && iconUrls) {
                this._player.setIconControl(
                    mapKey,
                    iconUrls.default ? iconUrls.default : '',
                    true,
                );
            } else if (iconUrls) {
                this._player.setIconControl(
                    mapKey,
                    iconUrls.default ? iconUrls.default : '',
                    false,
                );
            }
            const className = `chapter${this._getRepresentationIndex(representationId)}`;
            this._player._icon.setButtonClass(className);
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

    // eslint-disable-next-line
    _showHideTarget() {
        // [TODO]: Code removed as it didn't do anything. If the user was in a substory which
        // contained any of the chapter markers it would show them. If not, then they would be
        // hidden. We still need to do this but using Player.
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
