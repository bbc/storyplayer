// @flow
import EventEmitter from 'events';
import JsonLogic from 'json-logic-js';
import type { StoryReasonerFactory } from './StoryReasonerFactory';
import StoryReasoner from './StoryReasoner';
import type { ExperienceFetchers, NarrativeElement, AssetUrls, Representation } from './romper';
import type { RepresentationReasoner } from './RepresentationReasoner';
import StoryPathWalker from './StoryPathWalker';
import type { StoryPathItem } from './StoryPathWalker';
import RenderManager from './RenderManager';
import RendererEvents from './renderers/RendererEvents';
import AnalyticEvents from './AnalyticEvents';
import type { AnalyticsLogger, AnalyticsPayload } from './AnalyticEvents';
import BrowserCapabilities, { BrowserUserAgent } from './browserCapabilities';
import logger from './logger';
import BaseRenderer from './renderers/BaseRenderer';
import { InternalVariableNames } from './InternalVariables';


import { NEXT_ELEMENTS, VARIABLE_CHANGED, CURRENT_NARRATIVE_ELEMENT} from './constants';
import SessionManager from './SessionManager';

// eslint-disable-next-line max-len
const IOS_WARNING = 'Due to technical limitations, the performance of this experience is degraded on iOS. To get the best experience please use another device';

export default class Controller extends EventEmitter {
    constructor(
        target: HTMLElement,
        storyReasonerFactory: StoryReasonerFactory,
        representationReasoner: RepresentationReasoner,
        fetchers: ExperienceFetchers,
        analytics: AnalyticsLogger,
        assetUrls: AssetUrls,
        privacyNotice: ?string,
    ) {
        super();
        this._storyId = null;
        this._reasoner = null;
        // $FlowFixMe
        this._sessionManager = null;
        this._target = target;
        this._storyReasonerFactory = storyReasonerFactory;
        this._representationReasoner = representationReasoner;
        this._fetchers = fetchers;
        this._analytics = analytics;
        this._enhancedAnalytics = this._enhancedAnalytics.bind(this);
        this._assetUrls = assetUrls;
        this._privacyNotice = privacyNotice;
        this._warnIosUsers();
        this._linearStoryPath = [];
        this._createRenderManager();
        this._storyIconRendererCreated = false;
        this._segmentSummaryData = {};
    }

    _enhancedAnalytics(logData: AnalyticsPayload): mixed {
        let repId = logData.current_representation;
        const renderer = this.getCurrentRenderer();
        if (repId === undefined && renderer && renderer.getRepresentation()){
            repId = renderer.getRepresentation().id;
        }
        let neId = logData.current_narrative_element;
        if (neId === undefined) {
            neId = this.getCurrentNarrativeElement() ?
                this.getCurrentNarrativeElement().id : 'null';
        }
        const appendedData: AnalyticsPayload = {
            name: AnalyticEvents.names[logData.name],
            type: AnalyticEvents.types[logData.type],
            from: logData.from,
            to: logData.to,
            current_narrative_element: neId,
            current_representation: repId,
        };

        this._handleSegmentSummaries(appendedData);
        this._analytics(appendedData);
    }
     
    _handleSegmentSummaries(appendedData: Object) {
        if (appendedData.type === AnalyticEvents.types.USER_ACTION) {
            if (this._segmentSummaryData.hasOwnProperty(appendedData.name)) {
                this._segmentSummaryData[appendedData.name] += 1;
            } else {
                this._segmentSummaryData[appendedData.name] = 1;
            }
        }

        if (appendedData.name === AnalyticEvents.names.START_BUTTON_CLICKED) {
            // log start time and first ne
            this._segmentSummaryData = {
                startTime: Date.now(),
                current_narrative_element: appendedData.current_narrative_element,
                current_representation: appendedData.current_representation,
            };
        }

        if (appendedData.name === AnalyticEvents.names.NARRATIVE_ELEMENT_CHANGE
            || appendedData.name === AnalyticEvents.names.STORY_END) {
            // work out and save summary data
            this._segmentSummaryData.duration = Date.now() - this._segmentSummaryData.startTime;
            if (!this._segmentSummaryData.chapter) {
                this._segmentSummaryData.chapter = appendedData.from;
            }
            const summaryData = {
                type: AnalyticEvents.types.SEGMENT_COMPLETION,
                name: appendedData.name,
                data: this._segmentSummaryData,
                current_narrative_element: appendedData.current_narrative_element,
                current_representation: appendedData.current_representation,
            };
            if (summaryData.current_representation) {
                this._analytics(summaryData);
            }
            this._segmentSummaryData = {
                startTime: Date.now(),
                chapter: appendedData.to,
            };
        }

    }


