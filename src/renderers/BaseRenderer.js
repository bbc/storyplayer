// @flow
/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import BehaviourFactory from '../behaviours/BehaviourFactory';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

export default class BaseRenderer extends EventEmitter {
    _representation: Representation;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _target: HTMLElement;

    /**
     * Load an particular representation. This should not actually render anything until start()
     * is called, as this could be constructed in advance as part of pre-loading.
     *
     * @param {Representation} representation the representation node to be rendered
     * @param {AssetCollectionFetcher} assetCollectionFetcher a fetcher for asset collections
     * @param {MediaFetcher} MediaFetcher a fetcher for media
     * @param {HTMLElement} target the DOM node this representation is targeted at
     */
    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        mediaFetcher: MediaFetcher,
        target: HTMLElement,
    ) {
        super();
        this._representation = representation;
        this._fetchAssetCollection = assetCollectionFetcher;
        this._fetchMedia = mediaFetcher;
        this._target = target;
        this._behavioursRunning = { complete: 0 }; // Count of number of behaviours running against each event type
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

    start() {}

    complete() {
        const behaviours = this._representation.behaviours;
        if (behaviours) {
            behaviours.complete.forEach((behaviour) => {
                const newBehaviour = BehaviourFactory(behaviour, this.completeBehaviourDone.bind(this));
                if (newBehaviour) {
                    newBehaviour.start();
                    this._behavioursRunning.complete++;
                }
            });
        }
    }

    completeBehaviourDone() {
        this._behavioursRunning.complete--;
        if (this._behavioursRunning.complete === 0) {
            this.emit('complete');
        }
    }

    /**
     * Destroy is called as this representation is unloaded from being visible. You should leave the DOM as you left it.
     *
     * @return {void}
     */
    destroy() {}
}
