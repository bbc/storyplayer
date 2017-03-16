// @flow

import EventEmitter from 'events';
import JsonLogic from 'json-logic-js';

import type { Story, NarrativeElement } from './romper';

export default class StoryReasoner extends EventEmitter {

    _story: Story;
    _narrativeElements: {[id: string]: NarrativeElement};
    _currentNarrativeElement: NarrativeElement;

    constructor(story: Story) {
        super();
        this._story = story;
        this._narrativeElements = {};
        this._story.narrative_objects.forEach(narrativeElement => {
            this._narrativeElements[narrativeElement.id] = narrativeElement;
        });
    }

    start() {
        const startElement = this._evaluateConditions(this._story.beginnings);
        if (startElement) {
            this._setCurrentNarrativeElement(startElement.id);
        } else {
            this.emit('error', new Error('Unable to choose a valid beginning'));
        }
    }

    next() {
        const nextElement = this._evaluateConditions(this._currentNarrativeElement.links);
        if (nextElement) {
            this._setCurrentNarrativeElement(nextElement.target);
        } else {
            this.emit('error', new Error('There are no possible links'));
        }
    }

    _setCurrentNarrativeElement(narrativeElementId: string) {
        this._currentNarrativeElement = this._narrativeElements[narrativeElementId];
        this.emit('narrativeElementChanged', this._currentNarrativeElement);
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
