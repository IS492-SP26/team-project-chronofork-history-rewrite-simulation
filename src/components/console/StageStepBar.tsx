"use client"

import { useChronoFork } from "@/src/lib/state/context"
import { toast } from "sonner"
import { Play, GitFork, Send, Eye, CheckCircle2 } from "lucide-react"

const observeSteps = [
  { label: "Start Observation", icon: Play },
  { label: "Watch Scene", icon: Eye },
  { label: "Bookmark Decisions", icon: CheckCircle2 },
]

const interveneSteps = [
  { label: "Select Node", icon: GitFork },
  { label: "Draft Decision", icon: Eye },
  { label: "Plausibility Check", icon: CheckCircle2 },
  { label: "Transmit", icon: Send },
  { label: "Review", icon: Eye },
]

function getObserveStepIndex(state: any): number {
  if (!state.playing && state.currentDialogueIndex === 0 && state.currentSceneIndex === 0)
    return 0
  if (state.playing) return 1
  return 2
}

function getInterveneStepIndex(state: any): number {
  if (!state.selectedNodeId) return 0
  if (state.divergence.inProgress && !state.divergence.exists) return 1
  if (state.divergence.inProgress) return 2
  if (state.divergence.exists && !state.analysis.available) return 3
  if (state.analysis.available) return 4
  return 1
}

function getGuidanceText(stage: 1 | 2, stepIdx: number): string {
  if (stage === 1) {
    const texts = [
      "Press play to begin the historical simulation",
      "Observe the scene unfolding. Bookmark key moments.",
      "Mark important decision points for later intervention.",
    ]
    return texts[stepIdx] ?? ""
  }
  const texts = [
    "Select a timeline node to fork from",
    "Draft your alternative decision",
    "Run a plausibility check on your decision",
    "Transmit your decision to alter the timeline",
    "Review the divergent outcomes",
  ]
  return texts[stepIdx] ?? ""
}

function getCTALabel(stage: 1 | 2, stepIdx: number, playing: boolean): string {
  if (stage === 1) {
    if (stepIdx === 0) return "Start Observation"
    if (stepIdx === 1) return playing ? "Pause" : "Resume"
    return "Bookmark Decision"
  }
  const labels = [
    "Fork From Selected Node",
    "Draft Decision",
    "Run Plausibility Check",
    "Transmit Decision",
    "View Report",
  ]
  return labels[stepIdx] ?? "Continue"
}

export function StageStepBar() {
  const { state, dispatch } = useChronoFork()

  const isObserve = state.stage === 1
  const steps = isObserve ? observeSteps : interveneSteps
  const currentStep = isObserve
    ? getObserveStepIndex(state)
    : getInterveneStepIndex(state)
  const guidance = getGuidanceText(state.stage, currentStep)
  const ctaLabel = getCTALabel(state.stage, currentStep, state.playing)

  const handleStagePillClick = () => {
    if (isObserve) {
      dispatch({ type: "SWITCH_STAGE", data: { stage: 2 } })
    } else {
      dispatch({ type: "SWITCH_STAGE", data: { stage: 1 } })
    }
  }

  const handleCTA = () => {
    if (isObserve) {
      if (currentStep <= 1) {
        dispatch({ type: "TOGGLE_PLAY" })
      } else {
        if (state.activeNodeId) {
          dispatch({ type: "BOOKMARK_NODE", data: { nodeId: state.activeNodeId } })
          toast.success("Decision point bookmarked")
        }
      }
    } else {
      if (currentStep === 0) {
        if (state.selectedNodeId) {
          dispatch({ type: "FORK_FROM_NODE", data: { nodeId: state.selectedNodeId } })
        } else {
          toast.info("Select a node in the timeline first")
        }
      } else if (currentStep === 4) {
        window.location.href = "/report/mock-run-001"
      }
    }
  }

  return (
    <div className="flex items-center gap-3 max-w-2xl w-full">
      {/* Stage Pill */}
      <button
        onClick={handleStagePillClick}
        className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${
          isObserve
            ? "bg-chrono-teal/20 text-chrono-teal border border-chrono-teal/30"
            : "bg-chrono-amber/20 text-chrono-amber border border-chrono-amber/30"
        }`}
        aria-label={`Current stage: ${isObserve ? "Observe" : "Intervene"}. Click to switch.`}
      >
        {isObserve ? "OBSERVE" : "INTERVENE"}
      </button>

      {/* Step Rail */}
      <div className="flex items-center gap-0 flex-1 min-w-0">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isActive = i === currentStep
          const isDone = i < currentStep
          const baseColor = isObserve ? "chrono-teal" : "chrono-amber"
          return (
            <div key={step.label} className="flex items-center">
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono transition-all ${
                  isActive
                    ? `text-${baseColor} bg-${baseColor}/10`
                    : isDone
                    ? "text-muted-foreground/70"
                    : "text-muted-foreground/30"
                }`}
                style={
                  isActive
                    ? {
                        color: `var(--${baseColor})`,
                        backgroundColor: `color-mix(in oklch, var(--${baseColor}) 10%, transparent)`,
                      }
                    : isDone
                    ? { color: "var(--muted-foreground)", opacity: 0.7 }
                    : { color: "var(--muted-foreground)", opacity: 0.3 }
                }
              >
                <Icon className="w-2.5 h-2.5 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="w-4 h-px mx-0.5"
                  style={{
                    backgroundColor:
                      i < currentStep
                        ? `var(--${baseColor})`
                        : "var(--border)",
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* CTA Button */}
      <button
        onClick={handleCTA}
        className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
          isObserve
            ? "bg-chrono-teal text-background animate-glow-cta hover:brightness-110"
            : "bg-chrono-amber text-background animate-glow-cta-amber hover:brightness-110"
        }`}
        style={{
          backgroundColor: isObserve ? "var(--chrono-teal)" : "var(--chrono-amber)",
          color: "var(--background)",
        }}
      >
        {ctaLabel}
      </button>

      {/* Guidance Text (hidden on small screens) */}
      <p className="hidden lg:block text-[10px] font-mono text-muted-foreground shrink-0 max-w-[180px] truncate">
        {guidance}
      </p>
    </div>
  )
}
