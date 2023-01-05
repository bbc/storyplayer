import EventEmitter from "events"
import JsonLogic from "json-logic-js"
import type {StoryReasonerFactory} from "./StoryReasonerFactory"
import StoryReasoner, {ReasonerError, REASONER_ERRORS} from "./StoryReasoner"
import type {
    ExperienceFetchers,
    NarrativeElement,
    AssetUrls,
    Representation,
    Story,
} from "./types"
import type {RepresentationReasoner} from "./RepresentationReasoner"
import StoryPathWalker from "./StoryPathWalker"
import type {StoryPathItem} from "./StoryPathWalker"
import RenderManager from "./RenderManager"
import RendererEvents from "./renderers/RendererEvents"
import AnalyticEvents from "./AnalyticEvents"
import type {AnalyticsLogger, AnalyticsPayload} from "./AnalyticEvents"
import {BrowserCapabilities, BrowserUserAgent} from "./browserCapabilities"
import logger from "./logger"
import BaseRenderer from "./renderers/BaseRenderer"
import {InternalVariableNames} from "./InternalVariables"
import {
    REASONER_EVENTS,
    VARIABLE_EVENTS,
    ERROR_EVENTS,
    DOM_EVENTS,
} from "./Events"
import SessionManager, {SESSION_STATE} from "./SessionManager"
import AnalyticsHandler from "./AnalyticsHandler"
export const PLACEHOLDER_REPRESENTATION = {
    object_class: "REPRESENTATION",
    version: "0:0",
    tags: {},
    name: "Blank representation",
    representation_type:
        "urn:x-object-based-media:representation-types:placeholder/v1.0",
    asset_collections: {},
}
export default class Controller extends EventEmitter {
    constructor(
        target: HTMLElement,
        storyReasonerFactory: StoryReasonerFactory,
        representationReasoner: RepresentationReasoner,
        fetchers: ExperienceFetchers,
        analytics: AnalyticsLogger,
        assetUrls: AssetUrls,
        privacyNotice: string | null | undefined,
        saveSession: boolean | null | undefined,
        handleKeys: boolean | null | undefined,
        options: Record<string, any> | null | undefined,
    ) {
        super()
        this._storyId = null
        this._reasoner = null
        this._saveSession = saveSession
        this._sessionManager = null
        this._target = target
        this._storyReasonerFactory = storyReasonerFactory
        this._representationReasoner = representationReasoner
        this._fetchers = fetchers
        this._handleVariableChanged = this._handleVariableChanged.bind(this)
        this._handleRendererCompletedEvent = this._handleRendererCompletedEvent.bind(
            this,
        )
        this._handleRendererNextButtonEvent = this._handleRendererNextButtonEvent.bind(
            this,
        )
        this._handleRendererPreviousButtonEvent = this._handleRendererPreviousButtonEvent.bind(
            this,
        ) // eslint-disable-line max-len

        this._startStoryEventListener = this._startStoryEventListener.bind(this)
        this._handleStoryEnd = this._handleStoryEnd.bind(this)
        this._emitFullScreenEvent = this._emitFullScreenEvent.bind(this)
        this._handleError = this._handleError.bind(this)
        this._handleFirstRendererEvent = this._handleFirstRendererEvent.bind(
            this,
        )
        this._analyticsHandler = new AnalyticsHandler(analytics, this)
        this._handleAnalytics = this._handleAnalytics.bind(this)
        this.options = options
        this._assetUrls = assetUrls
        this._privacyNotice = privacyNotice
        this.handleKeys = handleKeys
        this._linearStoryPath = []

        this._createRenderManager()

        this._storyIconRendererCreated = false
        console.log("ANDY: SP running vite build")
    }

    _handleAnalytics(logData: AnalyticsPayload): any {
        this._analyticsHandler.handleAnalyticsEvent(logData)
    }

    /**
     * Restarts the story
     * @param {string} storyId story id
     * @param {*} initialState initial state of variables
     */
    restart(
        storyId: string | null | undefined = null,
        initialState: Record<string, any> = {},
    ) {
        let restartStoryId

        if (storyId) {
            restartStoryId = storyId
        } else if (this._storyId) {
            restartStoryId = this._storyId
        } else {
            logger.error("Could not restart - no story id")
            return
        }

        this._reasoner = null

        this._prepareRenderManagerForRestart()

        if (this._sessionManager) {
            if (Object.keys(initialState).length === 0) {
                this._sessionManager
                    .fetchExistingSessionState()
                    .then(resumeState => {
                        this.start(restartStoryId, resumeState)
                    })
            }
        } else {
            this.start(restartStoryId, initialState)
        }
    }

    updateOptions(newOptions: Record<string, any>) {
        this.options = newOptions
    }

    /**
     * get render manager to tidy up
     */
    _prepareRenderManagerForRestart() {
        this._removeListenersFromRenderManager()

        this._renderManager.prepareForRestart()
    }

    /**
     * Reset the story and keep the reasoner for it.
     * @param  {boolean} newState state for session manager to enter
     * @param  {string} storyId story to reset
     */
    resetStory(newState: string, storyId: string | null | undefined = null) {
        let restartStoryId

        if (storyId) {
            restartStoryId = storyId
        } else if (this._storyId) {
            restartStoryId = this._storyId
        } else {
            logger.error("Could not reset - no story id")
            return
        }

        // set this to restart just in case
        this.setSessionState(newState)

        // we're just resetting
        this._prepareRenderManagerForRestart()

        this.start(restartStoryId)
    }

    /**
     * Start the story
     * Entry point comsumer of the Controller (likely the page hosting the player)
     * @param {string} storyId  top level story id
     * @param {Object} initialState initial state to start from
     */
    start(storyId: string, initialState?: Record<string, any>) {
        this._storyId = storyId

        if (this._saveSession) {
            if (!this._sessionManager) {
                this._createSessionManager(storyId)
            }

            switch (this._sessionManager.sessionState) {
                case SESSION_STATE.RESUME:
                case SESSION_STATE.EXISTING:
                    this.resumeStoryFromState(storyId, initialState)
                    break

                case SESSION_STATE.RESTART:
                case SESSION_STATE.NEW:
                default:
                    this.startFromDefaultState(storyId, initialState)
                    break
            }
        } else {
            this.deleteExistingSession()
            this.startFromDefaultState(storyId, initialState)
        }
    }

