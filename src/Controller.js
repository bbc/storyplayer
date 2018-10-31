// @flow
import EventEmitter from 'events';

import JsonLogic from 'json-logic-js';
import type { StoryReasonerFactory } from './StoryReasonerFactory';
import StoryReasoner from './StoryReasoner';
import type { ExperienceFetchers, NarrativeElement, AssetUrls } from './romper';
import type { RepresentationReasoner } from './RepresentationReasoner';
import StoryPathWalker from './StoryPathWalker';
import type { StoryPathItem } from './StoryPathWalker';
import RenderManager from './RenderManager';
import RendererEvents from './renderers/RendererEvents';
import AnalyticEvents from './AnalyticEvents';
import type { AnalyticsLogger } from './AnalyticEvents';
import BrowserCapabilities, { BrowserUserAgent } from './browserCapabilities';
import logger from './logger';

export default class Controller extends EventEmitter {
    constructor(
        target: HTMLElement,
        storyReasonerFactory: StoryReasonerFactory,
        representationReasoner: RepresentationReasoner,
        fetchers: ExperienceFetchers,
        analytics: AnalyticsLogger,
        assetUrls: AssetUrls,
    ) {
        super();
        this._storyId = null;
        this._reasoner = null;
        this._target = target;
        this._storyReasonerFactory = storyReasonerFactory;
        this._representationReasoner = representationReasoner;

        this._fetchers = fetchers;
        this._analytics = analytics;
        this._assetUrls = assetUrls;
        this._linearStoryPath = [];
        this._createRenderManager();
    }

    restart(storyId: string, variableState?: Object = {}) {
        this._reasoner = null;
        // get render manager to tidy up
        this._renderManager.prepareForRestart();
        this.start(storyId, variableState);
    }

    start(storyId: string, variableState?: Object = {}) {
        this._storyId = storyId;

        // event handling functions for StoryReasoner
        const _handleStoryEnd = () => {
            const logData = {
                type: AnalyticEvents.types.STORY_NAVIGATION,
                name: AnalyticEvents.names.STORY_END,
            };
            this._analytics(logData);
            logger.warn('Story Ended!');
        };
        const _handleError = (err) => {
            logger.warn(`Error: ${err}`);
        };

        // see if we have a linear story
        this._testForLinearityAndBuildStoryRenderer(storyId);

        this._storyReasonerFactory(storyId).then((reasoner) => {
            if (this._storyId !== storyId) {
                return;
            }
            if (this._checkStoryPlayable(reasoner.getRequirements()) === -1) {
                return;
            }

            reasoner.on('storyEnd', _handleStoryEnd);
            reasoner.on('error', _handleError);

            this._handleNarrativeElementChanged = (narrativeElement: NarrativeElement) => {
                this._handleNEChange(reasoner, narrativeElement);
            };

            reasoner.on('narrativeElementChanged', this._handleNarrativeElementChanged);

            this._reasoner = reasoner;
            this._reasoner.start(variableState);

            this._addListenersToRenderManager();
            this.emit('ControllerReady');

            this._renderManager.handleStoryStart(storyId);
        });
    }

