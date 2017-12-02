// @flow

import EventEmitter from 'events';
import type { Representation } from '../romper';
import type { AssetCollectionFetcher } from '../romper';

export default class BaseRenderer extends EventEmitter {

    _representation: Representation;
    _fetchAssetCollection: AssetCollectionFetcher;
    _target: HTMLElement;

    /**
     * Load an particular representation. This should not actually render anything until start()
     * is called, as this could be constructed in advance as part of pre-loading.
     *
     * @param {Representation} representation the representation node to be rendered
     * @param {HTMLElement} target the DOM node this representation is targeted at
     */
    constructor(representation: Representation, assetCollectionFetcher: AssetCollectionFetcher, target: HTMLElement) {
        super();
        this._representation = representation;
        this._fetchAssetCollection = assetCollectionFetcher;
        this._target = target;
    }

    /**
     * An event which fires when this renderer has completed it's part of the experience
     * (e.g., video finished, or the user has clicked 'skip', etc)
     *
     * @event BaseRenderer#complete
     */

    /**
     * When start() is called you are expected to take control of the DOM node in question.
     *
     * @fires BaseRenderer#complete
     * @return {void}
     */
    start() {
    }

    /**
     * Destroy is called as this representation is unloaded from being visible. You should leave the DOM as you left it.
     *
     * @return {void}
     */
    destroy() {
    }

}
