// @flow

import { expect } from 'chai';

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
            expect(narrativeElement.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            expect(narrativeElement.name).to.equal("My narrative object");
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
            expect(narrativeElement.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            expect(narrativeElement.name).to.equal("My narrative object");
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

    it('uses JSONLogic to evaluate the beginning rules', (done) => {
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
            expect(narrativeElement.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            expect(narrativeElement.name).to.equal("My narrative object");
            done();
        });

        storyReasoner.start();
    });

    it('emits an error on the next event if there are no suitable links', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": true,
                },
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My start narrative object",
                    links: [],
                },
            ],
        });
        storyReasoner.start();

        storyReasoner.on('error', () => {
            done();
        });

        storyReasoner.next();
    });

    it('emits the next item when prodded', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": true,
                },
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My start narrative object",
                    links: [
                        {
                            link_type: 'NARRATIVE_OBJECT',
                            target: '7772a753-7ea8-4375-921f-6b086535e1c8',
                            condition: true,
                        },
                    ],
                },
                {
                    id: "7772a753-7ea8-4375-921f-6b086535e1c8",
                    name: "My second narrative object",
                },
            ],
        });
        storyReasoner.start();

        storyReasoner.on('narrativeElementChanged', narrativeElement => {
            expect(narrativeElement.id).to.equal('7772a753-7ea8-4375-921f-6b086535e1c8');
            done();
        });

        storyReasoner.next();
    });

    it('handles fuzzy logic appropriately', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": {'-': [1.0, 0.5]},
                },
                {
                    "id": "c46cd043-9edc-4c46-8b7c-f70afc6d6c23",
                    "condition": {'-': [1.0, 0.1]},
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
            expect(narrativeElement.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            expect(narrativeElement.name).to.equal("My narrative object");
            done();
        });

        storyReasoner.start();
    });

    it('never selects false links', (done) => {
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
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My bad narrative object",
                },
            ],
        });

        storyReasoner.on('error', () => {
            done();
        });

        storyReasoner.start();
    });

    it('gives boolean true priority above any fuzzy logic', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": {'+': [1.0, 0.5]},
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
            expect(narrativeElement.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            done();
        });

        storyReasoner.start();
    });

    it('gives higher priority to items which come first', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": {'+': [1.0, 0.5]},
                },
                {
                    "id": "c46cd043-9edc-4c46-8b7c-f70afc6d6c23",
                    "condition": {'+': [1.0, 0.5]},
                },
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My narrative object",
                },
                {
                    id: "c46cd043-9edc-4c46-8b7c-f70afc6d6c23",
                    name: "My bad narrative object",
                },
            ],
        });

        storyReasoner.on('narrativeElementChanged', narrativeElement => {
            expect(narrativeElement.id).to.equal('3d4b829e-390e-45cb-a314-eeed0d66064f');
            done();
        });

        storyReasoner.start();
    });

    it('sends an endStory event when the story ends', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": true,
                },
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My narrative object",
                    links: [
                        {
                            link_type: 'END_STORY',
                            condition: true,
                        },
                    ],
                },
            ],
        });
        storyReasoner.start();

        storyReasoner.on('storyEnd', () => {
            done();
        });

        storyReasoner.next();
    });

    it('does not allow you to trigger next when a story has ended', () => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": true,
                },
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My narrative object",
                    links: [
                        {
                            link_type: 'END_STORY',
                            condition: true,
                        },
                    ],
                },
            ],
        });
        storyReasoner.start();
        storyReasoner.next();

        expect(() => storyReasoner.next()).to.throw(Error);
    });

    it('does not allow you to trigger next before a story has started', () => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [],
            narrative_objects: [],
        });

        expect(() => storyReasoner.next()).to.throw(Error);
    });

    it('does not allow you to trigger start a story twice', () => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": true,
                },
            ],
            narrative_objects: [],
        });

        storyReasoner.start();
        expect(() => storyReasoner.start()).to.throw(Error);
    });

    it('will allow you to go back to the beginning of the story', (done) => {
        const storyReasoner = new StoryReasoner({
            id: "23fb988d-510f-48c2-bae5-9b9e7d927bf4",
            version: "0:0",
            name: "A sample story",
            tags: {},
            beginnings: [
                {
                    "id": "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    "condition": true,
                },
            ],
            narrative_objects: [
                {
                    id: "3d4b829e-390e-45cb-a314-eeed0d66064f",
                    name: "My start narrative object",
                    links: [
                        {
                            link_type: 'CHOOSE_BEGINNING',
                            condition: true,
                        },
                    ],
                },
            ],
        });
        storyReasoner.start();

        storyReasoner.on('narrativeElementChanged', narrativeElement => {
            expect(narrativeElement.id).to.equal('3d4b829e-390e-45cb-a314-eeed0d66064f');
            done();
        });

        storyReasoner.next();
    });

});
