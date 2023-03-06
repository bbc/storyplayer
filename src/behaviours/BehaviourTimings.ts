import {$Keys} from "utility-types"
const BehaviourTimings: Record<string, "completed">  = { completed: "completed" }
export type BehaviourTiming = $Keys<typeof BehaviourTimings>
export default BehaviourTimings