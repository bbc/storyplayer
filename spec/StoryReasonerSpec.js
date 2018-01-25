// @flow

import 'babel-polyfill';
// @flowignore
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import StoryReasoner from '../src/StoryReasoner';

chai.use(sinonChai);

describe('StoryReasoner', () => {
    const PRESENTATION_OBJECT_ID = '8d7e96f2-fbc0-467c-a285-88a8908bc954';
    let story;
    let storyReasoner;
    let subStoryReasoner;
    let subStoryReasonerFactory;
    let dataResolver;

    function addNarrativeObject(id, name, condition, links, referencesSubStory) {
        if (condition !== null) {
            story.beginnings.push({ id, condition });
        }
        const presentation = {
            type: referencesSubStory ? 'STORY_ELEMENT' : 'PRESENTATION_OBJECT',
            target: PRESENTATION_OBJECT_ID,
        };
        story.narrative_elements.push({
            id,
            name,
            links,
            presentation,
            description: '',
            tags: {},
            version: '',
        });
    }

    beforeEach(() => {
        story = {
            id: '23fb988d-510f-48c2-bae5-9b9e7d927bf4',
            version: '0:0',
            name: 'A sample story',
            tags: {},
            beginnings: [],
            narrative_elements: [],
        };
        subStoryReasoner = new StoryReasoner(
            {
                id: '3a7bf33e-38f9-4a27-9eac-c2e2008b36a9',
                version: '0:0',
                name: 'A sub-story',
                tags: {},
                beginnings: [],
                narrative_elements: [],
            },
            () => Promise.reject(),
            () => Promise.reject(),
        );
        sinon.stub(subStoryReasoner, 'start');
        sinon.stub(subStoryReasoner, 'next');
        subStoryReasonerFactory = sinon.stub().returns(Promise.resolve(subStoryReasoner));
        dataResolver = sinon.stub().returns(Promise.resolve());
    });

    function buildStoryReasoner() {
        storyReasoner = new StoryReasoner(story, dataResolver, subStoryReasonerFactory);
    }

    it('emits the first narrative element on story start', (done) => {
        const narrativeObjectId = 'c46cd043-9edc-4c46-8b7c-f70afc6d6c23';
        const name = 'My narrative object';
        addNarrativeObject(narrativeObjectId, name, true, []);
        buildStoryReasoner();

        storyReasoner.on('narrativeElementChanged', (narrativeElement) => {
            expect(narrativeElement.id).to.equal(narrativeObjectId);
            expect(narrativeElement.name).to.equal(name);
            done();
        });

        storyReasoner.start();
    });

    it('only passes the first logic rule which satisfies the condition as the start', (done) => {
        const expectedId = 'c46cd043-9edc-4c46-8b7c-f70afc6d6c23';
        const expectedName = 'My narrative object';

        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My bad narrative object',
            false,
            [],
        );
        addNarrativeObject(expectedId, expectedName, true, []);
        buildStoryReasoner();

        storyReasoner.on('narrativeElementChanged', (narrativeElement) => {
            expect(narrativeElement.id).to.equal(expectedId);
            expect(narrativeElement.name).to.equal(expectedName);
            done();
        });

        storyReasoner.start();
    });

    it('generates an error if there are no possible moves left', (done) => {
        buildStoryReasoner();

        storyReasoner.on('error', () => {
            done();
        });

        storyReasoner.start();
    });

    it('uses JSONLogic to evaluate the beginning rules', (done) => {
        const expectedId = 'c46cd043-9edc-4c46-8b7c-f70afc6d6c23';
        const expectedName = 'My narrative object';

        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My bad narrative object',
            { '==': [0, 1] },
            [],
        );
        addNarrativeObject(expectedId, expectedName, { '==': [1, 1] }, []);
        buildStoryReasoner();

        storyReasoner.on('narrativeElementChanged', (narrativeElement) => {
            expect(narrativeElement.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            expect(narrativeElement.name).to.equal('My narrative object');
            done();
        });

        storyReasoner.start();
    });

    it('emits an error on the next event if there are no suitable links', (done) => {
        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My start narrative object',
            true,
            [],
        );
        buildStoryReasoner();
        storyReasoner.start();

        storyReasoner.on('narrativeElementChanged', () => {
            storyReasoner.on('error', () => {
                done();
            });

            storyReasoner.next();
        });
    });

    it('emits the next item when prodded', (done) => {
        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My start narrative object',
            true,
            [
                {
                    link_type: 'NARRATIVE_ELEMENT',
                    target: '7772a753-7ea8-4375-921f-6b086535e1c8',
                    condition: true,
                },
            ],
        );
        addNarrativeObject(
            '7772a753-7ea8-4375-921f-6b086535e1c8',
            'My second narrative object',
            null,
            [],
        );

        buildStoryReasoner();
        storyReasoner.start();

        storyReasoner.once('narrativeElementChanged', () => {
            storyReasoner.on('narrativeElementChanged', (narrativeElement) => {
                expect(narrativeElement.id).to.equal('7772a753-7ea8-4375-921f-6b086535e1c8');
                done();
            });

            storyReasoner.next();
        });
    });

    it('handles fuzzy logic appropriately', (done) => {
        const expectedId = 'c46cd043-9edc-4c46-8b7c-f70afc6d6c23';
        const expectedName = 'My narrative object';
        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My bad narrative object',
            { '-': [1.0, 0.5] },
            [],
        );
        addNarrativeObject(expectedId, expectedName, { '-': [1.0, 0.1] }, []);
        buildStoryReasoner();

        storyReasoner.on('narrativeElementChanged', (narrativeElement) => {
            expect(narrativeElement.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            expect(narrativeElement.name).to.equal('My narrative object');
            done();
        });

        storyReasoner.start();
    });

    it('never selects false links', (done) => {
        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My bad narrative object',
            false,
            [],
        );
        buildStoryReasoner();

        storyReasoner.on('error', () => {
            done();
        });

        storyReasoner.start();
    });

    it('gives boolean true priority above any fuzzy logic', (done) => {
        const expectedId = 'c46cd043-9edc-4c46-8b7c-f70afc6d6c23';
        const expectedName = 'My narrative object';
        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My bad narrative object',
            { '+': [1.0, 0.5] },
            [],
        );
        addNarrativeObject(expectedId, expectedName, true, []);
        buildStoryReasoner();

        storyReasoner.on('narrativeElementChanged', (narrativeElement) => {
            expect(narrativeElement.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            done();
        });

        storyReasoner.start();
    });

    it('gives higher priority to items which come first', (done) => {
        const expectedId = '3d4b829e-390e-45cb-a314-eeed0d66064f';
        const expectedName = 'My narrative object';
        addNarrativeObject(expectedId, expectedName, { '+': [1.0, 0.5] }, []);
        addNarrativeObject(
            'c46cd043-9edc-4c46-8b7c-f70afc6d6c23',
            'My bad narrative object',
            { '+': [1.0, 0.5] },
            [],
        );
        buildStoryReasoner();

        storyReasoner.on('narrativeElementChanged', (narrativeElement) => {
            expect(narrativeElement.id).to.equal('3d4b829e-390e-45cb-a314-eeed0d66064f');
            done();
        });

        storyReasoner.start();
    });

    it('sends an endStory event when the story ends', (done) => {
        addNarrativeObject('c46cd043-9edc-4c46-8b7c-f70afc6d6c23', 'My narrative object', true, [
            {
                link_type: 'END_STORY',
                condition: true,
            },
        ]);
        buildStoryReasoner();
        storyReasoner.start();

        storyReasoner.once('narrativeElementChanged', () => {
            storyReasoner.on('storyEnd', () => {
                done();
            });

            storyReasoner.next();
        });
    });

    it('does not allow you to trigger next when a story has ended', (done) => {
        addNarrativeObject('c46cd043-9edc-4c46-8b7c-f70afc6d6c23', 'My narrative object', true, [
            {
                link_type: 'END_STORY',
                condition: true,
            },
        ]);
        buildStoryReasoner();

        storyReasoner.once('narrativeElementChanged', () => {
            storyReasoner.once('storyEnd', () => {
                expect(() => storyReasoner.next()).to.throw(Error);
                done();
            });

            storyReasoner.next();
        });

        storyReasoner.start();
    });

    it('does not allow you to trigger next before a story has started', () => {
        buildStoryReasoner();

        expect(() => storyReasoner.next()).to.throw(Error);
    });

    it('does not allow you to trigger start a story twice', () => {
        addNarrativeObject('c46cd043-9edc-4c46-8b7c-f70afc6d6c23', 'My narrative object', true, []);
        buildStoryReasoner();

        storyReasoner.start();
        expect(() => storyReasoner.start()).to.throw(Error);
    });

    it('will allow you to go back to the beginning of the story', (done) => {
        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My start narrative object',
            true,
            [
                {
                    link_type: 'CHOOSE_BEGINNING',
                    condition: true,
                },
            ],
        );
        buildStoryReasoner();
        storyReasoner.start();

        storyReasoner.once('narrativeElementChanged', () => {
            storyReasoner.on('narrativeElementChanged', (narrativeElement) => {
                expect(narrativeElement.id).to.equal('3d4b829e-390e-45cb-a314-eeed0d66064f');
                done();
            });

            storyReasoner.next();
        });
    });

    it('generates an error if the link type is unrecognised', (done) => {
        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My start narrative object',
            true,
            [
                {
                    link_type: 'WOBBLE',
                    condition: true,
                },
            ],
        );
        buildStoryReasoner();
        storyReasoner.start();

        storyReasoner.on('error', () => {
            done();
        });

        storyReasoner.once('narrativeElementChanged', () => {
            storyReasoner.next();
        });
    });

    it('generates an error if the link target is not in the graph', (done) => {
        addNarrativeObject(
            '3d4b829e-390e-45cb-a314-eeed0d66064f',
            'My start narrative object',
            true,
            [
                {
                    link_type: 'NARRATIVE_ELEMENT',
                    condition: true,
                    target: '85478a77-bfe6-43c7-84ef-29d85a9b0221',
                },
            ],
        );
        buildStoryReasoner();
        storyReasoner.start();

        storyReasoner.on('error', () => {
            done();
        });

        storyReasoner.once('narrativeElementChanged', () => {
            storyReasoner.next();
        });
    });

    describe('sub-stories', () => {
        beforeEach(() => {
            addNarrativeObject('85478a77-bfe6-43c7-84ef-29d85a9b0221', 'Post-story', null, []);
            addNarrativeObject(
                '3d4b829e-390e-45cb-a314-eeed0d66064f',
                'My start narrative object',
                true,
                [
                    {
                        link_type: 'NARRATIVE_ELEMENT',
                        condition: true,
                        target: '85478a77-bfe6-43c7-84ef-29d85a9b0221',
                    },
                ],
                true,
            );
            buildStoryReasoner();
        });

        it('will fetch a sub-story if the presentation of a narrative node is another story', (done) => {
            subStoryReasoner.start.callsFake(() => {
                expect(subStoryReasonerFactory).to.have.been.calledWith(PRESENTATION_OBJECT_ID);
                done();
            });

            storyReasoner.start();
        });

        it('will throw an error if it can not fetch a substory', (done) => {
            subStoryReasonerFactory.returns(Promise.reject());

            storyReasoner.on('error', () => {
                done();
            });

            storyReasoner.start();
        });

        it('will call start() on the substory reasoner', (done) => {
            subStoryReasoner.start.callsFake(() => {
                subStoryReasoner.emit('narrativeElementChanged', {});
            });

            storyReasoner.on('narrativeElementChanged', () => {
                expect(subStoryReasoner.start).to.have.been.calledWith();
                done();
            });

            storyReasoner.start();
        });

        it('will call pass changing narrative elements from that substory reasoner up', (done) => {
            const expectedId = '19b71c5a-1eca-45d9-8e39-4500b32a97bb';
            subStoryReasoner.start.callsFake(() => {
                subStoryReasoner.emit('narrativeElementChanged', {
                    id: expectedId,
                });
            });

            storyReasoner.on('narrativeElementChanged', (elem) => {
                expect(elem.id).to.equal(expectedId);
                done();
            });

            storyReasoner.start();
        });

        it('will not allow next to be triggered before the substory has finished loading', () => {
            storyReasoner.start();

            expect(() => storyReasoner.next()).to.throw(Error);
        });

        it('will pass next() calls on to the sub-story', (done) => {
            const expectedId = '19b71c5a-1eca-45d9-8e39-4500b32a97bb';
            subStoryReasoner.start.callsFake(() => {
                subStoryReasoner.emit('narrativeElementChanged', {
                    id: 'incorrect-id',
                });
            });
            subStoryReasoner.next.callsFake(() => {
                subStoryReasoner.emit('narrativeElementChanged', {
                    id: expectedId,
                });
            });

            storyReasoner.once('narrativeElementChanged', () => {
                storyReasoner.once('narrativeElementChanged', (elem) => {
                    expect(elem.id).to.equal(expectedId);
                    done();
                });

                storyReasoner.next();
            });

            storyReasoner.start();
        });

        it('will continue traversing the parent graph when the substory ends', (done) => {
            subStoryReasoner.start.callsFake(() => {
                subStoryReasoner.emit('storyEnd');
            });

            storyReasoner.on('narrativeElementChanged', (elem) => {
                expect(elem.id).to.equal('85478a77-bfe6-43c7-84ef-29d85a9b0221');
                done();
            });

            storyReasoner.start();
        });
    });

    it('should resolve data using the data resolver', () => {
        addNarrativeObject(
            'c46cd043-9edc-4c46-8b7c-f70afc6d6c23',
            'My narrative object',
            { var: 'test.test' },
            [],
        );
        addNarrativeObject('2311429b-cab9-4628-9cd4-5cc037bbfc50', 'My narrative object', true, []);
        buildStoryReasoner();

        storyReasoner.start();

        expect(dataResolver).to.have.been.calledWith('test.test');
    });

    it('should use the response of the data resolver', (done) => {
        addNarrativeObject(
            'c46cd043-9edc-4c46-8b7c-f70afc6d6c23',
            'My narrative object',
            { var: 'test.test' },
            [],
        );
        buildStoryReasoner();

        dataResolver.returns(Promise.resolve(true));

        storyReasoner.on('narrativeElementChanged', (elem) => {
            expect(elem.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            done();
        });

        storyReasoner.start();
    });

    it('should support resolving strings', (done) => {
        addNarrativeObject(
            'c46cd043-9edc-4c46-8b7c-f70afc6d6c23',
            'My narrative object',
            { '==': [{ var: 'test.test' }, 'test'] },
            [],
        );
        buildStoryReasoner();

        dataResolver.returns(Promise.resolve('test'));

        storyReasoner.on('narrativeElementChanged', (elem) => {
            expect(elem.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            done();
        });

        storyReasoner.start();
    });

    it('should not break the whole chain if one resolution promise rejects', (done) => {
        addNarrativeObject(
            'e2e5d2e2-ab2e-4120-a816-ab9e44f0ffef',
            'My narrative object',
            { '==': [{ var: 'test.test' }, 'test'] },
            [],
        );
        addNarrativeObject(
            'c46cd043-9edc-4c46-8b7c-f70afc6d6c23',
            'My second narrative object',
            true,
            [],
        );
        buildStoryReasoner();

        dataResolver.returns(Promise.reject());

        storyReasoner.on('narrativeElementChanged', (elem) => {
            expect(elem.id).to.equal('c46cd043-9edc-4c46-8b7c-f70afc6d6c23');
            done();
        });

        storyReasoner.start();
    });
});
