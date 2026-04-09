"use client"

import { useChronoFork } from "@features/chronofork/state/context"
import { useI18n } from "@features/chronofork/i18n"
import { graphNodes, graphEdges, timelineNodes, type GraphEdge } from "@features/chronofork/mock/mockData"
import type { ServerGraphData } from "@features/chronofork/state/types"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"

type UnifiedNodeStatus = "completed" | "in_progress" | "unfinished" | "suspended" | "divergent"

interface UnifiedNode {
  id: string
  label: string
  status: UnifiedNodeStatus
  branch: "canonical" | "divergent"
  hoverTitle: string
  hoverDesc: string
  isClickable: boolean
}

interface UnifiedEdge {
  from: string
  to: string
  branch: "canonical" | "divergent"
  tooltip: {
    title: string
    desc: string
  }
}

interface UnifiedGraph {
  nodes: UnifiedNode[]
  edges: UnifiedEdge[]
  pos: Record<string, [number, number]>
  activeNodeId: string | null
}

interface GraphLayout {
  svgW: number
  svgH: number
  pos: Record<string, { x: number; y: number }>
}

function formatNodeStatus(status: UnifiedNodeStatus): string {
  if (status === "in_progress") return "IN_PROGRESS"
  if (status === "unfinished") return "UNFINISHED"
  if (status === "suspended") return "SUSPENDED"
  if (status === "divergent") return "DIVERGENT"
  return "COMPLETED"
}

/* ── Node colors ── */
function nodeColor(n: { branch: "canonical" | "divergent" }, isBacktracked: boolean) {
  if (isBacktracked) return { fill: "var(--chrono-amber)", stroke: "var(--chrono-amber)" }
  return n.branch === "divergent"
    ? { fill: "var(--chrono-amber)", stroke: "var(--chrono-amber)" }
    : { fill: "var(--chrono-teal)", stroke: "var(--chrono-teal)" }
}

function parseBranchFromId(id: string): "canonical" | "divergent" {
  const suffix = id.split(".").pop()
  if (!suffix) return "canonical"
  const n = Number(suffix)
  if (Number.isNaN(n)) return "canonical"
  return n === 0 ? "canonical" : "divergent"
}

function mapEdgeLabelsByPosition(graph: ServerGraphData): string[] {
  const labels = graph.edge_label_data ?? []
  if (labels.length === 0) {
    return graph.edges.map(() => "Path transition")
  }

  const edgeMidpoints = graph.edges.map(([from, to]) => {
    const fromPos = graph.pos[from]
    const toPos = graph.pos[to]
    if (!fromPos || !toPos) return null
    return {
      x: (fromPos[0] + toPos[0]) / 2,
      y: (fromPos[1] + toPos[1]) / 2,
    }
  })

  const used = new Set<number>()
  return edgeMidpoints.map((mid, idx) => {
    if (!mid) return labels[idx]?.text || "Path transition"

    let bestIdx = -1
    let bestDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < labels.length; i++) {
      if (used.has(i)) continue
      const dx = labels[i].x - mid.x
      const dy = labels[i].y - mid.y
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }

    if (bestIdx >= 0) {
      used.add(bestIdx)
      return labels[bestIdx].text || "Path transition"
    }

    return labels[idx]?.text || "Path transition"
  })
}

/* ── Edge tooltip content ── */
function edgeChoiceText(edge: GraphEdge): { title: string; desc: string } {
  const toNode = graphNodes.find((n) => n.id === edge.to)
  const tn = toNode ? timelineNodes.find((t) => t.id === toNode.id) : null
  if (edge.branch === "divergent") {
    return {
      title: "Divergence",
      desc: toNode?.hoverDesc ?? "Rewritten branch path",
    }
  }
  return {
    title: "Choice",
    desc: tn?.canonicalChoice ?? toNode?.hoverDesc ?? "Canonical path transition",
  }
}

/* ── Portal Tooltip ── */
function PortalTooltip({ children, show }: { children: React.ReactNode; show: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted || !show) return null
  return createPortal(children, document.body)
}

