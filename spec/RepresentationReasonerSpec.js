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
                        name: 'Test Representation',
                        version: '0:0',
                        representation_type: 'TEST',
                        tags: {},
                    },
                },
            ],
            tags: {},
        }).then((presentation) => {
            expect(presentation.id).to.equal('2a64404d-8988-4cf3-a3e9-f7742ba4afe9');
        });
    });
});
