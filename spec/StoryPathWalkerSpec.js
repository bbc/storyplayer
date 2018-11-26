// @flow

import 'babel-polyfill';
// @flowignore
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import StoryPathWalker from '../src/StoryPathWalker';
// eslint-disable-next-line import/no-named-as-default
import StoryReasonerFactory from '../src/StoryReasonerFactory';
import RepresentationReasonerFactory from '../src/RepresentationReasoner';
import ObjectDataResolverFactory from '../src/resolvers/ObjectDataResolver';

import type { Experience } from '../src/romper';

const storyjson: Experience = require('./teststory.json');

chai.use(sinonChai);
const resolver = ObjectDataResolverFactory({ test: 'foobar' });

const storyFetcher = id =>
    Promise.resolve(storyjson.stories.filter(storyObject => storyObject.id === id)[0]);

const narrativeElementFetcher = id =>
    Promise.resolve(storyjson.narrative_elements.filter(neObject => neObject.id === id)[0]);

const representationCollectionFetcher = id =>
    Promise.resolve(storyjson.representation_collections
        .filter(representationCollectionObject => representationCollectionObject.id === id)[0]);

const representationFetcher = id =>
    Promise.resolve(storyjson.representations
        .filter(representationObject => representationObject.id === id)[0]);

const storyReasonerFactory = StoryReasonerFactory(storyFetcher, narrativeElementFetcher, resolver);

const representationReasoner = RepresentationReasonerFactory(representationFetcher, resolver);

describe('StoryPathWalker', () => {
    it('can create a new instance of StoryPathWalker', (done) => {
        const spw = new StoryPathWalker(
            storyFetcher,
            representationCollectionFetcher,
            storyReasonerFactory,
        );
        expect(spw).to.be.an.instanceof(StoryPathWalker);
        expect(spw).to.have.property('_pathmap');
        expect(spw._pathmap.length).to.equal(0);
        expect(spw._representationCollectionFetcher).to.equal(representationCollectionFetcher);
        done();
    });

    it('can parse straight story to representation collection id', (done) => {
        const spw = new StoryPathWalker(
            storyFetcher,
            representationCollectionFetcher,
            storyReasonerFactory,
        );
        const handleWalkEnd = () => {
            expect(spw._linear).to.be.equal(true);
            expect(spw._pathmap.length).to.equal(29);
            expect(spw._pathmap[1].narrative_element.body.representation_collection_target_id)
                .to.equal('d220a2f8-3df1-4a47-a710-4ec7ce394e90');
            done();
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });

    it('can parse straight story to presentation objects', (done) => {
        const spw = new StoryPathWalker(
            storyFetcher,
            representationCollectionFetcher,
            storyReasonerFactory,
        );
        const handleWalkEnd = () => {
            spw.getStoryItemList(representationReasoner).then((storyItemArray) => {
                expect(storyItemArray[2].representation_collection.id)
                    .to.equal('5723f542-5821-4003-9cc2-e34723793c9a');
                expect(storyItemArray[2].representation_collection.representations[0]
                    .representation_id).to.equal('259d08ec-b2a9-44f2-8564-39f746d453f2');
                done();
            });
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });

    it('returns empty list on multi-beginning story', (done) => {
        const intro = storyjson.stories[1];
        intro.beginnings.push({
            narrative_element_id: '68cf2acd-0b62-45cc-ac1e-0eddc5c8e571',
            condition: { '==': [1, 0] },
        });
        const spw = new StoryPathWalker(
            storyFetcher,
            representationCollectionFetcher,
            storyReasonerFactory,
        );
        const handleWalkEnd = () => {
            expect(spw._pathmap.length).to.be.equal(0);
            expect(spw._linear).to.be.equal(false);
            done();
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });
});
