// @flow
/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import BehaviourRunner from '../behaviours/BehaviourRunner';
import RendererEvents from './RendererEvents';
import BehaviourTimings from '../behaviours/BehaviourTimings';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import Player, { PlayerEvents } from '../Player';
import PlayoutEngine from '../playoutEngines/BasePlayoutEngine';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger, AnalyticEventName } from '../AnalyticEvents';
import Controller from '../Controller';
import logger from '../logger';
import { checkAddDetailsOverride } from '../utils';
import { VARIABLE_EVENTS } from '../Events';
import { buildPanel } from '../behaviours/VariablePanelHelper';

import { renderSocialPopup } from '../behaviours/SocialShareBehaviourHelper';
import { renderLinkoutPopup } from '../behaviours/LinkOutBehaviourHelper';
import iOSPlayoutEngine from '../playoutEngines/iOSPlayoutEngine';
import TimeManager from '../TimeManager';
import PauseBehaviour from '../behaviours/PauseBehaviour';

const SEEK_TIME = 10;

const debugPhase = true;

const getBehaviourEndTime = (behaviour: Object) => {
    if(behaviour.duration !== undefined) {
        const endTime = behaviour.start_time + behaviour.duration;
        return endTime;
    }
    return undefined;
}

export const RENDERER_PHASES = {
    CONSTRUCTING: 'CONSTRUCTING',
    CONSTRUCTED: 'CONSTRUCTED',
    START: 'START',
    MAIN: 'MAIN',
    COMPLETING: 'COMPLETING',
    ENDED: 'ENDED',
    DESTROYED: 'DESTROYED',
    MEDIA_FINISHED: 'MEDIA_FINISHED', // done all its rendering and ready to move on, but not ended
};

export default class BaseRenderer extends EventEmitter {
    _rendererId: string;

    _representation: Representation;

    _fetchAssetCollection: AssetCollectionFetcher;

    _fetchMedia: MediaFetcher;

    _player: Player;

    _playoutEngine: PlayoutEngine;

    _behaviourRunner: ?BehaviourRunner;

    _behaviourRendererMap: { [key: string]: (behaviour: Object, callback: () => mixed) => void };

    _applyColourOverlayBehaviour: Function;

    _applyShowImageBehaviour: Function;

    _applyShowVariablePanelBehaviour: Function;

    _applyShowChoiceBehaviour: Function;

    _renderLinkChoices: Function;

    _applySocialSharePanelBehaviour: Function;

    _applyLinkOutBehaviour: Function;

    _handleLinkChoiceEvent: Function;

    _seekForward: Function;

    _seekBack: Function;

    _togglePause: Function;

    _behaviourElements: Array<HTMLElement>;

    _target: HTMLDivElement;

    _destroyed: boolean;

    _analytics: AnalyticsLogger;

    _controller: Controller;

    _preloadedBehaviourAssets: Array<Image>;

    _preloadedIconAssets: Array<Image>;

    _choiceBehaviourData: Object;

    _linkBehaviour: Object;

    inVariablePanel: boolean;

    _linkFadeTimeout: TimeoutID;

    seekEventHandler: Function;

    checkIsLooping: Function;

    _loopCounter: number;

    _willHideControls: Function;

    _hideControls: Function;

    _showControls: Function;

    _timer: TimeManager;

    isIosPlayoutEngine: Function;

    _cleanupSingleDuringBehaviour: Function;

    _runSingleDuringBehaviour: Function;

    _runDuringBehaviours: Function;

    addTimeEventListener: Function;

    _addPauseHandlersForTimer: Function;

    _removePauseHandlersForTimer: Function;

    _handlePlayPauseButtonClicked: Function;

    _duration: ?number;

    _lastSetTime: number;

    _inTime: number;

    _outTime: number;

    _setOutTime: Function;

    _setInTime: Function;

    _inPauseBehaviourState: boolean;

    phase: string;

