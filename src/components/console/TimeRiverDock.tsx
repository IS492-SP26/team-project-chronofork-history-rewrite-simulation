"use client"

import { useChronoFork } from "@/src/lib/state/context"
import { graphNodes, graphEdges, timelineNodes, type GraphNode, type GraphEdge } from "@/src/lib/mock/mockData"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"

/* ── Node colors ── */
function nodeColor(n: GraphNode, isBacktracked: boolean) {
  if (isBacktracked) return { fill: "var(--chrono-amber)", stroke: "var(--chrono-amber)" }
  if (n.branch === "divergent") return { fill: "var(--chrono-amber)", stroke: "var(--chrono-amber)" }
  if (n.status === "completed") return { fill: "var(--chrono-teal)", stroke: "var(--chrono-teal)" }
  if (n.status === "in_progress") return { fill: "var(--chrono-teal)", stroke: "var(--chrono-teal)" }
  return { fill: "transparent", stroke: "var(--border)" }
}

/* ── Edge choice text ── */
function edgeChoiceText(edge: GraphEdge): string {
  const toNode = graphNodes.find((n) => n.id === edge.to)
  const tn = toNode ? timelineNodes.find((t) => t.id === toNode.id) : null
  if (edge.branch === "divergent") {
    return toNode ? `Divergent choice: ${toNode.hoverDesc}` : "Divergent path"
  }
  return tn ? `Choice: ${tn.canonicalChoice}` : (toNode?.hoverDesc ?? "")
}

/* ── Portal Tooltip ── */
function PortalTooltip({ children, show }: { children: React.ReactNode; show: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted || !show) return null
  return createPortal(children, document.body)
}

