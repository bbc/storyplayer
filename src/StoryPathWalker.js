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
    _storylist: Array<Story>;
    _storyId: string;

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

    fetchAllStories(
        story: Story,
        startEl: NarrativeElement,
        storyList: Array<Story>,
    ) {
        if (startEl.presentation.type === 'STORY_ELEMENT') {
            const subStoryId = startEl.presentation.target;
            this._depth += 1;
            this._storyFetcher(subStoryId).then((subStory) => {
                // console.log('SPW fetched ', subStory.name);
                const subStoryStartId = this.getBeginning(subStory);
                if (!subStoryStartId) {
                    this.storyFetchComplete();
                    return;
                }
                storyList.push(subStory);
                const subStoryStart = StoryPathWalker.getNarrEl(subStoryStartId, subStory);
                // recurse
                this.fetchAllStories(subStory, subStoryStart, storyList);
                if (this._depth === 0) this.storyFetchComplete();
            });
        }

        if (startEl.links.length > 1) {
            // this.emit('nonLinear', new Error('Story non-linear: multiple possible links'));
            return;
        }
        const link = this.getLink(startEl);
        if (!link) return;
        if (link.link_type === 'NARRATIVE_ELEMENT') {
            if (!link.target) {
                this.emit('error', new Error('Cannot walk path - no link target'));
            } else {
                const nextNe = StoryPathWalker.getNarrEl(link.target, story);
                this.fetchAllStories(story, nextNe, storyList);
            }
        } else if (link.link_type === 'END_STORY') {
            this._depth -= 1;
        }
    }

    getStory(id: string): ?Story {
        let matchingStory = null;
        this._storylist.forEach((story) => {
            if (story.id === id) {
                matchingStory = story;
            }
        });
        return matchingStory;
    }

    walkFetch(
        story: Story,
        startEl: NarrativeElement,
        neList: Array<PathGather>,
        storyList: Array<string>,
    ) {
        // console.log('entering walk', this._depth);
        if (this._abort) { this._path = []; return; }
        if (startEl.presentation.type === 'STORY_ELEMENT') {
            const subStoryId = startEl.presentation.target;

            const subStory = this.getStory(subStoryId);

            if (subStory) {
                // console.log(subStory.name);

                // console.log('SPW fetch sub story ', subStoryId, 'at depth', this._depth);
                const subStoryStartId = this.getBeginning(subStory);
                if (!subStoryStartId) {
                    console.log('no start id');
                    this.walkComplete();
                    return;
                }
                // return false if multiple starts possible
                storyList.push(subStoryId);
                const subStoryStart = StoryPathWalker.getNarrEl(subStoryStartId, subStory);
                // recurse
                this._depth += 1;
                this.walkFetch(subStory, subStoryStart, neList, storyList);
                storyList.pop();
            }
            // if (this._depth === 0) {
            //     console.log('depth', this._depth);
            //     this.walkComplete();
            // }
        } else {
            // console.log('SWE fetch pushing ', startEl.name, storyList);
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
            if (this._depth === 0) {
                this.walkComplete();
            }
        }
    }

    parseStory(storyid: string) {
        this._depth = 1;
        this._abort = false;
        this._storyId = storyid;
        this._storyFetcher(storyid).then((story) => {
            // console.log('SPW parsing story ', story.name);
            const storyStartId = this.getBeginning(story);
            this._storylist = [story];
            if (storyStartId) {
                const storyStart = StoryPathWalker.getNarrEl(storyStartId, story);
                this.fetchAllStories(story, storyStart, this._storylist);
            }
        });
    }

    // once we've completed our recursive fetch of the stories,
    // recursively walk through again to build the map
    storyFetchComplete() {
        // console.log('sf complete', this._storylist);
        const startStory = this._storylist[0];
        const storyStartId = this.getBeginning(startStory);
        if (storyStartId) {
            this._depth = 1;
            const storyStart = StoryPathWalker.getNarrEl(storyStartId, startStory);
            this.walkFetch(startStory, storyStart, this._path, [storyStartId]);
        }
    }


    walkComplete() {
        this.getStoryPath().then(() => this.emit('walkComplete', this._pathmap));
        // this.emit('walkComplete', this._linear);
    }

    getStoryPath(): Promise<Array<StoryPathItem>> {
        const promises = [];
        this._path.forEach((pathGather) => {
            const presentationId = pathGather.ne.presentation.target;
            promises.push(this._presentationFetcher(presentationId));
        });

        return Promise.all(promises).then((presentations) => {
            presentations.forEach((pres, i) => {
                const pathGather = this._path[i];
                const pathmapitem: StoryPathItem = {
                    stories: pathGather.stories,
                    narrative_element: pathGather.ne,
                    presentation: pres,
                };
                this._pathmap.push(pathmapitem);
            });
            return Promise.resolve(this._pathmap);
        });
    }
}
