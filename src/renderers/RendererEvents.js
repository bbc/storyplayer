// @flow

const RendererEventNames = [
    'STARTED',
    'RENDERER_READY',
    'COMPLETED',
    'DESTROYED',
    'COMPLETE_START_BEHAVIOURS',
    'NEXT_BUTTON_CLICKED',
    'BACK_BUTTON_CLICKED',
    'ADD_TO_DOM',
    'REMOVE_FROM_DOM',
    'SWITCHED_REPRESENTATION',
];

const RendererEvents = {};

RendererEventNames.forEach((name) => { RendererEvents[name] = name; });

export type RendererEvent = $Keys<typeof RendererEvents>;
export default RendererEvents;
