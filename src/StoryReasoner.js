// @flow

import EventEmitter from 'events';

import type { Story, NarrativeElement, Link, DataResolver } from './romper';
import evaluateConditions from './logic';
import type { StoryReasonerFactory } from './StoryReasonerFactory';
import logger from './logger';
import InternalVariables, { InternalVariableNames } from './InternalVariables';
import {REASONER_EVENTS, VARIABLE_EVENTS, ERROR_EVENTS } from './Events';
/**
 * The StoryReasoner is a class which encapsulates navigating the narrative
 * structure of a story.
 */
export default class StoryReasoner extends EventEmitter {
    _story: Story;

    _dataResolver: DataResolver;

    _reasonerFactory: StoryReasonerFactory;

    _narrativeElements: { [id: string]: NarrativeElement };

    _currentNarrativeElement: NarrativeElement;

    _storyStarted: boolean;

    _storyEnded: boolean;

    _resolving: boolean;

    _subStoryReasoner: ?StoryReasoner;

    _parent: ?StoryReasoner;

    /**
     * An error event. This will get fired if the narrative gets stuck or some other error occurs.
     *
     * @event StoryReasoner#error
     * @type {Error}
     */

    /**
     * This event is fired when a narrative element has changed.
     * The body is the new narrative element.
     *
     * @event StoryReasoner#narrativeElementChanged
     * @type {NarrativeElement}
     */

    /**
     * This event is fired when the story has ended
     *
     * @event StoryReasoner#storyEnd
     * @type {NarrativeElement}
     */

    /**
     * Builds an instance of the reasoner for a particular story,
     * including recursing into sub-stories where they exist.
     *
     * @param {Story} story The JSON data structure of a Story, expanded to include the full set of
     *                      narrative elements expressed within
     * @param {DataResolver} dataResolver used for resolving variables
     *                      which are referenced in JSONLogic expressions
     * @param {StoryReasonerFactory} reasonerFactory used for building reasons for sub-stories
     */
    constructor(
        story: Story,
        narrativeElements: Array<NarrativeElement>,
        dataResolver: DataResolver,
        reasonerFactory: StoryReasonerFactory,
    ) {
        super();
        this._story = story;
        this._dataResolver = dataResolver;
        this._reasonerFactory = reasonerFactory;
        this._storyStarted = false;
        this._storyEnded = false;
        this._resolving = false;
        this._parent = null;

        this._narrativeElements = {};
        narrativeElements.forEach((narrativeElement) => {
            this._narrativeElements[narrativeElement.id] = narrativeElement;
        });
    }

    getRequirements() {
        if (
            this._story.meta !== undefined &&
            this._story.meta.romper !== undefined &&
            this._story.meta.romper.requirements !== undefined
        ) {
            return this._story.meta.romper.requirements;
        }
        return [];
    }

    /**
     * Start this particular story. This initially causes a narrativeElementChanged
     * event to fire to indicate which narrative element is the first in this story.
     *
     * @param {initialState} Object - Key value pair of starting values for story variables
     *
     * @throws when the story has already started
     * @fires StoryReasoner#error
     * @fires StoryReasoner#narrativeElementChanged
     * @fires StoryReasoner#CHOICE_OF_BEGINNINGS
     * @return {void}
     */
    start(initialState?: Object = {}) {
        if (this._storyStarted) {
            logger.warn('Calling reasoner start on story that has already started');
            // throw new Error('InvalidState: this story has already been');
        }
        this._storyStarted = true;
        this._applyInitialState(initialState);
    }

    // Get the variables defined in this story
    _fetchVariablesFromStory() {
        if (this._story.variables) {
            const variableTree = this._story.variables;
            return Promise.all(Object.keys(variableTree).map((storyVariableName) => {
                const storyVariableValue = variableTree[storyVariableName].default_value;
                return this.getVariableValue(storyVariableName)
                    .then((value) => {
                        if (value === undefined || value === null) {
                            return {
                                name: storyVariableName,
                                value: storyVariableValue
                            };
                        }
                        logger.info(`Variable ${storyVariableName} already has value ${value}`);
                        return null;
                    });
            })).then(foundVariables => foundVariables.filter(Boolean)
                .reduce((variablesObject, variable) => {
                    // eslint-disable-next-line no-param-reassign
                    variablesObject[variable.name] = variable.value;
                    return variablesObject;
                }, {}),
            );
        } 
        logger.info('No variables in story');
        return Promise.resolve(null);
    }

    _applyInitialState(initialState: Object) {
        if(initialState && Object.keys(initialState).length > 0) {
            Object.keys(initialState).forEach((varName) => {
                this.setVariableValue(varName, initialState[varName]);
            });
        }
        const internalVarSetter = new InternalVariables(this._dataResolver, this._story.meta);
        internalVarSetter.setAllVariables();
    }


