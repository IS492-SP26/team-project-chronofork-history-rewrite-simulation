import type { FlowPhase } from "./state/types"
import type { ButtonTone } from "@/components/ui/button"

/**
 * Returns the CSS variable string for the active phase color.
 * observe = teal, intervene = amber, reflection = violet
 */
export function phaseColor(phase: FlowPhase): string {
  const obs: FlowPhase[] = ["observe_idle", "observe_playing", "observe_complete"]
  const ref: FlowPhase[] = ["branch_complete", "reflection_open"]
  if (obs.includes(phase)) return "var(--chrono-teal)"
  if (ref.includes(phase)) return "var(--chrono-violet)"
  return "var(--chrono-amber)"
}

export function phaseBg(phase: FlowPhase): string {
  const obs: FlowPhase[] = ["observe_idle", "observe_playing", "observe_complete"]
  const ref: FlowPhase[] = ["branch_complete", "reflection_open"]
  if (obs.includes(phase)) return "var(--chrono-teal-bg)"
  if (ref.includes(phase)) return "var(--chrono-violet-bg)"
  return "var(--chrono-amber-bg)"
}

export function phaseTone(phase: FlowPhase): ButtonTone {
  const obs: FlowPhase[] = ["observe_idle", "observe_playing", "observe_complete"]
  const ref: FlowPhase[] = ["branch_complete", "reflection_open"]
  if (obs.includes(phase)) return "observe"
  if (ref.includes(phase)) return "reflection"
  return "intervene"
}
