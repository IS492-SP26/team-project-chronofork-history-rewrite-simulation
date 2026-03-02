"use client"

import { useChronoFork } from "@/src/lib/state/context"
import { scenes } from "@/src/lib/mock/mockData"
import { motion, AnimatePresence } from "framer-motion"

export function DirectorSubtitleBox() {
  const { state } = useChronoFork()
  const scene = scenes[state.currentSceneIndex]
  const reducedMotion = state.ui.reducedMotion

  if (!scene) return null

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.id}
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: reducedMotion ? 0 : 0.5 }}
          className="glass-panel rounded-lg px-5 py-3 text-center"
        >
          <p className="text-sm leading-relaxed text-foreground italic font-serif">
            {scene.directorCaption}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1.5 tracking-wide">
            {scene.time} &mdash; {scene.location}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
