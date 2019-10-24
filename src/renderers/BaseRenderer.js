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

import { renderSocialPopup } from '../behaviours/SocialShareBehaviourHelper';
import { renderLinkoutPopup } from '../behaviours/LinkOutBehaviourHelper';
import iOSPlayoutEngine from '../playoutEngines/iOSPlayoutEngine';
import SrcSwitchPlayoutEngine from '../playoutEngines/SrcSwitchPlayoutEngine';
import TimeManager from '../TimeManager';

const SEEK_TIME = 10;

const getBehaviourEndTime = (behaviour: Object) => {
    if(behaviour.duration !== undefined) {
        const endTime = behaviour.start_time + behaviour.duration;
        return endTime;
    }
    return undefined;
}

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

    _savedLinkConditions: Object;

    _linkBehaviour: Object;

    _hasEnded: boolean;

    inVariablePanel: boolean;

    _linkFadeTimeout: TimeoutID;

    seekEventHandler: Function;

    checkIsLooping: Function;

    _loopCounter: number;

    _willHideControls: Function;

    _hideControls: Function;

    _timer: TimeManager;

    isSrcIosPlayoutEngine: Function;

    _cleanupSingleDuringBehaviour: Function;

    _runSingleDuringBehaviour: Function;

    _runDuringBehaviours: Function;

    addTimeEventListener: Function;

    _addPauseHandlersForTimer: Function;
    
    _removePauseHandlersForTimer: Function;

    _handlePlayPauseButtonClicked: Function;

    _duration: ?number;

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
        this._handleLinkChoiceEvent = this._handleLinkChoiceEvent.bind(this);
        this._applySocialSharePanelBehaviour = this._applySocialSharePanelBehaviour.bind(this);
        this._applyLinkOutBehaviour = this._applyLinkOutBehaviour.bind(this);
        this._seekBack = this._seekBack.bind(this);
        this._seekForward = this._seekForward.bind(this);
        this._togglePause = this._togglePause.bind(this);
        this.seekEventHandler = this.seekEventHandler.bind(this);
        this.checkIsLooping = this.checkIsLooping.bind(this);
        this.isSrcIosPlayoutEngine = this.isSrcIosPlayoutEngine.bind(this);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);


        this._willHideControls = this._willHideControls.bind(this); 
        this._hideControls = this._hideControls.bind(this);
        this._runDuringBehaviours = this._runDuringBehaviours.bind(this);
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

        this._destroyed = false;
        this._analytics = analytics;
        this.inVariablePanel = false;
        this._savedLinkConditions = {};
        this._preloadedBehaviourAssets = [];
        this._preloadBehaviourAssets();
        this._preloadIconAssets();
        this._loopCounter = 0;
    }

    willStart(elementName: ?string, elementId: ?string) {
        this.inVariablePanel = false;
        this._behaviourRunner = this._representation.behaviours
            ? new BehaviourRunner(this._representation.behaviours, this)
            : null;
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
        this._player.on(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED, this._seekBack);
        this._player.on(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED, this._seekForward);
        if(checkAddDetailsOverride()) {
            const { name, id } = this._representation;
            this._player.addDetails(elementName, elementId, name, id)
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
        this.emit(RendererEvents.STARTED);
        this._hasEnded = false;
        this._timer.start();
        if (!this._playoutEngine.isPlaying()) this._timer.pause();
        this._addPauseHandlersForTimer();
        this._player.exitStartBehaviourPhase();
        this._clearBehaviourElements();
        this._removeInvalidDuringBehaviours()
            .then(() => this._runDuringBehaviours());
        this._player.connectScrubBar(this);
        this._player.on(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED, this._handlePlayPauseButtonClicked);
    }

    end() {
        this._player.disconnectScrubBar(this);
        this._clearBehaviourElements()
        this._reapplyLinkConditions();
        clearTimeout(this._linkFadeTimeout);
        this._player.removeListener(PlayerEvents.LINK_CHOSEN, this._handleLinkChoiceEvent);
        this._player.removeListener(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED, this._seekBack);
        this._player.removeListener(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED, this._seekForward);
        this._timer.clear();
        this._loopCounter = 0;
        this._player.removeListener(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED, this._handlePlayPauseButtonClicked);
    }

    hasEnded(): boolean {
        return this._hasEnded;
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

    _getDuration(): number {
        let  { duration } = this._representation; // specified in rep
        if (duration !== undefined) {
            this._duration = duration;
            return this._duration;    
        }

        // otherwise need to work out
        if (this._duration !== undefined  && this._duration !== Infinity) {
            return this._duration; // if value stored, return
        }
        if (duration === undefined) {
            // if not, check playout engine
            duration = Infinity;
            if (this.checkIsLooping()){
                // looping, and not specified in rep => infinite
                duration = Infinity;
            } else {
                // if we have playout engine duration, use
                duration = this._playoutEngine.getDuration(this._rendererId);
                if (duration === undefined) {
                    duration = Infinity;
                }
            }
        }
        this._duration = duration;
        return this._duration;
    }

    getCurrentTime(): Object {
        const duration = this._getDuration();
        const currentTime = this._timer.getTime();
        let timeBased = false;
        let remainingTime = Infinity;
        if (duration === Infinity) {
            logger.warn('getting time data from BaseRenderer without duration');
        } else {
            timeBased = true;
            remainingTime = duration - currentTime;
        }
        const timeObject = {
            timeBased,
            currentTime,
            remainingTime,
            duration,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        logger.warn(`setting time on BaseRenderer ${time}`);
        this._timer.setTime(time);
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
    }

    play() {
        this._timer.resume();
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
        this._hasEnded = true;
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
        assetCollectionIds.forEach((behaviour) => {
            this._fetchAssetCollection(behaviour.asset_collection_id)
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
                });
        });
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

    _removeInvalidDuringBehaviours() {
        return this._controller.getValidNextSteps()
            .then((narrativeElementObjects) => {
                if(narrativeElementObjects.length === 0) {
                    logger.warn("Removing showlinkchoices behaviour due to no valid links");
                    delete this._behaviourRendererMap[
                        'urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0'
                    ];
                }
            })
            // If this fails then we don't care
            .catch((err) => {
                logger.warn(err);
            })
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
                startTime - 0.8,
                hideControls,
            );
        } else {
            hideControls();
        }
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
                behaviourRunner(behaviour.behaviour, () =>
                    logger.info(`completed during behaviour ${behaviour.behaviour.type}`));
                if (this._willHideControls(behaviour.behaviour)) {
                    this._hideControls(behaviour.start_time);
                }
            }
            const startTime = behaviour.start_time;
            const endTime = getBehaviourEndTime(behaviour);
            const clearFunction = () => {
                const behaviourElement = document.getElementById(behaviour.behaviour.id);
                if (behaviourElement && behaviourElement.parentNode) {
                    behaviourElement.parentNode.removeChild(behaviourElement);
                }
            };
            const listenerId = behaviour.behaviour.id;
            this.addTimeEventListener(listenerId, startTime, startCallback, endTime, clearFunction);
        } else {
            logger.warn(`${this.constructor.name} does not support ` +
                `${behaviour.behaviour.type} - ignoring`)
        }
    }

    // //////////// show link choice behaviour
    _applyShowChoiceBehaviour(behaviour: Object, callback: () => mixed) {
        this._player.on(PlayerEvents.LINK_CHOSEN, this._handleLinkChoiceEvent);
        const behaviourOverlay = this._player.createBehaviourOverlay(behaviour);
        this._setBehaviourElementAttribute(behaviourOverlay.overlay, 'link-choice');

        logger.info('Rendering link icons for user choice');
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

        // get valid links
        return this._controller.getValidNextSteps().then((narrativeElementObjects) => {
            if(narrativeElementObjects.length === 0) {
                return Promise.reject(new Error(
                    "Shouldn't be possible to get here as "
                    + "_removeInvalidDuringBehaviours should remove this rep"
                ));
            }
            // build icons
            const iconSrcPromises = this._getIconSourceUrls(narrativeElementObjects, behaviour);

            // we want to ensure a default link is taken, if we aren't looping as that'll remove the link from the selection next time around
            if(!this.checkIsLooping()) {
                this._applyDefaultLink(narrativeElementObjects);
            }
            const defaultLinkId = this._getDefaultLink(narrativeElementObjects);

            // go through asset collections and render icons
            return iconSrcPromises.then((iconObjects) => {

                this._player.clearLinkChoices();
                iconObjects.forEach((iconSpecObject) => {
                    // add the icon to the player
                    this._buildLinkIcon(iconSpecObject, behaviourOverlay.overlay);
                });
                if(iconObjects.length > 1 || showIfOneLink) {
                    // add link elements to the div element for the behaviour
                }

                if (iconObjects.length > 1 || showIfOneLink) {
                    this._showChoiceIcons({
                        defaultLinkId, // id for link to highlight at start
                        forceChoice, // do we highlight
                        disableControls, // are controls disabled while icons shown
                        countdown, // do we animate countdown
                        iconOverlayClass, // css classes to apply to overlay
                        // css classes to apply to overlay
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
            });
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
            if (iconSpecObject.acId === null && iconSpecObject.iconText === null) {
                // if not specified - get default icon...
                iconObjectPromises.push(this._controller
                    .getRepresentationForNarrativeElementId(choiceNarrativeElementObj.ne.id)
                    .then((representation) => {
                        let defaultSrcAcId = null;
                        if (representation && representation.asset_collections.icon
                            && representation.asset_collections.icon.default_id) {
                            defaultSrcAcId = representation.asset_collections.icon.default_id;
                        }
                        return Promise.resolve({
                            choiceId: i,
                            acId: defaultSrcAcId,
                            ac: null,
                            resolvedUrl: null,
                            targetNarrativeElementId: choiceNarrativeElementObj.targetNeId,
                        });
                    }));
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
        this._player.showChoiceIcons(forceChoice ? null : defaultLinkId, iconOverlayClass, behaviourOverlay, choiceCount);
        this._player.enableLinkChoiceControl();
        if (disableControls) {
            // disable transport controls
            this._player.disableControls();
        }
        if (countdown) {
            this._player.startChoiceCountdown(this);
        }
    }

    // user has made a choice of link to follow - do it
    _followLink(narrativeElementId: string, behaviourId: string) {
        if (this._linkBehaviour) {
            this._linkBehaviour.forceChoice = false; // they have made their choice
        }
        const currentNarrativeElement = this._controller.getCurrentNarrativeElement();
        if (this._linkBehaviour && this._linkBehaviour.showNeToEnd) {
            // if not done so, save initial conditions
            if (Object.keys(this._savedLinkConditions).length === 0) {
                this._saveLinkConditions();
            }
            // now make this link the only valid option
            currentNarrativeElement.links.forEach((neLink) => {
                if (neLink.target_narrative_element_id === narrativeElementId) {
                    // eslint-disable-next-line no-param-reassign
                    neLink.condition = { '==': [1, 1] };
                } else {
                    // eslint-disable-next-line no-param-reassign
                    neLink.condition = { '==': [1, 0] };
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

    // set the link conditions so only the default is valid
    // returns the id of the NE of the default link or null if
    // there isn't one
    // takes an array of objects for all currently valid links
    _applyDefaultLink(narrativeElementObjects: Array<Object>): ?string {
        // filter links to ones amongst the valid links
        const currentNarrativeElement = this._controller.getCurrentNarrativeElement();
        const validLinks = currentNarrativeElement.links.filter(link =>
            narrativeElementObjects.filter(ne =>
                ne.targetNeId === link.target_narrative_element_id).length > 0);

        const defaultLink = validLinks[0];
        // save link conditions from model, and apply new ones to force default choice
        if (!this._savedLinkConditions.narrativeElement) {
            this._saveLinkConditions();
        }
        validLinks.forEach((neLink) => {
            if (neLink === defaultLink) {
                // eslint-disable-next-line no-param-reassign
                neLink.condition = { '==': [1, 1] };
            } else {
                // eslint-disable-next-line no-param-reassign
                neLink.condition = { '==': [1, 0] };
            }
        });
        return defaultLink.target_narrative_element_id;
    }

    // save link conditions for current NE
    _saveLinkConditions() {
        const currentNarrativeElement = this._controller.getCurrentNarrativeElement();
        const conditions = [];
        currentNarrativeElement.links.forEach((neLink) => {
            if (neLink.target_narrative_element_id) {
                conditions.push({
                    target: neLink.target_narrative_element_id,
                    condition: neLink.condition,
                });
            }
        });
        this._savedLinkConditions = {
            narrativeElement: currentNarrativeElement,
            conditions,
        };
    }

    // revert link conditions for current NE to what they were originally
    _reapplyLinkConditions() {
        if (this._savedLinkConditions.narrativeElement) {
            const currentNarrativeElement = this._savedLinkConditions.narrativeElement;
            currentNarrativeElement.links.forEach((neLink) => {
                if (neLink.target_narrative_element_id) {
                    const matches = this._savedLinkConditions.conditions
                        .filter(cond => cond.target === neLink.target_narrative_element_id);
                    if (matches.length > 0) {
                        // eslint-disable-next-line no-param-reassign
                        neLink.condition = matches[0].condition;
                    }
                }
            });
            this._savedLinkConditions = {};
        }
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

    _applyShowImageBehaviour(behaviour: Object, callback: () => mixed) {
        const behaviourAssetCollectionMappingId = behaviour.image;
        const assetCollectionId =
            this.resolveBehaviourAssetCollectionMappingId(behaviourAssetCollectionMappingId);
        if (assetCollectionId) {
            this._fetchAssetCollection(assetCollectionId).then((image) => {
                if (image.assets.image_src) {
                    this._overlayImage(image.assets.image_src, behaviour.id);
                    callback();
                }
            });
        }
    }

    _overlayImage(imageSrc: string, id: string) {
        const overlayImageElement = document.createElement('div');
        overlayImageElement.id = id;
        this._setBehaviourElementAttribute(overlayImageElement, 'image-overlay');
        overlayImageElement.style.backgroundImage = `url(${imageSrc})`;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
    }

    _applySocialSharePanelBehaviour(behaviour: Object, callback: () => mixed) {
        const modalElement = renderSocialPopup(behaviour, this._player._overlays, callback);
        this._setBehaviourElementAttribute(modalElement, 'social-share');
        this._behaviourElements.push(modalElement);
    }

    _applyLinkOutBehaviour(behaviour: Object, callback: () => mixed) {
        const modalElement = renderLinkoutPopup(behaviour, this._player._overlays, callback);
        this._setBehaviourElementAttribute(modalElement, 'link-out');
        this._behaviourElements.push(modalElement);
    }


    _setBehaviourElementAttribute(element: HTMLElement, attributeValue: string) {
        element.setAttribute('data-behaviour', attributeValue)
    }

    // //////////// variables panel choice behaviour

    // an input for selecting the value for a list variable
    _getListVariableSetter(varName: string, variableDecl: Object) {
        if (variableDecl.values.length > 3) {
            return this._getLongListVariableSetter(varName, variableDecl);
        }
        return this._getShortListVariableSetter(varName, variableDecl);
    }

    // a drop-down list input for selecting the value for a list variable
    _getLongListVariableSetter(varName: string, variableDecl: Object) {
        const varInput = document.createElement('div');
        varInput.classList.add('romper-var-form-input-container');

        const options = variableDecl.values;
        const varInputSelect = document.createElement('select');

        options.forEach((optionValue) => {
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', optionValue);
            optionElement.textContent = optionValue;
            varInputSelect.appendChild(optionElement);
        });
        varInput.appendChild(varInputSelect);

        this._controller.getVariableValue(varName)
            .then((varValue) => {
                varInputSelect.value = varValue;
            });

        varInputSelect.onchange = () =>
            this._setVariableValue(varName, varInputSelect.value);

        return varInput;
    }

    // an input for selecting the value for a list variable
    _getBooleanVariableSetter(varName: string) {
        const varInput = document.createElement('div');
        varInput.classList.add('romper-var-form-input-container');

        const varInputSelect = document.createElement('div');
        varInputSelect.classList.add('romper-var-form-button-div');

        const yesElement = document.createElement('button');
        const noElement = document.createElement('button');

        const setSelected = (varVal) => {
            if (varVal) {
                yesElement.classList.add('selected');
                noElement.classList.remove('selected');
            } else {
                yesElement.classList.remove('selected');
                noElement.classList.add('selected');
            }
        };

        yesElement.textContent = 'Yes';
        yesElement.onclick = () => {
            this._setVariableValue(varName, true);
            setSelected(true);
        };
        varInputSelect.appendChild(yesElement);
        noElement.textContent = 'No';
        noElement.onclick = () => {
            this._setVariableValue(varName, false);
            setSelected(false);
        };
        varInputSelect.appendChild(noElement);

        varInput.appendChild(varInputSelect);

        this._controller.getVariableValue(varName)
            .then(varValue => setSelected(varValue));

        return varInput;
    }

    // an input for selecting the value for a list variable
    _getShortListVariableSetter(varName: string, variableDecl: Object) {
        const varInput = document.createElement('div');
        varInput.classList.add('romper-var-form-input-container');

        const options = variableDecl.values;
        const varInputSelect = document.createElement('div');
        varInputSelect.classList.add('romper-var-form-button-div');

        const buttons = {};
        const setSelected = (varValue) => {
            Object.keys(buttons).forEach((key) => {
                if (key === varValue) {
                    buttons[key].classList.add('selected');
                } else {
                    buttons[key].classList.remove('selected');
                }
            });
        };

        options.forEach((optionValue) => {
            const optionElement = document.createElement('button');
            optionElement.textContent = optionValue;
            buttons[optionValue] = optionElement;
            optionElement.onclick = () => {
                this._setVariableValue(varName, optionValue);
                setSelected(optionValue);
            };
            varInputSelect.appendChild(optionElement);
        });
        varInput.appendChild(varInputSelect);

        this._controller.getVariableValue(varName)
            .then(varValue => setSelected(varValue));

        return varInput;
    }

    // an input for changing the value for an integer number variables
    _getIntegerVariableSetter(varName: string) {
        const varInput = document.createElement('div');
        varInput.classList.add('romper-var-form-input-container');

        const varIntInput = document.createElement('input');
        varIntInput.type = 'number';

        this._controller.getVariableValue(varName)
            .then((varValue) => {
                varIntInput.value = varValue;
            });

        varIntInput.onchange = () => this._setVariableValue(varName, varIntInput.value);
        varInput.appendChild(varIntInput);

        return varInput;
    }

    _getNumberRangeVariableSetter(varName: string, range: Object, behaviourVar: Object) {
        const varInput = document.createElement('div');
        varInput.classList.add('romper-var-form-input-container');

        const sliderDiv = document.createElement('div');
        sliderDiv.style.position = 'relative';
        const minSpan = document.createElement('span');
        minSpan.classList.add('min');
        if (behaviourVar.hasOwnProperty('min_label')) {
            minSpan.textContent = behaviourVar.min_label === null ? '' : behaviourVar.min_label;
        } else {
            minSpan.textContent = range.min_val;
        }
        const maxSpan = document.createElement('span');
        maxSpan.classList.add('max');
        if (behaviourVar.hasOwnProperty('max_label')) {
            maxSpan.textContent = behaviourVar.max_label === null ? '' : behaviourVar.max_label;
        } else {
            maxSpan.textContent = range.max_val;
        }

        const outputTest = document.createElement('div');
        outputTest.className = 'romper-var-form-range-output';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.classList.add('romper-var-form-slider');
        slider.id = `variable-input-${varName}`;

        sliderDiv.appendChild(minSpan);
        sliderDiv.appendChild(slider);
        sliderDiv.appendChild(maxSpan);

        const numberInput = document.createElement('input');
        numberInput.classList.add('romper-var-form-slider-input');
        numberInput.classList.add('slider-input');
        numberInput.type = 'number';

        const setOutputPosition = () => {
            const proportion = parseFloat(slider.value)/parseFloat(slider.max);
            let leftPos = minSpan.clientWidth; // minimum value element
            leftPos += (1/12) * slider.clientWidth; // slider margin L
            leftPos += (proportion * (10/12) * slider.clientWidth);
            outputTest.style.left = `${leftPos}px`;
        }

        slider.min = range.min_val;
        slider.max = range.max_val;
        this._controller.getVariableValue(varName)
            .then((varValue) => {
                slider.value = varValue;
                numberInput.value = varValue;
                outputTest.textContent = `${varValue}`;
                setOutputPosition();
            });

        slider.onchange = () => {
            this._setVariableValue(varName, slider.value);
            numberInput.value = slider.value;
        };

        slider.oninput = () => {
            numberInput.value = slider.value;
            outputTest.textContent = `${slider.value}`;
            setOutputPosition();
        };

        numberInput.onchange = () => {
            this._setVariableValue(varName, numberInput.value);
            slider.value = numberInput.value;
        };

        numberInput.oninput = () => {
            this._setVariableValue(varName, numberInput.value);
        };

        varInput.appendChild(sliderDiv);
        if (behaviourVar.hasOwnProperty('precise_entry') && behaviourVar.precise_entry){
            varInput.appendChild(numberInput);
        } else if (!(behaviourVar.hasOwnProperty('min_label')
            || behaviourVar.hasOwnProperty('max_label'))) {
            // if precise, or user has specified labels, don't show
            // otherwise give number feedback
            sliderDiv.appendChild(outputTest);
            window.onresize = () => setOutputPosition();
        }

        return varInput;
    }

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

    // create an input element for setting a variable
    _getVariableSetter(variableDecl: Object, behaviourVar: Object): HTMLDivElement {
        const variableDiv = document.createElement('div');
        variableDiv.className = 'romper-variable-form-item';
        variableDiv.id = `romper-var-form-${behaviourVar.variable_name.replace('_', '-')}`;

        const variableType = variableDecl.variable_type;
        const variableName = behaviourVar.variable_name;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'romper-var-form-label-div';
        const labelSpan = document.createElement('span');
        labelSpan.innerHTML = behaviourVar.label;
        labelDiv.appendChild(labelSpan);
        variableDiv.appendChild(labelDiv);

        const answerContainer = document.createElement('div');
        answerContainer.className = 'romper-var-form-answer-cont-inner';
        const answerContainerOuter = document.createElement('div');
        answerContainerOuter.className = 'romper-var-form-answer-cont';

        answerContainerOuter.appendChild(answerContainer);

        if (variableType === 'boolean') {
            const boolDiv = this._getBooleanVariableSetter(variableName);
            answerContainer.append(boolDiv);
        } else if (variableType === 'list') {
            const listDiv = this._getLongListVariableSetter(
                behaviourVar.variable_name,
                variableDecl,
            );
            listDiv.classList.add('romper-var-form-list-input');
            answerContainer.append(listDiv);
        } else if (variableType === 'number') {
            let numDiv;
            if (variableDecl.hasOwnProperty('range')) {
                numDiv = this._getNumberRangeVariableSetter(
                    variableName,
                    variableDecl.range,
                    behaviourVar,
                );
            } else {
                numDiv = this._getIntegerVariableSetter(variableName);
            }
            numDiv.classList.add('romper-var-form-number-input');
            answerContainer.append(numDiv);
        }

        variableDiv.appendChild(answerContainerOuter);
        return variableDiv;
    }

    _applyShowVariablePanelBehaviour(behaviour: Object, callback: () => mixed) {
        this._player.setNextAvailable(false);
        this.inVariablePanel = true;

        const behaviourVariables = behaviour.variables;
        const formTitle = behaviour.panel_label;
        const vairablePannelElement = document.createElement('div');
        this._setBehaviourElementAttribute(vairablePannelElement, 'variable-pannel');
        vairablePannelElement.className = 'romper-variable-panel';

        if (behaviour.background_colour) {
            vairablePannelElement.style.background = behaviour.background_colour;
        }

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = formTitle;
        titleDiv.className = 'romper-var-form-title';
        vairablePannelElement.appendChild(titleDiv);

        this._controller.getVariableState()
            .then((storyVariables) => {
                const variablesFormContainer = document.createElement('div');
                variablesFormContainer.className = 'romper-var-form-var-containers';

                const carouselDiv = document.createElement('div');
                carouselDiv.className = 'romper-var-form-carousel';
                variablesFormContainer.appendChild(carouselDiv);

                // get an array of divs - one for each question
                const variableFields = [];
                // div for each variable Element
                behaviourVariables.forEach((behaviourVar, i) => {
                    const storyVariable = storyVariables[behaviourVar.variable_name];
                    const variableDiv = this._getVariableSetter(storyVariable, behaviourVar);
                    if (i > 0) {
                        variableDiv.classList.add('right');
                    }
                    variableFields.push(variableDiv);
                    carouselDiv.appendChild(variableDiv);
                });

                vairablePannelElement.appendChild(carouselDiv);
                // show first question
                let currentQuestion = 0;

                // submit button
                const okButtonContainer = document.createElement('div');

                okButtonContainer.className = 'romper-var-form-button-container';
                const okButton = document.createElement('input');
                okButton.className = 'romper-var-form-button';
                okButton.type = 'button';
                okButton.classList.add('var-next');
                okButton.value = 'Next';

                // back button
                const backButton = document.createElement('input');
                backButton.type = 'button';
                backButton.value = 'Back';
                backButton.classList.add('var-back');
                backButton.classList.add('romper-var-form-button');

                const statusSpan = document.createElement('span');
                statusSpan.classList.add('var-count');
                let statusText = `${currentQuestion + 1} of ${behaviourVariables.length}`;
                statusSpan.textContent = statusText;

                // log var panel, value, even if user doesn't change it
                const logSlideChange = (fwd: boolean) => {
                    const currentBehaviour = behaviourVariables[currentQuestion];
                    const varName = currentBehaviour.variable_name;
                    this._controller.getVariableValue(varName).then((value) => {
                        const actionName = fwd ?
                            AnalyticEvents.names.VARIABLE_PANEL_NEXT_CLICKED :
                            AnalyticEvents.names.VARIABLE_PANEL_BACK_CLICKED;
                        const logData = {
                            type: AnalyticEvents.types.USER_ACTION,
                            name: actionName,
                            from: 'unset',
                            to: `${varName}: ${value}`,
                        };
                        this._analytics(logData);
                    });
                };

                const changeSlide = (fwd: boolean) => {
                    logSlideChange(fwd);
                    const targetId = fwd ? currentQuestion + 1 : currentQuestion - 1;

                    if (fwd && currentQuestion >= behaviourVariables.length - 1) {
                        // start fade out
                        vairablePannelElement.classList.remove('active');
                        this.inVariablePanel = false;
                        // complete NE when fade out done
                        setTimeout(() => {
                            this._player.setNextAvailable(true);
                            return callback();
                        }, 700);
                        return false;
                    }
                    // hide current question and show next
                    variableFields.forEach((varDiv, i) => {
                        if (i === targetId) {
                            varDiv.classList.remove('left');
                            varDiv.classList.remove('right');
                        } else if (i < targetId) {
                            varDiv.classList.add('left');
                            varDiv.classList.remove('right');
                        } else {
                            varDiv.classList.remove('left');
                            varDiv.classList.add('right');
                        }
                    });

                    currentQuestion = targetId;
                    if (currentQuestion > 0) {
                        backButton.classList.add('active');
                    } else {
                        backButton.classList.remove('active');
                    }
                    statusText = `${currentQuestion + 1} of ${behaviourVariables.length}`;
                    statusSpan.textContent = statusText;
                    return false;
                };

                backButton.onclick = () => { changeSlide(false); };
                okButton.onclick = () => { changeSlide(true); };

                okButtonContainer.appendChild(backButton);
                okButtonContainer.appendChild(statusSpan);
                okButtonContainer.appendChild(okButton);

                vairablePannelElement.appendChild(okButtonContainer);

                this._target.appendChild(vairablePannelElement);
                setTimeout(() => { vairablePannelElement.classList.add('active'); }, 200);
                this._behaviourElements.push(vairablePannelElement);
            });
    }

    // //////////// end of variables panel choice behaviour

    _clearBehaviourElements() {
        const behaviourElements = document.querySelectorAll('[data-behaviour]');
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

    addTimeEventListener(listenerId: string, startTime: number, startCallback: Function, endTime: ?number, clearCallback: ?Function) {
        this._timer.addTimeEventListener(listenerId, startTime, startCallback, endTime, clearCallback);
    }

    deleteTimeEventListener(listenerId: string) {
        this._timer.deleteTimeEventListener(listenerId);
    }

    seekEventHandler(inTime: number) {
        const currentTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if(this.checkIsLooping()) {
            if (currentTime !== undefined && currentTime <= 0.002) {
                if(inTime !== 0) {
                    this.setCurrentTime(inTime);
                } 
                // this.resetPlayer();
                if(this.isSrcIosPlayoutEngine()) {
                    if(this._playoutEngine._playing && this._playoutEngine._foregroundMediaElement.paused) {
                        this._playoutEngine.play();
                    }
                }
            }
        }
    }
    
    checkIsLooping() {
        const mediaElement = this._playoutEngine.getMediaElement(this._rendererId);
        return mediaElement && mediaElement.hasAttribute('loop');
    }

    /**
     * Destroy is called as this representation is unloaded from being visible.
     * You should leave the DOM as you left it.
     *
     * @return {void}
     */
    destroy() {
        this.end();
        this._clearBehaviourElements();
        if (this._behaviourRunner) {
            this._behaviourRunner.destroyBehaviours();
        }
        // we didn't find any behaviours to run, so emit completion event
        this.emit(RendererEvents.DESTROYED);
        this._destroyed = true;
    }

    isSrcIosPlayoutEngine() {
        return (this._playoutEngine instanceof iOSPlayoutEngine || 
            this._playoutEngine instanceof SrcSwitchPlayoutEngine)
    }
}