    restart(storyId: string, initialState?: Object = {}) {
        let resumeState = initialState;
        this._reasoner = null;
        // get render manager to tidy up
        this._renderManager.prepareForRestart();
        if(Object.keys(resumeState).length === 0) {
            resumeState = this._sessionManager.fetchExistingSessionState();
        }
        this.start(storyId, initialState);
    }

    start(storyId: string, initialState?: Object) {
        if(!this._sessionManager) {
            this._createSessionManager(storyId);
        }
        if(!this._sessionManager._existingSession) {
            const resumeState = this._sessionManager.fetchExistingSessionState();
            this.startStory(storyId, resumeState);
        } else {
            this.startStory(storyId, initialState);
        }
       
    }

    startStory(storyId: string, initialState?: Object = {}) {
        this._storyId = storyId;
        this._getAllNarrativeElements().then((neList) => {
            this._allNarrativeElements = neList;
        });
        window._sessionManager = this._sessionManager;

        // event handling functions for StoryReasoner
        const _handleStoryEnd = () => {
            const logData = {
                type: AnalyticEvents.types.STORY_NAVIGATION,
                name: AnalyticEvents.names.STORY_END,
            };
            this._enhancedAnalytics(logData);
            logger.warn('Story Ended!');
        };
        const _handleError = (err) => {
            logger.warn(`Error: ${err}`);
        };

        // see if we have a linear story
        this._testForLinearityAndBuildStoryRenderer(storyId)
            .then(() => this._storyReasonerFactory(storyId))
            .then((reasoner) => {
                if (this._storyId !== storyId) {
                    return;
                }
                if (this._checkStoryPlayable(reasoner.getRequirements()) === -1) {
                    return;
                }

                reasoner.on('storyEnd', _handleStoryEnd);
                reasoner.on('error', _handleError);

                this._handleNarrativeElementChanged = (narrativeElement: NarrativeElement) => {
                    this._handleNEChange(reasoner, narrativeElement)
                        .then(() => {
                            if (this._linearStoryPath && !this._storyIconRendererCreated) {
                                this._renderManager._createStoryIconRenderer(this._linearStoryPath);
                                this._storyIconRendererCreated = true;
                            }
                        });
                };

                reasoner.on('narrativeElementChanged', this._handleNarrativeElementChanged);

                reasoner.on(VARIABLE_CHANGED, (e) => { this.emit(VARIABLE_CHANGED, e)});

                this._reasoner = reasoner;
                this._reasoner.start(initialState);

                this._addListenersToRenderManager();
                this.emit('romperstorystarted');
                this._renderManager.handleStoryStart(storyId);

                const lastVisitedElement = this._sessionManager.fetchLastVisitedElement()
                if(lastVisitedElement){
                    logger.info(`attempting to jump to ${lastVisitedElement}`);
                    // this._jumpToNarrativeElement(lastVisitedElement);
                }
                
            })
            .catch((err) => {
                logger.warn('Error starting story', err);
            });
    }

    // get the current and next narrative elements
    getStatus(): Promise<Object> {
        const currentNarrativeElement = this._renderManager.getCurrentNarrativeElement();
        let nextNarrativeElement = null;
        return this.getValidNextSteps()
            .then((nextNarrativeElementObjects) => {
                if (nextNarrativeElementObjects.length >= 1) {
                    // eslint-disable-next-line prefer-destructuring
                    nextNarrativeElement = nextNarrativeElementObjects[0].ne;
                }
                return Promise.resolve(nextNarrativeElement);
            }).then((nextne) => {
                const statusObject = {
                    currentNarrativeElement,
                    nextNarrativeElement: nextne,
                };
                return statusObject;
            });
    }
    /*
    requirements:[
        // First Requirement
        {
            logic: {//json logic here}
            errorMsg: "Error to show to user"
        },
        // Second Requirement
        {
            logic: {//json logic here}
            errorMsg: "Error to show to user"
        },
        ...
    ]
    */

