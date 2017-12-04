// @flow

import EventEmitter from 'events';

import type { Story, NarrativeElement, Link, DataResolver } from './romper';
import evaluateConditions from './logic';
import type { StoryReasonerFactory } from './StoryReasonerFactory';

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
        this._story.narrative_elements.forEach((narrativeElement) => {
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
        evaluateConditions(this._story.beginnings, this._dataResolver)
            .then((startElement) => {
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
        evaluateConditions(this._currentNarrativeElement.links, this._dataResolver)
            .then((nextElement) => {
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
        } else if (nextElement.link_type === 'NARRATIVE_ELEMENT' && nextElement.target) {
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
                    .catch((err) => {
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
}
