// @flow

import EventEmitter from 'events';
import type { StoryFetcher, PresentationFetcher, Story, NarrativeElement, Link } from './romper';

/**
 * The StoryPathWalker is a class which walks through the narrative
 * structure of a linear story.
 */
export default class StoryPathWalker extends EventEmitter {
    _storyFetcher: StoryFetcher;
    // _dataResolver: DataResolver;
    _path: Array<string>;
    _presentationFetcher: PresentationFetcher;
    _depth: number;

    constructor(
        storyFetcher: StoryFetcher,
        presentationFetcher: PresentationFetcher,
    ) {
        super();
        this._storyFetcher = storyFetcher;
        this._presentationFetcher = presentationFetcher;
        this._path = [];
        this._depth = 0;
    }

    static getNarrEl(id: string, story: Story): NarrativeElement {
        const narrativeEl = story.narrative_elements.filter(neObject => neObject.id === id)[0];
        return narrativeEl;
    }

    getBeginning(story: Story): string {
        if (story.beginnings.length > 1) {
            this.emit('nonLinear', new Error('Story non-linear: multiple possible beginnings'));
        }
        return story.beginnings[0].id;
    }

    getLink(ne: NarrativeElement): Link {
        if (ne.links.length > 1) {
            this.emit('nonLinear', new Error('Story non-linear: multiple possible links'));
        }
        return ne.links[0];
    }

    walkFetch(story: Story, startEl: NarrativeElement, neList: Array<string>): boolean {
        if (startEl.presentation.type === 'STORY_ELEMENT') {
            const subStoryId = startEl.presentation.target;
            this._depth += 1;
            // console.log('SPW fetch sub story ', subStoryId, 'at depth', this._depth);
            this._storyFetcher(subStoryId).then((subStory) => {
                // console.log('SPW fetched ', subStory.name);
                const subStoryStartId = this.getBeginning(subStory);
                // return false if multiple starts possible
                if (!subStoryStartId) return false;
                const subStoryStart = StoryPathWalker.getNarrEl(subStoryStartId, subStory);
                // recurse
                const linear = this.walkFetch(subStory, subStoryStart, neList);
                // return false if substory non-linear
                if (!linear) return false;
                // console.log('depth', this._depth);
                if (this._depth === 0) this.walkComplete();
                return true;
            });
        } else {
            // console.log('SWE fetch pushing ', startEl.presentation.target);
            neList.push(startEl.presentation.target);
        }
        if (startEl.links.length > 1) {
            this.emit('nonLinear', new Error('Story non-linear: multiple possible links'));
            return false;
        }
        const link = this.getLink(startEl);
        if (link.link_type === 'NARRATIVE_ELEMENT') {
            if (!link.target) {
                this.emit('error', new Error('Cannot walk path - no link target'));
            } else {
                const nextNe = StoryPathWalker.getNarrEl(link.target, story);
                return this.walkFetch(story, nextNe, neList);
            }
        } else if (link.link_type === 'END_STORY') {
            // console.log('exiting substory to depth =', this._depth);
            this._depth -= 1;
            return true;
        }
        return false;
    }

    parseStory(storyid: string) {
        this._depth = 1;
        this._storyFetcher(storyid).then((story) => {
            console.log('SPW parsing story ', story.name);
            const storyStartId = this.getBeginning(story);
            const storyStart = StoryPathWalker.getNarrEl(storyStartId, story);
            this.walkFetch(story, storyStart, this._path);
        });
    }

    walkComplete() {
        // this.getStoryPath();
        this.emit('walkComplete', this.getStoryPath());
    }

    getStoryPath(): { [key: number]: string } {
        const map = {};
        let index = 1;
        this._path.forEach((presentationId) => {
            const position = index;
            this._presentationFetcher(presentationId).then((pres) => {
                map[position] = pres.id;
            });
            index += 1;
        });
        // console.log('SPW parsed story', map);
        return map;
    }
}
