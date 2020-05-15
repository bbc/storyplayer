// @flow

import JsonLogic from 'json-logic-js';
import type { DataResolver } from './romper';
import logger from './logger';

/**
 * Evaluate a pair of JSONLogic results for sorting such that true is like Infinity and false like
 * -Infinity.
 *
 * @param {Object} a the first item to sort
 * @param {Object} b the second item to sort
 * @return {number} the sort order
 */
function sortCandidates(a, b) {
    if (a.result === b.result) {
        return a.i - b.i;
    } if (a.result === true) {
        return -1;
    } if (b.result === true) {
        return 1;
    }
    return b.result - a.result;
}

/**
 * Given some key value pairs, where the keys use . to denote nesting, return a deeply nested object
 * that includes all the keys specified in the array.
 *
 * @param {Array} resolvedVars an array of nested objects in the form [{key: 'a.b.c', value: 123}]
 * @return {{}} the nested object
 */
export function convertDotNotationToNestedObjects(resolvedVars) {
    const vars = {};
    resolvedVars.forEach(({ key, value }) => {
        let objPart = vars;
        const keyParts = key.split('.');
        keyParts.forEach((keyPart, i) => {
            if (!(keyPart in objPart)) {
                if (i === keyParts.length - 1) {
                    objPart[keyPart] = value;
                } else {
                    objPart[keyPart] = {};
                    objPart = objPart[keyPart];
                }
            }
        });
    });
    return vars;
}

/**
 * Takes a list of links that has a JSONLogic "condition", evaluates them and returns
 * the object with the best JSONLogic result
 *
 * @param {Array} candidates array to evaluate
 * @param {DataResolver} dataResolver the resolver to use to resolve variables
 * @return {Promise} the best result
 * @private
 */
export default function evaluateConditions<T>(
    candidates: Array<{condition: any} & T>,
    dataResolver: DataResolver,
): Promise<?Array<T>> {
    const interestingVars = [];
    candidates.forEach(candidate =>
        JsonLogic.uses_data(candidate.condition).forEach(cv => interestingVars.push(cv)));
        
    return Promise.all(interestingVars.map(interestingVar =>
        dataResolver.get(interestingVar)
            .catch(() => null)
            .then(value => ({ key: interestingVar, value })))
    )
        .then(convertDotNotationToNestedObjects)
        .then((resolvedVars) => {
            const evaluatedCandidates = candidates
                .map((candidate, i) =>
                    ({ i, result: JsonLogic.apply(candidate.condition, resolvedVars) }))
                .filter(candidate => candidate.result > 0);
            if (evaluatedCandidates.length > 0) {
                if (evaluatedCandidates.length > 1) {
                    logger.info(`LOGIC: choice of ${evaluateConditions.length} conditions`);
                }
                const sortedCandidates = [];
                evaluatedCandidates.sort(sortCandidates).forEach((c) => {
                    sortedCandidates.push(candidates[c.i]);
                });
                return sortedCandidates;
            }
            return null;
        });
}
