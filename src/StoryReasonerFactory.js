// @flow

import type {
    DataResolver, StoryFetcher, NarrativeElementFetcher, NarrativeElement,
} from './romper';
import StoryReasoner from './StoryReasoner';

export type StoryReasonerFactory = (id: string) => Promise<StoryReasoner>;

/**
 * Create an instance of a StoryReasonerFactory
 *
 * @param {Function} fetcher a function which fetches the JSON body of a story
 * @param {Function} dataResolver an instance of the data resolver using for resolving world state
 * @return {Factory} an instance of the Factory which can be used to fetch an individual story
 */
export default function (
    storyFetcher: StoryFetcher,
    narrativeElementFetcher: NarrativeElementFetcher,
    dataResolver: DataResolver,
): StoryReasonerFactory {
    /**
     * Given a story ID, this will give you an instance of a StoryReasoner
     * which can reason over that ID
     *
     * @param {string} id the ID of the story to fetch
     * @return {Promise.<StoryReasoner>} a promise which will resolve to an instance of a reasoner
     */
    function Factory(id: string): Promise<StoryReasoner> {
        let returnedStory;
        return storyFetcher(id)
            .then((story) => {
                returnedStory = story;
                const nePromiseArray = [];
                story.narrative_element_ids.forEach((narrativeElementId) => {
                    nePromiseArray.push(narrativeElementFetcher(narrativeElementId));
                });
                return Promise.all(nePromiseArray);
            })
            .then((narrativeElements: Array<NarrativeElement>) => new StoryReasoner(
                returnedStory,
                narrativeElements,
                dataResolver,
                Factory,
            ));
    }

    return Factory;
}
