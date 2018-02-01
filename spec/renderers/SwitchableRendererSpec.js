// @flow

import 'babel-polyfill';
// @flowignore
import chai, { expect } from 'chai';
// import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SwitchableRenderer from '../../src/renderers/SwitchableRenderer';
import SimpleAVRenderer from '../../src/renderers/SimpleAVRenderer';
import ImageRenderer from '../../src/renderers/ImageRenderer';
import Player from '../../src/Player';
// import ImageVideoContextRenderer from '../../src/renderers/ImageVideoContextRenderer';
// import SimpleAVVideoContextRenderer from '../../src/renderers/SimpleAVVideoContextRenderer';

// import BaseRenderer from '../../src/renderers/BaseRenderer';

const storyjson = require('../teststory.json');

chai.use(sinonChai);

// const storyFetcher = id =>
//     Promise.resolve(storyjson.story.filter(storyObject => storyObject.id === id)[0])
//         .then(storyObject => storyObject ? storyObject : Promise.reject('no such story object ' + id));

// const presentationFetcher = id =>
//     Promise.resolve(storyjson.presentations.filter(presentationObject => presentationObject.id === id)[0])
//         .then(presentationObject => presentationObject ? presentationObject : Promise.reject('no such presentation object ' + id));

// const defaultSwitchableRepresentation = storyjson.presentations[4].representations[0];

const defaultSwitchableRepresentation = {
    id: '0505ff24-83e6-4e07-9f0b-45f57c010189',
    version: '0: 0',
    name: 'Make Step 1 Switchable Presentation Element',
    tags: {},
    representation_type: 'urn:x-object-based-media:representation-types:switchable/v1.0',
    choices: [
        {
            label: 'overhead',
            representation: {
                id: '8037d1c0-8ea3-4833-9aa8-dd910f3e89f3',
                version: '0:0',
                name: 'Make Step 1 Camera 1 Representation Element',
                tags: {},
                representation_type: 'urn:x-object-based-media:representation-types:simple-av/v1.0',
                asset_collection: {
                    foreground: 'f1482c67-1c5b-407b-90c3-c2f7288e253c',
                    background: ['d22484f9-da14-484b-8051-71be36b2227f'],
                    icon: {
                        default: 'FB95A7AB-FB65-4C73-9FD3-1910F8CE754F',
                    },
                },
            },
        },
        {
            label: 'presenter',
            representation: {
                id: 'aa7ff82e-5cf2-40bd-b9fb-48d0ed829458',
                version: '0:0',
                name: 'Make Step 1 Camera 2 Representation Element',
                tags: {},
                representation_type: 'urn:x-object-based-media:representation-types:simple-av/v1.0',
                asset_collection: {
                    foreground: 'fa20bde6-a388-4ec8-a457-ceaecdddcb4d',
                    background: ['d22484f9-da14-484b-8051-71be36b2227f'],
                    icon: { default: '265ECCF4-B4B0-4E55-9B9A-FAE9849330B1' },
                },
            },
        },
        {
            label: 'close-up',
            representation: {
                id: '3d22492b-ec4c-4cc0-80d1-b7f880aff0d5',
                version: '0:0',
                name: 'Make Step 1 Camera 3 Representation Element',
                tags: {},
                representation_type: 'urn:x-object-based-media:representation-types:simple-av/v1.0',
                asset_collection: {
                    foreground: '852bd2f3-3b76-40af-bca6-b266a4c0d22e',
                    background: ['d22484f9-da14-484b-8051-71be36b2227f'],
                    icon: { default: 'A914B88E-46D3-4D55-BE5F-7DE0000487BC' },
                },
            },
        },
        {
            label: 'graphic',
            representation: {
                id: '91a9bef3-acfd-4aab-ac5b-ac06d0ee4e85',
                version: '0:0',
                name: 'Make Step 1 Image Representation Element',
                tags: {},
                representation_type: 'urn:x-object-based-media:representation-types:image/v1.0',
                asset_collection: {
                    foreground: 'adeb8f74-00d1-45ce-bf92-8328bc66457a',
                    icon: { default: 'adeb8f74-00d1-45ce-bf92-8328bc66457a' },
                },
            },
        },
    ],
    asset_collection: {
        icon: { default: 'adeb8f74-00d1-45ce-bf92-8328bc66457a' },
    },
};

const assetCollectionFetcher = id =>
    Promise.resolve(storyjson.asset_collections.filter(assetCollectionObject => assetCollectionObject.id === id)[0]).then(assetCollectionObject => assetCollectionObject);

const mediaFetcher = uri =>
    Promise.resolve(uri).then(() => 'http://localhost/~andybr/obm/nothingtosee.mp4');

const player = new Player(document.createElement('div'));

describe('SwitchableRenderer', () => {
    it('can create an instance of SwitchableRenderer', (done) => {
        const Renderer = new SwitchableRenderer(
            defaultSwitchableRepresentation,
            assetCollectionFetcher,
            mediaFetcher,
            player,
        );
        expect(Renderer).to.have.property('_representation');
        done();
    });

    it('can create a subRenderer for each choice', (done) => {
        const Renderer = new SwitchableRenderer(
            defaultSwitchableRepresentation,
            assetCollectionFetcher,
            mediaFetcher,
            player,
        );

        expect(Renderer).to.have.property('_choiceRenderers');

        expect(Renderer._choiceRenderers[0]).to.be.an.instanceof(SimpleAVRenderer);
        expect(Renderer._choiceRenderers[1]).to.be.an.instanceof(SimpleAVRenderer);
        expect(Renderer._choiceRenderers[2]).to.be.an.instanceof(SimpleAVRenderer);
        expect(Renderer._choiceRenderers[3]).to.be.an.instanceof(ImageRenderer);
        // expect(Renderer._choiceRenderers[0]).to.be.an.instanceof(SimpleAVVideoContextRenderer);
        // expect(Renderer._choiceRenderers[1]).to.be.an.instanceof(SimpleAVVideoContextRenderer);
        // expect(Renderer._choiceRenderers[2]).to.be.an.instanceof(SimpleAVVideoContextRenderer);
        // expect(Renderer._choiceRenderers[3]).to.be.an.instanceof(ImageVideoContextRenderer);

        done();
    });
});
