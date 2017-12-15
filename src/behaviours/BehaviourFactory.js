// @flow
import ShowImageAndPauseBehaviour from './ShowImageAndPauseBehaviour';

export default function BehaviourFactory(
    behaviourDefinition: Object,
    onComplete: (event: string, completionEvent: string) => void,
) {
    const BEHAVIOURS = {
        'urn:x-object-based-media:asset-mixin:show-image-and-pause': ShowImageAndPauseBehaviour,
    };

    let currentBehaviour;

    if (behaviourDefinition.type in BEHAVIOURS) {
        const Behaviour = BEHAVIOURS[behaviourDefinition.type];
        currentBehaviour = new Behaviour(behaviourDefinition, onComplete);
    } else {
        console.warn(`Do not know how to handle behaviour ${behaviourDefinition.type} - ignoring`);
    }
    return currentBehaviour;
}
