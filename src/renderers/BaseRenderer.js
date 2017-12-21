// @flow
/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import BehaviourRunner from '../behaviours/BehaviourRunner';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';

export default class BaseRenderer extends EventEmitter {
    _representation: Representation;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _target: HTMLElement;
    _behaviourRunner: ?BehaviourRunner;

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
        this._behaviourRunner = this._representation.behaviours
            ? new BehaviourRunner(this._representation.behaviours, this)
            : null;
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

    willStart() {
        if (!this._behaviourRunner ||
            !this._behaviourRunner.runBehaviours('start', 'completeStartBehaviours')) {
            this.emit('completeStartBehaviours');
        }
    }

    start() { }

    /**
     * get the representation that this renderer is currently rendering
     * @returns {Representation}
     */
    getRepresentation(): Representation {
        return this._representation;
    }

    complete() {
        if (!this._behaviourRunner ||
            !this._behaviourRunner.runBehaviours('complete', 'complete')) {
            this.emit('complete'); // we didn't find any behaviours to run, so emit completion event
        }
    }
    /**
     * Destroy is called as this representation is unloaded from being visible.
     * You should leave the DOM as you left it.
     *
     * @return {void}
     */
    destroy() {
        if (this._behaviourRunner) {
            this._behaviourRunner.destroyBehaviours();
        }
    }

    renderNextButton() {
        const nextButton = document.createElement('button');
        nextButton.id = 'nextNEbutton';
        nextButton.textContent = 'Next';
        nextButton.addEventListener('click', () => this.handleNextButtonClick());
        this._target.appendChild(nextButton);
    }

    handleNextButtonClick() {
        this.emit('nextButtonClicked');
    }

    renderBackButton() {
        const backButton = document.createElement('button');
        backButton.id = 'backNEbutton';
        backButton.textContent = 'Back';
        backButton.addEventListener('click', () => this.handleBackButtonClick());
        this._target.appendChild(backButton);
    }

    handleBackButtonClick() {
        this.emit('backButtonClicked');
    }
}
