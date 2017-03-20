// @flow

import type { DataResolver, StoryFetcher } from './romper';
import StoryReasoner from "./StoryReasoner";

export type StoryReasonerFactory = (id: string) => Promise<StoryReasoner>;

/**
 * Create an instance of a StoryReasonerFactory
 *
 * @param {Function} fetcher a function which fetches the JSON body of a story
 * @param {Function} dataResolver an instance of the data resolver using for resolving world state
 * @return {Factory} an instance of the Factory which can be used to fetch an individual story
 */
export default function(fetcher: StoryFetcher, dataResolver: DataResolver): StoryReasonerFactory {

    /**
     * Given a story ID, this will give you an instance of a StoryReasoner which can reason over that ID
     *
     * @param {string} id the ID of the story to fetch
     * @return {Promise.<StoryReasoner>} a promise which will resolve to an instance of a reasoner
     */
    function Factory(id: string): Promise<StoryReasoner> {
        return fetcher(id).then(story => new StoryReasoner(story, dataResolver, Factory));
    }

    return Factory;
}
