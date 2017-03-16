// @flow

import StoryReasoner from '../src/StoryReasoner';

describe('StoryReasoner', () => {

    it('emits the first narrative element on story start', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "c46cd043-9edc-4c46-8b7c-f70afc6d6c23",
                    "condition": true,
                },
            ],
            narrative_objects: [
                {
                    id: "c46cd043-9edc-4c46-8b7c-f70afc6d6c23",
                    name: "My narrative object",
                },
            ],
        });

        storyReasoner.on('narrativeElementChanged', narrativeElement => {
            expect(narrativeElement.id).toEqual('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            expect(narrativeElement.name).toEqual("My narrative object");
            done();
        });

        storyReasoner.start();
    });

});