    /**
     * Resume the story from some known state
     * @param {string} storyId top level story id
     * @param {Object} initialState resule state
     */
    resumeStoryFromState(storyId: string, initialState?: Record<string, any>) {
        if (initialState && Object.keys(initialState).length > 0) {
            this.startStory(storyId, initialState)
        } else {
            // eslint-disable-next-line no-lonely-if
            if (this._sessionManager) {
                this._sessionManager
                    .fetchExistingSessionState()
                    .then(resumeState => {
                        this.startStory(storyId, resumeState)
                    })
            } else {
                this.startStory(storyId, initialState)
            }
        }
    }

    /**
     * Start story from default state
     * @param {string} storyId top level story id
     * @param {*} initialState initial variable state
     */
    startFromDefaultState(storyId: string, initialState?: Record<string, any>) {
        if (initialState && Object.keys(initialState).length > 0) {
            this.startStory(storyId, initialState)
        } else {
            this.getDefaultInitialState().then(variableState => {
                this.setDefaultState(variableState)

                if (Object.keys(variableState).length > 0) {
                    this.startStory(storyId, variableState)
                } else {
                    this.startStory(storyId, initialState)
                }
            })
        }
    }

    /**
     * Starts the story by testing for linearity and building a story renderer
     * checking if the story is playable
     * attaching the event listeners to the reasoner created
     * and calling this._renderManager.handleStoryStart(storyId);
     * @param {string} storyId top level story id
     * @param {Object?} initialState initial state for the story variables
     */
    startStory(storyId: string, initialState: Array<{logic?: object, errorMsg?: string}> | object = {}) {
        this._getAllNarrativeElements().then(neList => {
            this._allNarrativeElements = neList
        })

        // @ts-ignore
        window._sessionManager = this._sessionManager

        // see if we have a linear story
        this._testForLinearityAndBuildStoryRenderer(storyId)
            .then(() => this._storyReasonerFactory(storyId, this._analytics))
            .then(reasoner => {
                if (this._storyId !== storyId) {
                    return
                }
                const requirements = reasoner.getRequirements()
                if (
                    this._checkStoryPlayable(requirements) === -1
                ) {
                    return
                }

                this._handleNarrativeElementChanged = (
                    narrativeElement: NarrativeElement,
                ) => {
                    this._handleNEChange(reasoner, narrativeElement).then(
                        () => {
                            if (
                                this._linearStoryPath &&
                                !this._storyIconRendererCreated
                            ) {
                                this._renderManager._createStoryIconRenderer(
                                    this._linearStoryPath,
                                )

                                this._storyIconRendererCreated = true
                            }
                        },
                    )
                }

                reasoner.on(REASONER_EVENTS.STORY_END, this._handleStoryEnd)
                reasoner.on(
                    REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED,
                    this._handleNarrativeElementChanged,
                ) // eslint-disable-line max-len

                reasoner.on(
                    VARIABLE_EVENTS.VARIABLE_CHANGED,
                    this._handleVariableChanged,
                )
                reasoner.on(ERROR_EVENTS, this._handleError)
                this._reasoner = reasoner

                this._reasoner.start(initialState)

                this._chooseBeginningElement()

                this._addListenersToRenderManager()

                this._renderManager.handleStoryStart(storyId)
            })
            .catch(err => {
                logger.warn("Error starting story", err)
            })
    }

    /**
     * Chooses the element to resume from if we have a resume state and path history
     */
    _chooseResumeElement() {
        this._sessionManager.fetchPathHistory().then(pathHistory => {
            if (!pathHistory) {
                this._reasoner.chooseBeginning()
            } else {
                const lastVisited = pathHistory[pathHistory.length - 1]

                if (
                    lastVisited &&
                    lastVisited in this._reasoner._narrativeElements
                ) {
                    this._jumpToNarrativeElement(lastVisited)
                } else {
                    this.walkPathHistory(
                        this._storyId,
                        lastVisited,
                        pathHistory,
                    )
                }
            }
        })
    }

    /**
     * Chooses the beginning element based on the session state
     */
    _chooseBeginningElement() {
        // if we don't have a session manager get the beginning and return
        if (!this._sessionManager) {
            this._reasoner.chooseBeginning()

            return
        }

        switch (this._sessionManager.sessionState) {
            case SESSION_STATE.RESUME:
                this._chooseResumeElement()

                break

            case SESSION_STATE.EXISTING:
                // we don't want to choose a beginning until the user selects one
                break

            case SESSION_STATE.RESTART:
            case SESSION_STATE.NEW:
            default:
                this._reasoner.chooseBeginning()

                break
        }
    }

    /**
     * Gets the current and next narrative elements
     */
    getStatus(): Promise<Record<string, any>> {
        const currentNarrativeElement = this._renderManager.getCurrentNarrativeElement()

        let nextNarrativeElement = null
        return this.getValidNextSteps()
            .then(nextNarrativeElementObjects => {
                if (nextNarrativeElementObjects.length >= 1) {
                    // eslint-disable-next-line prefer-destructuring
                    nextNarrativeElement = nextNarrativeElementObjects[0].ne
                }

                return Promise.resolve(nextNarrativeElement)
            })
            .then(nextne => {
                const statusObject = {
                    currentNarrativeElement,
                    nextNarrativeElement: nextne,
                }
                return statusObject
            })
    }

