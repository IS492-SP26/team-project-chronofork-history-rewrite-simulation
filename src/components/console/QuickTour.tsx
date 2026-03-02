"use client"

import { useState, useEffect, useCallback } from "react"
import { useChronoFork } from "@/src/lib/state/context"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { X, ArrowRight, ArrowLeft } from "lucide-react"

const tourSteps = [
  {
    title: "Stage Step Bar",
    description:
      "Your mission control. The glowing button shows what to do next. Watch the stage pill switch between OBSERVE and INTERVENE.",
    highlight: "top-center",
  },
  {
    title: "Time-River Timeline",
    description:
      "A vertical git-style timeline showing the historical flow. Click nodes to inspect them, fork from any to create alternate history.",
    highlight: "left",
  },
  {
    title: "Center Stage",
    description:
      "The virtual round table where historical figures speak. Watch speech bubbles appear as the scene unfolds. This is your window into history.",
    highlight: "center",
  },
  {
    title: "Tactical HUD",
    description:
      "Your decision composer and analysis dashboard. In OBSERVE mode, ask clarifying questions. In INTERVENE mode, draft decisions and see their impact.",
    highlight: "right",
  },
  {
    title: "Analysis Panel",
    description:
      "After transmitting a divergent decision, the analysis panel reveals plausibility scores, outcome projections, and causal chains.",
    highlight: "right",
  },
]

export function QuickTour() {
  const { state, dispatch } = useChronoFork()
  const [step, setStep] = useState(0)

  if (!state.ui.showQuickTour) return null

  const current = tourSteps[step]

  const handleDismiss = () => {
    dispatch({ type: "DISMISS_TOUR" })
  }

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setStep(step + 1)
    } else {
      handleDismiss()
    }
  }

  const handlePrev = () => {
    if (step > 0) setStep(step - 1)
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Tour Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: state.ui.reducedMotion ? 0 : 0.3 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-panel rounded-xl p-6 max-w-md w-full mx-4"
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss tour"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === step ? 24 : 8,
                  backgroundColor:
                    i === step
                      ? "var(--chrono-teal)"
                      : i < step
                      ? "var(--chrono-teal-dim)"
                      : "var(--border)",
                }}
              />
            ))}
          </div>

          {/* Content */}
          <span
            className="text-[10px] font-mono uppercase tracking-widest mb-1 block"
            style={{ color: "var(--chrono-teal)" }}
          >
            Step {step + 1} of {tourSteps.length}
          </span>
          <h3 className="text-lg font-semibold text-foreground mb-2 text-balance">
            {current.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {current.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={handleDismiss}
            >
              Skip tour
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 border-border/40"
                  onClick={handlePrev}
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                className="text-xs gap-1"
                style={{
                  backgroundColor: "var(--chrono-teal)",
                  color: "var(--background)",
                }}
                onClick={handleNext}
              >
                {step === tourSteps.length - 1 ? "Start Exploring" : "Next"}
                {step < tourSteps.length - 1 && <ArrowRight className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Keyboard Shortcuts Overlay ───
const shortcuts = [
  { key: "Space", label: "Play / Pause" },
  { key: "N", label: "Next decision point" },
  { key: "B", label: "Bookmark current node" },
  { key: "F", label: "Fork from selected node" },
  { key: "R", label: "Open reflection report" },
  { key: "?", label: "Toggle this help" },
  { key: "1", label: "Switch to OBSERVE" },
  { key: "2", label: "Switch to INTERVENE" },
  { key: "[", label: "Toggle left dock" },
  { key: "]", label: "Toggle right dock" },
]

export function KeyboardShortcutsOverlay() {
  const { state, dispatch } = useChronoFork()

  if (!state.ui.showKeyboardShortcuts) return null

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={() => dispatch({ type: "TOGGLE_KEYBOARD_SHORTCUTS" })}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-panel rounded-xl p-6 max-w-sm w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
          <button
            onClick={() => dispatch({ type: "TOGGLE_KEYBOARD_SHORTCUTS" })}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <kbd className="px-2 py-0.5 rounded bg-secondary text-foreground text-[10px] font-mono border border-border/50">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Keyboard Handler Hook ───
export function useKeyboardShortcuts() {
  const { state, dispatch } = useChronoFork()

  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      switch (e.key) {
        case " ":
          e.preventDefault()
          dispatch({ type: "TOGGLE_PLAY" })
          break
        case "n":
        case "N":
          dispatch({ type: "ADVANCE_DIALOGUE" })
          break
        case "b":
        case "B":
          if (state.activeNodeId) {
            dispatch({ type: "BOOKMARK_NODE", data: { nodeId: state.activeNodeId } })
          }
          break
        case "f":
        case "F":
          if (state.selectedNodeId && state.stage === 2) {
            dispatch({ type: "FORK_FROM_NODE", data: { nodeId: state.selectedNodeId } })
          }
          break
        case "r":
        case "R":
          if (state.reflection.enabled) {
            window.location.href = "/report/mock-run-001"
          }
          break
        case "?":
          dispatch({ type: "TOGGLE_KEYBOARD_SHORTCUTS" })
          break
        case "1":
          dispatch({ type: "SWITCH_STAGE", data: { stage: 1 } })
          break
        case "2":
          dispatch({ type: "SWITCH_STAGE", data: { stage: 2 } })
          break
        case "[":
          dispatch({ type: "TOGGLE_DOCK", data: { dock: "left" } })
          break
        case "]":
          dispatch({ type: "TOGGLE_DOCK", data: { dock: "right" } })
          break
      }
    },
    [dispatch, state.activeNodeId, state.selectedNodeId, state.stage, state.reflection.enabled]
  )

  useEffect(() => {
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handler])
}
