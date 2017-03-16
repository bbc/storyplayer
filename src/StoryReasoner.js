// @flow

import EventEmitter from 'events';

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

    start(): void {
        const beginningObjectId = this._story.beginnings[0].id;
        this.emit('narrativeElementChanged', this._narrativeElements[beginningObjectId]);
    }

}
