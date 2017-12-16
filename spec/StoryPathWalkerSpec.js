// @flow

import 'babel-polyfill';
import chai, { expect } from 'chai';
// import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import StoryPathWalker from '../src/StoryPathWalker';
import StoryReasonerFactory from '../src/StoryReasonerFactory'; // eslint-disable-line import/no-named-as-default
import RepresentationReasonerFactory from '../src/RepresentationReasoner';
// import type { Presentation } from '../src/romper';

const storyjson = require('./teststory.json');

chai.use(sinonChai);

const storyFetcher = id =>
    Promise.resolve(storyjson.story.filter(storyObject => storyObject.id === id)[0])
        .then(storyObject => storyObject);

const presentationFetcher = id =>
    Promise.resolve(storyjson.presentations
        .filter(presentationObject => presentationObject.id === id)[0])
        .then(presentationObject => presentationObject);

const storyReasonerFactory = StoryReasonerFactory(
    storyFetcher,
    null,
);

const representationReasoner = RepresentationReasonerFactory(null);

describe('StoryPathWalker', () => {
    it('can create a new instance of StoryPathWalker', (done) => {
        const spw = new StoryPathWalker(storyFetcher, presentationFetcher, storyReasonerFactory);
        expect(spw).to.be.an.instanceof(StoryPathWalker);
        expect(spw).to.have.property('_pathmap');
        expect(spw._pathmap.length).to.equal(0);
        expect(spw._presentationFetcher).to.equal(presentationFetcher);
        done();
    });

    it('can parse straight story to presentation ids', (done) => {
        const spw = new StoryPathWalker(storyFetcher, presentationFetcher, storyReasonerFactory);
        const handleWalkEnd = () => {
            expect(spw._linear).to.be.equal(true);
            expect(spw._pathmap.length).to.equal(7);
            expect(spw._pathmap[1].narrative_element.presentation.target)
                .to.equal('86f69eca-47a7-4b30-810c-d3f51dd63b9a');
            done();
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });

    it('can parse straight story to presentation objects', (done) => {
        const spw = new StoryPathWalker(storyFetcher, presentationFetcher, storyReasonerFactory);
        const handleWalkEnd = () => {
            spw.getStoryItemList(representationReasoner).then((map) => {
                expect(map[2].presentation.id)
                    .to.equal('abed0e16-b284-46a2-9a0a-6351aa0215cc');
                expect(map[2].presentation.representations[0].representation.id)
                    .to.equal('53cc9301-10fd-42a8-ae83-74f1e6354ad2');
                done();
            });
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });

    it('returns empty list on multi-beginning story', (done) => {
        const intro = storyjson.story[1];
        intro.beginnings.push({
            target: '619f999a-5535-4b05-9f20-9b523033078b',
            condition: { '==': [1, 0] },
        });
        const spw = new StoryPathWalker(storyFetcher, presentationFetcher, storyReasonerFactory);
        const handleWalkEnd = () => {
            expect(spw._pathmap.length).to.be.equal(0);
            expect(spw._linear).to.be.equal(false);
            done();
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });

    it('returns empty list on story with link branch', (done) => {
        const introsubs = storyjson.story[1].narrative_elements[0];
        introsubs.links.push({
            target: 'ed5304f6-b500-478d-b71d-c6632db95cf1',
            condition: { '==': [1, 1] },
            link_type: 'NARRATIVE_ELEMENT',
        });
        const spw = new StoryPathWalker(storyFetcher, presentationFetcher, storyReasonerFactory);
        const handleWalkEnd = () => {
            expect(spw._linear).to.be.equal(false);
            expect(spw._pathmap.length).to.be.equal(0);
            done();
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });
});
