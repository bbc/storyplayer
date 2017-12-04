// @flow

import type { DataResolver, Representation, Presentation } from './romper';
import evaluateConditions from './logic';

export type RepresentationReasoner = (presentation: Presentation) => Promise<Representation>;

/**
 * Create an instance of a RepresentationReasoner
 *
 * @param {Function} dataResolver an instance of the data resolver using for resolving world state
 * @return {RepresentationReasoner} an instance of the reasoner
 */
export default function RepresentationReasonerFactory(dataResolver: DataResolver): RepresentationReasoner {
    /**
     * Given a representation, this will give you the appropriate presentation to use
     *
     * @param {Presentation} presentation the presentation object to reason about
     * @return {Promise.<Representation>} a promise which will resolve to the representation to use
     */
    return function (presentation: Presentation): Promise<Representation> {
        return evaluateConditions(presentation.representations, dataResolver)
            .then(representationContainer =>
                (representationContainer ?
                    representationContainer.representation :
                    Promise.reject(new Error('no suitable representations found'))));
    };
}
