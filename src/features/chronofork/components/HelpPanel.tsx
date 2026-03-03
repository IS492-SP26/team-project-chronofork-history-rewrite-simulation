"use client"

import { useChronoFork } from "@features/chronofork/state/context"
import { motion } from "framer-motion"
import { X } from "lucide-react"

export function HelpPanel() {
  const { state, dispatch } = useChronoFork()
  if (!state.ui.showHelpPanel) return null

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" onClick={() => dispatch({ type: "TOGGLE_HELP_PANEL" })} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-foreground">How ChronoFork Works</h3>
          <button onClick={() => dispatch({ type: "TOGGLE_HELP_PANEL" })} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col gap-4">
          {[
            { n: "1", color: "var(--chrono-teal)", title: "Observe", desc: "Watch the historical event unfold. This is system-controlled -- press Start and watch." },
            { n: "2", color: "var(--chrono-amber)", title: "Intervene", desc: "After observation, select a timeline node to backtrack. Roleplay as a historical figure and make a different choice." },
            { n: "3", color: "var(--chrono-violet)", title: "Reflection", desc: "When your intervention ends, a report compares your timeline with canonical history." },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0" style={{ backgroundColor: step.color }}>{step.n}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed">Repeat Intervene-Reflect from different nodes. The DAG on the left shows all branches.</p>
        </div>
      </motion.div>
    </div>
  )
}
