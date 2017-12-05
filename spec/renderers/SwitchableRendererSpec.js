// @flow

import 'babel-polyfill';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SwitchableRenderer from '../../src/renderers/SwitchableRenderer';
import SimpleAVRenderer from '../../src/renderers/SimpleAVRenderer';
import ImageRenderer from '../../src/renderers/ImageRenderer';
import BaseRenderer from '../../src/renderers/BaseRenderer';

chai.use(sinonChai);

const defaultRepresentation = {
    id: '123',
    version: '',
    name: 'Test',
    tags: {},
    representation_type: 'urn:x-object-based-media:representation-types:simple-av/v1.0',
    asset_collection: {
        foreground: "2cf4f4a5-5e6a-4eb3-b5d4-6c957f8b8b0c",
        background: "2cf4f4a5-5e6a-4eb3-b5d4-6c957f8b8b0c",
        icon: {
            default: "1dbcb2c6-adf4-4e68-b7fe-fe3ce458bb79"
        }
    }
};

const defaultAssetCollection = {
    id: "d22484f9-da14-484b-8051-71be36b2227f",
    name: "Looping Background Music",
    description: "This background music loops throughout the experience and is played under each step of the make",
    version: "0:0",
    tags: {},
    type: "urn:x-object-based-media:asset-collection-types:looping-audio/v1.0",
    assets: {
        audio_src: "urn:x-ipstudio:entity:package:af4dfbe4-5efc-46a8-ab6e-a50b891ec119"
    }
};

describe('SwitchableRenderer', () => {

    it('can create an instance of SwitchableRenderer', (done) => {
        const Renderer = new SwitchableRenderer(
            defaultRepresentation,
            Promise.resolve(() => null),
            document.createElement('div'),
        );
        expect(Renderer).to.have.property('_representation');
        done();
    });

    it('can create a subRenderer for each choice', (done) => {
        const Renderer = new SwitchableRenderer(
            {
                "id": "40a134c6-577d-4252-ac52-49619f643d52",
                "version": "0:0",
                "name": "Make Step 2 Switchable Presentation Element",
                "tags": {},
                "representation_type": "urn:x-object-based-media:representation-types:switchable/v1.0",
                "asset_collection": {
                    "icon": "8d8b9741-7c7a-4f59-94b8-b53c7d1039a2"
                },
                "choices": [
                    {
                        "label": "overhead",
                        "representation": {
                            "id": "8037d1c0-8ea3-4833-9aa8-dd910f3e89f3",
                            "version": "0:0",
                            "name": "Make Step 1 Camera 1 Representation Element",
                            "tags": {},
                            "representation_type": "urn:x-object-based-media:representation-types:simple-av/v1.0",
                            "asset_collection": {
                                "foreground": "f1482c67-1c5b-407b-90c3-c2f7288e253c",
                                "background": "d22484f9-da14-484b-8051-71be36b2227f"
                            },
                            "behaviours": [
                                {
                                    "type": "urn:x-object-based-media:asset-mixin:pause-at-end",
                                    "image": "adeb8f74-00d1-45ce-bf92-8328bc66457a"
                                }
                            ]
                        }
                    },
                    {
                        "label": "presenter",
                        "representation": {
                            "id": "aa7ff82e-5cf2-40bd-b9fb-48d0ed829458",
                            "version": "0:0",
                            "name": "Make Step 1 Camera 2 Representation Element",
                            "tags": {},
                            "representation_type": "urn:x-object-based-media:representation-types:simple-av/v1.0",
                            "asset_collection": {
                                "foreground": "fa20bde6-a388-4ec8-a457-ceaecdddcb4d",
                                "background": "d22484f9-da14-484b-8051-71be36b2227f"
                            },
                            "behaviours": [
                                {
                                    "type": "urn:x-object-based-media:asset-mixin:pause-at-end",
                                    "image": "adeb8f74-00d1-45ce-bf92-8328bc66457a"
                                }
                            ]
                        }
                    },
                    {
                        "label": "close-up",
                        "representation": {
                            "id": "3d22492b-ec4c-4cc0-80d1-b7f880aff0d5",
                            "version": "0:0",
                            "name": "Make Step 1 Camera 3 Representation Element",
                            "tags": {},
                            "representation_type": "urn:x-object-based-media:representation-types:simple-av/v1.0",
                            "asset_collection": {
                                "foreground": "852bd2f3-3b76-40af-bca6-b266a4c0d22e",
                                "background": "d22484f9-da14-484b-8051-71be36b2227f"
                            },
                            "behaviours": [
                                {
                                    "type": "urn:x-object-based-media:asset-mixin:pause-at-end",
                                    "image": "adeb8f74-00d1-45ce-bf92-8328bc66457a"
                                }
                            ]
                        }
                    },
                    {
                        "label": "graphic",
                        "representation": {
                            "id": "91a9bef3-acfd-4aab-ac5b-ac06d0ee4e85",
                            "version": "0:0",
                            "name": "Make Step 1 Image Representation Element",
                            "tags": {},
                            "representation_type": "urn:x-object-based-media:representation-types:image/v1.0",
                            "asset_collection": {
                                "foreground": "adeb8f74-00d1-45ce-bf92-8328bc66457a"
                            }
                        }
                    }
                ]
            },
            Promise.resolve(() => null),
            document.createElement('div'),
        );

        expect(Renderer).to.have.property('_choiceRenderers');

        expect(Renderer._choiceRenderers[0]).to.be.an.instanceof(SimpleAVRenderer);
        expect(Renderer._choiceRenderers[1]).to.be.an.instanceof(SimpleAVRenderer);
        expect(Renderer._choiceRenderers[2]).to.be.an.instanceof(SimpleAVRenderer);
        expect(Renderer._choiceRenderers[3]).to.be.an.instanceof(ImageRenderer);

        done();

    });

    it('can delegate rendering to an appropriate choiceRenderer');
    it('switches between choiceRenderers');

});