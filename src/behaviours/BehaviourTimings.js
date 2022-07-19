// @flow

const BehaviourTimingsNames = [
    'completed',
];

const BehaviourTimings = {};

BehaviourTimingsNames.forEach((name) => { BehaviourTimings[name] = name; });

export type BehaviourTiming = $Keys<typeof BehaviourTimings>;
export default BehaviourTimings;