    // get the current and next narrative elements
    getStatus(): Promise<Object> {
        const currentNarrativeElement = this._renderManager.getCurrentNarrativeElement();
        let nextNarrativeElement = null;
        return this.getValidNextSteps()
            .then((nextNarrativeElements) => {
                if (nextNarrativeElements.length === 1) {
                    // eslint-disable-next-line prefer-destructuring
                    nextNarrativeElement = nextNarrativeElements[0];
                }
                return {
                    currentNarrativeElement,
                    nextNarrativeElement,
                };
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

    // create a manager to handle the rendering
    _createRenderManager() {
        this._renderManager = new RenderManager(
            this,
            this._target,
            this._representationReasoner,
            this._fetchers,
            this._analytics,
            this._assetUrls,
        );
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
    _testForLinearityAndBuildStoryRenderer(storyId: string) {
        // create an spw to see if the story is linear or not
        const spw = new StoryPathWalker(
            this._fetchers.storyFetcher,
            this._fetchers.representationCollectionFetcher,
            this._storyReasonerFactory,
        );

        // handle our StoryPathWalker reaching the end of its travels:
        // get spw to resolve the list of presentations into representations
        // then (if story is linear) create and start a StoryIconRenderer
        const _handleWalkEnd = () => {
            spw.getStoryItemList(this._representationReasoner).then((storyItemPath) => {
                this._linearStoryPath = storyItemPath;
                if (storyItemPath) this._renderManager._createStoryIconRenderer(storyItemPath);
            });
        };

        spw.on('walkComplete', _handleWalkEnd);
        spw.parseStory(storyId);
    }

    //
    // go to previous node in the current story, if we can
    //
    _goBackOneStepInStory() {
        const previous = this._getIdOfPreviousNode();
        if (previous) {
            this._jumpToNarrativeElement(previous);
        } else {
            logger.error('cannot resolve previous node to go to');
        }
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
        this._renderManager.handleNEChange(narrativeElement);
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
        this._analytics(logData);
    }

    // try to get the narrative element object with the given id
    // returns NE if it is either in the current subStory, or if this story is
    // linear (assuming id is valid).
    // returns null otherwise
    _getNarrativeElement(neid: string): ?NarrativeElement {
        let neObj;
        if (this._reasoner) {
            // get the actual NarrativeElement object
            const subReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(neid);
            if (subReasoner) {
                neObj = subReasoner._narrativeElements[neid];
            }
            if (!neObj && this._linearStoryPath) {
                // can't find it via reasoner if in different substoruy,
                // but can get from storyPath if linear
                this._linearStoryPath.forEach((storyPathItem) => {
                    if (storyPathItem.narrative_element.id === neid) {
                        neObj = storyPathItem.narrative_element;
                    }
                });
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
                logger.warn('reached story end without meeting target node');
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

            // run straight through the graph until we hit the target
            // when we do, change our event listeners to the normal ones
            // and take the place of the original _reasoner
            const shadowHandleNarrativeElementChanged = (narrativeElement: NarrativeElement) => {
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
                    this._reasoner._followLink(link);
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
            this._reasoner.setVariableValue(name, value);
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
     */
    getVariables(): Promise<Object> {
        const storyId = this._storyId;
        if (storyId) {
            return this._fetchers.storyFetcher(storyId)
                .then((story) => {
                    if (story.variables) {
                        return story.variables;
                    }
                    return {};
                });
        }
        return Promise.resolve({});
    }

    /**
     * Set a bunch of variables without doing renderer lookahead refresh in between
     * @param {*} variables An object of form { name1: valuetring1, name2: valuestring2 }
     */
    setVariables(variables: Object) {
        Object.keys(variables).forEach((varName) => {
            if (this._reasoner) {
                this._reasoner.setVariableValue(varName, variables[varName]);
            } else {
                logger.warn(`Controller cannot set variable '${varName}' - no reasoner`);
            }
        });
        this._renderManager.refreshLookahead();
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
    getValidNextSteps(): Promise<Array<NarrativeElement>> {
        if (this._reasoner) {
            return this._reasoner.hasNextNode()
                .then((links) => {
                    const narrativeElementList = [];
                    links.forEach((link) => {
                        if (this._reasoner && link.target_narrative_element_id) {
                            narrativeElementList.push(this._reasoner._narrativeElements[
                                link.target_narrative_element_id
                            ]);
                        }
                    });
                    return narrativeElementList;
                }, () => []);
        }
        return Promise.resolve([]);
    }

    // get the id of the previous node
    // if it's a linear path, will use the linearStoryPath to identify
    // if not will ask reasoner to try within ths substory
    // otherwise, returns null.
    _getIdOfPreviousNode(): ?string {
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
        return matchingId;
    }

    // get an array of ids of the NarrativeElements that follow narrativeElement
    // finds next NARRATIVE_ELEMENTs, but does not look out of the current subStory,
    // except in case of linear story
    _getIdsOfNextNodes(narrativeElement: NarrativeElement) {
        const upcomingIds: Array<string> = [];
        const nextNodes = narrativeElement.links;
        nextNodes.forEach((link) => {
            if (link.link_type === 'NARRATIVE_ELEMENT' && link.target_narrative_element_id) {
                upcomingIds.push(link.target_narrative_element_id);
            } else if (link.link_type === 'END_STORY') {
                if (this._linearStoryPath) {
                    let matchingId = null;
                    this._linearStoryPath.forEach((storyPathItem, i) => {
                        if (storyPathItem.narrative_element.id === narrativeElement.id
                            && i < (this._linearStoryPath.length - 1)) {
                            matchingId = this._linearStoryPath[i + 1].narrative_element.id;
                        }
                    });
                    if (matchingId) {
                        upcomingIds.push(matchingId);
                    }
                }
            }
        });
        return upcomingIds;
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
    _representationReasoner: RepresentationReasoner;
    _analytics: AnalyticsLogger;
    _assetUrls: AssetUrls;
    _handleError: ?Function;
    _handleStoryEnd: ?Function;
    _handleNarrativeElementChanged: ?Function;
    _handleLinkChoice: ?Function;
    _linearStoryPath: Array<StoryPathItem>;
    _currentNarrativeElement: NarrativeElement;
    _renderManager: RenderManager;
}
