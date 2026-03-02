"use client"

import { useChronoFork } from "@/src/lib/state/context"
import { graphNodes, graphEdges, timelineNodes, type GraphNode, type GraphEdge } from "@/src/lib/mock/mockData"
import type { ServerGraphData } from "@/src/lib/state/types"
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
  if (edge.branch === "divergent") return toNode ? `Divergent: ${toNode.hoverDesc}` : "Divergent path"
  return tn ? `Choice: ${tn.canonicalChoice}` : (toNode?.hoverDesc ?? "")
}

/* ── Portal Tooltip ── */
function PortalTooltip({ children, show }: { children: React.ReactNode; show: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted || !show) return null
  return createPortal(children, document.body)
}

/* ── Server Graph DAG ── */
function ServerDAGVisualization({ graph }: { graph: ServerGraphData }) {
  const { state, dispatch } = useChronoFork()
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<[string, string] | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const canSelect = ["observe_complete", "intervene_idle"].includes(state.phase)

  const posEntries = Object.entries(graph.pos)
  const allX = posEntries.map(([, p]) => p[0])
  const allY = posEntries.map(([, p]) => p[1])
  const minX = Math.min(...allX), maxX = Math.max(...allX)
  const minY = Math.min(...allY), maxY = Math.max(...allY)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  const pad = 30, svgW = 240, labelW = 60
  const usableW = svgW - pad * 2 - labelW
  const usableH = Math.max(250, posEntries.length * 70)
  const svgH = usableH + pad * 2

  function toSVG(pos: [number, number]): { x: number; y: number } {
    const nx = posEntries.length <= 1 ? svgW / 2 : pad + ((pos[0] - minX) / rangeX) * usableW + labelW / 2
    const ny = posEntries.length <= 1 ? svgH / 2 : pad + ((pos[1] - minY) / rangeY) * usableH
    return { x: nx, y: ny }
  }

  function sNodeColor(status: string) {
    switch (status) {
      case "COMPLETED": return { fill: "var(--chrono-teal)", stroke: "var(--chrono-teal)" }
      case "IN_PROGRESS": return { fill: "var(--chrono-teal)", stroke: "var(--chrono-teal)" }
      case "SUSPENDED": return { fill: "var(--chrono-amber)", stroke: "var(--chrono-amber)" }
      default: return { fill: "transparent", stroke: "var(--border)" }
    }
  }

  const updateTooltipPos = useCallback((cx: number, cy: number) => {
    setTooltipPos({ x: cx + 14, y: cy - 8 })
  }, [])

  const hoveredNodeData = hoveredNode ? graph.nodes.find((n) => n.id === hoveredNode) : null

  return (
    <>
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="block" role="img" aria-label="Server DAG">
        {graph.edges.map(([from, to]) => {
          const fromPos = graph.pos[from], toPos = graph.pos[to]
          if (!fromPos || !toPos) return null
          const f = toSVG(fromPos), t = toSVG(toPos)
          const isHovered = hoveredEdge?.[0] === from && hoveredEdge?.[1] === to
          return (
            <g key={`${from}-${to}`}>
              <line x1={f.x} y1={f.y + 12} x2={t.x} y2={t.y - 12}
                stroke="transparent" strokeWidth={14} className="cursor-default"
                onMouseEnter={(e) => { setHoveredEdge([from, to]); setHoveredNode(null); updateTooltipPos(e.clientX, e.clientY) }}
                onMouseMove={(e) => updateTooltipPos(e.clientX, e.clientY)}
                onMouseLeave={() => setHoveredEdge(null)} />
              <line x1={f.x} y1={f.y + 12} x2={t.x} y2={t.y - 12}
                stroke="var(--chrono-teal)" strokeWidth={1.5} opacity={isHovered ? 0.9 : 0.3}
                className="pointer-events-none transition-opacity duration-150" />
            </g>
          )
        })}
        {graph.nodes.map((node) => {
          const pos = graph.pos[node.id]
          if (!pos) return null
          const { x, y } = toSVG(pos)
          const colors = sNodeColor(node.status)
          const isActive = node.id === graph.active_id
          const isSelected = state.selectedNodeId === node.id
          const isClickable = canSelect && (node.status === "COMPLETED" || node.status === "IN_PROGRESS")
          const r = 10
          return (
            <g key={node.id}
              className={isClickable ? "cursor-pointer" : "cursor-default"}
              onMouseEnter={(e) => { setHoveredNode(node.id); setHoveredEdge(null); updateTooltipPos(e.clientX, e.clientY) }}
              onMouseMove={(e) => updateTooltipPos(e.clientX, e.clientY)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => { if (isClickable) dispatch({ type: "SELECT_NODE", data: { nodeId: isSelected ? null : node.id } }) }}
            >
              {/* Label above node */}
              <text x={x} y={y - r - 5} textAnchor="middle" dominantBaseline="auto"
                fill={node.status === "UNFINISHED" ? "var(--muted-foreground)" : "var(--foreground)"}
                fontSize="9" fontFamily="var(--font-mono)" fontWeight="600"
                opacity={node.status === "UNFINISHED" ? 0.4 : 0.85}>
                {node.label_id}
              </text>
              {isActive && node.status === "IN_PROGRESS" && (
                <circle cx={x} cy={y} r={r + 5} fill="none" stroke={colors.stroke} strokeWidth="1" opacity={0.35} className="animate-node-breathe" />
              )}
              {(hoveredNode === node.id || isSelected) && !(isActive && node.status === "IN_PROGRESS") && (
                <circle cx={x} cy={y} r={r + 4} fill="none" stroke={colors.stroke} strokeWidth="0.8" opacity={0.25} />
              )}
              <circle cx={x} cy={y} r={r}
                fill={node.status === "UNFINISHED" ? "var(--background)" : colors.fill}
                stroke={colors.stroke} strokeWidth={isSelected ? 2 : 1.2}
                opacity={node.status === "UNFINISHED" ? 0.35 : 1} />
              {node.status === "COMPLETED" && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="var(--background)" fontSize="10" fontWeight="bold">&#x2713;</text>
              )}
              {node.status === "IN_PROGRESS" && isActive && (
                <circle cx={x} cy={y} r={3} fill="var(--background)" />
              )}
            </g>
          )
        })}
      </svg>
      <PortalTooltip show={!!hoveredNodeData}>
        <div className="fixed z-[200] pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 240 }}>
          <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2.5 shadow-2xl">
            <p className="text-xs font-semibold text-foreground leading-tight">{hoveredNodeData?.hover_title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{hoveredNodeData?.hover_desc}</p>
          </div>
        </div>
      </PortalTooltip>
      <PortalTooltip show={!!hoveredEdge}>
        <div className="fixed z-[200] pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 220 }}>
          <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2.5 shadow-2xl">
            <p className="text-xs text-foreground leading-relaxed">Path transition</p>
          </div>
        </div>
      </PortalTooltip>
    </>
  )
}

