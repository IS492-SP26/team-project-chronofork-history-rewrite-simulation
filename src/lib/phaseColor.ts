import type { FlowPhase } from "./state/types"

/**
 * Returns the CSS variable string for the active phase color.
 * observe = teal, intervene = amber, reflection = violet
 */
export function phaseColor(phase: FlowPhase): string {
  const obs: FlowPhase[] = ["observe_idle", "observe_playing", "observe_complete"]
  const ref: FlowPhase[] = ["reflection_open"]
  if (obs.includes(phase)) return "var(--chrono-teal)"
  if (ref.includes(phase)) return "var(--chrono-violet)"
  return "var(--chrono-amber)"
}

export function phaseBg(phase: FlowPhase): string {
  const obs: FlowPhase[] = ["observe_idle", "observe_playing", "observe_complete"]
  const ref: FlowPhase[] = ["reflection_open"]
  if (obs.includes(phase)) return "var(--chrono-teal-bg)"
  if (ref.includes(phase)) return "var(--chrono-violet-bg)"
  return "var(--chrono-amber-bg)"
}