    /**
     * Load an particular representation. This should not actually render anything until start()
     * is called, as this could be constructed in advance as part of pre-loading.
     *
     * @param {Representation} representation the representation node to be rendered
     * @param {AssetCollectionFetcher} assetCollectionFetcher a fetcher for asset collections
     * @param {MediaFetcher} MediaFetcher a fetcher for media
     * @param {Player} player the Player used to manage DOM changes
     *
     */
    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        mediaFetcher: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
        controller: Controller,
    ) {
        super();
        this._representation = representation;
        this._rendererId = this._representation.id;
        this._fetchAssetCollection = assetCollectionFetcher;
        this._fetchMedia = mediaFetcher;
        this._player = player;
        this._playoutEngine = player.playoutEngine;
        this._target = player.mediaTarget;
        this._controller = controller;

        this._applyColourOverlayBehaviour = this._applyColourOverlayBehaviour.bind(this);
        this._applyShowImageBehaviour = this._applyShowImageBehaviour.bind(this);
        this._applyShowVariablePanelBehaviour = this._applyShowVariablePanelBehaviour.bind(this);
        this._applyShowChoiceBehaviour = this._applyShowChoiceBehaviour.bind(this);
        this._renderLinkChoices = this._renderLinkChoices.bind(this);
        this._handleLinkChoiceEvent = this._handleLinkChoiceEvent.bind(this);
        this._applySocialSharePanelBehaviour = this._applySocialSharePanelBehaviour.bind(this);
        this._applyLinkOutBehaviour = this._applyLinkOutBehaviour.bind(this);
        this._seekBack = this._seekBack.bind(this);
        this._seekForward = this._seekForward.bind(this);
        this._togglePause = this._togglePause.bind(this);
        this.seekEventHandler = this.seekEventHandler.bind(this);
        this.checkIsLooping = this.checkIsLooping.bind(this);
        this.isIosPlayoutEngine = this.isIosPlayoutEngine.bind(this);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);


        this._willHideControls = this._willHideControls.bind(this);
        this._hideControls = this._hideControls.bind(this);
        this._showControls = this._showControls.bind(this);
        this._runDuringBehaviours = this._runDuringBehaviours.bind(this);
        this._runStartBehaviours = this._runStartBehaviours.bind(this);
        this._runSingleDuringBehaviour = this._runSingleDuringBehaviour.bind(this);
        this.addTimeEventListener = this.addTimeEventListener.bind(this);
        this._addPauseHandlersForTimer = this._addPauseHandlersForTimer.bind(this);
        this._removePauseHandlersForTimer = this._removePauseHandlersForTimer.bind(this);


        this._behaviourRendererMap = {
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:colouroverlay/v1.0': this._applyColourOverlayBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showimage/v1.0': this._applyShowImageBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showvariablepanel/v1.0': this._applyShowVariablePanelBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0': this._applyShowChoiceBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:socialmodal/v1.0': this._applySocialSharePanelBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:linkoutmodal/v1.0' : this._applyLinkOutBehaviour,
        };

        this._behaviourElements = [];
        this._timer = new TimeManager();

        this._setInTime = this._setInTime.bind(this);
        this._setOutTime = this._setOutTime.bind(this);
        this._lastSetTime = 0;
        this._inTime = 0;
        this._outTime = -1;

        this._destroyed = false;
        this._analytics = analytics;
        this.inVariablePanel = false;
        this._preloadedBehaviourAssets = [];
        this._preloadBehaviourAssets().catch(e =>
            logger.warn(e, 'Could not preload behaviour assets'));
        this._preloadIconAssets().catch(e =>
            logger.warn(e, 'Could not preload icon assets'));
        this._loopCounter = 0;
        this.phase = RENDERER_PHASES.CONSTRUCTING;
        this._inPauseBehaviourState = false;
    }

    // run any code that may be asynchronous
    async init() {
        // eslint-disable-next-line max-len
        throw new Error('Need to override this class to run async code and set renderer phase to CONSTRUCTED');
    }

    willStart(elementName: ?string, elementId: ?string): boolean {
        if (this.phase === RENDERER_PHASES.CONSTRUCTING) {
            setTimeout(() => this.willStart(elementName, elementId), 100);
            return false;
        }
        // eslint-disable-next-line max-len
        if (debugPhase) logger.info('PHASE will starting', this._representation.name, this.phase);        
        this.phase = RENDERER_PHASES.START;
        this.inVariablePanel = false;

        this._runStartBehaviours();

        this._player.on(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED, this._seekBack);
        this._player.on(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED, this._seekForward);
        if(checkAddDetailsOverride()) {
            const { name, id } = this._representation;
            this._player.addDetails(elementName, elementId, name, id)
        }
        return true;
    }

    _runStartBehaviours() {
        this._behaviourRunner = this._representation.behaviours ?
            new BehaviourRunner(this._representation.behaviours, this) :
            null;
        this._player.enterStartBehaviourPhase(this);
        this._playoutEngine.setPlayoutVisible(this._rendererId);
        if (!this._behaviourRunner ||
            !this._behaviourRunner.runBehaviours(
                BehaviourTimings.started,
                RendererEvents.COMPLETE_START_BEHAVIOURS,
            )
        ) {
            this.emit(RendererEvents.COMPLETE_START_BEHAVIOURS);
        }
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
        if (debugPhase) logger.info('PHASE starting', this._representation.name, this.phase);
        this.phase = RENDERER_PHASES.MAIN;
        this.emit(RendererEvents.STARTED);
        this._timer.start();
        if (!this._playoutEngine.isPlaying()) {
            this._timer.pause();
        }
        this._addPauseHandlersForTimer();
        this._player.exitStartBehaviourPhase();
        this._clearBehaviourElements();
        this._player.connectScrubBar(this);
        this._player.on(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED, this._handlePlayPauseButtonClicked);
        // set time to last set time (relative to click start)
        this.setCurrentTime(this._lastSetTime);
        this._runDuringBehaviours();
    }

    end(): boolean {
        switch (this.phase) {
        case (RENDERER_PHASES.ENDED):
        case (RENDERER_PHASES.DESTROYED):
            // eslint-disable-next-line max-len
            if (debugPhase) logger.info('PHASE base ended already', this._representation.name, this.phase);
            return false;
        default:
            break;
        };
        if (debugPhase) logger.info('PHASE base ending', this._representation.name, this.phase);
        this._player.disconnectScrubBar(this);
        try{
            this._clearBehaviourElements()
        } catch (e) {
            logger.info(e);
        }
        this._reapplyLinkConditions();
        clearTimeout(this._linkFadeTimeout);
        this._player.removeListener(PlayerEvents.LINK_CHOSEN, this._handleLinkChoiceEvent);
        this._player.removeListener(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED, this._seekBack);
        this._player.removeListener(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED, this._seekForward);
        this._controller.off(VARIABLE_EVENTS.CONTROLLER_CHANGED_VARIABLE, this._renderLinkChoices);
        this._timer.clear();
        this._loopCounter = 0;
        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        this._lastSetTime = 0;
        this.phase = RENDERER_PHASES.ENDED;
        return true;
    }

    // has the media finished?
    hasMediaEnded(): boolean {
        return (
            this.phase === RENDERER_PHASES.MEDIA_FINISHED
            || this.phase === RENDERER_PHASES.ENDED
            || this.phase === RENDERER_PHASES.DESTROYED
        );
    }

    // if we have any start pauses, complete those behaviours early
    exitStartPauseBehaviour() {
        if (!this._behaviourRunner || this._behaviourRunner.eventCounters.started === 0 ) return;
        const startBehaviours = this._behaviourRunner.behaviours;
        startBehaviours.forEach((behaviour => {
            if (behaviour instanceof PauseBehaviour) {
                behaviour.handleTimeout();
            }
        }));
        this.setInPause(false);
    }

    // does this renderer have a show variable panel behaviour
    hasVariablePanelBehaviour(): boolean {
        let hasPanel = false;
        if (this._representation.behaviours && this._representation.behaviours.completed) {
            this._representation.behaviours.completed.forEach((behave) => {
                // eslint-disable-next-line max-len
                if (behave.type === 'urn:x-object-based-media:representation-behaviour:showvariablepanel/v1.0') {
                    hasPanel = true;
                }
            });
        }
        return hasPanel;
    }

    /* record some analytics for the renderer - not user actions though */
    logRendererAction(userEventName: AnalyticEventName) {
        const logData = {
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names[userEventName],
            from: 'not_set',
            to: 'not_set',
        };
        this._analytics(logData);
    }

    /* record some analytics for a user action */
    logUserInteraction(
        userEventName: AnalyticEventName,
        fromId: string = 'not_set',
        toId: string = 'not_set',
    ) {
        const logData = {
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names[userEventName],
            from: fromId === null ? 'not_set' : fromId,
            to: toId === null ? 'not_set' : toId,
        };
        this._analytics(logData);
    }

    /**
     * get the representation that this renderer is currently rendering
     * @returns {Representation}
     */
    getRepresentation(): Representation {
        return this._representation;
    }

    _setInTime(time: number) {
        this._inTime = time;
        this.setCurrentTime(0);
    }

    _setOutTime(time: number) {
        this._outTime = time;
    }

    getDuration(): number {
        let  { duration } = this._representation; // specified in rep
        if (duration !== undefined && duration !== null) {
            if (duration < 0) duration = Infinity;
            this._duration = duration;
            return this._duration;
        }

        // otherwise need to work out
        if (this._duration && this._duration !== Infinity) {
            return this._duration; // if value stored, return
        }
        if (duration === undefined || duration === null) {
            // if not, check playout engine
            duration = Infinity;
            if (this.checkIsLooping()){
                // looping, and not specified in rep => infinite
                duration = Infinity;
            } else {
                // if we have playout engine duration, use
                duration = this._playoutEngine.getDuration(this._rendererId);
                if (duration === undefined || duration === null) {
                    duration = Infinity;
                }
            }
        }
        if (this._outTime >= 0) {
            duration = this._outTime - this._inTime;
        } else if (this._inTime) {
            duration -= this._inTime;
        }
        this._duration = duration;
        return this._duration;
    }

    getCurrentTime(): Object {
        const duration = this.getDuration();
        const currentTime = this._timer.getTime();
        let timeBased = false;
        let remainingTime = Infinity;
        if (duration !== Infinity) {
            timeBased = true;
            remainingTime = duration - currentTime;
        }
        const timeObject = {
            timeBased,
            currentTime,
            remainingTime,
            duration,
            timersSyncing: this._timer.isSyncing(),
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        const timeIsInvalid = (value) => {
            return (value < 0 || value === Infinity || Number.isNaN(value))
        };

        // ensure that we are setting a valid time
        if (timeIsInvalid(time)) {
            logger.warn(`Setting time for renderer out of range (${time}).  Ignoring`);
            return;
        }

        // work out what time we actually need to go to, given what was asked for
        let targetTime = time;
        const choiceTime = this.getChoiceTime();
        if (choiceTime >= 0 && choiceTime < time) {
            targetTime = choiceTime;
        }
        // convert to absolute time into video
        this._lastSetTime = targetTime; // time into segment
        targetTime += this._inTime;

        // test again to make sure calculations haven't resulted in invalid time
        if (timeIsInvalid(time)) {
            logger.warn(`Setting time for renderer out of range (${time}).  Ignoring`);
            return;
        }

        // if we have a media element, set that time and pause the timer until playhead has synced
        if (this._playoutEngine.getPlayoutActive(this._rendererId)) {
            const isPaused = this._timer._paused;
            const sync = () => {
                const playheadTime = this._playoutEngine.getCurrentTime(this._rendererId);
                if (playheadTime >= (targetTime + 0.1)) { // leeway to allow it to start going
                    this._timer.setTime(playheadTime - this._inTime);
                    this._timer.setSyncing(false);
                    if (isPaused) this._timer.pause();  // don't restart if we were paused
                    this._playoutEngine.off(this._rendererId,'timeupdate', sync);
                }
            };
            this._timer.setSyncing(true);
            this._playoutEngine.on(this._rendererId,'timeupdate', sync);
            this._playoutEngine.setCurrentTime(this._rendererId, targetTime);
        } else {
            this._timer.setTime(time);
        }
    }

    _togglePause() {
        if (this._playoutEngine.isPlaying()) {
            this._timer.resume();
        } else {
            this._timer.pause();
        }
    }

    _addPauseHandlersForTimer() {
        if (this._timer) {
            this._playoutEngine.on(this._rendererId, 'pause', () => { this._timer.pause() });
            this._playoutEngine.on(this._rendererId, 'play', () => { this._timer.resume() });
        }
    }

    _removePauseHandlersForTimer() {
        if (this._timer) {
            this._playoutEngine.off(this._rendererId, 'pause', () => { this._timer.pause() });
            this._playoutEngine.off(this._rendererId, 'play', () => { this._timer.resume() });
        }
    }

    _handlePlayPauseButtonClicked(): void {
        if (this._timer._paused) {
            this._timer.resume();
        } else {
            this._timer.pause();
        }
        if (this._playoutEngine.getPlayoutActive(this._rendererId)) {
            if (this._playoutEngine.isPlaying()) {
                this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            } else {
                this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            }
        }
    }

    pause() {
        this._timer.pause();
        this._playoutEngine.pause();
    }

    play() {
        this._timer.resume();
        this._playoutEngine.play();
    }

    _seekBack() {
        const { timeBased, currentTime } = this.getCurrentTime();
        if (timeBased) {
            let targetTime = currentTime - SEEK_TIME;
            if (targetTime < 0) {
                targetTime = 0;
            }
            this.logUserInteraction(AnalyticEvents.names.SEEK_BACKWARD_BUTTON_CLICKED,
                currentTime,
                `${targetTime}`,
            );
            this.setCurrentTime(targetTime);
        }
    }

    _seekForward() {
        if (this.getInPause() && this.phase === RENDERER_PHASES.START) {
            logger.info('Seek forward button clicked during infinite start pause - starting element'); // eslint-disable-line max-len
            this.exitStartPauseBehaviour();
        }
        const { timeBased, currentTime } = this.getCurrentTime();
        if (timeBased) {
            let targetTime = currentTime + SEEK_TIME;
            const choiceTime = this.getChoiceTime();
            if (choiceTime > 0 && choiceTime < targetTime) {
                targetTime = choiceTime;
            }
            this.setCurrentTime(targetTime);
            this.logUserInteraction(AnalyticEvents.names.SEEK_FORWARD_BUTTON_CLICKED,
                currentTime,
                `${targetTime}`,
            );
        }
    }

    // get the time of the first choice in the element
    // returns -1 if no such behaviours
    getChoiceTime(): number {
        if (this._representation.behaviours) {
            if (this._representation.behaviours.during) {
                const matches = this._representation.behaviours.during.filter(behave =>
                    behave.behaviour.type === 'urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0') // eslint-disable-line max-len
                    .sort((a, b) => a.start_time - b.start_time);
                if (matches.length > 0) {
                    return matches[0].start_time;
                }
            }
        }
        return -1;
    }

    complete() {
        if (debugPhase) logger.info('PHASE completing', this._representation.name, this.phase);
        this.phase = RENDERER_PHASES.COMPLETING;
        this._timer.pause();
        if (!this._linkBehaviour ||
            (this._linkBehaviour && !this._linkBehaviour.forceChoice)) {
            this._player.enterCompleteBehavourPhase();
            this.emit(RendererEvents.STARTED_COMPLETE_BEHAVIOURS);
            if (!this._behaviourRunner ||
                !this._behaviourRunner.runBehaviours(
                    BehaviourTimings.completed,
                    RendererEvents.COMPLETED,
                )
            ) {
                // we didn't find any behaviours to run, so emit completion event
                this.emit(RendererEvents.COMPLETED);
            }
        }
    }

    switchFrom() {
        this.end();
    }

    // prepare renderer so it can be switched to quickly and in sync
    cueUp() { }

    switchTo() {
        this.start();
    }

    _preloadBehaviourAssets() {
        this._preloadedBehaviourAssets = [];
        const assetCollectionIds = this._representation.asset_collections.behaviours ?
            this._representation.asset_collections.behaviours : [];
        return Promise.all(assetCollectionIds.map((behaviour) => {
        // assetCollectionIds.forEach((behaviour) => {
            return this._fetchAssetCollection(behaviour.asset_collection_id)
                .then((assetCollection) => {
                    if (assetCollection.assets.image_src) {
                        return this._fetchMedia(assetCollection.assets.image_src);
                    }
                    return Promise.resolve();
                })
                .then((imageUrl) => {
                    if (imageUrl) {
                        const image = new Image();
                        image.src = imageUrl;
                        this._preloadedBehaviourAssets.push(image);
                    }
                }).catch((err) => {
                    logger.error(err,
                        `could not preload behaviour asset ${behaviour.asset_collection_id}`);
                });
        }));
    }

    _preloadIconAssets() {
        this._preloadedIconAssets = [];
        const assetCollectionIds = [];
        if (this._representation.asset_collections.icon) {
            if (this._representation.asset_collections.icon.default_id) {
                assetCollectionIds.push(this._representation.asset_collections.icon.default_id);
            }
            if (this._representation.asset_collections.icon.active_id) {
                assetCollectionIds.push(this._representation.asset_collections.icon.active_id);
            }
        }
        return Promise.all(assetCollectionIds.map((iconAssetCollection) => {
            return this._fetchAssetCollection(iconAssetCollection)
                .then((assetCollection) => {
                    if (assetCollection.assets.image_src) {
                        return this._fetchMedia(assetCollection.assets.image_src);
                    }
                    return Promise.resolve();
                })
                .then((imageUrl) => {
                    if (imageUrl) {
                        const image = new Image();
                        image.src = imageUrl;
                        logger.info(`Preloading icon ${imageUrl}`);
                        this._preloadedIconAssets.push(image);
                    }
                }).catch((err) => {
                    logger.error(err, `could not preload icon asset ${iconAssetCollection}`);
                });
        }));
    }

    getBehaviourRenderer(behaviourUrn: string): (behaviour: Object, callback: () => mixed) => void {
        return this._behaviourRendererMap[behaviourUrn];
    }

    hasShowIconBehaviour(): boolean {
        if (this._representation.behaviours) {
            if (this._representation.behaviours.started) {
                const startMatches = this._representation.behaviours.started.filter(behave =>
                    behave.type === 'urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0'); // eslint-disable-line max-len
                if (startMatches.length > 0) {
                    return true;
                }
            }
            if (this._representation.behaviours.completed) {
                const endMatches = this._representation.behaviours.completed.filter(behave =>
                    behave.type === 'urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0'); // eslint-disable-line max-len
                if (endMatches.length > 0) {
                    return true;
                }
            }
            if (this._representation.behaviours.during) {
                const matches = this._representation.behaviours.during.filter(behave =>
                    behave.behaviour.type === 'urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0'); // eslint-disable-line max-len
                if (matches.length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    resetPlayer() {
        this._player.resetControls();
        this._player.removeListener(PlayerEvents.LINK_CHOSEN, this._handleLinkChoiceEvent);
    }


    _willHideControls(behaviour: Object) {
        return behaviour.type ===
            'urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0' // eslint-disable-line max-len
            && behaviour.disable_controls && behaviour.show_if_one_choice;
    }

    _hideControls(startTime: number) {
        const hideControls = () => {
            this._player.disableControls();
            this._player._hideRomperButtons();
        };
        if (startTime > 1) {
            this.addTimeEventListener(
                'prechoice-control-hide',
                startTime - 0.4,
                hideControls,
            );
        } else {
            hideControls();
        }
    }

    _showControls() {
        this._player.enableControls();
    }

    _runDuringBehaviours() {
        // run during behaviours
        if (this._representation.behaviours && this._representation.behaviours.during) {
            const duringBehaviours = this._representation.behaviours.during;
            duringBehaviours.forEach((behaviour) => {
                this._runSingleDuringBehaviour(behaviour);
            });
        }
    }

    _runSingleDuringBehaviour(behaviour: Object) {
        const behaviourRunner = this.getBehaviourRenderer(behaviour.behaviour.type);
        if (behaviourRunner) {
            const startCallback = () => {
                logger.info(`started during behaviour ${behaviour.behaviour.type}`);
                this._analytics({
                    type: AnalyticEvents.types.RENDERER_ACTION,
                    name: AnalyticEvents.names.DURING_BEHAVIOUR_STARTED,
                    from: behaviour.behaviour.type,
                    to: '',
                });
                behaviourRunner(behaviour.behaviour, () =>
                    logger.info(`completed during behaviour ${behaviour.behaviour.type}`));
            }
            if (this._willHideControls(behaviour.behaviour)) {
                this._hideControls(behaviour.start_time);
            }
            const startTime = behaviour.start_time;
            const endTime = getBehaviourEndTime(behaviour);
            const clearFunction = () => {
                const behaviourElement = document.getElementById(behaviour.behaviour.id);
                if (behaviourElement && behaviourElement.parentNode) {
                    behaviourElement.parentNode.removeChild(behaviourElement);
                }
                this._showControls();
            };
            const listenerId = behaviour.behaviour.id;
            if (startTime === 0) {
                startCallback();
                this.addTimeEventListener(listenerId, endTime, clearFunction);
            } else {
                this.addTimeEventListener(
                    listenerId,
                    startTime,
                    startCallback,
                    endTime,
                    clearFunction,
                );
            }
        } else {
            logger.warn(`${this.constructor.name} does not support ` +
                `${behaviour.behaviour.type} - ignoring`)
        }
    }

    // //////////// show link choice behaviour
    _applyShowChoiceBehaviour(behaviour: Object, callback: () => mixed) {
        this._player.on(PlayerEvents.LINK_CHOSEN, this._handleLinkChoiceEvent);

        this._linkChoiceBehaviourOverlay = this._player.createBehaviourOverlay(behaviour);
        this._setBehaviourElementAttribute(this._linkChoiceBehaviourOverlay.overlay, 'link-choice');

        this._choiceBehaviourData = {
            choiceIconNEObjects: null,
            behaviour,
            callback,
        };
        // listen for variable changes and update choices to reflect
        this._controller.on(VARIABLE_EVENTS.CONTROLLER_CHANGED_VARIABLE, this._renderLinkChoices);

        // show them in current state
        return this._renderLinkChoices();
    }

    // have the choices available changed
    // compare new NE objects to those we have at the moment
    _choicesHaveChanged(newNEObjects: Array<Object>) {
        const { choiceIconNEObjects } = this._choiceBehaviourData;
        if (choiceIconNEObjects.length !== newNEObjects.length) return true;
        let allNesStillIn = true;
        newNEObjects.forEach((neo) => {
            if (!choiceIconNEObjects.find(
                (e) => e.targetNeId === neo.targetNeId)) {
                allNesStillIn = false;
            }
        });
        return !allNesStillIn;
    }

    _renderLinkChoices() {
        const { behaviour, callback, choiceIconNEObjects } = this._choiceBehaviourData;
        // get behaviours of links from data
        const {
            showNeToEnd,
            countdown,
            disableControls,
            iconOverlayClass,
            forceChoice,
            oneShot,
            showIfOneLink,
        } = this._getLinkChoiceBehaviours(behaviour);

        this._linkBehaviour = {
            showNeToEnd,
            oneShot,
            forceChoice,
            callback: forceChoice ? callback : () => {},
        };

        const behaviourOverlay = this._linkChoiceBehaviourOverlay;

        // get valid links
        return this._controller.getValidNextSteps().then((narrativeElementObjects) => {
            if (choiceIconNEObjects !== null) {
                if (this._choicesHaveChanged(narrativeElementObjects)) {
                    logger.info('Variable state has changed valid links - need to refresh icons');
                    this._player.clearLinkChoices();
                    behaviourOverlay.clearAll();
                } else {
                    logger.info('Variable state has changed, but same link options valid');
                    return Promise.resolve();
                }
            }

            // save current set of icons so we can easily test if they need to be rebuilt
            // after a variable state change
            this._choiceBehaviourData.choiceIconNEObjects = narrativeElementObjects;
            if (narrativeElementObjects.length === 0) {
                logger.warn('Show link icons behaviour run, but no links are currently valid');
                this._player.enableControls();
                callback();
                return Promise.resolve();
            }

            // abort now if only one link and not showIfOneLink
            if (narrativeElementObjects.length === 1 && !showIfOneLink) {
                logger.info('Link Choice behaviour ignored - only one link');
                this._player.enableControls();
                callback();
                return Promise.resolve();
            }

            // find out which link is default
            const defaultLinkId = this._getDefaultLink(narrativeElementObjects);

            // go through asset collections and render icons
            return this._getIconSourceUrls(narrativeElementObjects, behaviour)
                .then((iconObjects) => {

                    this._player.clearLinkChoices();
                    iconObjects.forEach((iconSpecObject) => {
                        this._buildLinkIcon(iconSpecObject, behaviourOverlay.overlay);
                    });
                    if (iconObjects.length > 1 || showIfOneLink) {
                        this._showChoiceIcons({
                            defaultLinkId, // id for link to highlight at start
                            forceChoice, // do we highlight
                            disableControls, // are controls disabled while icons shown
                            countdown, // do we animate countdown
                            iconOverlayClass, // css classes to apply to overlay

                            behaviourOverlay,
                            choiceCount: iconObjects.length,
                        });

                        // callback to say behaviour is done, but not if user can
                        // change their mind
                        if (!forceChoice) {
                            callback();
                        }
                    } else {
                        logger.info('Link Choice behaviour ignored - only one link');
                        this._linkBehaviour.forceChoice = false;
                        callback();
                    }
                }).catch((err) => {
                    logger.error(err, 'could not get assets for rendering link icons');
                    callback();
                });
        }).catch((err) => {
            logger.error(err, 'Could not get next steps for rendering links');
            callback();
        });
    }

    // handler for user clicking on link choice
    _handleLinkChoiceEvent(eventObject: Object) {
        if(this.checkIsLooping()) {
            this._playoutEngine.removeLoopAttribute(this._rendererId);
        }
        this._followLink(eventObject.id, eventObject.behaviourId);
    }

    // get behaviours of links from behaviour meta data
    _getLinkChoiceBehaviours(behaviour: Object): Object {
        // set default behaviours if not specified in data model
        let countdown = false;
        let disableControls = true;
        let iconOverlayClass = null;
        let forceChoice = false;
        let oneShot = false;
        let showNeToEnd = true;
        let showIfOneLink = false;

        // and override if they are specified
        if (behaviour.hasOwnProperty('show_ne_to_end')) {
            showNeToEnd = behaviour.show_ne_to_end;
        }
        if (behaviour.hasOwnProperty('one_shot')) {
            oneShot = behaviour.one_shot;
        }
        if (behaviour.hasOwnProperty('show_if_one_choice')) {
            showIfOneLink = behaviour.show_if_one_choice;
        }
        // do we show countdown?
        if (behaviour.hasOwnProperty('show_time_remaining')) {
            countdown = behaviour.show_time_remaining;
        }
        // do we disable controls while choosing
        if (behaviour.hasOwnProperty('disable_controls')) {
            disableControls = behaviour.disable_controls;
        }
        // do we apply any special css classes to the overlay
        if (behaviour.hasOwnProperty('overlay_class')) {
            iconOverlayClass = behaviour.overlay_class;
        }
        if (behaviour.hasOwnProperty('force_choice')) {
            forceChoice = behaviour.force_choice;
        }

        return {
            showNeToEnd,
            countdown,
            disableControls,
            iconOverlayClass,
            forceChoice,
            oneShot,
            showIfOneLink,
        };
    }

    // get data objects including resolved src urls for icons to represent link choices
    _getIconSourceUrls(
        narrativeElementObjects: Array<Object>,
        behaviour: Object,
    ): Promise<Array<Object>> {
        const iconObjectPromises: Array<Promise<Object>> = [];
        narrativeElementObjects.forEach((choiceNarrativeElementObj, i) => {
            logger.info(`choice ${(i + 1)}: ${choiceNarrativeElementObj.ne.id}`);
            // blank object describing each icon
            const iconSpecObject = {
                choiceId: i,
                acId: null,
                ac: null,
                resolvedUrl: null,
                targetNarrativeElementId: choiceNarrativeElementObj.targetNeId,
                iconText: null,
            };
            // first get an asset collection id for each icon
            // firstly is there an  icon specified in the behaviour
            if (behaviour.link_icons) {
                behaviour.link_icons.forEach((linkIconObject) => {
                    // eslint-disable-next-line max-len
                    if (linkIconObject.target_narrative_element_id === choiceNarrativeElementObj.targetNeId) {
                        if (linkIconObject.image) {
                            // map representation to asset
                            iconSpecObject.acId =
                                this.resolveBehaviourAssetCollectionMappingId(linkIconObject.image);
                            // inject any other properties in data model into the object
                            Object.keys(linkIconObject).forEach((key) => {
                                if (key !== 'image') {
                                    iconSpecObject[key] = linkIconObject[key];
                                }
                            });
                        }
                        if (linkIconObject.text) {
                            iconSpecObject.iconText = linkIconObject.text;
                        }
                    }
                });
            }
            iconObjectPromises.push(Promise.resolve(iconSpecObject));
        });

        return Promise.all(iconObjectPromises).then((iconSpecObjects) => {
            // next resolve asset collection ids into asset collection objects
            const iconAssetCollectionPromises = [];
            iconSpecObjects.forEach((iconSpecObj) => {
                if (iconSpecObj.acId) {
                    iconAssetCollectionPromises.push(this._fetchAssetCollection(iconSpecObj.acId));
                } else {
                    iconAssetCollectionPromises.push(Promise.resolve(null));
                }
            });
            return Promise.all(iconAssetCollectionPromises).then((resolvedAcs) => {
                resolvedAcs.forEach((resolvedAc, index) => {
                    const holdingObj = iconSpecObjects[index];
                    holdingObj.ac = resolvedAc;
                });
                return Promise.resolve(iconSpecObjects);
            });
        }).then((iconObjects) => {
            // next get src urls from each asset collection and resolve them using media fetcher
            const fetcherPromises = [];
            iconObjects.forEach((iconObject) => {
                if (iconObject && iconObject.ac && iconObject.ac.assets.image_src) {
                    fetcherPromises.push(this._fetchMedia(iconObject.ac.assets.image_src));
                } else {
                    fetcherPromises.push(Promise.resolve(''));
                }
            });
            return Promise.all(fetcherPromises).then((resolvedUrls) => {
                const returnObjects = [];
                resolvedUrls.forEach((resolvedUrl, i) => {
                    const obj = iconObjects[i];
                    obj.resolvedUrl = resolvedUrl;
                    returnObjects.push(obj);
                });
                return returnObjects;
            });
        });
    }

    // tell the player to build an icon
    // but won't show yet
    _buildLinkIcon(iconObject: Object, behaviourElement: HTMLElement) {
        // tell Player to build icon
        const targetId = iconObject.targetNarrativeElementId;
        let icon;
        if (iconObject.iconText && iconObject.resolvedUrl) {
            icon = this._player.addTextLinkIconChoice(
                behaviourElement,
                targetId,
                iconObject.iconText,
                iconObject.resolvedUrl,
                `Option ${(iconObject.choiceId + 1)}`,
            );
        } else if (iconObject.iconText) {
            icon = this._player.addTextLinkChoice(
                behaviourElement,
                targetId,
                iconObject.iconText,
                `Option ${(iconObject.choiceId + 1)}`,
            );
        } else if (iconObject.resolvedUrl) {
            icon = this._player.addLinkChoiceControl(
                behaviourElement,
                targetId,
                iconObject.resolvedUrl,
                `Option ${(iconObject.choiceId + 1)}`,
            );
        } else {
            logger.warn(`No icon specified for link to ${targetId} - not rendering`);
        }
        if (icon && iconObject.position && iconObject.position.two_d) {
            const {
                left,
                top,
            } = iconObject.position.two_d;
            let {
                width,
                height,
            } = iconObject.position.two_d;
            if (left !== undefined && top !== undefined
                && (width !== undefined || height !== undefined)) {
                if (width === undefined) {
                    width = height;
                } else if (height === undefined) {
                    height = width;
                }
                icon.style.position = 'absolute';
                icon.style.top = `${top}%`;
                icon.style.left = `${left}%`;
                icon.style.width = `${width}%`;
                icon.style.height = `${height}%`;
            }
        }
    }

    // tell the player to show the icons
    // parameter specifies how icons are presented
    _showChoiceIcons(iconDataObject: Object) {
        const {
            defaultLinkId, // id for link to highlight at start
            forceChoice,
            disableControls, // are controls disabled while icons shown
            countdown, // do we animate countdown
            iconOverlayClass, // css classes to apply to overlay
            behaviourOverlay,
            choiceCount,
        } = iconDataObject;

        this._player.showChoiceIcons(
            forceChoice ? null : defaultLinkId,
            iconOverlayClass,
            behaviourOverlay,
            choiceCount,
        ).then(() => {
            if (disableControls) {
                // disable transport controls
                this._player.disableControls();
            }
            if (countdown) {
                this._player.startChoiceCountdown(this);
            }
            this._player.enableLinkChoiceControl();
        }).catch((err) => { // REFACTOR: this returns a promise
            logger.error(err, 'could not render link choice icons')  ;
        });
    }

    // user has made a choice of link to follow - do it
    _followLink(narrativeElementId: string, behaviourId: string) {
        this._controller.off(VARIABLE_EVENTS.CONTROLLER_CHANGED_VARIABLE, this._renderLinkChoices);
        if (this._linkBehaviour) {
            this._linkBehaviour.forceChoice = false; // they have made their choice
        }
        const currentNarrativeElement = this._controller.getCurrentNarrativeElement();
        if (this._linkBehaviour && this._linkBehaviour.showNeToEnd) {
            // if not done so, save initial conditions
            // now make chosen link top option
            currentNarrativeElement.links.forEach((neLink) => {
                if (neLink.target_narrative_element_id === narrativeElementId) {
                    neLink.override_as_chosen = true; // eslint-disable-line no-param-reassign
                } else if (neLink.hasOwnProperty('override_as_chosen')) {
                    neLink.override_as_chosen = false; // eslint-disable-line no-param-reassign
                }
            });

            // if already ended, follow immediately
            if (this._hasEnded) {
                this._hideChoiceIcons(narrativeElementId, behaviourId);
            // do we keep the choice open?
            } else if (this._linkBehaviour && this._linkBehaviour.oneShot) {
                // hide icons
                this._hideChoiceIcons(null, behaviourId);
                // refresh next/prev so user can skip now if necessary
                this._controller.refreshPlayerNextAndBack();
                this._player.enableControls();
                this._player.showSeekButtons();
            }
        } else {
            // or follow link now
            this._hideChoiceIcons(narrativeElementId, behaviourId);
        }
    }

    _getDefaultLink(narrativeElementObjects: Array<Object>): ?string {
        const currentNarrativeElement = this._controller.getCurrentNarrativeElement();
        const validLinks = currentNarrativeElement.links.filter(link =>
            narrativeElementObjects.filter(ne =>
                ne.targetNeId === link.target_narrative_element_id).length > 0);

        const defaultLink = validLinks[0];

        return defaultLink && defaultLink.target_narrative_element_id;
    }


    // revert link conditions for current NE to what they were originally
    _reapplyLinkConditions() {
        const currentNarrativeElement = this._controller.getCurrentNarrativeElement();
        currentNarrativeElement.links.forEach((neLink) => {
            if (neLink.hasOwnProperty('override_as_chosen')) {
                neLink.override_as_chosen = false; // eslint-disable-line no-param-reassign
            }
        });
    }

    // hide the choice icons, and optionally follow the link
    _hideChoiceIcons(narrativeElementId: ?string, behaviourId: string) {
        if (narrativeElementId) { this._reapplyLinkConditions(); }
        const behaviourElement = document.getElementById(behaviourId);
        if(behaviourElement) {
            this._linkFadeTimeout = setTimeout(() => {
                behaviourElement.classList.remove('romper-icon-fade');
                this._player.clearLinkChoices();
                if (narrativeElementId) {
                    this._controller.followLink(narrativeElementId);
                } else {
                    this._linkBehaviour.callback();
                }
            }, 1500);
            behaviourElement.classList.add('romper-icon-fade');
        }
    }

    // //////////// end of show link choice behaviour

    _applyColourOverlayBehaviour(behaviour: Object, callback: () => mixed) {
        const { colour } = behaviour;
        const overlayImageElement = document.createElement('div');
        this._setBehaviourElementAttribute(overlayImageElement, 'colour-overlay');
        overlayImageElement.style.background = colour;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
        callback();
    }

    // REFACTOR note: these are called by the behaviour, without knowing what will happen
    // via behaviour map
    _applyShowImageBehaviour(behaviour: Object, callback: () => mixed) {
        const behaviourAssetCollectionMappingId = behaviour.image;
        const assetCollectionId =
            this.resolveBehaviourAssetCollectionMappingId(behaviourAssetCollectionMappingId);
        if (assetCollectionId) {
            this._fetchAssetCollection(assetCollectionId)
                .then((assetCollection) => {
                    if (assetCollection.assets.image_src) {
                        return this._fetchMedia(assetCollection.assets.image_src);
                    }
                    return Promise.resolve();
                })
                .then((imageUrl) => {
                    if (imageUrl) {
                        this._overlayImage(imageUrl, behaviour.id);
                    }
                    callback();
                })
                .catch((err) => {
                    logger.error(err, 'could not get image for show image behaviour');
                });
        } else {
            logger.error('No asset collection id for show image behaviour');
        }
    }

    _overlayImage(imageSrc: string, id: string) {
        const overlayImageElement = document.createElement('img');
        overlayImageElement.id = id;
        this._setBehaviourElementAttribute(overlayImageElement, 'image-overlay');
        overlayImageElement.src = imageSrc;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
    }

    _applySocialSharePanelBehaviour(behaviour: Object, callback: () => mixed) {
        const modalElement = renderSocialPopup(
            behaviour,
            this._player._overlays,
            callback,
            this._analytics,
        );
        this._setBehaviourElementAttribute(modalElement, 'social-share');
        this._behaviourElements.push(modalElement);
    }

    _applyLinkOutBehaviour(behaviour: Object, callback: () => mixed) {
        const modalElement = renderLinkoutPopup(
            behaviour,
            this._player._overlays,
            callback,
            this._analytics,
        );
        this._setBehaviourElementAttribute(modalElement, 'link-out');
        this._behaviourElements.push(modalElement);
    }


    _setBehaviourElementAttribute(element: HTMLElement, attributeValue: string) {
        element.setAttribute('data-behaviour', attributeValue)
        element.setAttribute('behaviour-renderer', this._rendererId);
    }

    // //////////// variables panel choice behaviour

    _setVariableValue(varName: string, value: any) {
        this._controller.getVariableValue(varName).then((oldVal) => {
            this._controller.setVariableValue(varName, value);
            const logData = {
                type: AnalyticEvents.types.USER_ACTION,
                name: AnalyticEvents.names.USER_SET_VARIABLE,
                from: `${varName}: ${oldVal}`,
                to: `${varName}: ${value}`,
            };
            this._analytics(logData);
        });
    }

    _applyShowVariablePanelBehaviour(behaviour: Object, callback: () => mixed) {
        buildPanel(
            behaviour,
            this._controller.getVariableState.bind(this._controller),
            this._controller.getVariableValue.bind(this._controller),
            this._setVariableValue.bind(this),
            callback,
            this._target,
            this._player,
            this,
            this._analytics,
        );
    }
    // //////////// end of variables panel choice behaviour

    _clearBehaviourElements() {
        const behaviourElements =
            document.querySelectorAll(`[behaviour-renderer="${this._rendererId}"]`);
        behaviourElements.forEach((be) => {
            try {
                if(be && be.parentNode) {
                    be.parentNode.removeChild(be);
                }
            } catch (e) {
                logger.warn(`could not remove behaviour element ${be.id} from Renderer`);
            }
        });
    }

    // Takes a UUID used in a behaviour and resolves it to an asset collection
    resolveBehaviourAssetCollectionMappingId(behaviourAssetCollectionMappingId: string) {
        if (this._representation.asset_collections.behaviours) {
            let returnId = null;
            this._representation.asset_collections.behaviours
                .some((assetCollectionsBehaviour) => {
                    if (assetCollectionsBehaviour.behaviour_asset_collection_mapping_id
                            === behaviourAssetCollectionMappingId) {
                        returnId = assetCollectionsBehaviour.asset_collection_id;
                        return true;
                    }
                    return false;
                });
            return returnId;
        }
        return null;
    }

    // can this render in a headset?
    // eslint-disable-next-line class-methods-use-this
    isVRViewable(): boolean {
        return false;
    }

    addTimeEventListener(
        listenerId: string,
        startTime: number,
        startCallback: Function,
        endTime: ?number,
        clearCallback: ?Function,
    ) {
        this._timer.addTimeEventListener(listenerId, startTime, startCallback, endTime, clearCallback); // eslint-disable-line max-len
    }

    deleteTimeEventListener(listenerId: string) {
        this._timer.deleteTimeEventListener(listenerId);
    }

    // the renderer is waiting in an infinite pause behaviour
    setInPause(paused: boolean) {
        this._inPauseBehaviourState = paused;
    }

    getInPause(): boolean {
        return this._inPauseBehaviourState;
    }

    seekEventHandler(inTime: number) {
        const currentTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if(this.checkIsLooping()) {
            if (currentTime !== undefined && currentTime <= 0.002) {
                if(inTime !== 0) {
                    this.setCurrentTime(inTime);
                }
                // this.resetPlayer();
                if(this.isIosPlayoutEngine()) {
                    if(this._playoutEngine._playing
                        && this._playoutEngine._foregroundMediaElement.paused) {
                        this._playoutEngine.play();
                    }
                }
            }
        }
    }

    checkIsLooping() {
        return this._playoutEngine.checkIsLooping(this._rendererId);
    }

    /**
     * Destroy is called as this representation is unloaded from being visible.
     * You should leave the DOM as you left it.
     *
     * @return {void}
     */
    destroy() {
        if (debugPhase) logger.info('PHASE destroying', this._representation.name, this.phase);
        if (this.phase === RENDERER_PHASES.DESTROYED) {
            // eslint-disable-next-line max-len
            if (debugPhase) logger.info('PHASE destroying - already destroyed', this._representation.name, this.phase);
            return false;
        }
        if (!this.phase === RENDERER_PHASES.ENDED) {
            if (debugPhase) logger.info('PHASE destroying need to end first');
            this.end();
        }
        this._clearBehaviourElements();
        if (this._behaviourRunner) {
            this._behaviourRunner.destroyBehaviours();
        }
        // we didn't find any behaviours to run, so emit completion event
        this.emit(RendererEvents.DESTROYED);
        this._destroyed = true;
        return true;
    }

    isIosPlayoutEngine() {
        return (this._playoutEngine instanceof iOSPlayoutEngine)
    }

    getController(): Controller {
        return this._controller;
    }
}