/* ── Polished Mock SVG DAG ── */
function DAGVisualization() {
  const { state, dispatch } = useChronoFork()
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const canSelect = ["observe_complete", "intervene_idle"].includes(state.phase)
  const showDivergent = state.divergence.exists || state.divergence.inProgress

  const visibleNodes = graphNodes.filter((n) => n.branch === "canonical" || showDivergent)
  const visibleEdges = graphEdges.filter((e) => !(e.branch === "divergent" && !showDivergent))

  /* Tighter layout */
  const nodeSpacing = 68
  const svgW = showDivergent ? 250 : 180
  const canonicalNodes = visibleNodes.filter((n) => n.branch === "canonical")
  const svgH = Math.max(200, canonicalNodes.length * nodeSpacing + 50)

  /* Recompute positions for tighter vertical layout */
  const posMap = new Map<string, { x: number; y: number }>()
  canonicalNodes.forEach((n, i) => {
    posMap.set(n.id, { x: svgW / 2 - (showDivergent ? 30 : 0), y: 30 + i * nodeSpacing })
  })
  visibleNodes.filter((n) => n.branch === "divergent").forEach((n, i) => {
    const parentCanon = graphEdges.find((e) => e.to === n.id)
    const parentPos = parentCanon ? posMap.get(parentCanon.from) : null
    const baseY = parentPos ? parentPos.y + 40 : 180
    posMap.set(n.id, { x: svgW / 2 + 55, y: baseY + i * nodeSpacing })
  })

  const updateTooltipPos = useCallback((cx: number, cy: number) => {
    setTooltipPos({ x: cx + 14, y: cy - 8 })
  }, [])

  const onNodeEnter = useCallback((e: React.MouseEvent, node: GraphNode) => {
    setHoveredNode(node); setHoveredEdge(null); updateTooltipPos(e.clientX, e.clientY)
  }, [updateTooltipPos])
  const onNodeMove = useCallback((e: React.MouseEvent) => { updateTooltipPos(e.clientX, e.clientY) }, [updateTooltipPos])
  const onEdgeEnter = useCallback((e: React.MouseEvent, edge: GraphEdge) => {
    setHoveredEdge(edge); setHoveredNode(null); updateTooltipPos(e.clientX, e.clientY)
  }, [updateTooltipPos])
  const onEdgeMove = useCallback((e: React.MouseEvent) => { updateTooltipPos(e.clientX, e.clientY) }, [updateTooltipPos])
  const onLeave = useCallback(() => { setHoveredNode(null); setHoveredEdge(null) }, [])

  const hoveredTn = hoveredNode ? timelineNodes.find((t) => t.id === hoveredNode.id) : null
  const r = 10

  return (
    <>
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="block" role="img" aria-label="Timeline DAG">
        {/* Edges */}
        {visibleEdges.map((edge) => {
          const fromPos = posMap.get(edge.from), toPos = posMap.get(edge.to)
          if (!fromPos || !toPos) return null
          const isDivergent = edge.branch === "divergent"
          const isHovered = hoveredEdge === edge
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line x1={fromPos.x} y1={fromPos.y + r + 2} x2={toPos.x} y2={toPos.y - r - 14}
                stroke="transparent" strokeWidth={14} className="cursor-default"
                onMouseEnter={(e) => onEdgeEnter(e, edge)} onMouseMove={onEdgeMove} onMouseLeave={onLeave} />
              <line x1={fromPos.x} y1={fromPos.y + r + 2} x2={toPos.x} y2={toPos.y - r - 14}
                stroke={isDivergent ? "var(--chrono-amber)" : "var(--chrono-teal)"}
                strokeWidth={1.5} strokeDasharray={isDivergent ? "4 3" : "none"}
                opacity={isHovered ? 0.9 : isDivergent ? 0.5 : 0.25}
                className="pointer-events-none transition-opacity duration-150" />
            </g>
          )
        })}

        {/* Nodes */}
        {visibleNodes.map((node) => {
          const pos = posMap.get(node.id)
          if (!pos) return null
          const { x, y } = pos
          const isSelected = state.selectedNodeId === node.id
          const isActive = state.activeNodeId === node.id
          const isBacktracked = state.divergence.backtrackedNodeId === node.id
          const colors = nodeColor(node, isBacktracked)
          const isClickable = canSelect && node.branch === "canonical" && (node.status === "completed" || node.status === "in_progress")
          const isDivergent = node.branch === "divergent"

          return (
            <g key={node.id}
              className={isClickable ? "cursor-pointer" : "cursor-default"}
              onMouseEnter={(e) => onNodeEnter(e, node)} onMouseMove={onNodeMove} onMouseLeave={onLeave}
              onClick={() => { if (isClickable) dispatch({ type: "SELECT_NODE", data: { nodeId: isSelected ? null : node.id } }) }}
            >
              {/* Label ABOVE the node */}
              <text x={x} y={y - r - 5} textAnchor="middle" dominantBaseline="auto"
                fill={node.status === "unfinished" ? "var(--muted-foreground)" : "var(--foreground)"}
                fontSize="9" fontFamily="var(--font-mono)" fontWeight="600"
                opacity={node.status === "unfinished" ? 0.4 : 0.85}>
                {node.label}
              </text>

              {/* Breathing glow ring for active node */}
              {isActive && node.status === "in_progress" && (
                <circle cx={x} cy={y} r={r + 5} fill="none" stroke={colors.stroke} strokeWidth="1" opacity={0.35} className="animate-node-breathe" />
              )}
              {(hoveredNode?.id === node.id || isSelected) && !(isActive && node.status === "in_progress") && (
                <circle cx={x} cy={y} r={r + 4} fill="none" stroke={colors.stroke} strokeWidth="0.8" opacity={0.25} />
              )}

              {/* Main node circle */}
              <circle cx={x} cy={y} r={r}
                fill={node.status === "unfinished" || node.status === "suspended" ? "var(--background)" : colors.fill}
                stroke={colors.stroke} strokeWidth={isSelected ? 2 : 1.2}
                opacity={node.status === "unfinished" ? 0.35 : 1} />

              {/* Status icon inside */}
              {node.status === "completed" && !isBacktracked && !isDivergent && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="var(--background)" fontSize="10" fontWeight="bold">&#x2713;</text>
              )}
              {node.status === "in_progress" && !isBacktracked && (
                <circle cx={x} cy={y} r={3} fill="var(--background)" />
              )}
              {isBacktracked && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="var(--background)" fontSize="9" fontWeight="bold">&#x21A9;</text>
              )}
              {isDivergent && !isBacktracked && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="var(--background)" fontSize="9" fontWeight="bold">&#x2442;</text>
              )}
              {node.status === "unfinished" && (
                <circle cx={x} cy={y} r={2.5} fill="var(--border)" opacity={0.4} />
              )}
            </g>
          )
        })}
      </svg>

      {/* Node tooltip */}
      <PortalTooltip show={!!hoveredNode}>
        <div className="fixed z-[200] pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 240 }}>
          <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2.5 shadow-2xl">
            <p className="text-xs font-semibold text-foreground leading-tight">{hoveredNode?.hoverTitle}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{hoveredNode?.hoverDesc}</p>
            {hoveredTn && (
              <p className="text-xs mt-1 font-medium" style={{ color: "var(--chrono-teal)" }}>
                Decision: {hoveredTn.canonicalChoice}
              </p>
            )}
          </div>
        </div>
      </PortalTooltip>

      {/* Edge tooltip */}
      <PortalTooltip show={!!hoveredEdge}>
        <div className="fixed z-[200] pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 220 }}>
          <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2.5 shadow-2xl">
            <p className="text-xs text-foreground leading-relaxed">{hoveredEdge ? edgeChoiceText(hoveredEdge) : ""}</p>
          </div>
        </div>
      </PortalTooltip>
    </>
  )
}

