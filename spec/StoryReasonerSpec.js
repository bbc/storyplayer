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

    it('only passes the first logic rule which satisfies the condition as the start', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": false,
                },
                {
                    "id": "c46cd043-9edc-4c46-8b7c-f70afc6d6c23",
                    "condition": true,
                },
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My bad narrative object",
                },
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

    it('generates an error if there are no possible moves left', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [],
            narrative_objects: [],
        });

        storyReasoner.on('error', () => {
            done();
        });

        storyReasoner.start();
    });

    it('use JSONLogic to evaluate the beginning rules', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": {'==': [0, 1]},
                },
                {
                    "id": "c46cd043-9edc-4c46-8b7c-f70afc6d6c23",
                    "condition": {'==': [1, 1]},
                },
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My bad narrative object",
                },
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
