// @flow

import EventEmitter from 'events';
import StoryReasoner from './StoryReasoner';
import type { StoryReasonerFactory } from './StoryReasonerFactory';
import type { Representation, Presentation, StoryFetcher, PresentationFetcher, NarrativeElement } from './romper';
import type { RepresentationReasoner } from './RepresentationReasoner';

export type StoryPathItem = {
    stories: Array<string>,
    narrative_element: NarrativeElement,
    presentation: Presentation,
    representation: Representation,
};

export type PartialStoryPathItem = {
    stories: Array<string>,
    narrative_element: NarrativeElement,
    presentation: Presentation,
};

// the things we create as we walk the story
type PathGather = { stories: Array<string>, ne: NarrativeElement };

// add a representation field to a PartialStoryPathItem to make it a full one
const convertPartialToFull = (
    partial: PartialStoryPathItem,
    representationObject: Representation,
): StoryPathItem => {
    const full = {
        stories: partial.stories,
        narrative_element: partial.narrative_element,
        presentation: partial.presentation,
        representation: representationObject,
    };
    return full;
};

/**
 * The StoryPathWalker is a class which walks through the narrative
 * structure of a linear story.
 */
export default class StoryPathWalker extends EventEmitter {
    _storyFetcher: StoryFetcher;
    _presentationFetcher: PresentationFetcher;
    _storyReasonerFactory: StoryReasonerFactory;
    _linear: boolean;
    _pathmap: Array<PartialStoryPathItem>;
    _storyItemMap: Array<StoryPathItem>;

    /**
     * Create an instance of a StoryPathWalker
     *
     * @param {Function} storyFetcher a function which fetches the JSON body of a story
     * @param {Function} presentationFetcher a function which fetches the
     *           JSON body of a presentation
     * @param {Function} storyReasonerFactory a Factory for making StoryReasoners
     *
     * @return {StoryPathWalker} an instance of the StoryPathWalker which can be used to
     * walk a story graph and find a linear path through it, if there is one.
     */
    constructor(
        storyFetcher: StoryFetcher,
        presentationFetcher: PresentationFetcher,
        storyReasonerFactory: StoryReasonerFactory,
    ) {
        super();
        this._storyFetcher = storyFetcher;
        this._presentationFetcher = presentationFetcher;
        this._storyReasonerFactory = storyReasonerFactory;
        this._linear = true;
        this._pathmap = [];
        this._storyItemMap = [];
    }

    // populate path with presentations
    _getPresentations(path: Array<PathGather>): Promise<Array<PartialStoryPathItem>> {
        const promises = [];
        path.forEach((pathGather) => {
            const presentationId = pathGather.ne.presentation.target;
            promises.push(this._presentationFetcher(presentationId));
        });

        return Promise.all(promises).then((presentations) => {
            presentations.forEach((pres, i) => {
                const pathGather = path[i];
                const pathmapitem: PartialStoryPathItem = {
                    stories: pathGather.stories,
                    narrative_element: pathGather.ne,
                    presentation: pres,
                };
                this._pathmap.push(pathmapitem);
            });
            return Promise.resolve(this._pathmap);
        });
    }

    // get list of substory ids for the reasoner in its current state
    _getStoryArray(reasoner: StoryReasoner, stories: Array<string>) {
        stories.push(reasoner._currentNarrativeElement.id);
        if (reasoner._subStoryReasoner) {
            return this._getStoryArray(reasoner._subStoryReasoner, stories);
        }
        return stories;
    }

    // finished the walk - notify listeners
    _walkComplete(path: Array<PathGather>) {
        this._getPresentations(path).then(() => this.emit('walkComplete'));
    }

    /**
     * Resolve each presentation in the list into a representation
     * @param {RepresentationReasoner} a reasoner for determining which Representation to use
     * for a Presentation
     *
     * @returns {Promise<Array<StoryPathItem>>} A promise to return an array of StoryPathItems,
     * which will be empty if the story is non-linear, or if this is called before the
     * walkComplete event has been emitted.
     */
    getStoryItemList(representationReasoner: RepresentationReasoner): Promise<Array<StoryPathItem>> {
        const promises = [];
        this._pathmap.forEach((pathItem) => {
            promises.push(representationReasoner(pathItem.presentation));
        });

        return Promise.all(promises).then((representations) => {
            representations.forEach((repres, i) => {
                const fullPathItem = convertPartialToFull(this._pathmap[i], repres);
                this._storyItemMap.push(fullPathItem);
            });
            return Promise.resolve(this._storyItemMap);
        });
    }

    /**
     * Walk the story graph to see if it's linear
     * @fires StoryPathWalker#walkComplete
     * @param {string} id of the story to fetch and parse
     */
    parseStory(storyId: string) {
        this._linear = true;
        const path = [];

        this._storyReasonerFactory(storyId).then((linearReasoner) => {
            const _handleEnd = () => {
                this._walkComplete(path);
            };
            linearReasoner.on('storyEnd', _handleEnd);

            const _handleError = (err) => {
                alert(`Error: ${err}`); // eslint-disable-line no-alert
            };
            linearReasoner.on('error', _handleError);

            const _nonLinear = () => {
                this._linear = false;
                this._walkComplete([]);
            };
            linearReasoner.on('choiceOfBeginnings', _nonLinear);
            linearReasoner.on('choiceOfLinks', _nonLinear);

            const _handleNarrativeElementChanged = (narrativeElement: NarrativeElement) => {
                // console.log('linear reasoner at', narrativeElement.name);
                const parentStories = [storyId].concat(this._getStoryArray(linearReasoner, []));
                const pathItem = {
                    stories: parentStories,
                    ne: narrativeElement,
                };
                path.push(pathItem);
                if (this._linear) linearReasoner.next();
            };
            linearReasoner.on('narrativeElementChanged', _handleNarrativeElementChanged);

            linearReasoner.start();
        });
    }
}