    _checkStoryPlayable(requirements: Array<Object>) {
        const data = {
            supports: {
                hls: BrowserCapabilities.hlsSupport(),
                dash: BrowserCapabilities.dashSupport(),
            },
            browser: {
                ie: BrowserUserAgent.ie(),
                edge: BrowserUserAgent.edge(),
                iOS: BrowserUserAgent.iOS(),
            },
        };
        const anyRequirementsFailed = requirements.some((req) => {
            if (JsonLogic.apply(req.logic, data) === false) {
                this._target.innerHTML = '';
                const warningDiv = document.createElement('div');
                warningDiv.classList.add('romper-warning');
                const warningDivDiv = document.createElement('div');
                warningDivDiv.classList.add('romper-warning-div');
                warningDivDiv.innerHTML = req.errorMsg;
                warningDiv.appendChild(warningDivDiv);
                this._target.appendChild(warningDiv);

                logger.warn(`Using Data: ${JSON.stringify(data)}`);
                logger.warn(`Requirement Failed: ${JSON.stringify(req.logic)}`);
                return true;
            }
            return false;
        });

        if (anyRequirementsFailed) {
            return -1;
        }
        logger.info(`All requirements satisfied: ${JSON.stringify(requirements)}`);
        return 0;
    }

    _warnIosUsers() {
        if (BrowserUserAgent.iOS()) {
            if (!this._privacyNotice) {
                this._privacyNotice = IOS_WARNING;
            } else {
                const appendedNotice = `${this._privacyNotice}\n${IOS_WARNING}`;
                this._privacyNotice = appendedNotice;
            }
        }
    }

    // create a manager to handle the rendering
    _createRenderManager() {
        this._renderManager = new RenderManager(
            this,
            this._target,
            this._representationReasoner,
            this._fetchers,
            this._enhancedAnalytics,
            this._assetUrls,
            this._privacyNotice,
        );
    }

    _createSessionManager(storyId: string) {
        this._sessionManager = new SessionManager(storyId, this);
    }

    getCurrentRenderer(): ?BaseRenderer {
        return this._renderManager.getCurrentRenderer();
    }

    getCurrentNarrativeElement(): NarrativeElement {
        return this._currentNarrativeElement;
    }

    // add event listeners to manager
    _addListenersToRenderManager() {
        this._renderManager.on(RendererEvents.COMPLETED, () => {
            if (this._reasoner) this._reasoner.next();
        });
        this._renderManager.on(RendererEvents.NEXT_BUTTON_CLICKED, () => {
            if (this._reasoner) this._reasoner.next();
        });
        this._renderManager.on(RendererEvents.PREVIOUS_BUTTON_CLICKED, () => {
            this._goBackOneStepInStory();
        });
    }

    // see if we have a linear story
    // and if we do, create a StoryIconRenderer
    _testForLinearityAndBuildStoryRenderer(storyId: string): Promise<any> {
        // create an spw to see if the story is linear or not
        const spw = new StoryPathWalker(
            this._fetchers.storyFetcher,
            this._fetchers.representationCollectionFetcher,
            this._storyReasonerFactory,
        );
        return new Promise((resolve) => {
            // handle our StoryPathWalker reaching the end of its travels:
            // get spw to resolve the list of presentations into representations
            // then (if story is linear) create and start a StoryIconRenderer
            const _handleWalkEnd = () => {
                spw.getStoryItemList(this._representationReasoner)
                    .then((storyItemPath) => {
                        this._linearStoryPath = storyItemPath;
                    })
                    .then(() => {
                        resolve();
                    })
                    .catch((err) => {
                        // If we end up here, most likely due to there being representations
                        // with false conditions on our linear graph
                        logger.warn(err);
                        this._linearStoryPath = [];
                        resolve();
                    });
            };

            spw.on('walkComplete', _handleWalkEnd);
            spw.parseStory(storyId);
        });
    }