    /**
     * checks requirements to satisfy for story to be playable
     * returns a 0 or -1 for some reason? should be a bool?
     * @returns number
     * @param {Array<Object>} requirements requirements to satisfy for story to be playable
     */
    _checkStoryPlayable(requirements: Array<{logic: object, errorMsg?: string}>) {
        const data = {
            supports: {
                hls: BrowserCapabilities.hlsSupport(),
                dash: BrowserCapabilities.dashSupport(),
            },
            browser: {
                ie: BrowserUserAgent.ie(),
                edge: BrowserUserAgent.edge(),
                iOS: BrowserUserAgent.iOS(),
                safari: BrowserUserAgent.safari(),
            },
        }
        // logs the capabilities and which format we support
        // also rudimentary check of the browser UA/platform/vendor/features
        logger.debug("playing capabilities", data)
        const anyRequirementsFailed = requirements.some(req => {
            if (JsonLogic.apply(req.logic, data) === false) {
                this._target.innerHTML = ""
                const warningDiv = document.createElement("div")
                warningDiv.classList.add("romper-warning")
                const warningDivDiv = document.createElement("div")
                warningDivDiv.classList.add("romper-warning-div")
                warningDivDiv.innerHTML = req.errorMsg
                warningDiv.appendChild(warningDivDiv)

                this._target.appendChild(warningDiv)

                logger.warn(`Using Data: ${JSON.stringify(data)}`)
                logger.warn(`Requirement Failed: ${JSON.stringify(req.logic)}`)
                return true
            }

            return false
        })

        if (anyRequirementsFailed) {
            return -1
        }

        logger.info(
            `All requirements satisfied: ${JSON.stringify(requirements)}`,
        )
        return 0
    }

    /**
     * Creates a render manager to handle rendering
     */
    _createRenderManager() {
        this._renderManager = new RenderManager(
            this,
            this._target,
            this._representationReasoner,
            this._fetchers,
            this._handleAnalytics,
            this._assetUrls,
            this._privacyNotice,
        )
    }

    /**
     * Creaters the state machine to hold user session data
     * @param {string} storyId top level story id
     */
    _createSessionManager(storyId: string) {
        this._sessionManager = new SessionManager(storyId)

        if (this.getSessionState() !== SESSION_STATE.NEW) {
            this._sessionManager.fetchUserId().then(id => {
                if (id) {
                    this._analyticsHandler.setUserId(id)
                } else {
                    this._sessionManager.setUserId(
                        this._analyticsHandler.userid,
                    )
                }
            })
        } else {
            this._sessionManager.setUserId(this._analyticsHandler.userid)
        }
    }

    /**
     * Gets current renderer
     * @returns BaseRenderer
     */
    getCurrentRenderer(): BaseRenderer | null | undefined {
        return this._renderManager.getCurrentRenderer()
    }

    /**
     * gets the current narrative Element
     * @returns NarrativeElement
     */
    getCurrentNarrativeElement(): NarrativeElement {
        return this._currentNarrativeElement
    }

    getCurrentStory(): Story | null | undefined {
        return this._reasoner ? this._reasoner._story : null
    }

    /**
     * handle RendererEvents.COMPLETED event
     */
    _handleRendererCompletedEvent() {
        if (this._reasoner)
            try {
                this._reasoner.next()
            } catch (e) {
                logger.warn(e.message)
            }
    }

    /**
     * Handle RendererEvents.NEXT_BUTTON_CLICKED
     */
    _handleRendererNextButtonEvent() {
        if (this._reasoner)
            try {
                this._reasoner.next()
            } catch (e) {
                logger.warn(e.message)
            }
    }

    /**
     * Tell the reasoner to move on (maybe we have encountered an error)
     */
    forceReasonerOn() {
        this._handleRendererNextButtonEvent()
    }

    /**
     * Handle RendererEvents.PREVIOUS_BUTTON_CLICKED event
     */
    _handleRendererPreviousButtonEvent() {
        this._goBackOneStepInStory()
    }

    _handleFirstRendererEvent() {
        this.emit(RendererEvents.FIRST_RENDERER_CREATED)
    }

    /**
     * Emits the event when we toggle fullscreen or not
     * @fires DOM_EVENTS#TOGGLE_FULLSCREEN
     */
    _emitFullScreenEvent(event: Record<string, any>) {
        this.emit(DOM_EVENTS.TOGGLE_FULLSCREEN, event)
    }

    /* eslint-disable max-len */

    /**
     * Add event listeners to render manager
     */
    _addListenersToRenderManager() {
        this._renderManager.on(
            REASONER_EVENTS.ROMPER_STORY_STARTED,
            this._startStoryEventListener,
        )

        this._renderManager.on(
            RendererEvents.COMPLETED,
            this._handleRendererCompletedEvent,
        )

        this._renderManager.on(
            RendererEvents.NEXT_BUTTON_CLICKED,
            this._handleRendererNextButtonEvent,
        )

        this._renderManager.on(
            RendererEvents.PREVIOUS_BUTTON_CLICKED,
            this._handleRendererPreviousButtonEvent,
        )

        this._renderManager.on(
            DOM_EVENTS.TOGGLE_FULLSCREEN,
            this._emitFullScreenEvent,
        )

        this._renderManager.once(
            RendererEvents.FIRST_RENDERER_CREATED,
            this._handleFirstRendererEvent,
        )
    }

    /**
     * Remove event listeners from render manager
     */
    _removeListenersFromRenderManager() {
        this._renderManager.off(
            RendererEvents.COMPLETED,
            this._handleRendererCompletedEvent,
        )

        this._renderManager.off(
            RendererEvents.NEXT_BUTTON_CLICKED,
            this._handleRendererNextButtonEvent,
        )

        this._renderManager.off(
            RendererEvents.PREVIOUS_BUTTON_CLICKED,
            this._handleRendererPreviousButtonEvent,
        )

        this._renderManager.off(
            DOM_EVENTS.TOGGLE_FULLSCREEN,
            this._emitFullScreenEvent,
        )

        this._renderManager.off(
            RendererEvents.FIRST_RENDERER_CREATED,
            this._handleFirstRendererEvent,
        )
    }

    /**
     * Hide the taster badge or not
     * @returns boolean
     */
    _hideTasterBadge(): boolean {
        return (
            (this._reasoner._story.meta &&
                this._reasoner._story.meta.storyplayer &&
                this._reasoner._story.meta.storyplayer.taster &&
                this._reasoner._story.meta.storyplayer.taster
                    .hideDuringExperience) ||
            false
        )
    }

    /**
     * Start story event listener, fired when reasoner emits REASONER_EVENTS.ROMPER_STORY_STARTED
     * emits with a boolean to hide the taster badge
     * @fires "REASONER_EVENTS.ROMPER_STORY_STARTED"
     */
    _startStoryEventListener() {
        const hide = this._hideTasterBadge()

        this.emit(REASONER_EVENTS.ROMPER_STORY_STARTED, {
            hide,
        })
    }

