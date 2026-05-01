"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useChronoFork } from "@features/chronofork/state/context"
import { graphNodes } from "@features/chronofork/mock/mockData"
import type { ServerGraphData } from "@features/chronofork/state/types"
import { motion } from "framer-motion"

type OverlayPhase = "idle" | "in" | "breath" | "out"

const ICE = "oklch(88% 0.07 215)"

function getNodeLabel(nodeId: string, serverGraph: ServerGraphData | null): string {
  if (serverGraph) {
    const node = serverGraph.nodes.find((n) => n.id === nodeId)
    return node?.label_id ?? nodeId
  }
  const mock = graphNodes.find((n) => n.id === nodeId)
  return mock?.label ?? nodeId
}

function getNodeTitle(nodeId: string, serverGraph: ServerGraphData | null): string {
  if (serverGraph) {
    const node = serverGraph.nodes.find((n) => n.id === nodeId)
    return node?.hover_title ?? node?.label_id ?? nodeId
  }
  const mock = graphNodes.find((n) => n.id === nodeId)
  return mock?.hoverTitle ?? mock?.label ?? nodeId
}

export function NodeTransitionOverlay() {
  const { state, dispatch } = useChronoFork()
  const [phase, setPhase] = useState<OverlayPhase>("idle")
  const exitRef = useRef<{ x: number; y: number }>({ x: -400, y: -300 })
  const activeNodeIdRef = useRef<string | null>(null)
  const isDockOpenRef = useRef(state.ui.docks.leftOpen)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  activeNodeIdRef.current = state.activeNodeId
  isDockOpenRef.current = state.ui.docks.leftOpen

  const nodeUpdates = state.chatHistory.filter((m) => m.type === "node_update")
  const latestNodeUpdate = nodeUpdates.length > 0 ? nodeUpdates[nodeUpdates.length - 1] : null
  const latestId = latestNodeUpdate?.id
  const fromId = latestNodeUpdate?.meta?.from_id as string | undefined
  const toId = latestNodeUpdate?.meta?.to_id as string | undefined

  const fromLabel = fromId && fromId !== "start" ? getNodeTitle(fromId, state.serverGraph) : null
  const toLabel = toId && toId !== "end" ? getNodeTitle(toId, state.serverGraph) : null

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const goOut = useCallback(() => {
    clearTimers()
    const targetId = activeNodeIdRef.current
    if (targetId) {
      const el = document.querySelector(`[data-node-id="${targetId}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        exitRef.current = {
          x: cx - window.innerWidth / 2,
          y: cy - window.innerHeight / 2,
        }
      }
    }
    setPhase("out")
    const t = setTimeout(() => setPhase("idle"), 900)
    timersRef.current = [t]
  }, [clearTimers])

  useEffect(() => {
    if (!latestId || fromId === "start" || toId === "end") return
    clearTimers()

    // Open dock if closed so the node element is rendered and in view
    const wasDockOpen = isDockOpenRef.current
    if (!wasDockOpen) {
      dispatch({ type: "TOGGLE_DOCK", data: { dock: "left" } })
    }

    // After dock animation settles, scroll to the target node
    const DOCK_SETTLE = wasDockOpen ? 0 : 280
    const scrollTimer = setTimeout(() => {
      const targetId = activeNodeIdRef.current
      const scrollEl = document.querySelector("[data-timeline-scroll-container]") as HTMLElement | null
      const nodeEl = targetId ? document.querySelector(`[data-node-id="${targetId}"]`) as HTMLElement | null : null
      if (scrollEl && nodeEl) {
        const nr = nodeEl.getBoundingClientRect()
        const sr = scrollEl.getBoundingClientRect()
        const newLeft = scrollEl.scrollLeft + (nr.left + nr.width / 2 - sr.left) - scrollEl.clientWidth / 2
        const newTop = scrollEl.scrollTop + (nr.top + nr.height / 2 - sr.top) - scrollEl.clientHeight / 2
        scrollEl.scrollTo({ left: Math.max(0, newLeft), top: Math.max(0, newTop), behavior: "smooth" })
      }
    }, DOCK_SETTLE)

    // Start overlay after scroll has settled
    const overlayStart = DOCK_SETTLE + 400
    const t1 = setTimeout(() => setPhase("in"), overlayStart)
    const t2 = setTimeout(() => setPhase("breath"), overlayStart + 400)
    const t3 = setTimeout(goOut, overlayStart + 1600)
    timersRef.current = [scrollTimer, t1, t2, t3]
    return clearTimers
  }, [latestId, fromId, clearTimers, goOut, dispatch])

  const handleClick = useCallback(() => {
    if (phase === "idle" || phase === "out") return
    goOut()
  }, [phase, goOut])

  if (phase === "idle") return null

  const { x: ex, y: ey } = exitRef.current

  const animate =
    phase === "out"
      ? { opacity: 0, scale: 0.04, x: ex, y: ey }
      : phase === "breath"
      ? { opacity: [0.88, 0.72, 0.88, 0.72, 0.88], scale: [1.02, 0.98, 1.02, 0.98, 1.02] }
      : { opacity: 0.88, scale: 1.0 }

  const transition =
    phase === "out"
      ? { duration: 0.85, ease: "easeIn" as const }
      : phase === "breath"
      ? { duration: 1.2, ease: "easeInOut" as const, times: [0, 0.25, 0.5, 0.75, 1] }
      : { duration: 0.35, ease: "easeOut" as const }

  return (
    <motion.div
      className="fixed inset-0 z-[79] cursor-pointer"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={animate}
      transition={transition}
      onClick={handleClick}
    >
      {/* Frosted glass base */}
      <div className="absolute inset-0 backdrop-blur-md bg-background/60" />

      {/* Ice-blue radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 70% at center, color-mix(in oklch, ${ICE} 22%, transparent) 0%, color-mix(in oklch, ${ICE} 10%, transparent) 50%, transparent 80%)`,
          filter: "blur(24px)",
        }}
      />

      {/* Edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 38%, color-mix(in oklch, ${ICE} 7%, var(--background)) 100%)`,
        }}
      />

      {/* Center: ring + transition text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex flex-col items-center gap-5">

          {/* Breathing ring */}
          <motion.div
            animate={
              phase === "breath"
                ? { scale: [1, 1.18, 1], opacity: [0.4, 0.7, 0.4] }
                : { scale: 1, opacity: 0.4 }
            }
            transition={
              phase === "breath"
                ? { duration: 1.2, ease: "easeInOut", times: [0, 0.5, 1] }
                : { duration: 0.35 }
            }
            className="absolute"
            style={{
              width: 220,
              height: 220,
              borderRadius: "50%",
              border: `1.5px solid color-mix(in oklch, ${ICE} 55%, transparent)`,
              boxShadow: `0 0 60px 20px color-mix(in oklch, ${ICE} 22%, transparent), inset 0 0 40px 10px color-mix(in oklch, ${ICE} 10%, transparent)`,
            }}
          />

          {/* Transition info */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-4 px-10 py-6 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <span
              className="text-[10px] font-mono tracking-[0.22em] uppercase"
              style={{ color: `color-mix(in oklch, ${ICE} 90%, white)` }}
            >
              Temporal Shift
            </span>

            {fromId && fromId !== "start" && (
              <div className="flex flex-col items-center gap-3">
                {/* FROM node */}
                <div className="flex flex-col items-center gap-1">
                  <span
                    className="text-3xl font-bold font-mono tracking-widest leading-none"
                    style={{ color: "var(--foreground)" }}
                  >
                    {fromId}
                  </span>
                  {fromLabel && (
                    <span
                      className="text-xs font-medium leading-snug max-w-[280px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {fromLabel}
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <motion.div
                  animate={phase === "breath" ? { opacity: [0.6, 1, 0.6] } : { opacity: 0.6 }}
                  transition={phase === "breath" ? { duration: 1.2, ease: "easeInOut" } : {}}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className="block w-px h-4" style={{ background: `color-mix(in oklch, ${ICE} 60%, white)` }} />
                  <span className="text-lg leading-none" style={{ color: `color-mix(in oklch, ${ICE} 80%, white)` }}>↓</span>
                </motion.div>

                {/* TO node */}
                {toId && toId !== "end" && (
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="text-3xl font-bold font-mono tracking-widest leading-none"
                      style={{ color: "var(--foreground)" }}
                    >
                      {toId}
                    </span>
                    {toLabel && (
                      <span
                        className="text-xs font-medium leading-snug max-w-[280px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {toLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
