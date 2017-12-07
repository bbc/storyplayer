import ShowImageAndPauseBehaviour from './ShowImageAndPauseBehaviour';

export default function BehaviourFactory(behaviour, behaviourComplete) {
    const BEHAVIOURS = {
        'urn:x-object-based-media:asset-mixin:show-image-and-pause': ShowImageAndPauseBehaviour,
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
