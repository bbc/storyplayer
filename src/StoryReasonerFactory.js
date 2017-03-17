// @flow

import type { Story } from './romper';
import type { DataResolver } from './DataResolver';
import StoryReasoner from "./StoryReasoner";

export type StoryReasonerFactory = (id: string) => Promise<StoryReasoner>;

export default function(fetcher: (id: string) => Promise<Story>, dataResolver: DataResolver): StoryReasonerFactory {
    function Factory(id: string): Promise<StoryReasoner> {
        return fetcher(id).then(story => new StoryReasoner(story, dataResolver, Factory));
    }

    return Factory;
}
