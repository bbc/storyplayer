// @flow

import EventEmitter from 'events';
import JsonLogic from 'json-logic-js';

import type { Story, NarrativeElement, Link } from './romper';
import type { StoryReasonerFactory } from './StoryReasonerFactory';
import type { DataResolver } from './DataResolver';

/**
 * The StoryReasoner is a class which encapsulates navigating the narrative
 * structure of a story.
 */
export default class StoryReasoner extends EventEmitter {

    _story: Story;
    _dataResolver: DataResolver;
    _reasonerFactory: StoryReasonerFactory;
    _narrativeElements: {[id: string]: NarrativeElement};
    _currentNarrativeElement: NarrativeElement;
    _storyStarted: boolean;
    _storyEnded: boolean;
    _resolving: boolean;
    _subStoryReasoner: ?StoryReasoner;

    /**
     * An error event. This will get fired if the narrative gets stuck or some other error occurs.
     *
     * @event StoryReasoner#error
     * @type {Error}
     */

    /**
     * This event is fired when a narrative element has changed. The body is the new narrative element.
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
     * Builds an instance of the reasoner for a particular story, including recursing into sub-stories where they exist.
     *
     * @param {Story} story The JSON data structure of a Story, expanded to include the full set of
     *                      narrative elements expressed within
     * @param {DataResolver} dataResolver used for resolving variables which are referenced in JSONLogic expressions
     * @param {StoryReasonerFactory} reasonerFactory used for building reasons for sub-stories
     */
    constructor(story: Story, dataResolver: DataResolver, reasonerFactory: StoryReasonerFactory) {
        super();
        this._story = story;
        this._dataResolver = dataResolver;
        this._reasonerFactory = reasonerFactory;
        this._storyStarted = false;
        this._storyEnded = false;
        this._resolving = false;

        this._narrativeElements = {};
        this._story.narrative_objects.forEach(narrativeElement => {
            this._narrativeElements[narrativeElement.id] = narrativeElement;
        });
    }

    /**
     * Start this particular story. This initially causes a narrativeElementChanged event to fire to indicate which
     * narrative element is the first in this story.
     *
     * @throws when the story has already started
     * @fires StoryReasoner#error
     * @fires StoryReasoner#narrativeElementChanged
     * @return {void}
     */
    start() {
        if (this._storyStarted) {
            throw new Error('InvalidState: this story has already been');
        }
        this._storyStarted = true;
        this._chooseBeginning();
    }

