/**
 * @jest-environment jsdom
 */

// @flowignore
import { expect } from 'chai';
import ObjectDataResolverFactory from '../../src/resolvers/ObjectDataResolver';

describe('ObjectDataResolver', () => {
    it('resolves data from an object that is passed in', () => {
        const dataResolver = ObjectDataResolverFactory({ test: 'foobar' });
        return dataResolver.get('test').then((result) => {
            expect(result).to.equal('foobar');
        });
    });

    it('resolves nested data from an object that is passed in', () => {
        const dataResolver = ObjectDataResolverFactory({ nested: { test: 'foobar' } });
        return dataResolver.get('nested.test').then((result) => {
            expect(result).to.equal('foobar');
        });
    });

    it('returns null when the requested key does not exist', () => {
        const dataResolver = ObjectDataResolverFactory({});
        return dataResolver.get('test').then((result) => {
            expect(result).to.equal(null);
        });
    });

    it(
        'returns null when the requested keys are nested and a high-level object does not exist',
        () => {
            const dataResolver = ObjectDataResolverFactory({});
            return dataResolver.get('nested.test').then((result) => {
                expect(result).to.equal(null);
            });
        },
    );
});