    //
    // go to previous node in the current story, if we can
    //
    _goBackOneStepInStory() {
        return Promise.all([
            this.getIdOfPreviousNode(),
            this.getVariableValue(InternalVariableNames.PATH_HISTORY),
        ]).then(([previous, history]) => {
            // remove the current NE from history
            history.pop();
            // remove the one we're going to - it'll be added again
            history.pop();
            // set history variable directly in reasoner to avoid triggering lookahead
            if (this._reasoner) {
                this._reasoner.setVariableAndSaveLocal(InternalVariableNames.PATH_HISTORY, history);
            }

            if (previous) {
                this._jumpToNarrativeElement(previous);
            } else {
                logger.error('cannot resolve previous node to go to');
            }
        });
    }

    //
    // repeat the current node in the current story, if we can
    //
    repeatStep() {
        const current = this._currentNarrativeElement;
        if (this._reasoner && current) {
            this._handleNEChange(this._reasoner, current);
        } else {
            logger.error('cannot resolve this node to repeat');
        }
    }

    // respond to a change in the Narrative Element: update the renderers
    _handleNEChange(reasoner: StoryReasoner, narrativeElement: NarrativeElement) {
        logger.info({
            obj: narrativeElement,
        }, 'Narrative Element');
        if (this._reasoner) {
            this._reasoner.appendToHistory(narrativeElement.id);
        }
        this._logNEChange(this._currentNarrativeElement, narrativeElement);
        this._currentNarrativeElement = narrativeElement;
        return this._renderManager.handleNEChange(narrativeElement);
    }

    _logNEChange(oldNarrativeElement: NarrativeElement, newNarrativeElement: NarrativeElement) {
        let oldName = 'null';
        if (oldNarrativeElement) {
            oldName = oldNarrativeElement.name;
        }
        const logData = {
            type: AnalyticEvents.types.STORY_NAVIGATION,
            name: AnalyticEvents.names.NARRATIVE_ELEMENT_CHANGE,
            from: oldName,
            to: newNarrativeElement.name,
        };
        this._enhancedAnalytics(logData);
        this.emit(CURRENT_NARRATIVE_ELEMENT, newNarrativeElement);
    }

    // try to get the narrative element object with the given id
    // returns NE or null if not found
    _getNarrativeElement(neid: string): ?NarrativeElement {
        let neObj;
        if (this._allNarrativeElements) {
            [neObj] = this._allNarrativeElements.filter(ne => ne.id === neid);
        } else if (this._reasoner) {
            // get the actual NarrativeElement object
            const subReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(neid);
            if (subReasoner) {
                neObj = subReasoner._narrativeElements[neid];
            }
        }
        return neObj;
    }

    // create a reasoner to do a shadow walk of the story graph
    // when it reaches a target node, it boots out the original reasoner
    // and takes its place (with suitable event listeners)
    _jumpToNarrativeElementUsingShadowReasoner(storyId: string, targetNeId: string) {
        this._storyReasonerFactory(storyId).then((shadowReasoner) => {
            if (this._storyId !== storyId) {
                return;
            }

            const _shadowHandleStoryEnd = () => {
                logger.warn('shadow reasoner reached story end without meeting target node');
            };
            shadowReasoner.on('storyEnd', _shadowHandleStoryEnd);

            // the 'normal' event listeners
            const _handleStoryEnd = () => {
                logger.warn('Story ended!');
            };
            const _handleError = (err) => {
                logger.warn(`Error: ${err}`);
            };
            shadowReasoner.on('error', _handleError);

            const visitedArray = [];

            // run straight through the graph until we hit the target
            // when we do, change our event listeners to the normal ones
            // and take the place of the original _reasoner
            const shadowHandleNarrativeElementChanged = (narrativeElement: NarrativeElement) => {
                if (visitedArray.includes(narrativeElement.id)) {
                    logger.warn('shadow reasoner looping - exiting without meeting target node');
                    _shadowHandleStoryEnd();
                    return;
                }
                visitedArray.push(narrativeElement.id);
                if (narrativeElement.id === targetNeId) {
                    // remove event listeners for the original reasoner
                    this.reset();

                    // apply appropriate listeners to this reasoner
                    this._storyId = storyId;
                    shadowReasoner.on('storyEnd', _handleStoryEnd);
                    shadowReasoner.removeListener(
                        'narrativeElementChanged',
                        shadowHandleNarrativeElementChanged,
                    );
                    this._handleNarrativeElementChanged = (ne: NarrativeElement) => {
                        this._handleNEChange(shadowReasoner, ne);
                    };
                    shadowReasoner.on(
                        'narrativeElementChanged',
                        this._handleNarrativeElementChanged,
                    );

                    // swap out the original reasoner for this one
                    this._reasoner = shadowReasoner;

                    // now we've walked to the target, trigger the change event handler
                    // so that it calls the renderers etc.
                    this._handleNEChange(shadowReasoner, narrativeElement);
                } else {
                    // just keep on walking until we find it (or reach the end)
                    shadowReasoner.next();
                }
            };
            shadowReasoner.on('narrativeElementChanged', shadowHandleNarrativeElementChanged);

            shadowReasoner.start();
        });
    }