/* ── Main Dock ── */
export function TimeRiverDock() {
  const { state, dispatch } = useChronoFork()
  const isOpen = state.ui.docks.leftOpen
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !scrollRef.current) return
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const container = scrollRef.current
        const activeNode = graphNodes.find((n) => n.id === state.activeNodeId)
        if (activeNode) {
          const ratio = activeNode.pos.y / 440
          const scrollTarget = ratio * container.scrollHeight - container.clientHeight / 2
          container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" })
        }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [state.activeNodeId, isOpen])

  return (
    <div className="absolute left-3 top-3 z-30" style={{ width: isOpen ? "auto" : "auto", maxWidth: 260 }}>
      <div className="glass-panel rounded-xl shadow-lg transition-all duration-300 overflow-hidden">
        <button
          onClick={() => dispatch({ type: "TOGGLE_DOCK", data: { dock: "left" } })}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-secondary/20 transition-colors"
          aria-label={isOpen ? "Collapse timeline" : "Expand timeline"}
        >
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground flex-1">Timeline</h3>
          {isOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </button>
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
              <div ref={scrollRef} className="overflow-auto max-h-[55vh] px-2 py-2">
                {state.serverGraph ? <ServerDAGVisualization graph={state.serverGraph} /> : <DAGVisualization />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
