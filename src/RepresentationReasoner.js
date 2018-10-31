// @flow
// eslint-disable-next-line max-len
import type { DataResolver, RepresentationFetcher, Representation, RepresentationCollection } from './romper';
import evaluateConditions from './logic';

export type RepresentationReasoner = (representationCollection: RepresentationCollection)
    => Promise<Representation>;

/**
 * Create an instance of a RepresentationReasoner
 *
 * @param {Function} dataResolver an instance of the data resolver using for resolving world state
 * @return {RepresentationReasoner} an instance of the reasoner
 */
export default function RepresentationReasonerFactory(
    representationFetcher: RepresentationFetcher,
    dataResolver: DataResolver,
): RepresentationReasoner {
    /**
     * Given a representationCollection, this will give you the appropriate representation to use
     *
     * @param {Presentation} representationCollection the representation_collection object to reason
     * about
     * @return {Promise.<Representation>} a promise which will resolve to the representation to use
     */
    return (representationCollection: RepresentationCollection): Promise<Representation> => {
        let representation;
        return evaluateConditions(representationCollection.representations, dataResolver)
            .then((representationContainer) => {
                if (representationContainer) {
                    return representationFetcher(representationContainer[0].representation_id);
                }
                return Promise.reject(new Error('no suitable representations found'));
            })
            .then((rep: Representation) => {
                representation = rep;
                const promiseArray = [];
                if (representation.choices) {
                    representation.choices.forEach((choice) => {
                        promiseArray.push(representationFetcher(choice.choice_representation_id));
                    });
                    return Promise.all(promiseArray);
                }
                return [];
            })
            .then((reps: Array<Representation>) => {
                const repsId = {};
                reps.forEach((rep) => {
                    repsId[rep.id] = rep;
                });
                if (representation.choices) {
                    representation.choices = representation.choices.map(choice => ({
                        label: choice.label,
                        choice_representation_id: choice.choice_representation_id,
                        choice_representation: repsId[choice.choice_representation_id],
                    }));
                }
                return representation;
            });
    };
}
