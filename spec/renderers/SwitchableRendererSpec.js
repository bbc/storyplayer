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

const allAssetCollections = [
    {
        "id": "d22484f9-da14-484b-8051-71be36b2227f",
        "name": "Looping Background Music",
        "description": "This background music loops throughout the experience and is played under each step of the make",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:looping-audio/v1.0",
        "assets": {
            "audio_src": "urn:x-ipstudio:entity:package:af4dfbe4-5efc-46a8-ab6e-a50b891ec119"
        }
    },
    {
        "id": "cd825485-4de6-4b88-99c0-33e609dcf66e",
        "name": "Title Sequence AV asset collection",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:simpleav/v1.0",
        "assets": {
            "av_src": "http://open.live.bbc.co.uk/mediaselector/5/select/version/2.0/vpid/p04p74yq/mediaset/mobile-phone-main/format/json/proto/https/jsfunc/ms_response_48"
        }
    },
    {
        "id": "cd825485-4de6-4b88-99c0-33e609dcf66e",
        "name": "General Intro AV asset collection",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:simpleav/v1.0",
        "assets": {
            "av_src": "http://open.live.bbc.co.uk/mediaselector/5/select/version/2.0/vpid/p04p74yq/mediaset/mobile-phone-main/format/json/proto/https/jsfunc/ms_response_47"
        }
    },
    {
        "id": "8b06cc58-1ccb-42e1-aeec-4302e817c671",
        "name": "How To Use Tool AV asset collection",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:simpleav/v1.0",
        "assets": {
            "av_src": "http://open.live.bbc.co.uk/mediaselector/5/select/version/2.0/vpid/p04p74yq/mediaset/mobile-phone-main/format/json/proto/https/jsfunc/ms_response_49"
        }
    },
    {
        "id": "94ecd001-b209-4863-9853-b87c78d6aeaa",
        "name": "Instructor Introduction AV asset collection",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:simpleav/v1.0",
        "assets": {
            "av_src": "http://open.live.bbc.co.uk/mediaselector/5/select/version/2.0/vpid/p04p74yq/mediaset/mobile-phone-main/format/json/proto/https/jsfunc/ms_response_50"
        }
    },
    {
        "id": "8d8b9741-7c7a-4f59-94b8-b53c7d1039a2",
        "name": "Make Step 1 Camera Angle 1",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:simple-av/v1.0",
        "assets": {
            "av_src": "urn:x-ipstudio:entity:package:f2f6979f-df5d-4ffb-83da-310a141695ff"
        }
    },
    {
        "id": "fa20bde6-a388-4ec8-a457-ceaecdddcb4d",
        "name": "Make Step 1 Camera Angle 2",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:simple-av/v1.0",
        "assets": {
            "av_src": "urn:x-ipstudio:entity:package:cf194b5a-eb6a-4a33-a2b3-2d9dc914a039"
        }
    },
    {
        "id": "852bd2f3-3b76-40af-bca6-b266a4c0d22e",
        "name": "Make Step 1 Camera Angle 3",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:simple-av/v1.0",
        "assets": {
            "av_src": "urn:x-ipstudio:entity:package:9635b63d-8be8-457e-9105-b227b0f4b392"
        }
    },
    {
        "id": "adeb8f74-00d1-45ce-bf92-8328bc66457a",
        "name": "Make Step 1 Image Asset Collection",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:image/v1.0",
        "assets": {
            "image_src": "urn:x-ipstudio:entity:package:dbadd9db-2752-4490-a280-034fa39fdde7"
        }
    },
    {
        "id": "ae397f04-c91b-4380-833f-03abc18bf443",
        "name": "Credit Sequence AV asset collection",
        "description": "",
        "version": "0:0",
        "tags": {},
        "type": "urn:x-object-based-media:asset-collection-types:simpleav/v1.0",
        "assets": {
            "av_src": "urn:x-ipstudio:entity:package:e9f1e607-4f37-421b-996c-f83ccd4ebc44"
        }
    }
];

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

    // on start get first choice and start rendering with its sub renderer
    // close on sub renderer close

    it('can delegate rendering to an appropriate choiceRenderer', (done) => {
        const contentDiv = document.createElement('div');
        contentDiv.id = 'switchable';

        // const stub = sinon.stub(SimpleAVRenderer, 'start');
        // const spy = sinon.spy();
        // sinon.spyOn(SimpleAVRenderer, 'start');

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
            id => Promise.resolve(
                allAssetCollections
                    .filter(assetCollectionObject => assetCollectionObject.id === id)[0]
            ).then(assetCollectionObject => assetCollectionObject ? assetCollectionObject : Promise.reject('no such asset collection')),
            contentDiv,
        );
        Renderer.start();

        // create html element for sub renderers
        expect(contentDiv.firstChild).to.exist;
        expect(contentDiv.firstChild.id).to.equal('subrenderer');
        // expect(spy.called).to.be.true;

        // switchable has child subrenderer

        done();
    });

    it('switches between choiceRenderers');

});