    // follow link from the narrative element to one following it
    followLink(narrativeElementId: string) {
        this._currentNarrativeElement.links.forEach((link) => {
            if (link.target_narrative_element_id === narrativeElementId) {
                if (this._reasoner) {
                    const subReasoner = this._reasoner
                        .getSubReasonerContainingNarrativeElement(this._currentNarrativeElement.id);
                    if (subReasoner) {
                        subReasoner._followLink(link);
                    }
                }
            }
        });
    }

    /**
     * Store or change a variable for the reasoner to use while reasoning
     *
     * @param {String} name The name of the variable to set
     * @param {any} value Its value
     */
    setVariableValue(name: string, value: any) {
        if (this._reasoner) {
            this._reasoner.setVariableAndSaveLocal(name, value);
            logger.info(`Controller seting variable '${name}' to ${value}`);
            this._renderManager.refreshLookahead();
        } else {
            logger.warn(`Controller cannot set variable '${name}' - no reasoner`);
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
            return this._reasoner.getVariableValue(name);
        }
        logger.warn(`Controller cannot get variable '${name}' - no reasoner`);
        return Promise.resolve(null);
    }

    /**
     * Get the variables present in the story
     * @param {*} No parameters, it uses the story Id
     * recurses into substories
     */
    getVariables(): Promise<Object> {
        const storyId = this._storyId;
        if (storyId) {
            return this._getAllStories(storyId)
                .then((subStoryIds) => {
                    const subVarPromises = [];
                    subStoryIds.forEach((subid) => {
                        subVarPromises.push(this._getVariablesForStory(subid));
                    });
                    return Promise.all(subVarPromises);
                })
                .then((subStoryVariables) => {
                    const allVars = {};
                    subStoryVariables.forEach((substoryVarObj) => {
                        Object.keys(substoryVarObj).forEach((varName) => {
                            allVars[varName] = substoryVarObj[varName];
                        });
                    });
                    return allVars;
                });
        }
        return Promise.resolve({});
    }

    /**
     * Sets initial state to be default
     *  * @param {*} No parameters, it uses the story Id
     */
    getDefaultInitialState() {
        return this.getVariables().then((allVariables) => {
            return Object.keys(allVariables).map(variable => {
                return {name: variable, value: allVariables[variable].default_value}
            }).reduce((variablesObject, variable) => {
                // eslint-disable-next-line no-param-reassign
                variablesObject[variable.name] = variable.value;
                return variablesObject;
            }, {})
        });
    }