function computeGraphLayout(graph: UnifiedGraph): GraphLayout {
  const posEntries = Object.entries(graph.pos)
  const padX = 30
  const padY = 30
  // Reserve enough horizontal space for centered node labels.
  const maxLabelChars = graph.nodes.reduce((max, node) => Math.max(max, node.label.length), 0)
  const approxCharPx = 7
  const maxLabelWidth = Math.max(56, maxLabelChars * approxCharPx)
  const labelPad = Math.ceil(maxLabelWidth / 2) + 10
  const minSvgW = 260
  const minSvgH = 200

  if (posEntries.length === 0) {
    return { svgW: minSvgW, svgH: minSvgH, pos: {} }
  }

  // Detect if coordinates are raw grid coordinates from server (e.g., [0, -1], [1, -1])
  const rawX = posEntries.map(([, p]) => p[0])
  const rawY = posEntries.map(([, p]) => p[1])
  const isGridCoords = (Math.max(...rawX) - Math.min(...rawX) < 20) && (Math.max(...rawY) - Math.min(...rawY) < 20)
  
  const mappedPosEntries = posEntries.map(([id, p]) => {
    let x = p[0]
    let y = p[1]
    if (isGridCoords) {
      x = p[0] * 160
      y = -p[1] * 80 // Invert Y so -1 becomes 80, -2 becomes 160 (going down)
    }
    return [id, x, y] as [string, number, number]
  })

  const allX = mappedPosEntries.map(([, x]) => x)
  const allY = mappedPosEntries.map(([, , y]) => y)
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const minY = Math.min(...allY)
  const maxY = Math.max(...allY)
  const rangeX = maxX - minX
  const rangeY = maxY - minY
  const svgW = Math.max(minSvgW, rangeX + padX * 2 + labelPad * 2)
  const svgH = Math.max(minSvgH, rangeY + padY * 2 + 20)

  const pos = Object.fromEntries(mappedPosEntries.map(([id, x, y]) => {
    const finalX = rangeX === 0 ? svgW / 2 : padX + labelPad + (x - minX)
    const finalY = rangeY === 0 ? svgH / 2 : padY + (y - minY)
    return [id, { x: finalX, y: finalY }]
  }))

  return { svgW, svgH, pos }
}

function buildMockGraph(phase: string, divergence: { exists: boolean; inProgress: boolean }, activeNodeId: string | null): UnifiedGraph {
  const canSelect = ["observe_complete", "intervene_idle"].includes(phase)
  const showDivergent = divergence.exists || divergence.inProgress
  const visibleNodes = graphNodes.filter((n) => n.branch === "canonical" || showDivergent)
  const visibleEdges = graphEdges.filter((e) => !(e.branch === "divergent" && !showDivergent))

  return {
    nodes: visibleNodes.map((node) => ({
      id: node.id,
      label: node.label,
      status: node.status,
      branch: node.branch,
      hoverTitle: node.hoverTitle,
      hoverDesc: node.hoverDesc,
      isClickable: canSelect && node.branch === "canonical" && (node.status === "completed" || node.status === "in_progress" || node.status === "suspended"),
    })),
    edges: visibleEdges.map((edge) => ({
      ...edge,
      tooltip: edgeChoiceText(edge),
    })),
    pos: Object.fromEntries(visibleNodes.map((node) => [node.id, [node.pos.x, node.pos.y] as [number, number]])),
    activeNodeId,
  }
}

function buildServerGraph(graph: ServerGraphData, phase: string): UnifiedGraph {
  const canSelect = ["observe_complete", "intervene_idle"].includes(phase)
  const edgeLabels = mapEdgeLabelsByPosition(graph)
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      label: node.label_id,
      status:
        node.status === "COMPLETED"
          ? "completed"
          : node.status === "IN_PROGRESS"
            ? "in_progress"
            : node.status === "SUSPENDED"
              ? "suspended"
              : "unfinished",
      branch: parseBranchFromId(node.id),
      hoverTitle: node.hover_title,
      hoverDesc: node.hover_desc,
      isClickable: canSelect && (node.status === "COMPLETED" || node.status === "IN_PROGRESS" || node.status === "SUSPENDED"),
    })),
    edges: graph.edges.map(([from, to], idx) => ({
      from,
      to,
      branch: parseBranchFromId(to),
      tooltip: {
        title: "Choice",
        desc: edgeLabels[idx] || "Path transition",
      },
    })),
    pos: graph.pos,
    activeNodeId: graph.active_id,
  }
}