    /**
     * Move on to the next node of this story.
     *
     * @fires StoryReasoner#error
     * @fires StoryReasoner#narrativeElementChanged
     * @fires StoryReasoner#storyEnd
     * @fires StoryReasoner#CHOICE_OF_LINKS
     * @throws when the story has not yet started, or has already ended
     * @throws if the reasoner is currently reasoning something
     *         (e.g,. next() has been called but a new narrative
     *         element has not yet been thought about)
     * @return {void}
     */
    next() {
        if (!this._storyStarted) {
            throw new Error('InvalidState: this story has not yet started');
        }
        if (this._storyEnded) {
            throw new Error('InvalidState: this story has ended');
        }
        if (this._resolving) {
            throw new Error('InvalidState: currently resolving an action');
        }
        if (this._subStoryReasoner) {
            this._subStoryReasoner.next();
        } else {
            this._chooseNextNode();
        }
    }



    chooseBeginning() {
        this._resolving = true;
        if (this._story.beginnings.length > 1) {
            this.emit(REASONER_EVENTS.CHOICE_OF_BEGINNINGS);
        }
        evaluateConditions(this._story.beginnings, this._dataResolver)
            .then((startElement) => {
                this._resolving = false;
                if (startElement) {
                    this._setCurrentNarrativeElement(startElement[0].narrative_element_id);
                } else {
                    this.emit(ERROR_EVENTS, new Error('Unable to choose a valid beginning'));
                }
            });
    }

    getBeginning(story: Story): Promise<?string> {
        return evaluateConditions(story.beginnings, this._dataResolver)
            .then((beginnings) => {
                if (beginnings && beginnings.length > 0) {
                    return beginnings[0].narrative_element_id;
                }
                return null;
            });
    }

    _chooseNextNode() {
        this._resolving = true;
        if (this._currentNarrativeElement.links.length === 0) {
            logger.info('Reasoner has found NE with no links - story end');
            this.emit(REASONER_EVENTS.STORY_END);
        } else if (this._currentNarrativeElement.links.length > 1) {
            this.emit(REASONER_EVENTS.CHOICE_OF_LINKS);
        }
        evaluateConditions(this._currentNarrativeElement.links, this._dataResolver)
            .then((nextElementChoices) => {
                this._resolving = false;
                if (nextElementChoices) {
                    if (nextElementChoices.length > 1) {
                        this.emit(REASONER_EVENTS.MULTIPLE_VALID_LINKS, nextElementChoices);
                        logger.info('StoryReasoner: multiple valid paths');
                    }
                    this._followLink(nextElementChoices[0]);
                } else {
                    this.emit(ERROR_EVENTS, new Error('There are no possible links'));
                }
            });
    }

    _followLink(nextElement: Link) {
        if (nextElement.link_type === 'END_STORY') {
            this._storyEnded = true;
            this.emit(REASONER_EVENTS.STORY_END);
        } else if (
            nextElement.link_type === 'NARRATIVE_ELEMENT' &&
            nextElement.target_narrative_element_id
        ) {
            this._setCurrentNarrativeElement(nextElement.target_narrative_element_id);
        } else if (nextElement.link_type === 'CHOOSE_BEGINNING') {
            this.chooseBeginning();
        } else {
            this.emit(ERROR_EVENTS, new Error(`Unable to follow a link of type ${nextElement.link_type}`),
            );
        }
    }

    _setCurrentNarrativeElement(narrativeElementId: string) {
        if (!(narrativeElementId in this._narrativeElements)) {
            this.emit(ERROR_EVENTS, new Error('Link is to an narrative object not in the graph'));
        } else {
            this._currentNarrativeElement = this._narrativeElements[narrativeElementId];
            if (this._currentNarrativeElement.body.type === 'STORY_ELEMENT') {
                this.appendToHistory(narrativeElementId);
                this._resolving = true;
                if (this._currentNarrativeElement.body.story_target_id) {
                    this._reasonerFactory(this._currentNarrativeElement.body.story_target_id)
                        .then(subStoryReasoner => this._initSubStoryReasoner(subStoryReasoner))
                        .catch((err) => {
                            this.emit(ERROR_EVENTS, err);
                        });
                }
            }
            else {
                this.emit(REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED, this._currentNarrativeElement);
            }
        }
    }



    createSubStoryReasoner(narrativeElementId: string) {
        this._currentNarrativeElement = this._narrativeElements[narrativeElementId];
        this._resolving = true;
        if (this._currentNarrativeElement.body.story_target_id) {
            this._reasonerFactory(this._currentNarrativeElement.body.story_target_id)
                .then(subStoryReasoner => this._initSubStoryReasoner(subStoryReasoner))
                .catch((err) => {
                    this.emit(ERROR_EVENTS, err);
                });
        }
    }