    /**
     * Move on to the next node of this story.
     *
     * @fires StoryReasoner#error
     * @fires StoryReasoner#narrativeElementChanged
     * @fires StoryReasoner#storyEnd
     * @throws when the story has not yet started, or has already ended
     * @throws if the reasoner is currently reasoning something (e.g,. next() has been called but a new narrative
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

    _chooseBeginning() {
        this._resolving = true;
        this._evaluateConditions(this._story.beginnings)
            .then(startElement => {
                this._resolving = false;
                if (startElement) {
                    this._setCurrentNarrativeElement(startElement.id);
                } else {
                    this.emit('error', new Error('Unable to choose a valid beginning'));
                }
            });
    }

    _chooseNextNode() {
        this._resolving = true;
        this._evaluateConditions(this._currentNarrativeElement.links)
            .then(nextElement => {
                this._resolving = false;
                if (nextElement) {
                    this._followLink(nextElement);
                } else {
                    this.emit('error', new Error('There are no possible links'));
                }
            });
    }

    _followLink(nextElement: Link) {
        if (nextElement.link_type === 'END_STORY') {
            this._storyEnded = true;
            this.emit('storyEnd');
        } else if (nextElement.link_type === 'NARRATIVE_OBJECT' && nextElement.target) {
            this._setCurrentNarrativeElement(nextElement.target);
        } else if (nextElement.link_type === 'CHOOSE_BEGINNING') {
            this._chooseBeginning();
        } else {
            this.emit('error', new Error(`Unable to follow a link of type ${nextElement.link_type}`));
        }
    }

    _setCurrentNarrativeElement(narrativeElementId: string) {
        if (!(narrativeElementId in this._narrativeElements)) {
            this.emit('error', new Error('Link is to an narrative object not in the graph'));
        } else {
            this._currentNarrativeElement = this._narrativeElements[narrativeElementId];
            if (this._currentNarrativeElement.presentation.type === 'STORY_OBJECT') {
                this._resolving = true;
                this._reasonerFactory(this._currentNarrativeElement.presentation.target)
                    .then(subStoryReasoner => this._initSubStoryReasoner(subStoryReasoner))
                    .catch(err => {
                        this.emit('error', err);
                    });
            } else {
                this.emit('narrativeElementChanged', this._currentNarrativeElement);
            }
        }
    }

    _initSubStoryReasoner(subStoryReasoner: StoryReasoner) {
        const errorCallback = err => this.emit('error', err);
        const elementChangedCallback = element => this.emit('narrativeElementChanged', element);
        const storyEndCallback = () => {
            this._subStoryReasoner = null;
            this._chooseNextNode();
            subStoryReasoner.removeListener('error', errorCallback);
            subStoryReasoner.removeListener('narrativeElementChanged', elementChangedCallback);
            subStoryReasoner.removeListener('storyEnd', storyEndCallback);
        };

        subStoryReasoner.on('error', errorCallback);
        subStoryReasoner.on('narrativeElementChanged', elementChangedCallback);
        subStoryReasoner.on('storyEnd', storyEndCallback);
        this._subStoryReasoner = subStoryReasoner;
        this._resolving = false;
        subStoryReasoner.start();
    }

    /**
     * Takes a list of links that has a JSONLogic "condition", evaluates them and returns
     * the object with the best JSONLogic result
     *
     * @param {Array} candidates array to evaluate
     * @return {Promise} the best result
     * @private
     */
    _evaluateConditions<T>(candidates: Array<{condition: any} & T>): Promise<?T> {
        const interestingVars = Array.from(
            new Set(...candidates.map(candidate => JsonLogic.uses_data(candidate.condition))).values()
        );
        return Promise.all(
            interestingVars.map(
                interestingVar => this._dataResolver(interestingVar)
                    .catch(() => null)
                    .then(value => ({ key: interestingVar, value: value }))
            )
        ).then(
            convertDotNotationToNestedObjects
        ).then(resolvedVars => {
            const evaluatedCandidates = candidates
                .map(
                    (candidate, i) => ({i, result: JsonLogic.apply(candidate.condition, resolvedVars)})
                )
                .filter(candidate => candidate.result > 0);
            if (evaluatedCandidates.length > 0) {
                const bestCandidate = evaluatedCandidates.sort(sortCandidates)[0];
                return candidates[bestCandidate.i];
            } else {
                return null;
            }
        });
    }

}

/**
 * Evaluate a pair of JSONLogic results for sorting such that true is like Infinity and false like -Infinity.
 *
 * @param {Object} a the first item to sort
 * @param {Object} b the second item to sort
 * @return {number} the sort order
 */
function sortCandidates(a, b) {
    if (a.result === b.result) {
        return a.i - b.i;
    } else if (a.result === true) {
        return -1;
    } else if (b.result === true) {
        return 1;
    } else {
        return b.result - a.result;
    }
}

/**
 * Given some key value pairs, where the keys use . to denote nesting, return a deeply nested object that includes
 * all the keys specified in the array.
 *
 * @param {Array} resolvedVars an array of nested objects in the form [{key: 'a.b.c', value: 123}]
 * @return {{}} the nested object
 */
function convertDotNotationToNestedObjects(resolvedVars) {
    const vars = {};
    resolvedVars.forEach(({ key, value }) => {
        let objPart = vars;
        const keyParts = key.split('.');
        keyParts.forEach((keyPart, i) => {
            if (!(keyPart in objPart)) {
                if (i === keyParts.length - 1) {
                    objPart[keyPart] = value;
                } else {
                    objPart[keyPart] = {};
                    objPart = objPart[keyPart];
                }
            }
        });
    });
    return vars;
}
