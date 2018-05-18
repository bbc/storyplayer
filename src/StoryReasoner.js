// @flow

import EventEmitter from 'events';

import type { Story, NarrativeElement, Link, DataResolver } from './romper';
import evaluateConditions from './logic';
import type { StoryReasonerFactory } from './StoryReasonerFactory';
import logger from './logger';

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
    constructor(story: Story, dataResolver: DataResolver, reasonerFactory: StoryReasonerFactory) {
        super();
        this._story = story;
        this._dataResolver = dataResolver;
        this._reasonerFactory = reasonerFactory;
        this._storyStarted = false;
        this._storyEnded = false;
        this._resolving = false;

        this._narrativeElements = {};
        this._story.narrative_elements.forEach((narrativeElement) => {
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
     * @throws when the story has already started
     * @fires StoryReasoner#error
     * @fires StoryReasoner#narrativeElementChanged
     * @fires StoryReasoner#choiceOfBeginnings
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
     * @fires StoryReasoner#choiceOfLinks
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

    _chooseBeginning() {
        this._resolving = true;
        if (this._story.beginnings.length > 1) {
            this.emit('choiceOfBeginnings');
        }
        evaluateConditions(this._story.beginnings, this._dataResolver)
            .then((startElement) => {
                this._resolving = false;
                if (startElement) {
                    this._setCurrentNarrativeElement(startElement[0].id);
                } else {
                    this.emit('error', new Error('Unable to choose a valid beginning'));
                }
            });
    }

    _chooseNextNode() {
        this._resolving = true;
        if (this._currentNarrativeElement.links.length > 1) {
            this.emit('choiceOfLinks');
        }
        evaluateConditions(this._currentNarrativeElement.links, this._dataResolver)
            .then((nextElementChoices) => {
                this._resolving = false;
                if (nextElementChoices) {
                    if (nextElementChoices.length > 1) {
                        this.emit('multipleValidLinks', nextElementChoices);
                        logger.info('StoryReasoner: choice of paths - waiting for user');
                    } else {
                        this._followLink(nextElementChoices[0]);
                    }
                } else {
                    this.emit('error', new Error('There are no possible links'));
                }
            });
    }

    _followLink(nextElement: Link) {
        if (nextElement.link_type === 'END_STORY') {
            this._storyEnded = true;
            this.emit('storyEnd');
        } else if (nextElement.link_type === 'NARRATIVE_ELEMENT' && nextElement.target) {
            this._setCurrentNarrativeElement(nextElement.target);
        } else if (nextElement.link_type === 'CHOOSE_BEGINNING') {
            this._chooseBeginning();
        } else {
            this.emit(
                'error',
                new Error(`Unable to follow a link of type ${nextElement.link_type}`),
            );
        }
    }

    _setCurrentNarrativeElement(narrativeElementId: string) {
        if (!(narrativeElementId in this._narrativeElements)) {
            this.emit('error', new Error('Link is to an narrative object not in the graph'));
        } else {
            this._currentNarrativeElement = this._narrativeElements[narrativeElementId];
            if (this._currentNarrativeElement.presentation.type === 'STORY_ELEMENT') {
                this._resolving = true;
                this._reasonerFactory(this._currentNarrativeElement.presentation.target)
                    .then(subStoryReasoner => this._initSubStoryReasoner(subStoryReasoner))
                    .catch((err) => {
                        this.emit('error', err);
                    });
            } else {
                this.emit('narrativeElementChanged', this._currentNarrativeElement);
            }
        }
    }

    setVariableValue(name: string, value: any) {
        logger.info(`Setting variable ${name} to ${value}`);
        this._dataResolver.set(name, value);
    }

    appendToHistory(narrativeElementId: string) {
        logger.info(`Storing ${narrativeElementId} in history`);
        this._dataResolver.get('romper_path_history')
            .then((value) => {
                let neList = [];
                if (value !== null) {
                    neList = neList.concat(value);
                }
                neList.push(narrativeElementId);
                this.setVariableValue('romper_path_history', neList);
            });
    }

    _initSubStoryReasoner(subStoryReasoner: StoryReasoner) {
        const errorCallback = err => this.emit('error', err);
        const branchBeginningCallback = () => this.emit('choiceOfBeginnings');
        const branchLinkCallback = () => this.emit('choiceOfLinks');

        const elementChangedCallback = (element) => {
            this.emit('narrativeElementChanged', element);
        };

        const storyEndCallback = () => {
            this._subStoryReasoner = null;
            this._chooseNextNode();
            subStoryReasoner.removeListener('error', errorCallback);
            subStoryReasoner.removeListener('narrativeElementChanged', elementChangedCallback);
            subStoryReasoner.removeListener('storyEnd', storyEndCallback);
        };

        subStoryReasoner.on('choiceOfBeginnings', branchBeginningCallback);
        subStoryReasoner.on('choiceOfLinks', branchLinkCallback);
        subStoryReasoner.on('error', errorCallback);
        subStoryReasoner.on('narrativeElementChanged', elementChangedCallback);
        subStoryReasoner.on('storyEnd', storyEndCallback);
        this._subStoryReasoner = subStoryReasoner;
        this._resolving = false;
        subStoryReasoner.start();
    }

    /**
     * Does the current narrative element have any valid ongoing links?
     * returns a list of links to valid following nodes
     */
    hasNextNode(): Promise<Array<Link>> {
        return evaluateConditions(this._currentNarrativeElement.links, this._dataResolver)
            .then((nextElementChoices) => {
                if (nextElementChoices) {
                    return nextElementChoices;
                }
                return [];
            }, () => []);
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
        } else if (reasoner._subStoryReasoner) {
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
        this._story.narrative_elements.forEach((ne) => {
            ne.links.forEach((link) => {
                if (link.target === currentId) {
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
}
