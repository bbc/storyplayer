// @flow
import PauseBehaviour from './PauseBehaviour';
import BaseBehaviour from './BaseBehaviour';
import type { RendererEvent } from '../renderers/RendererEvents';
import logger from '../logger';

export default function BehaviourFactory(
    behaviourDefinition: Object,
    onComplete: (event: RendererEvent, completionEvent: RendererEvent) => void,
) {
    const BEHAVIOURS = {
        'urn:x-object-based-media:asset-mixin:pause/v1.0': PauseBehaviour,
        'urn:x-object-based-media:asset-mixin:blur/v1.0': BaseBehaviour,
        'urn:x-object-based-media:asset-mixin:colouroverlay/v1.0': BaseBehaviour,
        'urn:x-object-based-media:asset-mixin:showimage/v1.0': BaseBehaviour,
    };

    let currentBehaviour;

    if (behaviourDefinition.type in BEHAVIOURS) {
        const Behaviour = BEHAVIOURS[behaviourDefinition.type];
        currentBehaviour = new Behaviour(behaviourDefinition, onComplete);
    } else {
        logger.warn(`Do not know how to handle behaviour ${behaviourDefinition.type} - ignoring`);
    }
    return currentBehaviour;
}
