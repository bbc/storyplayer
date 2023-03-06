const RendererEventNames = [
    "FIRST_RENDERER_CREATED",
    "CONSTRUCTED",
    "STARTED",
    "RENDERER_READY",
    "COMPLETED",
    "DESTROYED",
    "NEXT_BUTTON_CLICKED",
    "PREVIOUS_BUTTON_CLICKED",
    "ADD_TO_DOM",
    "REMOVE_FROM_DOM",
    "SWITCHED_REPRESENTATION",
    "STARTED_COMPLETE_BEHAVIOURS",
] as const
const RendererEvents: Record<string, string> = RendererEventNames.reduce(
    (events, eventName) => {
        // eslint-disable-next-line no-param-reassign
        events[eventName] = eventName
        return events
    },
    {},
) 
export default RendererEvents
export type RendererEvent = string