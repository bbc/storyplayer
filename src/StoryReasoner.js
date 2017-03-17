// @flow

import EventEmitter from 'events';
import JsonLogic from 'json-logic-js';

import type { Story, NarrativeElement } from './romper';
import type StoryReasonerFactory from './StoryReasonerFactory';

export default class StoryReasoner extends EventEmitter {

    _story: Story;
    _subStoryReasoner: ?StoryReasoner;
    _narrativeElements: {[id: string]: NarrativeElement};
    _currentNarrativeElement: NarrativeElement;
    _storyStarted: boolean;
    _storyEnded: boolean;
    _reasonerFactory: StoryReasonerFactory;
    _resolving: boolean;

    constructor(story: Story, reasonerFactory: StoryReasonerFactory) {
        super();
        this._story = story;
        this._narrativeElements = {};
        this._storyStarted = false;
        this._storyEnded = false;
        this._story.narrative_objects.forEach(narrativeElement => {
            this._narrativeElements[narrativeElement.id] = narrativeElement;
        });
        this._reasonerFactory = reasonerFactory;
        this._resolving = false;
    }

    start() {
        if (this._storyStarted) {
            throw new Error('InvalidState: this story has already been');
        }
        this._chooseBeginning();
    }

    next() {
        if (!this._storyStarted) {
            throw new Error('InvalidState: this story has not yet started');
        }
        if (this._storyEnded) {
            throw new Error('InvalidState: this story has ended');
        }
        if (this._resolving) {
            throw new Error('InvalidState: currently resolving a sub-story');
        }
        if (this._subStoryReasoner) {
            this._subStoryReasoner.next();
        } else {
            this._chooseNextNode();
        }
    }

    _chooseBeginning() {
        const startElement = this._evaluateConditions(this._story.beginnings);
        if (startElement) {
            this._storyStarted = true;
            this._setCurrentNarrativeElement(startElement.id);
        } else {
            this.emit('error', new Error('Unable to choose a valid beginning'));
        }
    }

    _chooseNextNode() {
        const nextElement = this._evaluateConditions(this._currentNarrativeElement.links);
        if (nextElement) {
            this._followLink(nextElement);
        } else {
            this.emit('error', new Error('There are no possible links'));
        }
    }

    _followLink(nextElement: NarrativeElement) {
        if (nextElement.link_type === 'END_STORY') {
            this.emit('storyEnd');
            this._storyEnded = true;
        } else if (nextElement.link_type === 'NARRATIVE_OBJECT') {
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

    _evaluateConditions(candidates: Array<{condition: any} | any>): any {
        const evaluatedCandidates = candidates
            .map(
                (candidate, i) => ({i, result: JsonLogic.apply(candidate.condition)})
            )
            .filter(candidate => candidate.result > 0);
        if (evaluatedCandidates.length > 0) {
            const bestCandidate = evaluatedCandidates.sort((a, b) => {
                if (a.result === b.result) {
                    return a.i - b.i;
                } else if (a.result === true) {
                    return -1;
                } else if (b.result === true) {
                    return 1;
                } else {
                    return b.result - a.result;
                }
            })[0].i;
            return candidates[bestCandidate];
        } else {
            return null;
        }
    }

}
