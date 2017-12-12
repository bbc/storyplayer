// @flow

import EventEmitter from 'events';
import type { Representation, Presentation, StoryFetcher, PresentationFetcher, Story, NarrativeElement, Link } from './romper';

export type StoryPathItem = {
    stories: Array<string>,
    narrative_element: NarrativeElement,
    presentation: Presentation,
    representation?: Representation,
};

// the things we create as we walk the story
type PathGather = { stories: Array<string>, ne: NarrativeElement };

/**
 * The StoryPathWalker is a class which walks through the narrative
 * structure of a linear story.
 */
export default class StoryPathWalker extends EventEmitter {
    _storyFetcher: StoryFetcher;
    // _dataResolver: DataResolver;
    _path: Array<PathGather>;
    _presentationFetcher: PresentationFetcher;
    _depth: number;
    _linear: boolean;
    _abort: boolean;
    _pathmap: Array<StoryPathItem>;

    constructor(
        storyFetcher: StoryFetcher,
        presentationFetcher: PresentationFetcher,
    ) {
        super();
        this._storyFetcher = storyFetcher;
        this._presentationFetcher = presentationFetcher;
        this._path = [];
        this._depth = 0;
        this._linear = true;
        this._pathmap = [];
    }

    static getNarrEl(id: string, story: Story): NarrativeElement {
        const narrativeEl = story.narrative_elements.filter(neObject => neObject.id === id)[0];
        return narrativeEl;
    }

    getBeginning(story: Story): ?string {
        if (story.beginnings.length > 1) {
            this.emit('nonLinear', new Error('Story non-linear: multiple possible beginnings'));
            this._linear = false;
            this._abort = true;
            return null;
        }
        return story.beginnings[0].id;
    }

    getLink(ne: NarrativeElement): Link {
        if (ne.links.length > 1) {
            this.emit('nonLinear', new Error('Story non-linear: multiple possible links'));
            this._linear = false;
            this._abort = true;
        }
        return ne.links[0];
    }

    walkFetch(
        story: Story,
        startEl: NarrativeElement,
        neList: Array<PathGather>,
        storyList: Array<string>,
    ) {
        if (this._abort) { this._path = []; return; }
        if (startEl.presentation.type === 'STORY_ELEMENT') {
            const subStoryId = startEl.presentation.target;
            this._depth += 1;
            // console.log('SPW fetch sub story ', subStoryId, 'at depth', this._depth);
            this._storyFetcher(subStoryId).then((subStory) => {
                // console.log('SPW fetched ', subStory.name);
                const subStoryStartId = this.getBeginning(subStory);
                if (!subStoryStartId) {
                    this.walkComplete();
                    return;
                }
                // return false if multiple starts possible
                storyList.push(subStoryId);
                const subStoryStart = StoryPathWalker.getNarrEl(subStoryStartId, subStory);
                // recurse
                this.walkFetch(subStory, subStoryStart, neList, storyList);
                storyList.pop();
                if (this._depth === 0) this.walkComplete();
            });
        } else {
            // console.log('SWE fetch pushing ', startEl.presentation.target, storyList);
            const pathItem = {
                stories: storyList.slice(0),
                ne: startEl,
            };
            neList.push(pathItem);
        }
        if (startEl.links.length > 1) {
            this.emit('nonLinear', new Error('Story non-linear: multiple possible links'));
            return;
        }
        const link = this.getLink(startEl);
        if (!link) return;
        if (link.link_type === 'NARRATIVE_ELEMENT') {
            if (!link.target) {
                this.emit('error', new Error('Cannot walk path - no link target'));
            } else {
                const nextNe = StoryPathWalker.getNarrEl(link.target, story);
                this.walkFetch(story, nextNe, neList, storyList);
            }
        } else if (link.link_type === 'END_STORY') {
            this._depth -= 1;
        }
    }

    parseStory(storyid: string) {
        this._depth = 1;
        this._abort = false;
        this._storyFetcher(storyid).then((story) => {
            // console.log('SPW parsing story ', story.name);
            const storyStartId = this.getBeginning(story);
            if (storyStartId) {
                const storyStart = StoryPathWalker.getNarrEl(storyStartId, story);
                this.walkFetch(story, storyStart, this._path, [storyStartId]);
            }
        });
    }

    walkComplete() {
        this.getStoryPath().then(() => this.emit('walkComplete', this._pathmap));
        // this.emit('walkComplete', this._linear);
    }

    getStoryPath(): Promise<Array<StoryPathItem>> {
        const promises = [];
        this._path.forEach((pathGather) => {
            const presentationId = pathGather.ne.presentation.target;
            promises.push(this._presentationFetcher(presentationId)
                .then((pres) => {
                    const pathmapitem: StoryPathItem = {
                        stories: pathGather.stories,
                        narrative_element: pathGather.ne,
                        presentation: pres,
                    };
                    this._pathmap.push(pathmapitem);
                }));
        });

        return Promise.all(promises).then(() => this._pathmap);
    }
}