    // get the ids of every story nested within the one given
    _getAllStories(storyId: string): Promise<Array<string>> {
        return this._fetchers.storyFetcher(storyId)
            .then((story) => {
                const nePromises = [];
                story.narrative_element_ids.forEach((neid) => {
                    nePromises.push(this._fetchers.narrativeElementFetcher(neid));
                });
                return Promise.all(nePromises);
            })
            .then((nes) => {
                const subStoryIds = [];
                nes.forEach((ne) => {
                    if (ne.body.type === 'STORY_ELEMENT' && ne.body.story_target_id) {
                        subStoryIds.push(ne.body.story_target_id);
                    }
                });
                const substoryPromises = [];
                subStoryIds.forEach((subStory) => {
                    substoryPromises.push(this._getAllStories(subStory));
                });
                return Promise.all(substoryPromises);
            })
            .then((subStoryIds) => {
                const flatSubIds = [].concat(...subStoryIds);
                const idArray: Array<string> = [];
                idArray.push(storyId);
                flatSubIds.forEach(sid => idArray.push(sid));
                return Promise.resolve(idArray);
            });
    }

    // get all the variables for the story given
    _getVariablesForStory(storyId: string) {
        let variables;
        return this._fetchers.storyFetcher(storyId)
            .then((story) => {
                const promisesToResolve = [];
                // eslint-disable-next-line prefer-destructuring
                variables = story.variables;
                if (variables) {
                    Object.keys(variables).forEach((name) => {
                        if (this._reasoner) {
                            promisesToResolve.push(this._reasoner.getVariableValue(name));
                        }
                    });
                }
                // for each - if story, get variables for story
                return Promise.all(promisesToResolve);
            })
            .then((resolvedVariables) => {
                if (variables && resolvedVariables.length > 0) {
                    Object.keys(variables).forEach((name, index) => {
                        if (variables) {
                            variables[name].value = resolvedVariables[index];
                        }
                    });
                    return variables;
                }
                return {};
            });
    }

    /**
     * Set a bunch of variables without doing renderer lookahead refresh in between
     * @param {*} variables An object of form { name1: valuetring1, name2: valuestring2 }
     */
    setVariables(variables: Object) {
        Object.keys(variables).forEach((varName) => {
            if (this._reasoner) {
                this._reasoner.setVariableAndSaveLocal(varName, variables[varName]);
            } else {
                logger.warn(`Controller cannot set variable '${varName}' - no reasoner`);
            }
        });
        this._renderManager.refreshLookahead();
    }

    _getAllNarrativeElements(): Promise<Array<NarrativeElement>> {
        if (!this._storyId) {
            return Promise.resolve([]);
        }
        return this._getAllStories(this._storyId)
            .then((storyIds) => {
                // @flowignore
                storyIds.push(this._storyId);
                const storyPromises = [];
                storyIds.forEach(sid =>
                    storyPromises.push(this._fetchers.storyFetcher(sid)));
                return Promise.all(storyPromises);
            }).then((stories) => {
                const neIds = [];
                stories.forEach((story) => {
                    story.narrative_element_ids.forEach((neid) => {
                        if (neIds.indexOf(neid) === -1) {
                            neIds.push(neid);
                        }
                    });
                });
                const nePromises = [];
                neIds.forEach(neid =>
                    nePromises.push(this._fetchers.narrativeElementFetcher(neid)));
                return Promise.all(nePromises);
            });
    }

    //
    // go to an arbitrary node in the current story
    // @param neid: id of narrative element to jump to
    _jumpToNarrativeElement(narrativeElementId: string) {
        if (!this._reasoner) {
            logger.error('no reasoner');
            // return;
        } else {
            const currentReasoner = this._reasoner
                .getSubReasonerContainingNarrativeElement(narrativeElementId);
            if (currentReasoner) {
                currentReasoner._setCurrentNarrativeElement(narrativeElementId);
                currentReasoner._subStoryReasoner = null;
                currentReasoner.hasNextNode()
                    .then((nodes) => {
                        if (nodes.length > 0 && currentReasoner._storyEnded) {
                            logger.info('Jumped back from finish: resetting storyEnded');
                            currentReasoner._storyEnded = false;
                        }
                    });
            } else if (this._storyId) {
                this._jumpToNarrativeElementUsingShadowReasoner(this._storyId, narrativeElementId);
            }
        }
    }

    // is the current Narrative Element followed by another?
    hasUniqueNextNode(): Promise<boolean> {
        if (this._reasoner) {
            return this._reasoner.hasNextNode()
                .then(links => (links.length === 1));
        }
        return Promise.resolve(false);
    }

