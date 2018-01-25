// @flowignore
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import RepresentationReasonerFactory from '../src/RepresentationReasoner';

chai.use(sinonChai);

describe('RepresentationReasoner', () => {
    it('returns the representation which is true', () => {
        const resolver = sinon.stub();
        const reasoner = RepresentationReasonerFactory(resolver);

        return reasoner({
            id: '1ce352ab-8b65-4df5-9436-35a49885e653',
            name: 'Test Presentation',
            version: '0:0',
            representations: [
                {
                    condition: true,
                    representation: {
                        id: '2a64404d-8988-4cf3-a3e9-f7742ba4afe9',
                        version: '0:0',
                        name: 'Test Representation',
                        tags: {},
                        representation_type: 'urn:x-object-based-media:representation-types:simple-av/v1.0',
                        asset_collection: {
                            foreground: '852bd2f3-3b76-40af-bca6-b266a4c0d22e',
                            background: ['d22484f9-da14-484b-8051-71be36b2227f'],
                            icon: { default: 'A914B88E-46D3-4D55-BE5F-7DE0000487BC' },
                        },
                    },
                },
            ],
            tags: {},
        }).then((presentation) => {
            expect(presentation.id).to.equal('2a64404d-8988-4cf3-a3e9-f7742ba4afe9');
        });
    });
});