    /* eslint-enable max-len */

    /**
     *  see if we have a linear story
     * and if we do, create a StoryIconRenderer
     * @param {string} storyId Top level story id
     */
    _testForLinearityAndBuildStoryRenderer(storyId: string): Promise<any> {
        // create an spw to see if the story is linear or not
        const spw = new StoryPathWalker(
            this._fetchers.storyFetcher,
            this._fetchers.representationCollectionFetcher,
            this._storyReasonerFactory,
        )
        return new Promise(resolve => {
            // handle our StoryPathWalker reaching the end of its travels:
            // get spw to resolve the list of presentations into representations
            // then (if story is linear) create and start a StoryIconRenderer
            const _handleWalkEnd = () => {
                spw.getStoryItemList(this._representationReasoner)
                    .then(storyItemPath => {
                        this._linearStoryPath = storyItemPath
                    })
                    .then(() => {
                        resolve(null)
                    })
                    .catch(err => {
                        // If we end up here, most likely due to there being representations
                        // with false conditions on our linear graph
                        logger.warn(err)
                        this._linearStoryPath = []
                        resolve(null)
                    })
            }

            spw.on(REASONER_EVENTS.WALK_COMPLETE, _handleWalkEnd)
            spw.parseStory(storyId)
        })
    }

    /**
     * Go to previous node in story if we can
     */
    _goBackOneStepInStory() {
        return Promise.all([
            this.getIdOfPreviousNode(),
            this.getVariableValue(InternalVariableNames.PATH_HISTORY),
        ]).then(([previous, history]) => {
            if (history.length <= 1) {
                // trying to go back but on first element, so just skip to start instead
                this.repeatStep()
                return
            }

            // remove the current NE from history
            history.pop()
            // remove the one we're going to - it'll be added again
            history.pop()

            // set history variable directly in reasoner to avoid triggering lookahead
            if (this._reasoner) {
                this._reasoner.setVariableValue(
                    InternalVariableNames.PATH_HISTORY,
                    history,
                )
            }

            if (this._sessionManager) {
                this._sessionManager.setVariable({
                    name: InternalVariableNames.PATH_HISTORY,
                    value: history,
                })
            }

            if (previous) {
                this._jumpToNarrativeElement(previous)
            } else {
                logger.error("cannot resolve previous node to go to")
            }
        })
    }

    /**
     * repeat the current node in the current story, if we can
     * calls this._handleNEChange with current element if we have one
     */
    repeatStep() {
        const current = this._currentNarrativeElement

        if (this._reasoner && current) {
            this._handleNEChange(this._reasoner, current)
        } else {
            logger.error("cannot resolve this node to repeat")
        }
    }

    /**
     * respond to a change in the Narrative Element: update the renderers
     * @param {StoryReasoner} reasoner
     * @param {NarrativeElement} narrativeElement
     * @param {Boolean} resuming are wqe resuming a previously watched experience or not.
     */
    // eslint-disable-next-line max-len
    _handleNEChange(
        reasoner: StoryReasoner,
        narrativeElement: NarrativeElement,
        resuming?: boolean,
    ) {
        logger.info(
            {
                obj: narrativeElement,
            },
            "Narrative Element",
        )

        if (this._reasoner && !resuming) {
            if (!this._currentNarrativeElement) {
                // setting first element - so record in history
                this._reasoner.appendToHistory(narrativeElement.id)
            } else if (
                narrativeElement.id !== this._currentNarrativeElement.id
            ) {
                // _handleNEChange is used to repeat an element
                // only add to history if changing
                this._reasoner.appendToHistory(narrativeElement.id)
            }

            this._logNEChange(this._currentNarrativeElement, narrativeElement)
        }

        this._currentNarrativeElement = narrativeElement
        return this._renderManager.handleNEChange(narrativeElement)
    }

    /**
     * Log changing from the old to the new narrative element
     * @fires REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED
     * @param {NarrativeElement} oldNarrativeElement previous narrative Element
     * @param {NarrativeElement} newNarrativeElement current narrative element
     */
    _logNEChange(
        oldNarrativeElement: NarrativeElement,
        newNarrativeElement: NarrativeElement,
    ) {
        let oldName = "null"
        let oldId = "null"

        if (oldNarrativeElement) {
            oldId = oldNarrativeElement.id
            oldName = oldNarrativeElement.name
        }

        const logData = {
            type: AnalyticEvents.types.STORY_NAVIGATION,
            name: AnalyticEvents.names.NARRATIVE_ELEMENT_CHANGE,
            from: oldId,
            to: newNarrativeElement.id,
            data: {
                fromName: oldName,
                toName: newNarrativeElement.name,
            },
        }

        this._handleAnalytics(logData)

        this.emit(
            REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED,
            newNarrativeElement,
        )
    }

    /**
     *  try to get the narrative element object with the given id
     * returns NE or null if not found
     * @param {string} narrativeElementId
     */
    _getNarrativeElement(
        narrativeElementId: string,
    ): NarrativeElement | null | undefined {
        let neObj

        if (this._allNarrativeElements) {
            [neObj] = this._allNarrativeElements.filter(
                ne => ne.id === narrativeElementId,
            )
        } else if (this._reasoner) {
            // get the actual NarrativeElement object
            const subReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(
                narrativeElementId,
            )

            if (subReasoner) {
                neObj = subReasoner._narrativeElements[narrativeElementId]
            }
        }

        return neObj
    }

