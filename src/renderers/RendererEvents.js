// @flow

const RendererEventNames = [
    'FIRST_RENDERER_CREATED',
    'CONSTRUCTED',
    'STARTED',
    'RENDERER_READY',
    'COMPLETED',
    'DESTROYED',
    'COMPLETE_START_BEHAVIOURS',
    'NEXT_BUTTON_CLICKED',
    'PREVIOUS_BUTTON_CLICKED',
    'ADD_TO_DOM',
    'REMOVE_FROM_DOM',
    'SWITCHED_REPRESENTATION',
    'STARTED_COMPLETE_BEHAVIOURS',
];

const RendererEvents = {};

RendererEventNames.forEach((name) => { RendererEvents[name] = name; });

export type RendererEvent = $Keys<typeof RendererEvents>;
export default RendererEvents;
