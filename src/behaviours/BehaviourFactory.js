// @flow
import ShowImageAndPauseBehaviour from './ShowImageAndPauseBehaviour';
import ShowBackButtonBehaviour from './ShowBackButtonBehaviour';

export default function BehaviourFactory(
    behaviour: Object,
    behaviourComplete: (event: string, completionEvent: string) => void,
) {
    const BEHAVIOURS = {
        'urn:x-object-based-media:asset-mixin:show-image-and-pause': ShowImageAndPauseBehaviour,
        'urn:x-object-based-media:asset-mixin:show-back-button': ShowBackButtonBehaviour,
    };

    let currentBehaviour;

    if (behaviour.type in BEHAVIOURS) {
        const Behaviour = BEHAVIOURS[behaviour.type];
        currentBehaviour = new Behaviour(behaviourComplete);
    } else {
        console.warn(`Do not know how to handle behaviour ${behaviour.type} - ignoring`);
    }
    return currentBehaviour;
}
