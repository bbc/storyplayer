// @flow
import ShowImageAndPauseBehaviour from './ShowImageAndPauseBehaviour';
import PauseBehaviour from './PauseBehaviour';
import BlurBehaviour from './BlurBehaviour';
import type { RendererEvent } from '../renderers/RendererEvents';

export default function BehaviourFactory(
    behaviourDefinition: Object,
    onComplete: (event: RendererEvent, completionEvent: RendererEvent) => void,
) {
    const BEHAVIOURS = {
        'urn:x-object-based-media:asset-mixin:show-image-and-pause': ShowImageAndPauseBehaviour,
        'urn:x-object-based-media:asset-mixin:pause/v1.0': PauseBehaviour,
        'urn:x-object-based-media:asset-mixin:blur/v1.0': BlurBehaviour,
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
