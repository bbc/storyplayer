// @flow

const fs = require('fs');

import 'babel-polyfill';
import chai, { expect } from 'chai';
// import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import StoryPathWalker from '../src/StoryPathWalker';

const storyjson = require('./teststory.json');


chai.use(sinonChai);

const storyFetcher = (id) => Promise.resolve(
    storyjson.story
        .filter(storyObject => storyObject.id === id)[0]
).then(storyObject => storyObject ? storyObject : Promise.reject('no such story object ' + id));

const presentationFetcher = (id) => Promise.resolve(
    storyjson.presentations
        .filter(presentationObject => presentationObject.id === id)[0]
).then(presentationObject => presentationObject ? presentationObject : Promise.reject('no such presentation object ' + id));

describe('StoryPathWalker', () => {

    it('can create a new instance of StoryPathWalker', (done) => {
        const spw = new StoryPathWalker(storyFetcher, presentationFetcher);
        expect(spw).to.be.an.instanceof(StoryPathWalker);
        expect(spw).to.have.property('_path');
        expect(spw._path.length).to.equal(0);
        expect(spw._presentationFetcher).to.equal(presentationFetcher);
        done();
    });

    it('can parse straight story to presentation ids', (done) => {
        const spw = new StoryPathWalker(storyFetcher, presentationFetcher);
        const handleWalkEnd = (path) => {
            expect(spw._path.length).to.equal(7);
            expect(spw._path[1]).to.equal('86f69eca-47a7-4b30-810c-d3f51dd63b9a');
            done();
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });

    it('can parse straight story to presentation objects', (done) => {
        const spw = new StoryPathWalker(storyFetcher, presentationFetcher);
        const handleWalkEnd = (path) => {
            path.then((map) => {
                expect(map['3']).to.equal('abed0e16-b284-46a2-9a0a-6351aa0215cc');
                done();
            });
        };
        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory('74ecc9ed-a4f8-4706-8762-779bd0430fd3');
    });
});