    // find what the next steps in the story can be
    // returns array of objects, each containing
    // targetNeId: the id of the ne linked to
    // ne: the narrative element
    // the first is the link, the second is the actual NE when
    // first is a story ne (it resolves into substory)
    // eslint-disable-next-line max-len
    // this looks into NEs to make sure that they also have valid representations
    getValidNextSteps(narrativeElementId: ?string = null): Promise<Array<Object>> {
        let neId = narrativeElementId;
        if (neId === null && this._currentNarrativeElement) {
            neId = this._currentNarrativeElement.id;
        }
        if (this._reasoner && neId) {
            const subReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(neId);
            if (subReasoner) {
                return subReasoner.hasNextNode()
                    .then((links) => {
                        const narrativeElementList = [];
                        links.forEach((link) => {
                            if (link.target_narrative_element_id) {
                                const ne =
                                    this._getNarrativeElement(link.target_narrative_element_id);
                                if (ne) {
                                    narrativeElementList.push(ne);
                                }
                            }
                        });
                        const promiseList = [];
                        narrativeElementList.forEach((narrativeElement) => {
                            if (narrativeElement.body.type ===
                                'REPRESENTATION_COLLECTION_ELEMENT') {
                                promiseList.push(Promise.resolve([{
                                    ne: narrativeElement,
                                    targetNeId: narrativeElement.id,
                                }]));
                            } else if (narrativeElement.body.type === 'STORY_ELEMENT'
                                && narrativeElement.body.story_target_id) {
                                promiseList.push(this._fetchers
                                    .storyFetcher(narrativeElement.body.story_target_id)
                                    .then((substory) => {
                                        const startPromises = [];
                                        substory.beginnings.forEach((beginning) => {
                                            // eslint-disable-next-line max-len
                                            startPromises.push(this._fetchers.narrativeElementFetcher(beginning.narrative_element_id));
                                        });
                                        return Promise.all(startPromises)
                                            .then((startNes) => {
                                                const startNeObjs = [];
                                                startNes.forEach(startingNe => startNeObjs.push({
                                                    ne: startingNe,
                                                    targetNeId: narrativeElement.id,
                                                }));
                                                return startNeObjs;
                                            });
                                    })
                                    .catch((err) => {
                                        // eslint-disable-next-line max-len
                                        logger.error(`Controller finding next steps, but cannot get substory: ${err}`);
                                        return Promise.resolve([null]);
                                    }));
                            }
                        });
                        // now we have valid NEs, test reprensentations
                        // only return those which have valid representations
                        return Promise.all(promiseList)
                            .then((neArrayArray) => {
                                const nes = [].concat(...neArrayArray);
                                const repPromises = nes.map(narrativeEl => {
                                    if (narrativeEl === null) {
                                        return Promise.resolve(null);
                                    }
                                    return this._fetchers
                                        .representationCollectionFetcher(narrativeEl.ne.body
                                            .representation_collection_target_id)
                                        .then(representationCollection =>
                                            // eslint-disable-next-line max-len
                                            this._representationReasoner(representationCollection))
                                        .then(() => narrativeEl)
                                        .catch((err) => {
                                            // eslint-disable-next-line max-len
                                            logger.warn(`No representations are currently valid for Narrative Element ${narrativeEl.id}`, err);
                                            return null;
                                        });
                                });
                                return Promise.all(repPromises);
                            })
                            .then(reps => reps.filter((rep) => rep !== null));
                    });
            }
        }
        return Promise.resolve([]);
    }

    refreshPlayerNextAndBack() {
        this._renderManager.refreshOnwardIcons();
    }

