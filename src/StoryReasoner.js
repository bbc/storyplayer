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
        for (let i = 0; i < candidates.length; ++i) {
            if (JsonLogic.apply(candidates[i].condition)) {
                return candidates[i];
            }
        }
        return null;
    }

}
