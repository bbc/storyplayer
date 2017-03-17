import type { Story } from './romper';
import StoryReasoner from "./StoryReasoner";

export default function(fetcher: (id: string) => Promise<Story>) {
    function StoryReasonerFactory(id: string): Promise<StoryReasoner> {
        return fetcher(id).then(story => new StoryReasoner(story, StoryReasonerFactory));
    }

    return StoryReasonerFactory;
}
