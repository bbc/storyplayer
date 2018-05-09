// @flow

import 'babel-polyfill';
// @flowignore
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import StoryPathWalker from '../src/StoryPathWalker';
// eslint-disable-next-line import/no-named-as-default
import StoryReasonerFactory from '../src/StoryReasonerFactory';
import RepresentationReasonerFactory from '../src/RepresentationReasoner';

const storyjson = require('./teststory.json');

chai.use(sinonChai);
const resolver = sinon.stub();

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

    it('can parse straight story to presentation ids', (done) => {
        const spw = new StoryPathWalker(
            storyFetcher,
            representationCollectionFetcher,
            storyReasonerFactory,
        );
        const handleWalkEnd = () => {
            expect(spw._linear).to.be.equal(true);
            expect(spw._pathmap.length).to.equal(29);
            expect(spw._pathmap[1].narrative_element.body.representation_collection_target)
                .to.equal('3566322a-05ec-4f38-a428-a2fd990ef588');
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
                    .to.equal('8e1d19ea-1bfc-45ae-873b-42d4b8bf4a41');
                expect(storyItemArray[2].representation_collection.representations[0]
                    .representation_id).to.equal('d51046af-4504-4093-940a-e3b190668f1f');
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
