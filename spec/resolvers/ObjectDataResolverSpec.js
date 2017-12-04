import ObjectDataResolverFactory from '../../src/resolvers/ObjectDataResolver';

import { expect } from 'chai';

describe('ObjectDataResolver', () => {
    it('resolves data from an object that is passed in', () => {
        const dataResolver = ObjectDataResolverFactory({ test: 'foobar' });
        return dataResolver('test')
            .then((result) => {
                expect(result).to.equal('foobar');
            });
    });

    it('resolves nested data from an object that is passed in', () => {
        const dataResolver = ObjectDataResolverFactory({ nested: { test: 'foobar' } });
        return dataResolver('nested.test')
            .then((result) => {
                expect(result).to.equal('foobar');
            });
    });

    it('returns null when the requested key does not exist', () => {
        const dataResolver = ObjectDataResolverFactory({});
        return dataResolver('test')
            .then((result) => {
                expect(result).to.equal(null);
            });
    });

    it('returns null when the requested keys are nested and a high-level object does not exist', () => {
        const dataResolver = ObjectDataResolverFactory({});
        return dataResolver('nested.test')
            .then((result) => {
                expect(result).to.equal(null);
            });
    });
});