/* ── Unified DAG Visualization ── */
function UnifiedDAGVisualization({ graph }: { graph: UnifiedGraph }) {
  const { state, dispatch } = useChronoFork()
  const { t } = useI18n()
  const [hoveredNode, setHoveredNode] = useState<UnifiedNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<UnifiedEdge | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const layout = computeGraphLayout(graph)
  const r = 15

  const updateTooltipPos = useCallback((cx: number, cy: number) => {
    setTooltipPos({ x: cx + 14, y: cy - 8 })
  }, [])

  const onNodeEnter = useCallback((e: React.MouseEvent, node: UnifiedNode) => {
    setHoveredNode(node); setHoveredEdge(null); updateTooltipPos(e.clientX, e.clientY)
  }, [updateTooltipPos])
  const onNodeMove = useCallback((e: React.MouseEvent) => { updateTooltipPos(e.clientX, e.clientY) }, [updateTooltipPos])
  const onEdgeEnter = useCallback((e: React.MouseEvent, edge: UnifiedEdge) => {
    setHoveredEdge(edge); setHoveredNode(null); updateTooltipPos(e.clientX, e.clientY)
  }, [updateTooltipPos])
  const onEdgeMove = useCallback((e: React.MouseEvent) => { updateTooltipPos(e.clientX, e.clientY) }, [updateTooltipPos])
  const onLeave = useCallback(() => { setHoveredNode(null); setHoveredEdge(null) }, [])

  const hoveredTn = hoveredNode ? timelineNodes.find((t) => t.id === hoveredNode.id) : null

  return (
    <>
      <svg width={layout.svgW} height={layout.svgH} viewBox={`0 0 ${layout.svgW} ${layout.svgH}`} className="block" role="img" aria-label="Timeline DAG">
        {graph.edges.map((edge) => {
          const fromPos = layout.pos[edge.from]
          const toPos = layout.pos[edge.to]
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

        {graph.nodes.map((node) => {
          const pos = layout.pos[node.id]
          if (!pos) return null
          const { x, y } = pos
          const isSelected = state.selectedNodeId === node.id
          const isActive = (graph.activeNodeId ?? state.activeNodeId) === node.id
          const isBacktracked = state.divergence.backtrackedNodeId === node.id
          const colors = nodeColor(node, isBacktracked)
          const isDivergent = node.branch === "divergent"

          return (
            <g key={node.id}
              className={node.isClickable ? "cursor-pointer" : "cursor-default"}
              onMouseEnter={(e) => onNodeEnter(e, node)} onMouseMove={onNodeMove} onMouseLeave={onLeave}
              onClick={() => { if (node.isClickable) dispatch({ type: "SELECT_NODE", data: { nodeId: isSelected ? null : node.id } }) }}
            >
              <text x={x} y={y - r - 6} textAnchor="middle" dominantBaseline="auto"
                fill="var(--foreground)"
                fontSize="11" fontFamily="var(--font-mono)" fontWeight="700"
                opacity={0.85}>
                {node.label}
              </text>

              {isActive && node.status === "in_progress" && (
                <circle cx={x} cy={y} r={r + 5} fill="none" stroke={colors.stroke} strokeWidth="1" opacity={0.35} className="animate-node-breathe" />
              )}
              {(hoveredNode?.id === node.id || isSelected) && !(isActive && node.status === "in_progress") && (
                <circle cx={x} cy={y} r={r + 4} fill="none" stroke={colors.stroke} strokeWidth="0.8" opacity={0.25} />
              )}
              {isSelected && (
                <>
                  <circle cx={x} cy={y} r={r + 7} fill="none" stroke="var(--foreground)" strokeWidth="2" opacity={0.55} />
                  <circle cx={x} cy={y} r={r + 10} fill="none" stroke={colors.stroke} strokeWidth="1.2" strokeDasharray="3 2" opacity={0.65} />
                </>
              )}

              <circle cx={x} cy={y} r={r}
                fill={colors.fill}
                stroke={colors.stroke} strokeWidth={isSelected ? 2 : 1.2}
                opacity={1} />

              {node.status === "completed" && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="var(--background)" fontSize="11" fontWeight="bold">&#x2713;</text>
              )}
              {node.status === "in_progress" && (
                <circle cx={x} cy={y} r={3.5} fill="var(--background)" />
              )}
              {node.status === "suspended" && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="var(--background)" fontSize="10" fontWeight="bold">&#x23F8;</text>
              )}
              {node.status === "unfinished" && (
                <circle cx={x} cy={y} r={3} fill="var(--background)" opacity={0.8} />
              )}
            </g>
          )
        })}
      </svg>

      {/* Node tooltip */}
      <PortalTooltip show={!!hoveredNode}>
        <div className="fixed z-[200] pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 240 }}>
          <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2.5 shadow-2xl">
            <p className="text-xs font-semibold text-foreground leading-tight">
              {hoveredNode?.hoverTitle}
              {hoveredNode && <span className="text-[10px] font-mono text-muted-foreground"> {" · "}[{formatNodeStatus(hoveredNode.status)}]</span>}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{hoveredNode?.hoverDesc}</p>
            {hoveredTn && (
              <p className="text-xs mt-1 font-medium" style={{ color: "var(--chrono-teal)" }}>
                {t("Decision:")} {hoveredTn.canonicalChoice}
              </p>
            )}
          </div>
        </div>
      </PortalTooltip>

      <PortalTooltip show={!!hoveredEdge}>
        <div className="fixed z-[200] pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 220 }}>
          <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2.5 shadow-2xl">
            <p className="text-xs font-semibold text-foreground leading-tight">{hoveredEdge?.tooltip.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{hoveredEdge?.tooltip.desc}</p>
          </div>
        </div>
      </PortalTooltip>
    </>
  )
}

/* ── Main Dock ── */
export function TimeRiverDock() {
  const { state, dispatch } = useChronoFork()
  const { t } = useI18n()
  const isOpen = state.ui.docks.leftOpen
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeGraph = state.serverGraph ? buildServerGraph(state.serverGraph, state.phase) : buildMockGraph(state.phase, state.divergence, state.activeNodeId)

  useEffect(() => {
    if (!isOpen || !scrollRef.current) return
    const activeNodeId = activeGraph.activeNodeId ?? state.activeNodeId
    if (!activeNodeId) return

    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const container = scrollRef.current
        const layout = computeGraphLayout(activeGraph)
        const activePos = layout.pos[activeNodeId]
        if (!activePos) return
        container.scrollTo({
          left: Math.max(0, activePos.x - container.clientWidth / 2),
          top: Math.max(0, activePos.y - container.clientHeight / 2),
          behavior: "smooth",
        })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [activeGraph, isOpen, state.activeNodeId])

  return (
    <div className="absolute left-3 top-3 z-30" style={{ width: isOpen ? "auto" : "auto", maxWidth: 380 }}>
      <div className="glass-panel rounded-xl shadow-lg transition-all duration-300 overflow-hidden">
        <button
          onClick={() => dispatch({ type: "TOGGLE_DOCK", data: { dock: "left" } })}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-secondary/20 transition-colors"
          aria-label={isOpen ? t("Collapse timeline") : t("Expand timeline")}
        >
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground flex-1">{t("Timeline")}</h3>
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
              <div
                ref={scrollRef}
                className="overflow-auto max-h-[55vh] px-2 py-2"
                style={{ maxWidth: "380px" }}
                onWheel={(e) => {
                  const container = e.currentTarget
                  if (e.deltaX !== 0) container.scrollLeft += e.deltaX
                  if (e.deltaY !== 0) container.scrollTop += e.deltaY
                }}
              >
                <div className="min-w-full w-max">
                  <UnifiedDAGVisualization graph={activeGraph} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