    /**
     * Store or change a variable for the reasoner to use while reasoning
     *
     * @param {String} name The name of the variable to set
     * @param {any} value Its value
     */
    setVariableValue(name: string, value: any) {
        this.emit(VARIABLE_EVENTS.VARIABLE_CHANGED, { name, value });
        logger.info(`Setting variable in story reasoner '${name}' to ${JSON.stringify(value)}`);
        this._dataResolver.set(name, value);
    }

    /**
     * Get the current value of a variable for the reasoner to use while reasoning
     *
     * @param {String} name The name of the variable to get
     */
    getVariableValue(name: string): Promise<any> {
        return this._dataResolver.get(name);
    }

    /**
     * Record the fact that a given Narrative Element has been visited
     * A special case of storing a variable
     *
     * @param {string} narrativeElementId The id of the narrative element visited
     */
    appendToHistory(narrativeElementId: string) {
        logger.info(`Storing ${narrativeElementId} in history`);
        this._dataResolver.get(InternalVariableNames.PATH_HISTORY)
            .then((value) => {
                let neList = [];
                if (value !== null) {
                    neList = neList.concat(value);
                }
                neList.push(narrativeElementId);
                this.setVariableValue(InternalVariableNames.PATH_HISTORY, neList);
                return value;
            });
    }

    _initSubStoryReasoner(subStoryReasoner: StoryReasoner) {
        this._addSubReasonerListeners(subStoryReasoner);
        this._subStoryReasoner = subStoryReasoner;
        this._resolving = false;
        this._subStoryReasoner.setParent(this);
        subStoryReasoner.start();
        subStoryReasoner.chooseBeginning();
    }

    _addSubReasonerListeners(subStoryReasoner: StoryReasoner) {
        const errorCallback = err => this.emit(ERROR_EVENTS, err);
        const branchBeginningCallback = () => this.emit(REASONER_EVENTS.CHOICE_OF_BEGINNINGS);
        const branchLinkCallback = () => this.emit(REASONER_EVENTS.CHOICE_OF_LINKS);
        const elementChangedCallback = (element) => {
            this.emit(REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED, element);
        };
        const storyEndCallback = () => {
            this._subStoryReasoner = null;
            this._chooseNextNode();
            subStoryReasoner.removeListener(ERROR_EVENTS, errorCallback);
            subStoryReasoner.removeListener(REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED, elementChangedCallback);
            subStoryReasoner.removeListener(REASONER_EVENTS.STORY_END, storyEndCallback);
        };
        subStoryReasoner.on(REASONER_EVENTS.CHOICE_OF_BEGINNINGS, branchBeginningCallback);
        subStoryReasoner.on(REASONER_EVENTS.CHOICE_OF_LINKS, branchLinkCallback);
        subStoryReasoner.on(ERROR_EVENTS, errorCallback);
        subStoryReasoner.on(REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED, elementChangedCallback);
        subStoryReasoner.on(REASONER_EVENTS.STORY_END, storyEndCallback);
        subStoryReasoner.on(VARIABLE_EVENTS.VARIABLE_CHANGED, (event) => {
            this.emit(VARIABLE_EVENTS.VARIABLE_CHANGED, event);
        });
    }

    setParent(parent: StoryReasoner) {
        this._parent = parent;
    }

    getParent(): ?StoryReasoner {
        return this._parent;
    }

    /**
     * Does the current narrative element have any valid ongoing links?
     * returns a list of links to valid following nodes
     * Recurses up the reasoner tree if end_story is met.
     */
    hasNextNode(): Promise<Array<Link>> {
        return evaluateConditions(this._currentNarrativeElement.links, this._dataResolver)
            .then((nextElementChoices) => {
                const promiseArray = [];
                if (nextElementChoices) {
                    nextElementChoices.forEach((neChoice) => {
                        if (neChoice.link_type === 'END_STORY') {
                            if (this._parent) {
                                promiseArray.push(this._parent.hasNextNode());
                            }
                        } else {
                            promiseArray.push(Promise.resolve([neChoice]));
                        }
                    });
                }
                return Promise.all(promiseArray);
            }).then((linkArrayArray) => {
                let linkArray = [];
                linkArrayArray.forEach((la) => {
                    linkArray = linkArray.concat(la);
                });
                return linkArray;
            });
    }

