import PauseBehaviour from "./PauseBehaviour"
import VariableManipulateBehaviour from "./VariableManipulateBehaviour"
import BaseBehaviour from "./BaseBehaviour"
import ExitFullscreenBehaviour from "./ExitFullscreenBehaviour"
import logger from "../logger"
export default function BehaviourFactory(
    behaviourDefinition: Record<string, any>,
    onComplete: () => void,
) {
    const BEHAVIOURS = {
        "urn:x-object-based-media:representation-behaviour:pause/v1.0": PauseBehaviour,
        // eslint-disable-next-line max-len
        "urn:x-object-based-media:representation-behaviour:manipulatevariable/v1.0": VariableManipulateBehaviour,
        // eslint-disable-next-line max-len
        "urn:x-object-based-media:representation-behaviour:exit-fullscreen/v1.0": ExitFullscreenBehaviour,
        "urn:x-object-based-media:representation-behaviour:blur/v1.0": BaseBehaviour,
        "urn:x-object-based-media:representation-behaviour:colouroverlay/v1.0": BaseBehaviour,
        "urn:x-object-based-media:representation-behaviour:showimage/v1.0": BaseBehaviour,
        "urn:x-object-based-media:representation-behaviour:showvariablepanel/v1.0": BaseBehaviour,
        "urn:x-object-based-media:representation-behaviour:showlinkchoices/v1.0": BaseBehaviour,
        "urn:x-object-based-media:representation-behaviour:socialmodal/v1.0": BaseBehaviour,
        "urn:x-object-based-media:representation-behaviour:linkoutmodal/v1.0": BaseBehaviour,
    }
    let currentBehaviour

    if (behaviourDefinition.type in BEHAVIOURS) {
        const Behaviour = BEHAVIOURS[behaviourDefinition.type]
        currentBehaviour = new Behaviour(behaviourDefinition, onComplete)
    } else {
        logger.warn(
            `Do not know how to handle behaviour ${behaviourDefinition.type} - ignoring`,
        )
    }

    return currentBehaviour
}