// @flow
/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import BehaviourRunner from '../behaviours/BehaviourRunner';
import RendererEvents from './RendererEvents';
import Player from '../Player';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import logger from '../logger';

export default class BaseRenderer extends EventEmitter {
    _representation: Representation;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _player: Player;
    _behaviourRunner: ?BehaviourRunner;
    _behaviourRendererMap: { [key: string]: () => void };
    _destroyed: boolean;
    _analytics: AnalyticsLogger;

    /**
     * Load an particular representation. This should not actually render anything until start()
     * is called, as this could be constructed in advance as part of pre-loading.
     *
     * @param {Representation} representation the representation node to be rendered
     * @param {AssetCollectionFetcher} assetCollectionFetcher a fetcher for asset collections
     * @param {MediaFetcher} MediaFetcher a fetcher for media
     * @param {Player} player the Player used to manage DOM changes
     */
    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        mediaFetcher: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
    ) {
        super();
        this._representation = representation;
        this._fetchAssetCollection = assetCollectionFetcher;
        this._fetchMedia = mediaFetcher;
        this._player = player;
        this._behaviourRunner = this._representation.behaviours
            ? new BehaviourRunner(this._representation.behaviours, this)
            : null;
        this._behaviourRendererMap = {};
        this._destroyed = false;
        this._analytics = analytics;
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
            !this._behaviourRunner.runBehaviours(
                RendererEvents.STARTED,
                RendererEvents.COMPLETE_START_BEHAVIOURS,
            )
        ) {
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

    getCurrentTime(): Object {
        logger.warn('getting time data from on BaseRenderer');
        const timeObject = {
            timeBased: false,
            currentTime: 0,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        logger.warn(`ignoring setting time on BaseRenderer ${time}`);
    }

    complete() {
        this.emit(RendererEvents.STARTED_COMPLETE_BEHAVIOURS);
        if (!this._behaviourRunner ||
            !this._behaviourRunner.runBehaviours(
                RendererEvents.COMPLETED,
                RendererEvents.COMPLETED,
            )
        ) {
            // we didn't find any behaviours to run, so emit completion event
            this.emit(RendererEvents.COMPLETED);
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

    getBehaviourRenderer(behaviourUrn: string): () => void {
        return this._behaviourRendererMap[behaviourUrn];
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
        // we didn't find any behaviours to run, so emit completion event
        this.emit(RendererEvents.DESTROYED);
        this._destroyed = true;
    }
}
