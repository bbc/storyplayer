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

const SEEK_TIME = 10;

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

    _handleLinkChoiceEvent: Function;

    _seekForward: Function;

    _seekBack: Function;

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

    _timeEventListeners: { [key: string]: (callback: () => mixed) => void };

    _linkFadeTimeout: TimeoutID;

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
        this._seekBack = this._seekBack.bind(this);
        this._seekForward = this._seekForward.bind(this);

        this._behaviourRendererMap = {
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:colouroverlay/v1.0': this._applyColourOverlayBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showimage/v1.0': this._applyShowImageBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showvariablepanel/v1.0': this._applyShowVariablePanelBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0': this._applyShowChoiceBehaviour,
        };
        this._behaviourElements = [];

        this._timeEventListeners = {};

        this._destroyed = false;
        this._analytics = analytics;
        this.inVariablePanel = false;
        this._savedLinkConditions = {};
        this._preloadedBehaviourAssets = [];
        this._preloadBehaviourAssets();
        this._preloadIconAssets();
    }

    willStart() {
        this.inVariablePanel = false;
        this._behaviourRunner = this._representation.behaviours
            ? new BehaviourRunner(this._representation.behaviours, this)
            : null;
        this._player.enterStartBehaviourPhase();
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
        this._player.exitStartBehaviourPhase();
        this._clearBehaviourElements();
        this._runDuringBehaviours();
    }

    end() {
        this._reapplyLinkConditions();
        clearTimeout(this._linkFadeTimeout);
        this._player.removeListener(PlayerEvents.LINK_CHOSEN, this._handleLinkChoiceEvent);
        this._player.removeListener(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED, this._seekBack);
        this._player.removeListener(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED, this._seekForward);
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
            const targetTime = currentTime + SEEK_TIME;
            this.setCurrentTime(targetTime);
            this.logUserInteraction(AnalyticEvents.names.SEEK_FORWARD_BUTTON_CLICKED,
                currentTime,
                `${targetTime}`,
            );
        }
    }

    complete() {
        this._hasEnded = true;
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

    _runDuringBehaviours() {
        if (this._representation.behaviours && this._representation.behaviours.during) {
            // for each behaviour
            this._representation.behaviours.during.forEach((behaviour) => {
                // get start time
                const startTime = behaviour.start_time;
                const behaviourObject = behaviour.behaviour;
                // get function to handle behaviour
                const behaviourRunner = this.getBehaviourRenderer(behaviourObject.type);
                if (startTime === 0) {
                    behaviourRunner(behaviourObject, () => {
                        logger.info(`started during behaviour ${behaviourObject.type}`);
                    });
                } else {
                    // set up to run function at set time
                    this.addTimeEventListener(behaviourObject.type, startTime, () =>
                        behaviourRunner(behaviourObject, () => {
                            logger.info(`started during behaviour ${behaviourObject.type}`);
                        }));
                }
                // if there is a duration
                if (behaviour.duration) {
                    const endTime = startTime + behaviour.duration;
                    this.addTimeEventListener(`${behaviourObject.type}-clearup`, endTime, () => {
                        // tidy up...
                        logger.error('StoryPlayer does not yet support duration on behaviours');
                    });
                }
            });
        }
    }

    // //////////// show link choice behaviour

    _applyShowChoiceBehaviour(behaviour: Object, callback: () => mixed) {
        this._player.on(PlayerEvents.LINK_CHOSEN, this._handleLinkChoiceEvent);

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
            // build icons
            const iconSrcPromises = this._getIconSourceUrls(narrativeElementObjects, behaviour);
            const defaultLinkId = this._applyDefaultLink(narrativeElementObjects);

            // go through asset collections and render icons
            return iconSrcPromises.then((iconObjects) => {

                this._player.clearLinkChoices();
                iconObjects.forEach((iconSpecObject) => {
                    // add the icon to the player
                    this._buildLinkIcon(iconSpecObject);
                });

                if (iconObjects.length > 1 || showIfOneLink) {
                    this._player.setNextAvailable(false);
                    this._showChoiceIcons({
                        defaultLinkId, // id for link to highlight at start
                        forceChoice, // do we highlight
                        disableControls, // are controls disabled while icons shown
                        countdown, // do we animate countdown
                        iconOverlayClass, // css classes to apply to overlay
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
        this._followLink(eventObject.id);
    }

    // get behaviours of links from behaviour meta data
    _getLinkChoiceBehaviours(behaviour: Object): Object {
        // set default behaviours if not specified in data model
        let countdown = false;
        let disableControls = countdown; // default to disable if counting down
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
    _buildLinkIcon(iconObject: Object) {
        // tell Player to build icon
        const targetId = iconObject.targetNarrativeElementId;
        let icon;
        if (iconObject.iconText && iconObject.resolvedUrl) {
            icon = this._player.addTextLinkIconChoice(
                targetId,
                iconObject.iconText,
                iconObject.resolvedUrl,
                `Option ${(iconObject.choiceId + 1)}`,
            );
        } else if (iconObject.iconText) {
            icon = this._player.addTextLinkChoice(
                targetId,
                iconObject.iconText,
                `Option ${(iconObject.choiceId + 1)}`,
            );
        } else if (iconObject.resolvedUrl) {
            icon = this._player.addLinkChoiceControl(
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
        } = iconDataObject;

        this._player.showChoiceIcons(forceChoice ? null : defaultLinkId, iconOverlayClass);
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
    _followLink(narrativeElementId: string) {
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
                this._hideChoiceIcons(narrativeElementId);
            // do we keep the choice open?
            } else if (this._linkBehaviour && this._linkBehaviour.oneShot) {
                // hide icons
                this._hideChoiceIcons(null);
                // refresh next/prev so user can skip now if necessary
                this._controller.refreshPlayerNextAndBack();
            }
        } else {
            // or follow link now
            this._hideChoiceIcons(narrativeElementId);
        }
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
    _hideChoiceIcons(narrativeElementId: ?string) {
        if (narrativeElementId) { this._reapplyLinkConditions(); }
        this._player._linkChoice.overlay.classList.add('fade');
        this._linkFadeTimeout = setTimeout(() => {
            this._player._linkChoice.overlay.classList.remove('fade');
            this._player.clearLinkChoices();
            if (narrativeElementId) {
                this._controller.followLink(narrativeElementId);
            } else {
                this._linkBehaviour.callback();
            }
        }, 1500);
    }

    // //////////// end of show link choice behaviour

    _applyColourOverlayBehaviour(behaviour: Object, callback: () => mixed) {
        const { colour } = behaviour;
        const overlayImageElement = document.createElement('div');
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
                    this._overlayImage(image.assets.image_src);
                    callback();
                }
            });
        }
    }

    _overlayImage(imageSrc: string) {
        const overlayImageElement = document.createElement('img');
        overlayImageElement.src = imageSrc;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
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


        const slider = document.createElement('input');
        slider.type = 'range';
        slider.classList.add('romper-var-form-slider');
        slider.id = `variable-input-${varName}`;

        sliderDiv.appendChild(minSpan);
        sliderDiv.appendChild(slider);
        sliderDiv.appendChild(maxSpan);

        const numberInput = document.createElement('input');
        numberInput.classList.add('romper-var-form-slider-output');
        numberInput.type = 'number';

        slider.min = range.min_val;
        slider.max = range.max_val;
        this._controller.getVariableValue(varName)
            .then((varValue) => {
                slider.value = varValue;
                numberInput.value = varValue;
            });

        slider.onchange = () => {
            this._setVariableValue(varName, slider.value);
            numberInput.value = slider.value;
        };

        slider.oninput = () => {
            numberInput.value = slider.value;
        };

        numberInput.onchange = () => {
            this._setVariableValue(varName, numberInput.value);
            slider.value = numberInput.value;
        };

        numberInput.oninput = () => {
            this._setVariableValue(varName, numberInput.value);
        };

        varInput.appendChild(sliderDiv);
        // varInput.appendChild(slider);
        if (behaviourVar.hasOwnProperty('precise_entry') && behaviourVar.precise_entry){
            varInput.appendChild(numberInput);
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
        const overlayImageElement = document.createElement('div');
        overlayImageElement.className = 'romper-variable-panel';

        if (behaviour.background_colour) {
            overlayImageElement.style.background = behaviour.background_colour;
        }

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = formTitle;
        titleDiv.className = 'romper-var-form-title';
        overlayImageElement.appendChild(titleDiv);

        this._controller.getVariables()
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

                overlayImageElement.appendChild(carouselDiv);
                // show first question
                let currentQuestion = 0;

                // submit button
                const okButtonContainer = document.createElement('div');

                okButtonContainer.className = 'romper-var-form-button-container';
                const okButton = document.createElement('input');
                okButton.className = 'romper-var-form-button';
                okButton.type = 'button';
                okButton.classList.add('var-next');
                okButton.value = 'Next'; // behaviourVariables.length > 1 ? 'Next' : 'OK!';

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

                const changeSlide = (fwd: boolean) => {
                    const targetId = fwd ? currentQuestion + 1 : currentQuestion - 1;

                    if (fwd && currentQuestion >= behaviourVariables.length - 1) {
                        // start fade out
                        overlayImageElement.classList.remove('active');
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
                            // varDiv.classList.add('active');
                        } else if (i < targetId) {
                            varDiv.classList.add('left');
                            // varDiv.classList.remove('active');
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

                overlayImageElement.appendChild(okButtonContainer);

                this._target.appendChild(overlayImageElement);
                setTimeout(() => { overlayImageElement.classList.add('active'); }, 200);
                this._behaviourElements.push(overlayImageElement);
            });
    }

    // //////////// end of variables panel choice behaviour

    _clearBehaviourElements() {
        this._behaviourElements.forEach((be) => {
            try {
                this._target.removeChild(be);
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

    addTimeEventListener(listenerId: string, time: number, callback: Function) {
        this._timeEventListeners[listenerId] = callback;
        this._playoutEngine.on(this._rendererId, 'timeupdate', () => {
            const mediaElement = this._playoutEngine.getMediaElement(this._rendererId);
            if (mediaElement) {
                if (time > 0 && mediaElement.currentTime >= time) {
                    if (listenerId in this._timeEventListeners) {
                        delete this._timeEventListeners[listenerId];
                        callback();
                    }
                }
            }
        });
    }

    deleteTimeEventListener(listenerId: string) {
        if (listenerId in this._timeEventListeners) {
            delete this._timeEventListeners[listenerId];
        }
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
}