    // get the id of the previous node
    // if it's a linear path, will use the linearStoryPath to identify
    // if not will ask reasoner to try within ths substory
    // otherwise, returns null.
    getIdOfPreviousNode(): Promise<?string> {
        let matchingId = null;
        if (this._linearStoryPath) {
            // find current
            this._linearStoryPath.forEach((storyPathItem, i) => {
                if (storyPathItem.narrative_element.id === this._currentNarrativeElement.id
                    && i >= 1) {
                    matchingId = this._linearStoryPath[i - 1].narrative_element.id;
                }
            });
        } else if (this._reasoner) {
            const subReasoner = this._reasoner
                .getSubReasonerContainingNarrativeElement(this._currentNarrativeElement.id);
            if (subReasoner) matchingId = subReasoner.findPreviousNodeId();
        }
        if (matchingId !== null) {
            return Promise.resolve(matchingId);
        }
        return this.getVariableValue(InternalVariableNames.PATH_HISTORY)
            .then((history) => {
                if (history.length > 1) {
                    const lastVisitedId = history[history.length - 2];
                    return this._fetchers.narrativeElementFetcher(lastVisitedId);
                }
                return Promise.resolve();
            })
            .then((lastne) => {
                if (lastne) {
                    return lastne.id;
                }
                return null;
            });
    }

    // get an array of ids of the NarrativeElements that follow narrativeElement
    getIdsOfNextNodes(narrativeElement: NarrativeElement): Promise<Array<string>> {
        return this.getValidNextSteps(narrativeElement.id)
            .then((nextNarrativeElements) => {
                if(nextNarrativeElements && nextNarrativeElements.length > 0) {
                    this.emit(NEXT_ELEMENTS, { names: nextNarrativeElements.map(neObj => neObj.ne.name) });
                }
                return nextNarrativeElements.map(neObj => neObj.ne.id);;
            });
    }

    // given the NE id, reason to find a representation
    // reasons into sub story if necessary
    getRepresentationForNarrativeElementId(narrativeElementId: string): Promise<?Representation> {
        return this._fetchers.narrativeElementFetcher(narrativeElementId)
            .then((narrativeElement) => {
                if (narrativeElement && narrativeElement.body.representation_collection_target_id) {
                    return this._fetchers
                        .representationCollectionFetcher(narrativeElement.body
                            .representation_collection_target_id)
                        .then(representationCollection =>
                            this._representationReasoner(representationCollection));
                } if (this._reasoner
                    && narrativeElement
                    && narrativeElement.body.story_target_id) {
                    // fetch story
                    return this._fetchers.storyFetcher(narrativeElement.body.story_target_id)
                        .then((story) => {
                            if (this._reasoner) {
                                return this._reasoner.getBeginning(story);
                            }
                            return Promise.resolve(null);
                        })
                        .then((beginning) => {
                            if (beginning) {
                                return this.getRepresentationForNarrativeElementId(beginning);
                            }
                            return Promise.resolve(null);
                        });
                }
                return Promise.resolve(null);
            });
    }

    reset() {
        this._storyId = null;
        if (this._reasoner && this._handleStoryEnd) {
            this._reasoner.removeListener('storyEnd', this._handleStoryEnd);
        }
        if (this._reasoner && this._handleLinkChoice) {
            this._reasoner.removeListener('multipleValidLinks', this._handleLinkChoice);
        }
        if (this._reasoner && this._handleError) {
            this._reasoner.removeListener('error', this._handleError);
        }
        if (this._reasoner && this._handleNarrativeElementChanged) {
            this._reasoner.removeListener(
                'narrativeElementChanged',
                this._handleNarrativeElementChanged,
            );
        }
        this._reasoner = null;

        this._renderManager.reset();
    }

    _storyId: ?string;

    _reasoner: ?StoryReasoner;

    _target: HTMLElement;

    _storyReasonerFactory: StoryReasonerFactory;

    _fetchers: ExperienceFetchers;

    _privacyNotice: ?string;

    _representationReasoner: RepresentationReasoner;

    _analytics: AnalyticsLogger;

    _enhancedAnalytics: AnalyticsLogger

    _assetUrls: AssetUrls;

    _handleError: ?Function;

    _handleStoryEnd: ?Function;

    _handleNarrativeElementChanged: ?Function;

    _handleLinkChoice: ?Function;

    _linearStoryPath: Array<StoryPathItem>;

    _currentNarrativeElement: NarrativeElement;

    _renderManager: RenderManager;

    _storyIconRendererCreated: boolean;

    _allNarrativeElements: ?Array<NarrativeElement>;

    _sessionManager: SessionManager;

    _segmentSummaryData: Object;
}