    /**
     * create a reasoner to do a shadow walk of the story graph
     * when it reaches a target node, it boots out the original reasoner
     * and takes its place (with suitable event listeners)
     * @param {string} storyId stop level story id
     * @param {*} targetNeId target narrative element id
     */
    _jumpToNarrativeElementUsingShadowReasoner(
        storyId: string,
        targetNeId: string,
    ) {
        this._storyReasonerFactory(storyId).then(shadowReasoner => {
            if (this._storyId !== storyId) {
                return
            }

            const _shadowHandleStoryEnd = () => {
                logger.warn(
                    "shadow reasoner reached story end without meeting target node",
                )
            }

            shadowReasoner.on(REASONER_EVENTS.STORY_END, _shadowHandleStoryEnd)

            const _handleError = err => {
                logger.warn(`Error: ${err}`)
            }

            shadowReasoner.on(ERROR_EVENTS, _handleError)
            const visitedArray = []

            // run straight through the graph until we hit the target
            // when we do, change our event listeners to the normal ones
            // and take the place of the original _reasoner
            const shadowHandleNarrativeElementChanged = (
                narrativeElement: NarrativeElement,
            ) => {
                if (visitedArray.includes(narrativeElement.id)) {
                    logger.warn(
                        "shadow reasoner looping - exiting without meeting target node",
                    )

                    _shadowHandleStoryEnd()

                    return
                }

                visitedArray.push(narrativeElement.id)

                if (narrativeElement.id === targetNeId) {
                    // remove event listeners for the original reasoner
                    this.reset()
                    // apply appropriate listeners to this reasoner
                    this._storyId = storyId
                    shadowReasoner.on(
                        REASONER_EVENTS.STORY_END,
                        this._handleStoryEnd,
                    )
                    shadowReasoner.removeListener(
                        REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED,
                        shadowHandleNarrativeElementChanged,
                    )

                    this._handleNarrativeElementChanged = (
                        ne: NarrativeElement,
                    ) => {
                        this._handleNEChange(shadowReasoner, ne)
                    }

                    shadowReasoner.on(
                        REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED,
                        this._handleNarrativeElementChanged,
                    )
                    // swap out the original reasoner for this one
                    this._reasoner = shadowReasoner

                    // now we've walked to the target, trigger the change event handler
                    // so that it calls the renderers etc.
                    this._handleNEChange(shadowReasoner, narrativeElement)

                    return
                }

                shadowReasoner.next()
            }

            shadowReasoner.on(
                REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED,
                shadowHandleNarrativeElementChanged,
            ) // eslint-disable-line max-len

            shadowReasoner.start()
            shadowReasoner.chooseBeginning()
        })
    }

    /**
     *  follow link from the narrative element
     * By getting the sub reasoner containing the narrative element and following the link
     * @param {string} narrativeElementId
     */
    followLink(narrativeElementId: string) {
        this._currentNarrativeElement.links.forEach(link => {
            if (link.target_narrative_element_id === narrativeElementId) {
                if (this._reasoner) {
                    const subReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(
                        this._currentNarrativeElement.id,
                    )

                    if (subReasoner) {
                        subReasoner._followLink(link)
                    }
                }
            }
        })
    }

    /**
     * Store or change a variable for the reasoner to use while reasoning
     *
     * @param {String} name The name of the variable to set
     * @param {any} value Its value
     */
    setVariableValue(name: string, value: any) {
        if (this._reasoner) {
            this._reasoner.setVariableValue(name, value)

            logger.info(`Controller seting variable '${name}' to ${value}`)
            this.emit(VARIABLE_EVENTS.CONTROLLER_CHANGED_VARIABLE, {
                name,
                value,
            })

            this._renderManager.refreshLookahead()
        } else {
            logger.warn(
                `Controller cannot set variable '${name}' - no reasoner`,
            )
        }
    }

    /**
     * Get the current value of a variable
     *
     * @param {String} name The name of the variable to get
     * returns null if no reasoner
     */
    getVariableValue(name: string): Promise<any> {
        if (this._reasoner) {
            return this._reasoner.getVariableValue(name)
        }

        logger.warn(`Controller cannot get variable '${name}' - no reasoner`)
        return Promise.resolve(null)
    }

    /**
     * Get the variables and their state present in the story
     * recurses into substories
     */
    getVariableState(): Promise<Record<string, any>> {
        const storyId = this._storyId

        if (storyId) {
            return this._getAllStories(storyId)
                .then(subStoryIds => {
                    const subVarPromises = []
                    subStoryIds.forEach(subid => {
                        subVarPromises.push(
                            this._getVariableStateForStory(subid),
                        )
                    })
                    return Promise.all(subVarPromises)
                })
                .then(subStoryVariables => {
                    const allVars = {}
                    subStoryVariables.forEach(substoryVarObj => {
                        Object.keys(substoryVarObj).forEach(varName => {
                            allVars[varName] = substoryVarObj[varName]
                        })
                    })
                    return allVars
                })
        }

        return Promise.resolve({})
    }

    getDefaultInitialState(): Promise<any> {
        if (!this._storyId) return Promise.resolve({})
        return this._getAllStories(this._storyId)
            .then(storyIds => {
                return Promise.all(
                    storyIds.map(id => this._getStoryDefaultVariableState(id)),
                )
            })
            .then(allVariables => {
                const flattenedVariables = [].concat(...allVariables)
                return flattenedVariables.reduce(
                    (variablesObject, variable) => {
                        // eslint-disable-next-line no-param-reassign
                        variablesObject[variable.name] = variable.value
                        return variablesObject
                    },
                    {},
                )
            })
    }

    _getStoryDefaultVariableState(storyId: string) {
        return this._fetchers.storyFetcher(storyId).then(story => {
            const {variables} = story

            if (variables) {
                return Object.keys(variables).map(variable => {
                    return {
                        name: variable,
                        value: variables[variable].default_value,
                    }
                })
            }

            return Promise.resolve({})
        })
    }

    /**
     * get the ids of every story nested within the one given
     * @param {string} storyId top level story
     * @param {array<string>} doneAlready stories looked at
     */
    _getAllStories(
        storyId: string,
        doneAlready: Array<string> = [],
    ): Promise<Array<string>> {
        return this._fetchers
            .storyFetcher(storyId)
            .then(story => {
                const nePromises = []
                story.narrative_element_ids.forEach(neid => {
                    nePromises.push(
                        this._fetchers.narrativeElementFetcher(neid),
                    )
                })
                return Promise.all(nePromises)
            })
            .then(nes => {
                const subStoryIds = []
                nes.forEach(ne => {
                    if (
                        ne.body.type === "STORY_ELEMENT" &&
                        ne.body.story_target_id &&
                        !subStoryIds.includes(ne.body.story_target_id) &&
                        !doneAlready.includes(ne.body.story_target_id)
                    ) {
                        subStoryIds.push(ne.body.story_target_id)
                        doneAlready.push(ne.body.story_target_id)
                    }
                })
                const substoryPromises = []
                subStoryIds.forEach(subStory => {
                    substoryPromises.push(
                        this._getAllStories(subStory, doneAlready),
                    )
                })
                return Promise.all(substoryPromises)
            })
            .then(subStoryIds => {
                const flatSubIds = [].concat(...subStoryIds)
                const idArray: Array<string> = []
                idArray.push(storyId)
                flatSubIds.forEach(sid => idArray.push(sid))
                return Promise.resolve(idArray)
            })
    }

