// @flow
/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import BehaviourRunner from '../behaviours/BehaviourRunner';
import RendererEvents from './RendererEvents';
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
            !this._behaviourRunner.runBehaviours(RendererEvents.STARTED, RendererEvents.COMPLETE_START_BEHAVIOURS)) {
            this.emit(RendererEvents.COMPLETE_START_BEHAVIOURS);
        }
    }

    start() {
        this.emit(RendererEvents.STARTED);
    }

    /**
     * get the representation that this renderer is currently rendering
     * @returns {Representation}
     */
    getRepresentation(): Representation {
        return this._representation;
    }

    getTimeData(): Object {
        console.warn('getting time data from on BaseRenderer');
        const timeObject = {
            timeBased: false,
            currentTime: 0,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        console.warn('ignoring setting time on BaseRenderer', time);
    }

    complete() {
        console.log('base renderer complete()');
        if (!this._behaviourRunner ||
            !this._behaviourRunner.runBehaviours(RendererEvents.COMPLETED, RendererEvents.COMPLETED)) {
            console.log('EMIT RendererEvents.COMPLETED');
            this.emit(RendererEvents.COMPLETED); // we didn't find any behaviours to run, so emit completion event
        }
    }

    switchFrom() {
        this.destroy();
    }

    // prepare rendere so it can be switched to quickly and in sync
    cueUp() { }

    switchTo() {
        this.start();
    }

    // Either have a generic function for all behaviours, and leave to individual renderers to parse
    applyBehaviour(behaviourDefinition: Object) {
        console.warn(`this Renderer does not know how to apply the ${behaviourDefinition.type} behaviour`);
    }

    // or have an explicit function for each behaviour
    // which means we can give warnings when renderer instances can't yet handle new behaviours
    applyBlurBehaviour(blur: number) {
        console.warn('this Renderer does not know how to apply the blur behaviour');
    }

    applyShowImageBehaviour(assetCollectionId: string, callback: () => mixed) {
        console.warn('this Renderer does not know how to apply the showImage behaviour');
        callback();
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
        this.emit(RendererEvents.DESTROYED); // we didn't find any behaviours to run, so emit completion event
    }
}