/* ── SVG DAG with centered layout ── */
function DAGVisualization() {
  const { state, dispatch } = useChronoFork()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const canSelect = ["observe_complete", "intervene_idle"].includes(state.phase)
  const showDivergent = state.divergence.exists || state.divergence.inProgress

  const visibleNodes = graphNodes.filter((n) => n.branch === "canonical" || showDivergent)
  const visibleEdges = graphEdges.filter((e) => !(e.branch === "divergent" && !showDivergent))

  const svgW = showDivergent ? 300 : 220
  const svgH = 440
  const allX = visibleNodes.map((n) => n.pos.x)
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const graphCenterX = (minX + maxX) / 2
  const offsetX = svgW / 2 - graphCenterX

  /* Compute screen position for tooltip near hovered element */
  const updateTooltipPos = useCallback((clientX: number, clientY: number) => {
    setTooltipPos({ x: clientX + 16, y: clientY - 10 })
  }, [])

  const onNodeEnter = useCallback((e: React.MouseEvent, node: GraphNode) => {
    setHoveredNode(node)
    setHoveredEdge(null)
    updateTooltipPos(e.clientX, e.clientY)
  }, [updateTooltipPos])

  const onNodeMove = useCallback((e: React.MouseEvent) => {
    updateTooltipPos(e.clientX, e.clientY)
  }, [updateTooltipPos])

  const onEdgeEnter = useCallback((e: React.MouseEvent, edge: GraphEdge) => {
    setHoveredEdge(edge)
    setHoveredNode(null)
    updateTooltipPos(e.clientX, e.clientY)
  }, [updateTooltipPos])

  const onEdgeMove = useCallback((e: React.MouseEvent) => {
    updateTooltipPos(e.clientX, e.clientY)
  }, [updateTooltipPos])

  const onLeave = useCallback(() => {
    setHoveredNode(null)
    setHoveredEdge(null)
  }, [])

  const hoveredTn = hoveredNode ? timelineNodes.find((t) => t.id === hoveredNode.id) : null

  return (
    <>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="block" role="img" aria-label="Timeline DAG visualization">
        {/* Edges */}
        {visibleEdges.map((edge) => {
          const from = graphNodes.find((n) => n.id === edge.from)
          const to = graphNodes.find((n) => n.id === edge.to)
          if (!from || !to) return null
          const isDivergent = edge.branch === "divergent"
          return (
            <g key={`${edge.from}-${edge.to}`}>
              {/* Wide invisible hit area for hover */}
              <line
                x1={from.pos.x + offsetX} y1={from.pos.y + 14}
                x2={to.pos.x + offsetX} y2={to.pos.y - 14}
                stroke="transparent" strokeWidth={16}
                className="cursor-default"
                onMouseEnter={(e) => onEdgeEnter(e, edge)}
                onMouseMove={onEdgeMove}
                onMouseLeave={onLeave}
              />
              <line
                x1={from.pos.x + offsetX} y1={from.pos.y + 14}
                x2={to.pos.x + offsetX} y2={to.pos.y - 14}
                stroke={isDivergent ? "var(--chrono-amber)" : "var(--chrono-teal)"}
                strokeWidth={2}
                strokeDasharray={isDivergent ? "4 3" : "none"}
                opacity={hoveredEdge === edge ? 0.9 : isDivergent ? 0.6 : 0.35}
                className="pointer-events-none transition-opacity duration-150"
              />
            </g>
          )
        })}

        {/* Nodes */}
        {visibleNodes.map((node) => {
          const isSelected = state.selectedNodeId === node.id
          const isActive = state.activeNodeId === node.id
          const isBacktracked = state.divergence.backtrackedNodeId === node.id
          const colors = nodeColor(node, isBacktracked)
          const isClickable = canSelect && node.branch === "canonical" && (node.status === "completed" || node.status === "in_progress")
          const isDivergent = node.branch === "divergent"
          const r = 14
          const nx = node.pos.x + offsetX
          const ny = node.pos.y

          return (
            <g key={node.id}
              className={isClickable ? "cursor-pointer" : "cursor-default"}
              onMouseEnter={(e) => onNodeEnter(e, node)}
              onMouseMove={onNodeMove}
              onMouseLeave={onLeave}
              onClick={() => {
                if (!isClickable) return
                dispatch({ type: "SELECT_NODE", data: { nodeId: isSelected ? null : node.id } })
              }}
            >
              {/* Breathing glow ring for active node */}
              {isActive && node.status === "in_progress" && (
                <circle cx={nx} cy={ny} r={r + 6}
                  fill="none" stroke={colors.stroke} strokeWidth="1.5" opacity={0.4}
                  className="animate-node-breathe"
                />
              )}

              {(hoveredNode?.id === node.id || isSelected) && !(isActive && node.status === "in_progress") && (
                <circle cx={nx} cy={ny} r={r + 5}
                  fill="none" stroke={colors.stroke} strokeWidth="1" opacity={0.3}
                />
              )}

              <circle cx={nx} cy={ny} r={r}
                fill={node.status === "unfinished" || node.status === "suspended" ? "var(--background)" : colors.fill}
                stroke={colors.stroke} strokeWidth={isSelected ? 2.5 : 1.5}
                opacity={node.status === "unfinished" ? 0.4 : 1}
              />

              {node.status === "completed" && !isBacktracked && !isDivergent && (
                <text x={nx} y={ny + 1} textAnchor="middle" dominantBaseline="central"
                  fill="var(--background)" fontSize="12" fontWeight="bold">{"✓"}</text>
              )}
              {node.status === "in_progress" && !isBacktracked && (
                <circle cx={nx} cy={ny} r={4} fill="var(--background)" />
              )}
              {isBacktracked && (
                <text x={nx} y={ny + 1} textAnchor="middle" dominantBaseline="central"
                  fill="var(--background)" fontSize="11" fontWeight="bold">{"↩"}</text>
              )}
              {isDivergent && (
                <text x={nx} y={ny + 1} textAnchor="middle" dominantBaseline="central"
                  fill="var(--background)" fontSize="11" fontWeight="bold">{"⑂"}</text>
              )}

              <text
                x={nx + r + 8} y={ny + 1}
                textAnchor="start" dominantBaseline="central"
                fill={node.status === "unfinished" ? "var(--muted-foreground)" : "var(--foreground)"}
                fontSize="13" fontFamily="var(--font-mono)"
                opacity={node.status === "unfinished" ? 0.5 : 0.9}
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Portal tooltip for node hover -- renders on document.body, above everything */}
      <PortalTooltip show={!!hoveredNode}>
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 260 }}
        >
          <div className="bg-popover text-popover-foreground border border-border rounded-xl px-4 py-3 shadow-2xl">
            <p className="text-sm font-semibold text-foreground leading-tight">{hoveredNode?.hoverTitle}</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">{hoveredNode?.hoverDesc}</p>
            {hoveredTn && (
              <p className="text-sm mt-2 font-medium" style={{ color: "var(--chrono-teal)" }}>
                Decision: {hoveredTn.canonicalChoice}
              </p>
            )}
          </div>
        </div>
      </PortalTooltip>

      {/* Portal tooltip for edge hover -- shows choice info */}
      <PortalTooltip show={!!hoveredEdge}>
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 240 }}
        >
          <div className="bg-popover text-popover-foreground border border-border rounded-xl px-4 py-3 shadow-2xl">
            <p className="text-sm text-foreground leading-relaxed">{hoveredEdge ? edgeChoiceText(hoveredEdge) : ""}</p>
          </div>
        </div>
      </PortalTooltip>
    </>
  )
}

export function TimeRiverDock() {
  const { state, dispatch } = useChronoFork()
  const isOpen = state.ui.docks.leftOpen
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active node when it changes
  useEffect(() => {
    if (!isOpen || !scrollRef.current) return
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const container = scrollRef.current
        const svgH = 440
        const activeNode = graphNodes.find((n) => n.id === state.activeNodeId)
        if (activeNode) {
          const ratio = activeNode.pos.y / svgH
          const scrollTarget = ratio * container.scrollHeight - container.clientHeight / 2
          container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" })
        }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [state.activeNodeId, isOpen])

  return (
    <div className="absolute left-3 top-3 z-30" style={{ maxWidth: 320, width: isOpen ? 300 : "auto" }}>
      <div className="glass-panel rounded-xl shadow-lg transition-all duration-300 overflow-hidden">
        {/* Title bar */}
        <button
          onClick={() => dispatch({ type: "TOGGLE_DOCK", data: { dock: "left" } })}
          className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-secondary/20 transition-colors"
          aria-label={isOpen ? "Collapse timeline" : "Expand timeline"}
        >
          <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-muted-foreground flex-1">
            Timeline DAG
          </h3>
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {/* Collapsible body */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/20" />
              <div ref={scrollRef} className="overflow-auto max-h-[60vh] px-3 py-3">
                <div className="flex justify-center">
                  <DAGVisualization />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