    /**
     * get all the variables for the story given
     * @param {string} storyId story to get variables for
     */
    _getVariableStateForStory(storyId: string) {
        let variables
        return this._fetchers
            .storyFetcher(storyId)
            .then(story => {
                const promisesToResolve = []
                // eslint-disable-next-line prefer-destructuring
                variables = story.variables

                if (variables) {
                    Object.keys(variables).forEach(name => {
                        if (this._reasoner) {
                            promisesToResolve.push(
                                this._reasoner.getVariableValue(name),
                            )
                        }
                    })
                }

                // for each - if story, get variables for story
                return Promise.all(promisesToResolve)
            })
            .then(resolvedVariables => {
                if (variables && resolvedVariables.length > 0) {
                    Object.keys(variables).forEach((name, index) => {
                        if (variables) {
                            variables[name].value = resolvedVariables[index]
                        }
                    })
                    return variables
                }

                return {}
            })
    }

    /**
     * Sets the default variables if we have a reasoner
     * @param  {} variables An object of form { name1: valuetring1, name2: valuestring2 }
     */
    setDefaultState(variables: Record<string, any>) {
        // eslint-disable-next-line no-param-reassign
        variables[InternalVariableNames.PATH_HISTORY] = []

        if (this._sessionManager) {
            this._sessionManager.setDefaultState(variables)
        } else {
            this.setVariables(variables)
        }
    }

    /**
     * Set a bunch of variables without doing renderer lookahead refresh in between
     * @param {*} variables An object of form { name1: valuetring1, name2: valuestring2 }
     */
    setVariables(variables: Record<string, any>) {
        Object.keys(variables).forEach(varName => {
            if (this._reasoner) {
                this._reasoner.setVariableValue(varName, variables[varName])
            } else {
                logger.warn(
                    `Controller cannot set variable '${varName}' - no reasoner`,
                )
            }
        })
        this.emit(VARIABLE_EVENTS.CONTROLLER_CHANGED_VARIABLE, variables)

        this._renderManager.refreshLookahead()
    }

    /**
     * Fetch all the narrative elements for the story and sub stories
     */
    _getAllNarrativeElements(): Promise<Array<NarrativeElement>> {
        if (!this._storyId) {
            return Promise.resolve([])
        }

        return this._getAllStories(this._storyId)
            .then(storyIds => {
                // @flowignore
                storyIds.push(this._storyId)
                const storyPromises = []
                storyIds.forEach(sid =>
                    storyPromises.push(this._fetchers.storyFetcher(sid)),
                )
                return Promise.all(storyPromises)
            })
            .then(stories => {
                const neIds = []
                stories.forEach(story => {
                    story.narrative_element_ids.forEach(neid => {
                        if (neIds.indexOf(neid) === -1) {
                            neIds.push(neid)
                        }
                    })
                })
                const nePromises = []
                neIds.forEach(neid =>
                    nePromises.push(
                        this._fetchers.narrativeElementFetcher(neid),
                    ),
                )
                return Promise.all(nePromises)
            })
    }

    /**
     * go to an arbitrary node in the current story
     * @param {string} narrativeElementId Id of node to jum to
     */
    _jumpToNarrativeElement(narrativeElementId: string) {
        if (!this._reasoner) {
            logger.error("no reasoner") // return;
        } else {
            const currentReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(
                narrativeElementId,
            )

            if (currentReasoner) {
                currentReasoner._setCurrentNarrativeElement(narrativeElementId)

                currentReasoner._subStoryReasoner = null
                currentReasoner.hasNextNode().then(nodes => {
                    if (nodes.length > 0 && currentReasoner._storyEnded) {
                        logger.info(
                            "Jumped back from finish: resetting storyEnded",
                        )
                        currentReasoner._storyEnded = false
                    }
                })
            } else if (this._storyId) {
                this._jumpToNarrativeElementUsingShadowReasoner(
                    this._storyId,
                    narrativeElementId,
                )
            }
        }
    }

    /**
     * is the current Narrative Element followed by another?
     */
    hasUniqueNextNode(): Promise<boolean> {
        if (this._reasoner) {
            return this._reasoner
                .hasNextNode()
                .then(links => links.length === 1)
        }

        return Promise.resolve(false)
    }

