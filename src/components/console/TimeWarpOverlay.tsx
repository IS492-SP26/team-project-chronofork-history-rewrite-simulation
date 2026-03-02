"use client"

import { useChronoFork } from "@/src/lib/state/context"
import { motion } from "framer-motion"

export function TimeWarpOverlay({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[80] pointer-events-none">
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 30%, color-mix(in oklch, var(--chrono-amber) 10%, transparent) 70%, var(--background) 100%)", filter: "blur(40px)" }} />
      <div className="absolute inset-0 film-grain" style={{ opacity: 0.04 }} />
    </motion.div>
  )
}