    // is there a next node in the path.  Takes a reasoner and
    // recurses into its subStoryReasoners
    _isFollowedByAnotherNode(reasoner: StoryReasoner): boolean {
        // can't have two end story links, so if multiple links, must continue
        if (reasoner._currentNarrativeElement.links.length > 1) {
            return true;
        }
        // if only link is to an NE, must continue
        if (reasoner._currentNarrativeElement.links[0].link_type === 'NARRATIVE_ELEMENT') {
            return true;
        }
        // if not, check with reasoner whether we go into another story
        const subReasoner = reasoner._subStoryReasoner;
        if (subReasoner) return this._isFollowedByAnotherNode(subReasoner);
        return false;
    }

    // is the narrative element with id neid one of the narrative elements
    // that reasoner is currently reasoning over ?
    _isInReasoner(narrativeElementId: string): boolean {
        const rids = Object.keys(this._narrativeElements);
        return (rids.indexOf(narrativeElementId) !== -1);
    }

    // dive into the substory reasoners until we find one that has neid
    // as one of its narrative elements
    // if not found, returns null
    static _getSubReasonerWithNarrativeElement(
        narrativeElementId: string,
        reasoner: StoryReasoner,
    ): ?StoryReasoner {
        if (reasoner._isInReasoner(narrativeElementId)) {
            return reasoner;
        } if (reasoner._subStoryReasoner) {
            return StoryReasoner._getSubReasonerWithNarrativeElement(
                narrativeElementId,
                reasoner._subStoryReasoner,
            );
        }
        return null;
    }

    /**
     * Recurse into sub-story reasoners to find one containing a narrative element
     * with the given id
     *
     * @param {string} The id of the narrative element we're searching for
     * @return {?StoryReasoner} The reasoner that is directly handling the narrative
     * element, or null if one can't be found.
     */
    getSubReasonerContainingNarrativeElement(narrativeElementId: string): ?StoryReasoner {
        return StoryReasoner._getSubReasonerWithNarrativeElement(narrativeElementId, this);
    }

    /**
     * Find the id of the Narrative Element that comes before the one currently being
     * reasoned over.  Only looks within this story (i.e., does not go up the tree and
     * into other stories).
     *
     * @return {?string} The id of the narrative element that comes before it, or null
     * if we're at the start of this (sub) story or if there are multiple nodes leading
     * to this one.
     */
    findPreviousNodeId(): ?string {
        const currentId = this._currentNarrativeElement.id;
        let incomingLinkCount = 0;
        let previousNodeId = null;
        Object.keys(this._narrativeElements).forEach((neId) => {
            const ne = this._narrativeElements[neId];
            ne.links.forEach((link) => {
                if (link.target_narrative_element_id === currentId) {
                    previousNodeId = ne.id;
                    incomingLinkCount += 1;
                }
            });
        });
        if (incomingLinkCount === 0) {
            // need to start traversing the tree...
        } else if (incomingLinkCount > 1) {
            //
        }
        return previousNodeId;
    }

    _shadowWalkPath(narrativeElementId: string, pathHistory: [string]) {
        if(!(narrativeElementId in this._narrativeElements)) {
            // this.emit('ERROR', new Error(`Where is this element ${narrativeElementId}`));
            return;
        }
        this._currentNarrativeElement = this._narrativeElements[narrativeElementId];
        if(narrativeElementId === pathHistory[pathHistory.length -1]) {
            this.emit(REASONER_EVENTS.ELEMENT_FOUND, this._currentNarrativeElement);
            return;
        }
        if(this._currentNarrativeElement.body.type === 'STORY_ELEMENT') {
            if (this._currentNarrativeElement.body.story_target_id) {
                this._reasonerFactory(this._currentNarrativeElement.body.story_target_id)
                    .then(subStoryReasoner => {
                        this._initShadowSubStoryReasoner(subStoryReasoner, narrativeElementId, pathHistory)
                    }).catch((err) => {
                        this.emit(ERROR_EVENTS, err);
                    });
            } else {
                this.emit(ERROR_EVENTS, new Error(`No Story target id for element ${narrativeElementId}`));
            }
            
        }
    }


    _initShadowSubStoryReasoner(subStoryReasoner: StoryReasoner, narrativeElement: string, pathHistory: [string]) {
        this._addSubReasonerListeners(subStoryReasoner);
        subStoryReasoner.on(REASONER_EVENTS.ELEMENT_FOUND, (foundElement) => this.emit(REASONER_EVENTS.ELEMENT_FOUND, foundElement));
        this._subStoryReasoner = subStoryReasoner;
        this._resolving = false;
        this._subStoryReasoner.setParent(this);
        subStoryReasoner.start();
        pathHistory.forEach(element => {
            subStoryReasoner._shadowWalkPath(element, pathHistory);
        });
    }
}