    /**
     * find what the next steps in the story can be
     * returns array of objects, each containing
     * targetNeId: the id of the ne linked to
     * ne: the narrative element
     * the first is the link, the second is the actual NE when
     * first is a story ne (it resolves into substory)
     * eslint-disable-next-line max-len
     * this looks into NEs to make sure that they also have valid representations
     * @param {string} narrativeElementId Find the next valid steps using the reasoner
     */
    getValidNextSteps(
        narrativeElementId: string | null | undefined = null,
    ): Promise<Array<{ne: NarrativeElement, targetNeId: string}>> {
        let neId = narrativeElementId

        if (neId === null && this._currentNarrativeElement) {
            neId = this._currentNarrativeElement.id
        }

        if (this._reasoner && neId) {
            const subReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(
                neId,
            )

            if (subReasoner) {
                return subReasoner.hasNextNode().then(links => {
                    const narrativeElementList = []
                    links.forEach(link => {
                        if (link.target_narrative_element_id) {
                            const ne = this._getNarrativeElement(
                                link.target_narrative_element_id,
                            )

                            if (ne) {
                                narrativeElementList.push(ne)
                            }
                        }
                    })
                    const promiseList = []
                    narrativeElementList.forEach(narrativeElement => {
                        if (
                            narrativeElement.body.type ===
                            "REPRESENTATION_COLLECTION_ELEMENT"
                        ) {
                            promiseList.push(
                                Promise.resolve([
                                    {
                                        ne: narrativeElement,
                                        targetNeId: narrativeElement.id,
                                    },
                                ]),
                            )
                        } else if (
                            narrativeElement.body.type === "STORY_ELEMENT" &&
                            narrativeElement.body.story_target_id
                        ) {
                            promiseList.push(
                                this._fetchers
                                    .storyFetcher(
                                        narrativeElement.body.story_target_id,
                                    )
                                    .then(substory => {
                                        const startPromises = []
                                        substory.beginnings.forEach(
                                            beginning => {
                                                // eslint-disable-next-line max-len
                                                startPromises.push(
                                                    this._fetchers.narrativeElementFetcher(
                                                        beginning.narrative_element_id,
                                                    ),
                                                )
                                            },
                                        )
                                        return Promise.all(startPromises).then(
                                            startNes => {
                                                const startNeObjs = []
                                                startNes.forEach(startingNe =>
                                                    startNeObjs.push({
                                                        ne: startingNe,
                                                        targetNeId:
                                                            narrativeElement.id,
                                                    }),
                                                )
                                                return startNeObjs
                                            },
                                        )
                                    })
                                    .catch(err => {
                                        // eslint-disable-next-line max-len
                                        logger.error(
                                            `Controller finding next steps, but cannot get substory: ${err}`,
                                        )
                                        return Promise.resolve([null])
                                    }),
                            )
                        }
                    })
                    // now we have valid NEs, test reprensentations
                    // only return those which have valid representations
                    return Promise.all(promiseList)
                        .then(neArrayArray => {
                            const nes = [].concat(...neArrayArray)
                            const repPromises = nes.map(narrativeEl => {
                                if (narrativeEl === null) {
                                    return Promise.resolve(null)
                                }

                                return this._fetchers
                                    .representationCollectionFetcher(
                                        narrativeEl.ne.body
                                            .representation_collection_target_id,
                                    )
                                    .then(representationCollection => {
                                        if (
                                            representationCollection
                                                .representations.length > 0
                                        ) {
                                            // eslint-disable-line max-len
                                            // if there are reps, reason over them
                                            return this._representationReasoner(
                                                representationCollection,
                                            ) // eslint-disable-line max-len
                                        }

                                        // if empty - need to render description
                                        logger.warn(
                                            "Found NE with no representations - render description",
                                        ) // eslint-disable-line max-len

                                        // need to render description only as placeholder
                                        const dummyRep = {
                                            ...PLACEHOLDER_REPRESENTATION,
                                            description:
                                                narrativeEl.ne.description,
                                            id: narrativeEl.ne.id,
                                        }
                                        return Promise.resolve(dummyRep)
                                    })
                                    .then(() => narrativeEl)
                                    .catch(err => {
                                        // eslint-disable-next-line max-len
                                        logger.warn(
                                            `No representations are currently valid for Narrative Element ${narrativeEl.id}`,
                                            err,
                                        )
                                        return null
                                    })
                            })
                            return Promise.all(repPromises)
                        })
                        .then(reps => reps.filter(rep => rep !== null))
                })
            }
        }

        return Promise.resolve([])
    }

    refreshPlayerControls() {
        this._renderManager.updateControlAvailability()
    }

    /**
     * get the id of the previous node
     * if it's a linear path, will use the linearStoryPath to identify
     * if not will ask reasoner to try within ths substory
     * otherwise, returns null.
     */
    async getIdOfPreviousNode(): Promise<string | null | undefined> {
        let matchingId = null

        if (this._linearStoryPath) {
            // find current
            this._linearStoryPath.forEach((storyPathItem, i) => {
                if (
                    storyPathItem.narrative_element.id ===
                        this._currentNarrativeElement.id &&
                    i >= 1
                ) {
                    matchingId = this._linearStoryPath[i - 1].narrative_element
                        .id
                }
            })
        } else if (this._reasoner) {
            const subReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(
                this._currentNarrativeElement.id,
            )

            if (subReasoner) matchingId = subReasoner.findPreviousNodeId()
        }

        if (matchingId !== null) {
            return Promise.resolve(matchingId)
        }

        const history = await this.getVariableValue(InternalVariableNames.PATH_HISTORY)
        if (history && history.length > 1) {
            const lastVisitedId = history[history.length - 2]
            const lastne = await this._fetchers.narrativeElementFetcher(lastVisitedId)
            if (lastne) {
                return lastne.id
        }
                return null
        }
    }

    // get an array of ids of the NarrativeElements that follow narrativeElement

    /**
     * Fetches an array of the narrative elements which follow on from the given element
     * @fires REASONER_EVENTS.NEXT_ELEMENTS
     * @param {NarrativeElement} narrativeElement
     */
    getIdsOfNextNodes(
        narrativeElement: NarrativeElement,
    ): Promise<Array<string>> {
        return this.getValidNextSteps(narrativeElement.id).then(
            nextNarrativeElements => {
                if (nextNarrativeElements && nextNarrativeElements.length > 0) {
                    this.emit(REASONER_EVENTS.NEXT_ELEMENTS, {
                        names: nextNarrativeElements.map(
                            neObj => neObj.ne.name,
                        ),
                        ids: nextNarrativeElements.map(neObj => neObj.ne.id),
                    })
                }

                return nextNarrativeElements.map(neObj => neObj.ne.id)
            },
        )
    }

    /**
     * Reason over the narrative elements representations to find the one we need
     * @param {string} narrativeElementId
     */
    getRepresentationForNarrativeElementId(
        narrativeElementId: string,
    ): Promise<Representation | null | undefined> {
        return this._fetchers
            .narrativeElementFetcher(narrativeElementId)
            .then(narrativeElement => {
                if (
                    narrativeElement &&
                    narrativeElement.body.representation_collection_target_id
                ) {
                    return this._fetchers
                        .representationCollectionFetcher(
                            narrativeElement.body
                                .representation_collection_target_id,
                        )
                        .then(representationCollection => {
                            if (
                                representationCollection.representations
                                    .length > 0
                            ) {
                                return this._representationReasoner(
                                    representationCollection,
                                )
                            }

                            // need to render description only as placeholder
                            const dummyRep = {
                                ...PLACEHOLDER_REPRESENTATION,
                                description: narrativeElement.description,
                                id: narrativeElement.id,
                            }
                            return Promise.resolve(dummyRep)
                        })
                }

                if (
                    this._reasoner &&
                    narrativeElement &&
                    narrativeElement.body.story_target_id
                ) {
                    // fetch story
                    return this._fetchers
                        .storyFetcher(narrativeElement.body.story_target_id)
                        .then(story => {
                            if (this._reasoner) {
                                return this._reasoner.getBeginning(story)
                            }

                            return Promise.resolve(null)
                        })
                        .then(beginning => {
                            if (beginning) {
                                return this.getRepresentationForNarrativeElementId(
                                    beginning,
                                )
                            }

                            return Promise.resolve(null)
                        })
                }

                return Promise.resolve(null)
            })
    }

