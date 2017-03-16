// @flow

import EventEmitter from 'events';
import JsonLogic from 'json-logic-js';

import type { Story, NarrativeElement } from './romper';

export default class StoryReasoner extends EventEmitter {

    _story: Story;
    _narrativeElements: {[id: string]: NarrativeElement};

    constructor(story: Story) {
        super();
        this._story = story;
        this._narrativeElements = {};
        this._story.narrative_objects.forEach(narrativeElement => {
            this._narrativeElements[narrativeElement.id] = narrativeElement;
        });
    }

    start() {
        for (let i = 0; i < this._story.beginnings.length; ++i) {
            if (JsonLogic.apply(this._story.beginnings[i].condition)) {
                this.emit('narrativeElementChanged', this._narrativeElements[this._story.beginnings[i].id]);
                return;
            }
        }
        this.emit('error', new Error('Unable to choose a valid beginning'));
    }

}
