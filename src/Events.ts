import {$Keys} from "utility-types"
// event constants
const reasonerEvents = [
    "romperstorystarted",
    "ROMPER_STORY_STARTED",
    "walkComplete",
    "WALK_COMPLETE",
    "jumpToNarrativeElement",
    "JUMP_TO_NARRATIVE_ELEMENT",
    "storyEnd",
    "STORY_END",
    "narrativeElementChanged",
    "NARRATIVE_ELEMENT_CHANGED",
    "choiceOfBeginnings",
    "CHOICE_OF_BEGINNINGS",
    "choiceOfLinks",
    "CHOICE_OF_LINKS",
    "NEXT_ELEMENTS",
    "MULTIPLE_VALID_LINKS",
    "ELEMENT_FOUND",
] as const
export const REASONER_EVENTS: Record<string, string> = reasonerEvents.reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName
    return events
}, {})
export type RendererEvent = $Keys<typeof REASONER_EVENTS>
export const VARIABLE_EVENTS: Record<string, string> = [
    "VARIABLE_CHANGED",
    "CONTROLLER_CHANGED_VARIABLE",
].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName
    return events
}, {})
export const ERROR_EVENTS = "ERROR"
export const SHAKA_EVENTS: Record<string, string> = [
    "error",
    "buffering",
    "adaptation",
    "adaptation",
].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName
    return events
}, {})
export const DOM_EVENTS: Record<string, string> = ["TOGGLE_FULLSCREEN"].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName
    return events
}, {})