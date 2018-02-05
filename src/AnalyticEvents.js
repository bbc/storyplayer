// @flow

const types = [
    'STORY_NAVIGATION',
    'RENDERER_ACTION',
    'USER_ACTION',
];

const names = [
    'NARRATIVE_ELEMENT_CHANGE',
    'STORY_END',
    'SWITCHABLE_REPRESENTATION_SWITCH',
    'VIDEO_START',
    'VIDEO_PAUSE',
    'VIDEO_UNPAUSE',
    'VIDEO_END',
    'PLAY_PAUSE_BUTTON_CLICKED',
    'REPEAT_BUTTON_CLICKED',
    'BACK_BUTTON_CLICKED',
    'NEXT_BUTTON_CLICKED',
    'FULLSCREEN_BUTTON_CLICKED',
    'VOLUME_CHANGED',
    'VIDEO_SCRUBBED',
];

const AnalyticEvents = {
    names: {},
    types: {},
};

types.forEach((name) => { AnalyticEvents.types[name] = name; });
names.forEach((name) => { AnalyticEvents.names[name] = name; });

export type AnalyticEventType = $Keys<typeof AnalyticEvents.types>;
export type AnalyticEventName = $Keys<typeof AnalyticEvents.names>;

export type AnalyticsPayload = {
    type: AnalyticEventType,
    name: AnalyticEventName,
    from?: string,
    to?: string,
};

export type AnalyticsLogger = (payload: AnalyticsPayload) => mixed;

export default AnalyticEvents;