    reset() {
        this._storyId = null

        if (this._reasoner && this._handleStoryEnd) {
            this._reasoner.removeListener(
                REASONER_EVENTS.STORY_END,
                this._handleStoryEnd,
            )
        }

        if (this._reasoner && this._handleLinkChoice) {
            this._reasoner.removeListener(
                REASONER_EVENTS.MULTIPLE_VALID_LINKS,
                this._handleLinkChoice,
            )
        }

        if (this._reasoner && this._handleError) {
            this._reasoner.removeListener(ERROR_EVENTS, this._handleError)
        }

        if (this._reasoner && this._handleNarrativeElementChanged) {
            this._reasoner.removeListener(
                REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED,
                this._handleNarrativeElementChanged,
            )
        }

        this._reasoner = null

        this._renderManager.reset()
    }

    /**
     * Handles when we finish the story, this function should be called when we have
     * finished the main story if there are sub stories too.
     * @fires REASONER_EVENTS.STORY_END
     */
    _handleStoryEnd() {
        const logData = {
            type: AnalyticEvents.types.STORY_NAVIGATION,
            name: AnalyticEvents.names.STORY_END,
            from: this._currentNarrativeElement.id,
            to: "STORY_END",
        }

        this._handleAnalytics(logData)

        if (this._storyId) {
            logger.warn(`Story id ${this._storyId} ended, resetting`)
            this.resetStory(SESSION_STATE.NEW, this._storyId)
        }

        this.emit(REASONER_EVENTS.STORY_END)
    }

    // eslint-disable-next-line class-methods-use-this
    _handleError(err: Error) {
        if (err instanceof ReasonerError) {
            switch (err.errorType) {
                case REASONER_ERRORS.NO_BEGINNING:
                    // start button etc being created asynchronously
                    // need to give some time before clearing
                    setTimeout(
                        () =>
                            this._renderManager.showError(
                                err.message,
                                true,
                                true,
                            ),
                        500,
                    )
                    break

                case REASONER_ERRORS.NO_VALID_LINKS:
                    this._renderManager.showError(err.message, true, false)

                    break

                default:
                    logger.warn(err.toString())
            }
        } else {
            logger.warn(err.toString())
        }
    }

    walkPathHistory(
        storyId: string,
        lastVisited: string,
        pathHistory: [string],
    ) {
        this._storyReasonerFactory(storyId).then(newReasoner => {
            if (this._storyId !== storyId) {
                return
            }

            newReasoner.on(REASONER_EVENTS.ELEMENT_FOUND, element => {
                this.reset()
                this._storyId = storyId

                // apply appropriate listeners to this reasoner
                this._handleNarrativeElementChanged = (
                    ne: NarrativeElement,
                ) => {
                    this._handleNEChange(newReasoner, ne)
                }

                newReasoner.on(
                    REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED,
                    this._handleNarrativeElementChanged,
                ) // eslint-disable-line max-len

                newReasoner.on(
                    VARIABLE_EVENTS.VARIABLE_CHANGED,
                    this._handleVariableChanged,
                )
                newReasoner.on(REASONER_EVENTS.STORY_END, this._handleStoryEnd)
                newReasoner.on(ERROR_EVENTS, this._handleError)
                // swap out the original reasoner for this one
                this._reasoner = newReasoner

                // now we've walked to the target, trigger the change event handler
                // so that it calls the renderers etc.
                this._handleNEChange(newReasoner, element, true)
            })
            newReasoner.start()
            pathHistory.forEach(element => {
                newReasoner._shadowWalkPath(element, pathHistory)
            })
        })
    }

    setSessionState(state: string) {
        if (this._sessionManager) {
            this._sessionManager.setSessionState(state)
        }
    }

    getSessionState() {
        if (this._sessionManager) {
            return this._sessionManager.sessionState
        }

        return null
    }

    deleteExistingSession() {
        if (this._sessionManager) {
            if (this._storyId) {
                this._sessionManager.clearExistingSession()
            }

            this._sessionManager.setSessionState(SESSION_STATE.NEW)
        }
    }

    setExistingSession() {
        if (this._sessionManager) {
            this._sessionManager.setExistingSession()
        }
    }

    _handleVariableChanged(variable: Record<string, any>) {
        if (this._sessionManager) {
            logger.info("Variable stored in session state", variable)

            this._sessionManager.setVariable(variable)
        } else {
            logger.info("Variable not stored in session state", variable)
        }

        this.emit(VARIABLE_EVENTS.VARIABLE_CHANGED, variable)
    }

    _storyId: string | null | undefined
    _reasoner: StoryReasoner | null | undefined
    _target: HTMLElement
    _storyReasonerFactory: StoryReasonerFactory
    _fetchers: ExperienceFetchers
    _privacyNotice: string | null | undefined
    _saveSession: boolean | null | undefined
    _representationReasoner: RepresentationReasoner
    _analytics: AnalyticsLogger
    _assetUrls: AssetUrls
    _handleNarrativeElementChanged:
        | ((...args: Array<any>) => any)
        | null
        | undefined
    _handleLinkChoice: ((...args: Array<any>) => any) | null | undefined
    _linearStoryPath: Array<StoryPathItem>
    _currentNarrativeElement: NarrativeElement
    _renderManager: RenderManager
    _storyIconRendererCreated: boolean
    _allNarrativeElements: Array<NarrativeElement> | null | undefined
    _sessionManager: SessionManager
    handleKeys: boolean | null | undefined
    _analyticsHandler: AnalyticsHandler
    options: Record<any, any>
}