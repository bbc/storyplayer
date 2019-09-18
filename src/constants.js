// event constants
// variable has changed { name, value}
export const VARIABLE_CHANGED = 'VARIABLE_CHANGED'

// narrative element changed { narrativeElement }
export const CURRENT_NARRATIVE_ELEMENT = 'NARRATIVE_ELEMENT_CHANGED';

// next elements are [elementNames]
export const NEXT_ELEMENTS = 'NEXT_ELEMENTS';

// @flow

export const REASONER_EVENTS = [
    'romperstorystarted',
    'ROMPER_STORY_STARTED',
    'walkComplete',
    'WALK_COMPLETE',
    'jumpToNarrativeElement',
    'JUMP_TO_NARRATIVE_ELEMENT',
    'romperstorystarted',
    'storyEnd',
    'STORY_END',
    'error',
    'ERROR',
    'narrativeElementChanged',
    'NARRATIVE_ELEMENT_CHANGED',
    'choiceOfBeginnings',
    'CHOICE_OF_BEGINNINGS',
    'choiceOfLinks',
    'CHOICE_OF_LINKS',
].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName;
    return events;
}, {});

export type RendererEvent = $Keys<typeof REASONER_EVENTS>;
