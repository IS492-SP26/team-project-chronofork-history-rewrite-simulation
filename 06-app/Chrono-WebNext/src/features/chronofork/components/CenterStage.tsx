"use client"

import { useEffect, useRef, useState } from "react"
import { DEFAULT_WS_URL } from "@features/chronofork/api/useWebSocket"
import { useChronoFork } from "@features/chronofork/state/context"
import { useI18n } from "@features/chronofork/i18n"
import { phaseColor, phaseTone } from "@features/chronofork/phaseColor"
import { roles, scenes, dialogueBeats, mockDivergenceAnalysis, mockReportData, episode, timelineNodes, type DialogueBeat, type Role } from "@features/chronofork/mock/mockData"
import type { RunState, ServerConfig, ServerGraphData, ServerGraphNode, TimelineEpilogue } from "@features/chronofork/state/types"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Clock, Play, Send, Zap, Loader2, Eye, Users, BookOpen, X, ArrowLeft, Download, GitFork, Target, Wifi, Database, FileCheck, AlertTriangle, ChevronDown, ChevronUp, Edit3, UserCheck, Bot } from "lucide-react"
import { toast } from "sonner"

/* ── helpers ── */
/* ── Shared speaker color assignment (identical to TacticalHUDDock) ── */
const SPEAKER_COLORS = [
  "#0284c7", "#ea580c", "#059669", "#4f46e5",
  "#db2777", "#e11d48", "#7c3aed", "#d97706",
]
function getSpeakerColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length]
}

function getFaction(role: Role): "us" | "soviet" | "neutral" {
  if (["jfk", "rfk", "mcnamara", "lemay"].includes(role.id)) return "us"
  if (["khrushchev"].includes(role.id)) return "soviet"

  const name = `${role.name ?? ""}`
  const title = `${role.title ?? ""}`
  const hint = `${name} ${title}`

  if (hint.includes("肯尼迪") || hint.includes("美国") || hint.includes("U.S") || hint.includes("US")) return "us"
  if (hint.includes("赫鲁晓夫") || hint.includes("苏联") || hint.includes("Soviet") || hint.includes("USSR")) return "soviet"

  return "neutral"
}

function factionStyle(f: "us" | "soviet" | "neutral") {
  if (f === "us") return { ring: "var(--faction-us)", bg: "var(--faction-us-bg)", glow: "0 0 12px 2px color-mix(in oklch, var(--faction-us) 25%, transparent)" }
  if (f === "soviet") return { ring: "var(--faction-soviet)", bg: "var(--faction-soviet-bg)", glow: "0 0 12px 2px color-mix(in oklch, var(--faction-soviet) 25%, transparent)" }
  return { ring: "var(--muted-foreground)", bg: "var(--secondary)", glow: "none" }
}

function EmotionDot({ emotion }: { emotion: DialogueBeat["emotion"] }) {
  const colors: Record<string, string> = {
    calm: "var(--chrono-teal)", concerned: "var(--chrono-amber)", angry: "var(--chrono-red)",
    resolute: "var(--chrono-teal-dim)", tense: "var(--chrono-amber-dim)",
  }
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[emotion] ?? colors.calm }} aria-label={`Emotion: ${emotion}`} />
}

type StageRole = Role & {
  avatarEmoji?: string
}

type DialogueDisplayMode = "auto" | "manual"

type StorylineStage = ServerConfig["storyline"][number]

function isCanonicalServerNodeId(id: string): boolean {
  const suffix = id.split(".").pop()
  if (!suffix) return true
  const numericSuffix = Number(suffix)
  return Number.isNaN(numericSuffix) || numericSuffix === 0
}

function normalizeConfigText(text?: string | null): string {
  return (text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

function getOrderedCanonicalGraphNodes(graph: ServerGraphData): ServerGraphNode[] {
  const canonicalNodes = graph.nodes.filter((node) => isCanonicalServerNodeId(node.id))
  const canonicalIds = new Set(canonicalNodes.map((node) => node.id))
  const byId = new Map(canonicalNodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, string[]>()
  const indegree = new Map(canonicalNodes.map((node) => [node.id, 0]))

  for (const [from, to] of graph.edges) {
    if (!canonicalIds.has(from) || !canonicalIds.has(to)) continue
    outgoing.set(from, [...(outgoing.get(from) ?? []), to])
    indegree.set(to, (indegree.get(to) ?? 0) + 1)
  }

  const visualOrder = (a: string, b: string) => {
    const aPos = graph.pos[a] ?? [0, 0]
    const bPos = graph.pos[b] ?? [0, 0]
    const yDelta = Math.abs(aPos[1] - bPos[1]) > 0.001 ? aPos[1] - bPos[1] : 0
    return yDelta || aPos[0] - bPos[0] || a.localeCompare(b)
  }

  const queue = canonicalNodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
    .sort(visualOrder)
  const ordered: ServerGraphNode[] = []
  const seen = new Set<string>()

  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    const node = byId.get(id)
    if (!node) continue
    seen.add(id)
    ordered.push(node)

    for (const nextId of (outgoing.get(id) ?? []).sort(visualOrder)) {
      indegree.set(nextId, Math.max(0, (indegree.get(nextId) ?? 0) - 1))
      if ((indegree.get(nextId) ?? 0) === 0) queue.push(nextId)
    }
    queue.sort(visualOrder)
  }

  for (const node of canonicalNodes.sort((a, b) => visualOrder(a.id, b.id))) {
    if (!seen.has(node.id)) ordered.push(node)
  }

  return ordered
}

function resolveStorylineNodeId(state: RunState, decisionStageIndex: number): string | null {
  const configStage = state.serverConfig?.storyline[decisionStageIndex]
  const graph = state.serverGraph

  if (graph) {
    const canonicalNodes = graph.nodes.filter((node) => isCanonicalServerNodeId(node.id))
    const title = normalizeConfigText(configStage?.title)
    const decision = normalizeConfigText(configStage?.decision)
    const matchedNode = canonicalNodes.find((node) => {
      const haystack = normalizeConfigText(`${node.label_id} ${node.hover_title} ${node.hover_desc}`)
      return (title && haystack.includes(title)) || (decision && haystack.includes(decision))
    })
    if (matchedNode) return matchedNode.id

    const orderedCanonicalNodes = getOrderedCanonicalGraphNodes(graph)
    if (orderedCanonicalNodes[decisionStageIndex]) return orderedCanonicalNodes[decisionStageIndex].id

    const pathNodeId = graph.current_path?.[decisionStageIndex]
    if (pathNodeId && graph.nodes.some((node) => node.id === pathNodeId)) return pathNodeId

    return null
  }

  return timelineNodes[decisionStageIndex]?.id ?? null
}

function getRoleAvatarEmoji(role: StageRole): string {
  if (role.avatarEmoji) return role.avatarEmoji

  const emojiMap: Record<string, string> = {
    jfk: "🦅",
    rfk: "⚖️",
    mcnamara: "📊",
    lemay: "🛩️",
    khrushchev: "🌾",
    facilitator: "🎙️",
  }

  return emojiMap[role.id] ?? "👤"
}

function Avatar({ role, isSpeaking, isListening, latestEmotion }: { role: StageRole; isSpeaking: boolean; isListening?: boolean; latestEmotion?: DialogueBeat["emotion"] }) {
  const { t } = useI18n()
  const ringColor = getSpeakerColor(role.name)
  const active = isSpeaking || !!isListening
  const displayName = role.shortName || role.name
  const displayTitle = role.title
  const avatarEmoji = getRoleAvatarEmoji(role)
  return (
    <div
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${
        isSpeaking ? "scale-110 relative z-10" : isListening ? "scale-100" : "scale-90"
      }`}
      style={{ opacity: active ? 1 : 0.28, filter: isSpeaking ? "none" : undefined }}
    >
      <div
        className={`w-24 h-24 rounded-full flex flex-col items-center justify-center px-3 py-3 text-center transition-all overflow-hidden ${isSpeaking ? "animate-breathe" : ""}`}
        style={{
          backgroundColor: isSpeaking
            ? `color-mix(in oklch, ${ringColor} 15%, var(--card))`
            : isListening
            ? "color-mix(in oklch, var(--chrono-amber) 12%, var(--card))"
            : "var(--secondary)",
          color: isSpeaking ? ringColor : isListening ? "var(--chrono-amber)" : "var(--muted-foreground)",
          border: isSpeaking
            ? `3px solid ${ringColor}`
            : isListening
            ? "2px dashed var(--chrono-amber)"
            : "2px solid transparent",
          boxShadow: isSpeaking
            ? `0 0 20px 5px color-mix(in oklch, ${ringColor} 35%, transparent)`
            : isListening
            ? "0 0 12px 3px color-mix(in oklch, var(--chrono-amber) 28%, transparent)"
            : "none",
        }}
      >
        <span className="text-[15px] leading-none mb-3">{avatarEmoji}</span>
        <span
          className="max-w-full px-1 text-[17px] font-black tracking-[-0.02em] leading-[1.02] text-center overflow-hidden"
          style={{ color: isSpeaking ? ringColor : isListening ? "var(--chrono-amber)" : "var(--foreground)" }}
          title={displayName}
        >
          <span
            className="block overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {displayName}
          </span>
        </span>
      </div>
      <span
        className="max-w-[108px] px-1 text-[11px] font-medium text-center leading-[1.2] text-muted-foreground overflow-hidden"
        style={{ color: isSpeaking ? ringColor : isListening ? "var(--chrono-amber)" : "var(--muted-foreground)" }}
        title={displayTitle}
      >
        <span
          className="block overflow-hidden"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {displayTitle}
        </span>
      </span>
      {isSpeaking && (
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white flex items-center gap-0.5 whitespace-nowrap"
          style={{ backgroundColor: ringColor }}
        >
          🗣️ {t("Speaking")}
        </span>
      )}
      {!isSpeaking && isListening && (
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap"
          style={{ backgroundColor: "var(--chrono-amber)", color: "var(--background)" }}
        >
          👂 {t("Listening")}
        </span>
      )}
      {latestEmotion && active && <EmotionDot emotion={latestEmotion} />}
    </div>
  )
}

function DialogueDisplayModeControls({
  mode,
  setMode,
  onManualNext,
  manualWaiting,
  phaseColor: pc,
  tone,
}: {
  mode: DialogueDisplayMode
  setMode: (mode: DialogueDisplayMode) => void
  onManualNext: () => void
  manualWaiting: boolean
  phaseColor: string
  tone?: ReturnType<typeof phaseTone>
}) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t("Dialogue Display")}</span>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-border/40 p-0.5">
          <button
            onClick={() => setMode("auto")}
            className={`px-2.5 h-6 rounded-full text-[11px] font-semibold transition-colors ${mode === "auto" ? "text-primary-foreground" : "text-muted-foreground"}`}
            style={mode === "auto" ? { backgroundColor: pc } : undefined}
          >
            {t("Auto")}
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`px-2.5 h-6 rounded-full text-[11px] font-semibold transition-colors ${mode === "manual" ? "text-primary-foreground" : "text-muted-foreground"}`}
            style={mode === "manual" ? { backgroundColor: pc } : undefined}
          >
            {t("Manual")}
          </button>
        </div>
      </div>
      {mode === "manual" && (
        <Button
          size="default"
          tone={tone}
          variant={manualWaiting ? "outline" : "default"}
          className={`w-full h-9 text-sm font-semibold gap-2 ${manualWaiting ? "border-border/40 text-muted-foreground" : "text-primary-foreground"}`}
          onClick={onManualNext}
          disabled={manualWaiting}
        >
          {manualWaiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {manualWaiting ? t("Waiting for next dialogue...") : t("Show Next Dialogue")}
        </Button>
      )}
    </div>
  )
}

/* ── Segmented observe progress bar ── */
function SegmentedProgressBar({ phaseColor: pc }: { phaseColor: string }) {
  const { state, ws } = useChronoFork()
  const isWS = state.connectionStatus === "connected"
  const transcriptTypes = new Set(["dialogue", "user_chat", "user_diverge"])
  const configuredNodeCount = state.serverConfig?.storyline?.length ?? 0
  const graphNodeCount = (state.serverGraph?.current_path ?? []).filter((id) => id !== "start" && id !== "end").length
  const totalNodes = Math.max(configuredNodeCount, graphNodeCount, 1)
  const totalSegments = Math.max(totalNodes, 1)

  // Node updates may include initial start -> first_node; this does not advance segment baseline.
  const nodeUpdates = state.chatHistory.filter((m) => m.type === "node_update")
  const transitionCount = nodeUpdates.filter((m) => m.meta?.from_id !== "start").length
  const currentSegmentIdx = Math.min(transitionCount, totalSegments - 1)
  const segStart = currentSegmentIdx / totalSegments
  const segEnd = (currentSegmentIdx + 1) / totalSegments

  // Count transcripts already displayed in current segment.
  let lastNodeUpdateIdx = -1
  for (let i = state.chatHistory.length - 1; i >= 0; i--) {
    if (state.chatHistory[i].type === "node_update") {
      lastNodeUpdateIdx = i
      break
    }
  }
  const shownTranscripts = state.chatHistory
    .slice(lastNodeUpdateIdx + 1)
    .filter((m) => transcriptTypes.has(m.type)).length

  // Fine-grained progress is available only after the queue contains the next node_update.
  let totalSegmentTranscripts = 0
  let hasFineProgress = false

  if (isWS) {
    const queue = ws.getQueueSnapshot()
    const nextNodeUpdateIdx = queue.findIndex((m) => m.type === "node_update")

    if (nextNodeUpdateIdx >= 0) {
      let queuedTranscriptBlocks = 0
      let activeStreamKey: string | null = null

      for (let i = 0; i < nextNodeUpdateIdx; i++) {
        const msg = queue[i]
        if (msg.type !== "stream_token") continue

        const agent = typeof msg.data?.agent === "string" ? msg.data.agent : null
        const target = typeof msg.data?.target === "string" ? msg.data.target : null
        const streamKey = agent && target ? `${agent}::${target}` : null

        if (!streamKey) continue
        if (streamKey !== activeStreamKey) {
          queuedTranscriptBlocks += 1
          activeStreamKey = streamKey
        }
      }

      totalSegmentTranscripts = shownTranscripts + queuedTranscriptBlocks
      hasFineProgress = totalSegmentTranscripts > 0
    }
  }

  const fineProgressRatio = hasFineProgress
    ? Math.min(shownTranscripts / totalSegmentTranscripts, 1)
    : 0

  const fillPct = isWS
    ? hasFineProgress
      ? segStart + fineProgressRatio * (segEnd - segStart)
      : segStart
    : state.observeProgress / 100

  const safeFillPct = Math.max(0, Math.min(fillPct, 1))
  const currentNodeDisplay = Math.min(transitionCount + 1, totalNodes)

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        {/* Segment dividers */}
        {Array.from({ length: totalSegments - 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px z-10"
            style={{
              left: `${((i + 1) / totalSegments) * 100}%`,
              backgroundColor: "color-mix(in oklch, var(--background) 60%, transparent)",
            }}
          />
        ))}
        {/* Fill */}
        <div
          className="absolute left-0 top-0 h-full transition-all duration-500"
          style={{ width: `${safeFillPct * 100}%`, backgroundColor: pc }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>{Math.round(safeFillPct * 100)}%</span>
        <span>{currentNodeDisplay} / {totalNodes}</span>
      </div>
    </div>
  )
}

/* ── Facilitator Strip -- standard glass card, constrained width ── */
function FacilitatorStrip({
  text,
  interaction,
}: {
  text?: string
  interaction?: { isSpeaking: boolean; counterpart?: string }
}) {
  const { t } = useI18n()
  const isSpeaking = interaction?.isSpeaking ?? false
  const toneColor = isSpeaking ? "var(--chrono-violet)" : "var(--chrono-amber)"
  return (
    <div className="flex justify-center px-4 py-1.5 shrink-0">
      <div
        className="glass-panel max-w-lg w-full rounded-xl px-4 py-2.5 border"
        style={{
          borderColor: interaction ? toneColor : "color-mix(in oklch, var(--border) 70%, transparent)",
          boxShadow: interaction
            ? `0 0 14px 2px color-mix(in oklch, ${toneColor} 25%, transparent)`
            : "none",
        }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "color-mix(in oklch, var(--chrono-violet) 15%, transparent)" }}>
            <Eye className="w-3 h-3" style={{ color: "var(--chrono-violet)" }} />
          </div>
          <span className="text-xs font-mono uppercase tracking-wider font-bold" style={{ color: "var(--chrono-violet)" }}>{t("Facilitator")}</span>
          {interaction && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ backgroundColor: toneColor, color: "var(--background)" }}
            >
              {isSpeaking ? `🗣️ ${t("Speaking")}` : `👂 ${t("Listening")}`}
            </span>
          )}
          {interaction?.counterpart && (
            <span className="text-[10px] text-muted-foreground font-mono truncate">{interaction.counterpart}</span>
          )}
        </div>
        {text && <p className="text-sm text-foreground/80 italic leading-relaxed">{text}</p>}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   PRE-START CONNECTION OVERLAY
   ════════════════════════════════════════════════════════════════ */

function PreStartOverlay() {
  const { state, connectToServer, useMockData } = useChronoFork()
  const { t } = useI18n()
  const [wsUrl] = useState(DEFAULT_WS_URL)
  const isConnecting = state.connectionStatus === "connecting"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* Connection card */}
      <div className="relative z-10 glass-panel-heavy rounded-2xl px-6 py-6 max-w-sm w-full mx-4 shadow-2xl border-t-2"
        style={{ borderTopColor: "var(--chrono-teal)" }}>
        <div className="flex flex-col items-center gap-5">
          {/* Logo */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--chrono-teal-bg)", border: "2px solid var(--chrono-teal)" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <circle cx="14" cy="14" r="12" stroke="var(--chrono-teal)" strokeWidth="1.5" fill="none" opacity="0.6" />
              <path d="M14 6v8l4 4" stroke="var(--chrono-teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 14l-3 5" stroke="var(--chrono-amber)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
            </svg>
          </div>

          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground text-balance">{t("ChronoFork Console")}</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("Connect to a running backend server or explore with mock data.")}</p>
          </div>

          {/* URL input */}
          <div className="w-full">
            <label className="text-[10px] font-mono tracking-wider text-muted-foreground mb-1 block">{t("Server Address")}: {wsUrl}</label>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2 w-full">
            <Button
              size="default"
              tone="observe"
              className="w-full gap-2 text-sm font-semibold text-primary-foreground"
              onClick={() => connectToServer(wsUrl)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("Connecting...")}
                </>
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  {t("Connect to Server")}
                </>
              )}
            </Button>
            <Button
              size="default"
              variant="outline"
              tone="observe"
              className="w-full gap-2 text-sm border-border/40 text-muted-foreground hover:text-foreground"
              onClick={useMockData}
              disabled={isConnecting}
            >
              <Database className="w-5 h-5" />
              {t("Use Mock Data")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
            {t("Mock mode uses local data for all interactions.")}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════
   INTERACTION CONSOLE CARDS -- scaled up text/components
   ════════════════════════════════════════════════════════════════ */

function InteractionIdle() {
  const { state, dispatch, ws } = useChronoFork()
  const { t } = useI18n()
  const isMock = state.connectionStatus === "mock"
  const isWS = state.connectionStatus === "connected"
  const currentScene = scenes[0]
  const tone = phaseTone(state.phase)

  const handleStart = () => {
    dispatch({ type: "START_OBSERVE" })
    // If connected to real server, send start_experience
    if (isWS) {
      ws.send("start_experience", {})
    }
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="text-center">
        <h2 className="text-lg font-bold text-foreground text-balance">
          {state.serverConfig?.episode?.emoji ?? ""} {state.serverConfig?.episode?.title ?? episode.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-md mx-auto">
          {state.serverConfig?.episode?.desc ?? episode.description}
        </p>
      </div>
      {currentScene && isMock && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs font-mono gap-1 border-border/30 text-muted-foreground bg-card/50 px-2.5 py-1">
            <Clock className="w-3 h-3" /> {currentScene.time}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono gap-1 border-border/30 text-muted-foreground bg-card/50 px-2.5 py-1">
            <MapPin className="w-3 h-3" /> {currentScene.location}
          </Badge>
        </div>
      )}
      {/* Show cast avatars from server config */}
      {isWS && state.serverConfig?.cast && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {state.serverConfig.cast.slice(0, 5).map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg bg-secondary border border-border/30">
                {c.avatar}
              </div>
              <span className="text-[12px] font-mono text-muted-foreground truncate max-w-[60px]">{c.name.split(" ").pop()}</span>
            </div>
          ))}
        </div>
      )}
      {/* User role badge from server config */}
      {/* {isWS && state.serverConfig?.user_role && (
        <div className="flex justify-center">
          <Badge variant="outline" className="text-sm font-mono gap-1.5 px-3 py-1.5" style={{ borderColor: "var(--chrono-amber)", color: "var(--chrono-amber)" }}>
            <Target className="w-3.5 h-3.5" />
            {t("Role:")} {state.serverConfig.user_role.name} ({state.serverConfig.user_role.title})
          </Badge>
        </div>
      )} */}
      <div className="flex items-center justify-center gap-2.5">
        <Button
          size="default"
          tone={tone}
          className="gap-2 text-sm font-semibold text-primary-foreground animate-glow-cta"
          onClick={handleStart}
        >
          <Play className="w-4 h-4" />
          {t("Start Observation")}
        </Button>
        {isMock && (
          <Button size="default" variant="outline" tone={tone} className="gap-2 text-sm border-border/40 text-muted-foreground">
            {t("Load Different Episode")}
          </Button>
        )}
      </div>
    </div>
  )
}

function InteractionObserving({
  dialogueMode,
  setDialogueMode,
  onManualNext,
  manualWaiting,
  showDialogueControls,
}: {
  dialogueMode: DialogueDisplayMode
  setDialogueMode: (mode: DialogueDisplayMode) => void
  onManualNext: () => void
  manualWaiting: boolean
  showDialogueControls: boolean
}) {
  const { state } = useChronoFork()
  const { t } = useI18n()
  const [paused] = useState(false)
  const pc = phaseColor(state.phase)
  const tone = phaseTone(state.phase)
  /* Segmented progress (replaces text description) */

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4" style={{ color: pc }} />
        <span className="text-sm font-semibold text-foreground">{t("Observation Mode")}</span>
      </div>
      <SegmentedProgressBar phaseColor={pc} />
      {/* <div className="flex items-center gap-1.5 flex-wrap">
        ...commented controls...
      </div> */}
      {showDialogueControls && (
        <DialogueDisplayModeControls
          mode={dialogueMode}
          setMode={setDialogueMode}
          onManualNext={onManualNext}
          manualWaiting={manualWaiting}
          phaseColor={pc}
          tone={tone}
        />
      )}
    </div>
  )
}

function InteractionBacktrackSetup() {
  const { state, dispatch, ws } = useChronoFork()
  const { t } = useI18n()
  const [pathAutoSelectDismissed, setPathAutoSelectDismissed] = useState(false)
  const isWS = state.connectionStatus === "connected"
  const storyline = state.serverConfig?.storyline ?? []
  const castData = state.serverConfig?.cast ?? []
  const playableRoles = roles.filter((r) => r.id !== "facilitator")
  const hasNode = !!state.selectedNodeId
  const pc = phaseColor(state.phase)
  const tone = phaseTone(state.phase)
  const selectedNodeLabel = state.selectedNodeId
    ? (state.serverGraph?.nodes.find((node) => node.id === state.selectedNodeId)?.label_id
      ?? timelineNodes.find((node) => node.id === state.selectedNodeId)?.label
      ?? state.selectedNodeId)
    : null
  const selectedNodeTitle = selectedNodeLabel ? t("Selected Node: ") + selectedNodeLabel : null
  const pathOptions = storyline
    .map((stage: StorylineStage, index: number) => {
      if (!stage.choice || stage.choice === "None") return null
      const decisionStageIndex = index - 1
      if (decisionStageIndex < 0) return null
      const decisionStage = storyline[decisionStageIndex]
      if (!decisionStage?.decision || decisionStage.decision === "None") return null
      if (!decisionStage.decision_maker || decisionStage.decision_maker === "None") return null
      return {
        stage,
        index,
        decisionStageIndex,
        nodeId: resolveStorylineNodeId(state, decisionStageIndex),
        roleName: decisionStage.decision_maker,
        decision: decisionStage.decision,
      }
    })
    .filter((option): option is NonNullable<typeof option> => option !== null)
  const firstPathOption = pathOptions[0]

  useEffect(() => {
    if (!isWS || pathAutoSelectDismissed) return
    if (!["observe_complete", "intervene_idle"].includes(state.phase)) return
    if (state.selectedNodeId || state.activeRoleName) return
    if (!firstPathOption?.nodeId || !firstPathOption.roleName) return

    dispatch({ type: "SELECT_NODE", data: { nodeId: firstPathOption.nodeId } })
    dispatch({ type: "SET_ROLE", data: { roleId: firstPathOption.roleName, roleName: firstPathOption.roleName } })
  }, [dispatch, firstPathOption?.nodeId, firstPathOption?.roleName, isWS, pathAutoSelectDismissed, state.activeRoleName, state.phase, state.selectedNodeId])

  const handleBacktrack = () => {
    if (!state.selectedNodeId) return
    if (isWS) {
      const perspectiveAgent = state.activeRoleName ?? (state.activeRoleId ? roles.find((r) => r.id === state.activeRoleId)?.name ?? "" : "")
      ws.send("backtrack_to", {
        target_id: state.selectedNodeId,
        perspective_agent: perspectiveAgent,
      })
      toast.success(t("Backtrack request sent..."))
    } else {
      dispatch({ type: "BACKTRACK_AND_INTERVENE", data: { nodeId: state.selectedNodeId } })
      toast.success(t("Backtracking..."))
    }
  }

  // ── Connected mode: storyline-driven role assignment ──
  if (isWS && storyline.length > 0) {
    // A stage's choice is the canonical result of the previous stage's decision.
    const selectedCast = state.activeRoleName
      ? castData.find((c) => c.name === state.activeRoleName)
      : null
    const hasRole = !!state.activeRoleName

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4" style={{ color: pc }} />
          <span className="text-sm font-semibold text-foreground">{t("Choose Your Path")}</span>
        </div>

        {/* Branch choice cards */}
        <div className="flex flex-col gap-2">
          {pathOptions.map((option) => {
            const { stage, decisionStageIndex, nodeId, roleName, decision } = option
            const isSelected = !!nodeId && state.selectedNodeId === nodeId && state.activeRoleName === roleName
            const cast = castData.find((c) => c.name === roleName)
            const nodeLabel = nodeId
              ? (state.serverGraph?.nodes.find((node) => node.id === nodeId)?.label_id
                ?? timelineNodes.find((node) => node.id === nodeId)?.label
                ?? nodeId)
              : null
            return (
              <button
                key={`${option.index}-${stage.choice}`}
                onClick={() => {
                  if (isSelected) {
                    setPathAutoSelectDismissed(true)
                    dispatch({ type: "SELECT_NODE", data: { nodeId: null } })
                    dispatch({ type: "SET_ROLE", data: { roleId: null, roleName: null } })
                    return
                  }
                  setPathAutoSelectDismissed(false)
                  if (nodeId) dispatch({ type: "SELECT_NODE", data: { nodeId } })
                  if (roleName) dispatch({ type: "SET_ROLE", data: { roleId: roleName, roleName } })
                }}
                className="text-left rounded-xl border transition-all duration-200 p-3"
                style={{
                  borderColor: isSelected ? pc : "var(--border)",
                  backgroundColor: isSelected
                    ? `color-mix(in oklch, ${pc} 14%, var(--card))`
                    : "var(--secondary)",
                  boxShadow: isSelected ? `0 0 0 1px ${pc}, 0 0 18px color-mix(in oklch, ${pc} 28%, transparent)` : "none",
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{decision}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                      {t("Canonical choice:")}{" "}
                      <span className="font-medium text-foreground">{stage.choice}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {cast?.avatar && <span className="text-sm leading-none">{cast.avatar}</span>}
                      {roleName && (
                        <span className="text-xs text-muted-foreground">
                          {t("Play as")}{" "}
                          <span className="font-semibold" style={{ color: isSelected ? pc : "var(--foreground)" }}>
                            {roleName}
                          </span>
                        </span>
                      )}
                      {nodeLabel && (
                        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: isSelected ? pc : "var(--muted-foreground)" }}>
                          {t("Node")} {decisionStageIndex + 1}: {nodeLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: pc }}
                    >
                      <span className="text-[9px] text-white font-black leading-none">✓</span>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected role reveal */}
        {selectedCast && (
          <motion.div
            key={selectedCast.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl p-3 border"
            style={{
              borderColor: pc,
              backgroundColor: `color-mix(in oklch, ${pc} 7%, var(--card))`,
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-2xl leading-none">{selectedCast.avatar}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight" style={{ color: pc }}>{selectedCast.name}</p>
                <p className="text-xs text-muted-foreground leading-tight">{selectedCast.title}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{selectedCast.desc}</p>
          </motion.div>
        )}
        {!selectedCast && (
          <motion.div
            key="manual-backtrack-setup"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl p-3 border border-border/50 bg-secondary/30"
          >
            <p className="text-sm font-semibold text-foreground leading-snug">{t("Manual backtrack")}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              {t("Select a node from the Timeline panel, then choose who you want to play.")}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {castData.map((cast) => {
                const isActive = state.activeRoleName === cast.name
                return (
                  <button
                    key={cast.name}
                    onClick={() => dispatch({ type: "SET_ROLE", data: { roleId: cast.name, roleName: cast.name } })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border"
                    style={{
                      backgroundColor: isActive ? `color-mix(in oklch, ${pc} 14%, var(--card))` : "var(--card)",
                      borderColor: isActive ? pc : "var(--border)",
                      color: isActive ? pc : "var(--muted-foreground)",
                    }}
                  >
                    <span className="text-sm leading-none">{cast.avatar}</span>
                    {cast.name}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        <Button
          size="default"
          tone={tone}
          className="w-full text-sm h-9 gap-2 font-semibold text-primary-foreground"
          disabled={!hasNode || !hasRole}
          onClick={handleBacktrack}
        >
          <GitFork className="w-4 h-4" />
          {t("Backtrack to Node")}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          {selectedNodeTitle ?? t("Select a node from the Timeline panel.")}
        </p>
      </div>
    )
  }

  // ── Mock / fallback mode: manual role picker ──
  const hasRole = !!state.activeRoleId
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4" style={{ color: pc }} />
        <span className="text-sm font-semibold text-foreground">{t("Backtrack Setup")}</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t("Select a node (left panel) and a character below to backtrack.")}
      </p>
      <div className="flex flex-wrap gap-2">
        {playableRoles.map((r) => {
          const isActive = state.activeRoleId === r.id
          const f = getFaction(r)
          const fs = factionStyle(f)
          return (
            <button
              key={r.id}
              onClick={() => dispatch({ type: "SET_ROLE", data: { roleId: r.id } })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
              style={{
                backgroundColor: isActive ? `color-mix(in oklch, ${fs.ring} 15%, transparent)` : "var(--secondary)",
                borderColor: isActive ? fs.ring : "transparent",
                color: isActive ? fs.ring : "var(--muted-foreground)",
              }}
            >
              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: isActive ? fs.ring : "var(--muted)" }} />
              {r.shortName}
            </button>
          )
        })}
      </div>
      <Button
        size="default"
        tone={tone}
        className="w-full text-sm h-9 gap-2 font-semibold text-primary-foreground"
        disabled={!hasNode || !hasRole}
        onClick={handleBacktrack}
      >
        {t("Backtrack to Node")}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        {selectedNodeTitle ?? t("Select a node from the Timeline panel.")}
      </p>
    </div>
  )
}

const TIP_INTENT_COLORS: Record<string, string> = {
  "Escalation": "var(--chrono-red)",
  "De-escalation": "var(--chrono-teal)",
  "Alliance Building": "var(--chrono-amber)",
  "Info Gathering": "#8b5cf6",
}

function InteractionComposer({
  dialogueMode,
  setDialogueMode,
  onManualNext,
  manualWaiting,
  showDialogueControls,
}: {
  dialogueMode: DialogueDisplayMode
  setDialogueMode: (mode: DialogueDisplayMode) => void
  onManualNext: () => void
  manualWaiting: boolean
  showDialogueControls: boolean
}) {
  const { state, dispatch, ws } = useChronoFork()
  const { t } = useI18n()
  const isWS = state.connectionStatus === "connected"
  const [text, setText] = useState("")
  const [targetId, setTargetId] = useState<string | null>(null)
  const [currentTipIdx, setCurrentTipIdx] = useState(0)
  const [tipPanelVisible, setTipPanelVisible] = useState(false)
  const [tipCollapsed, setTipCollapsed] = useState(false)
  const [manualExpanded, setManualExpanded] = useState(false)
  const lastTipRequestKeyRef = useRef<string | null>(null)
  const pendingAutoConfirmRef = useRef(false)

  const activeRole = state.activeRoleId ? roles.find((r) => r.id === state.activeRoleId) : null
  const selectedRoleName = state.activeRoleName ?? activeRole?.name ?? activeRole?.shortName
  const roleName = selectedRoleName ?? state.serverConfig?.user_role?.name ?? "You"
  const roleTitle = selectedRoleName ? activeRole?.title : state.serverConfig?.user_role?.title
  const targetRoles = roles.filter((r) => r.id !== "facilitator" && r.id !== state.activeRoleId)
  const serverTargets = (state.serverConfig?.cast ?? []).filter((c) => c.name !== roleName)
  const pc = phaseColor(state.phase)
  const tone = phaseTone(state.phase)

  const tipOptions = state.tipData?.options ?? []
  const AUTO_AGENT_IDX = tipOptions.length
  const tipTotal = tipOptions.length + 1
  const isAutoAgentTip = currentTipIdx === AUTO_AGENT_IDX
  const currentTip = isAutoAgentTip ? null : tipOptions[currentTipIdx]

  useEffect(() => {
    if (state.tipData) setCurrentTipIdx(0)
  }, [state.tipData])


  useEffect(() => {
    if (state.inputRequest?.from_name) setTargetId(state.inputRequest.from_name)
  }, [state.inputRequest?.from_name])

  // Auto-request tips each time a new input_request arrives
  useEffect(() => {
    if (!isWS) return
    if (!state.inputRequest) {
      lastTipRequestKeyRef.current = null
      return
    }
    const key = `${state.inputRequest.from_name}::${state.inputRequest.msg}`
    if (key === lastTipRequestKeyRef.current) return
    lastTipRequestKeyRef.current = key
    setTipPanelVisible(true)
    setTipCollapsed(false)
    dispatch({ type: "SET_TIP_LOADING", data: { loading: true } })
    ws.send("request_tip", {})
  }, [isWS, state.inputRequest, dispatch, ws])

  const handleContinueAgent = () => {
    ws.send("continue_agent", {})
    dispatch({ type: "SET_AGENT_CONTINUE_REQUEST", data: null })
  }

  // After sending a tip, auto-confirm the next agent_continue_request
  useEffect(() => {
    if (!state.agentContinueRequest || !pendingAutoConfirmRef.current) return
    pendingAutoConfirmRef.current = false
    handleContinueAgent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.agentContinueRequest])

  const handleTakeover = () => {
    ws.send("takeover", {})
    dispatch({ type: "SET_AGENT_CONTINUE_REQUEST", data: null })
    dispatch({ type: "SET_AUTO_PROXY", data: { enabled: false } })
  }

  const handleEnableAutoProxy = () => {
    ws.send("set_auto_proxy", { enabled: true })
    dispatch({ type: "SET_AUTO_PROXY", data: { enabled: true } })
    dispatch({ type: "SET_INPUT_REQUEST", data: null })
    setTipPanelVisible(false)
  }

  const handleSendTip = () => {
    if (!currentTip) return
    ws.send("user_message", { content: currentTip.example_response, target: currentTip.target_agent })
    dispatch({ type: "SEND_CHAT", data: { text: currentTip.example_response, speakerName: roleName, targetName: currentTip.target_agent } })
    dispatch({ type: "SET_INPUT_REQUEST", data: null })
    dispatch({ type: "SET_AGENT_CONTINUE_REQUEST", data: null })
    pendingAutoConfirmRef.current = true
    setTipPanelVisible(false)
  }

  const handleSend = () => {
    if (!text.trim()) return
    if (isWS) {
      const targetName = targetId ?? ""
      if (!targetName) { toast.error(t("Select a recipient before sending.")); return }
      ws.send("user_message", { content: text.trim(), target: targetName })
      dispatch({ type: "SEND_CHAT", data: { text: text.trim(), speakerName: roleName, targetName } })
      dispatch({ type: "SET_INPUT_REQUEST", data: null })
      dispatch({ type: "SET_AGENT_CONTINUE_REQUEST", data: null })
      setTipPanelVisible(false)
      setText("")
      return
    }
    if (text.trim().startsWith("DIVERGE:")) {
      dispatch({ type: "SEND_DIVERGE", data: { text: text.trim(), speakerName: roleName } })
      toast.success(t("Intervention committed. Computing divergence..."))
      setTimeout(() => dispatch({ type: "DIVERGENCE_COMPLETE" }), 1500)
      setTimeout(() => { dispatch({ type: "ANALYSIS_COMPLETE", data: { analysis: { available: true, plausibility: mockDivergenceAnalysis.plausibility, drivers: mockDivergenceAnalysis.drivers, constraints: mockDivergenceAnalysis.constraints, outcomes: mockDivergenceAnalysis.outcomes, causalChain: mockDivergenceAnalysis.causalChain } } }) }, 4000)
    } else {
      dispatch({ type: "SEND_CHAT", data: { text: text.trim(), speakerName: roleName } })
    }
  }

  const showCheckPrevious = state.ui.analysisViewed && !state.ui.showAnalysis && (state.analysis.available || !!state.analysisHtml)
  const intentColor = currentTip ? (TIP_INTENT_COLORS[currentTip.intent_type] ?? "var(--muted-foreground)") : pc

  return (
    <div className="flex flex-col gap-2">
      {/* Status strip */}
      {isWS && state.inputRequest && (
        <div className="rounded-lg px-2.5 py-1.5 text-xs italic text-foreground/80"
          style={{ backgroundColor: "color-mix(in oklch, var(--chrono-amber) 8%, transparent)", borderLeft: "3px solid var(--chrono-amber)" }}>
          {state.inputRequest.from_name
            ? <><span className="font-bold not-italic">{state.inputRequest.from_name}</span>{t(" is talking to you.")} {t("Respond or select another character.")}</>
            : state.inputRequest.msg}
        </div>
      )}

      {/* ── Stage 2: agent continue request ── */}
      {isWS && state.stage === 2 && state.agentContinueRequest && !state.inputRequest && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg px-2.5 py-1.5 text-xs text-foreground/70 flex items-center gap-1.5"
            style={{ backgroundColor: "color-mix(in oklch, var(--secondary) 60%, transparent)" }}>
            {state.autoProxy && (
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: pc }} />
            )}
            <span className="font-bold text-foreground/90">{state.agentContinueRequest.agent}</span>
            {t(" is ready to speak.")}
          </div>
          <div className="flex gap-2">
            <Button size="default" variant="outline" tone={tone}
              className="h-9 px-3 text-sm font-medium gap-1.5 border-border/50"
              onClick={handleTakeover}>
              <UserCheck className="w-3.5 h-3.5" />{t("Takeover")}
            </Button>
            <Button size="default" tone={tone}
              className="flex-1 h-9 text-sm font-semibold gap-2 text-primary-foreground"
              onClick={handleContinueAgent}>
              <Play className="w-4 h-4" />{t("Next")}
            </Button>
          </div>
        </div>
      )}

      {/* ── 策略选项 (TOP, connected only, visible after auto-request until send) ── */}
      {isWS && tipPanelVisible && (
        <div className="rounded-xl border border-border/25 overflow-hidden"
          style={{ backgroundColor: "color-mix(in oklch, var(--secondary) 25%, var(--card))" }}>
          {/* Section header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 cursor-pointer select-none"
            onClick={() => { setTipCollapsed((c) => { if (c) setManualExpanded(false); return !c }) }}>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: pc }} />
              <span className="text-xs font-bold tracking-wide uppercase" style={{ color: pc }}>{t("Strategic Options")}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!tipCollapsed && !state.tipLoading && tipTotal > 0 && (
                <span className="text-xs font-mono font-semibold text-foreground/50 tabular-nums">
                  {currentTipIdx + 1} / {tipTotal}
                </span>
              )}
              {!tipCollapsed && state.tipLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              )}
              {tipCollapsed
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </div>
          </div>

          {/* Content */}
          {!tipCollapsed && <div className="p-3 flex flex-col gap-2">
            {/* Situation strip */}
            {state.tipData?.situation_analysis && !state.tipLoading && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {state.tipData.situation_analysis}
              </p>
            )}

            {/* Loading skeleton */}
            {state.tipLoading && (
              <div className="flex flex-col gap-1.5 animate-pulse py-1">
                <div className="h-2 rounded-full bg-muted/40 w-2/5" />
                <div className="h-3 rounded-full bg-muted/40 w-3/4" />
                <div className="h-2 rounded-full bg-muted/40 w-full" />
                <div className="h-2 rounded-full bg-muted/40 w-5/6" />
              </div>
            )}

            {/* Tip card */}
            {!state.tipLoading && (currentTip || isAutoAgentTip) && (
              <div className="flex items-stretch gap-1.5">
                {/* Prev button */}
                <button
                  onClick={() => setCurrentTipIdx((i) => Math.max(0, i - 1))}
                  disabled={currentTipIdx === 0}
                  className="shrink-0 w-8 rounded-lg border border-border flex items-center justify-center text-2xl font-light leading-none text-foreground disabled:opacity-20 hover:bg-secondary transition-colors"
                  style={{ backgroundColor: "var(--secondary)" }}
                >‹</button>

                {/* Card */}
                <div className="flex-1 min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentTipIdx}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.12 }}
                      className="flex flex-col gap-2"
                    >
                      {isAutoAgentTip ? (
                        /* ── Auto Agent card ── */
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                              style={{ backgroundColor: "var(--chrono-teal)" }}>
                              {t("Auto")}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">{t("All agents → LLM")}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-snug">{t("Auto Agent")}</p>
                          <p className="text-xs text-foreground/70 leading-relaxed italic border-l-2 pl-2"
                            style={{ borderColor: "color-mix(in oklch, var(--chrono-teal) 45%, transparent)" }}>
                            {t("Hand off all roles to AI. Watch the dialogue unfold automatically — take over any agent at any time.")}
                          </p>
                          <Button size="sm" tone={tone}
                            className="w-full h-8 text-sm font-semibold text-primary-foreground gap-1.5"
                            disabled={state.autoProxy}
                            onClick={handleEnableAutoProxy}>
                            <Bot className="w-3.5 h-3.5" />
                            {state.autoProxy ? t("Auto Agent Active") : t("Enable Auto Agent")}
                          </Button>
                        </>
                      ) : currentTip ? (
                        /* ── Regular tip card ── */
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                              style={{ backgroundColor: intentColor }}>
                              {currentTip.intent_type}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono truncate">→ {currentTip.target_agent}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-snug">{currentTip.label}</p>
                          <p className="text-xs text-foreground/70 leading-relaxed italic border-l-2 pl-2"
                            style={{ borderColor: `color-mix(in oklch, ${intentColor} 45%, transparent)` }}>
                            "{currentTip.example_response}"
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="rounded-lg p-1.5" style={{ backgroundColor: "color-mix(in oklch, var(--chrono-teal) 8%, var(--secondary))" }}>
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--chrono-teal)" }}>✓ {t("Why")}</p>
                              <p className="text-xs text-foreground/70 leading-relaxed line-clamp-3">{currentTip.rationale}</p>
                            </div>
                            <div className="rounded-lg p-1.5" style={{ backgroundColor: "color-mix(in oklch, var(--chrono-red) 8%, var(--secondary))" }}>
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--chrono-red)" }}>⚠ {t("Risk")}</p>
                              <p className="text-xs text-foreground/70 leading-relaxed line-clamp-3">{currentTip.risks}</p>
                            </div>
                          </div>
                          <Button size="sm" tone={tone} className="w-full h-8 text-sm font-semibold text-primary-foreground gap-1.5"
                            onClick={handleSendTip}>
                            <Send className="w-3.5 h-3.5" />{t("Send This")}
                          </Button>
                        </>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Next button */}
                <button
                  onClick={() => setCurrentTipIdx((i) => Math.min(tipTotal - 1, i + 1))}
                  disabled={currentTipIdx === tipTotal - 1}
                  className="shrink-0 w-8 rounded-lg border border-border flex items-center justify-center text-2xl font-light leading-none text-foreground disabled:opacity-20 hover:bg-secondary transition-colors"
                  style={{ backgroundColor: "var(--secondary)" }}
                >›</button>
              </div>
            )}

            {/* Error state */}
            {!state.tipLoading && !currentTip && state.tipError && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--chrono-red)" }} />
                <p className="text-xs text-muted-foreground">{state.tipError}</p>
              </div>
            )}
          </div>}
        </div>
      )}

      {/* ── 手动输入卡片 ── */}
      <div className="rounded-xl border border-border/25 overflow-hidden"
        style={{ backgroundColor: "color-mix(in oklch, var(--secondary) 25%, var(--card))" }}>
        {/* Header / toggle */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 cursor-pointer select-none"
          onClick={() => { setManualExpanded((v) => { if (!v) setTipCollapsed(true); return !v }) }}>
          <div className="flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5 shrink-0" style={{ color: pc }} />
            <span className="text-xs font-bold tracking-wide uppercase" style={{ color: pc }}>{t("Type Manually")}</span>
          </div>
          {manualExpanded
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </div>

        {/* Content */}
        {manualExpanded && (
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono shrink-0">{t("TO:")}</span>
              {isWS && serverTargets.length > 0
                ? serverTargets.map((c, i) => {
                    const isT = targetId === c.name
                    return (
                      <button key={i} onClick={() => setTargetId(isT ? null : c.name)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${isT ? "text-primary-foreground" : "text-muted-foreground border-border/30 hover:text-foreground"}`}
                        style={isT ? { backgroundColor: pc, borderColor: pc } : undefined}>
                        {c.avatar} {c.name.split(" ").pop()}
                      </button>
                    )
                  })
                : targetRoles.map((r) => {
                    const isT = targetId === r.id
                    return (
                      <button key={r.id} onClick={() => setTargetId(isT ? null : r.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${isT ? "text-primary-foreground" : "text-muted-foreground border-border/30 hover:text-foreground"}`}
                        style={isT ? { backgroundColor: pc, borderColor: pc } : undefined}>
                        {r.shortName}
                      </button>
                    )
                  })}
            </div>
            <Textarea
              tone={tone} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={`${t("Type in character as")} ${roleTitle ? `${roleName} (${roleTitle})` : roleName}...`}
              className="min-h-[52px] w-full text-sm bg-card/50 border-border/30 resize-none leading-relaxed"
              rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {showDialogueControls && (
                  <DialogueDisplayModeControls mode={dialogueMode} setMode={setDialogueMode}
                    onManualNext={onManualNext} manualWaiting={manualWaiting} phaseColor={pc} tone={tone} />
                )}
                {isWS && (
                  <Button size="sm" variant="outline" tone={tone} className="text-xs h-7 px-2.5 gap-1 border-border/40"
                    onClick={() => dispatch({ type: "BACK_TO_INTERVENE" })}>
                    <Target className="w-3.5 h-3.5" />{t("Jump to another node")}
                  </Button>
                )}
                {showCheckPrevious && (
                  <Button size="sm" variant="outline" tone={tone} className="text-xs h-7 px-2.5 gap-1 border-border/40"
                    onClick={() => dispatch({ type: "OPEN_ANALYSIS" })}>
                    {t("Check previous analysis")}
                  </Button>
                )}
                {!isWS && (
                  <Button size="sm" variant="outline" tone={tone} className="text-xs h-7 px-2.5 gap-1 border-border/40 text-muted-foreground"
                    onClick={() => {
                      if (!text.trim()) {
                        dispatch({ type: "SEND_DIVERGE", data: { text: "DEBUG: Trigger divergence", speakerName: roleName } })
                        toast.success(t("DEBUG: Computing divergence..."))
                        setTimeout(() => dispatch({ type: "DIVERGENCE_COMPLETE" }), 1500)
                        setTimeout(() => { dispatch({ type: "ANALYSIS_COMPLETE", data: { analysis: { available: true, plausibility: mockDivergenceAnalysis.plausibility, drivers: mockDivergenceAnalysis.drivers, constraints: mockDivergenceAnalysis.constraints, outcomes: mockDivergenceAnalysis.outcomes, causalChain: mockDivergenceAnalysis.causalChain } } }) }, 4000)
                      }
                    }}>
                    <Zap className="w-3.5 h-3.5" />{t("Trigger Divergence")}
                  </Button>
                )}
              </div>
              <Button size="sm" tone={tone} className="h-8 px-3 gap-1.5 font-semibold text-primary-foreground"
                disabled={!text.trim()} onClick={handleSend} aria-label={t("Send")}>
                <Send className="w-4 h-4" /><span>{t("Send")}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════ EPILOGUE LOADING OVERLAY ════════════ */

function EpilogueLoadingOverlay() {
  const { state } = useChronoFork()
  const episode = state.serverConfig?.episode

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "#f6f5f1" }}
    >
      {/* Subtle ruled-line texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 28px, #1a1a1a 28px, #1a1a1a 29px)",
      }} />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-6 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Animated ring */}
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-stone-200" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-t-stone-500 border-r-transparent border-b-transparent border-l-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border border-stone-300/50"
            animate={{ scale: [1, 1.08, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div>
          <p className="text-[13px] font-semibold text-stone-700 mb-1" style={{ fontFamily: SERIF }}>
            终局演算中…
          </p>
          <p className="text-[10px] font-mono tracking-[0.2em] text-stone-400 uppercase">
            Computing Timeline Verdict
          </p>
        </div>

        {episode && (
          <p className="text-[10px] font-mono tracking-widest text-stone-400 opacity-60">
            {episode.emoji} {episode.title}
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}

/* ════════════ TIMELINE EPILOGUE OVERLAY ════════════ */

const MOOD = {
  triumphant: {
    label: "另类结局 · 凯旋", labelEn: "TRIUMPHANT",
    pageBg: "#fdf8ee",
    headerFrom: "#d97706", headerTo: "#92400e",
    headText: "#ffffff",
    accent: "#b45309", accentLight: "#fef3c7", accentMid: "#fbbf24",
    bodyText: "#1c0f00", mutedText: "#78500a",
    cardBg: "#ffffff", cardBorder: "#fde68a",
    divBg: "#fff7e0", divBorder: "#fde68a",
    divChapter: { bg: "#fffbeb", border: "#fcd34d", dotColor: "#d97706", tagBg: "#fef3c7", tagText: "#92400e" },
    verdictBg: "#fffbeb", verdictBorder: "#f59e0b",
    rippleDot: "#f59e0b",
    sidebarBg: "#fef9ec", sidebarBorder: "#fde68a",
    footerBg: "rgba(253,248,238,0.97)",
    btnBg: "#d97706", btnText: "#ffffff", btnHover: "#b45309",
  },
  tragic: {
    label: "另类结局 · 悲剧", labelEn: "TRAGIC",
    pageBg: "#fdf5f5",
    headerFrom: "#dc2626", headerTo: "#7f1d1d",
    headText: "#ffffff",
    accent: "#991b1b", accentLight: "#fef2f2", accentMid: "#f87171",
    bodyText: "#1c0606", mutedText: "#7f1d1d",
    cardBg: "#ffffff", cardBorder: "#fecaca",
    divBg: "#fff5f5", divBorder: "#fecaca",
    divChapter: { bg: "#fff5f5", border: "#fca5a5", dotColor: "#dc2626", tagBg: "#fee2e2", tagText: "#991b1b" },
    verdictBg: "#fff5f5", verdictBorder: "#ef4444",
    rippleDot: "#ef4444",
    sidebarBg: "#fef7f7", sidebarBorder: "#fecaca",
    footerBg: "rgba(253,245,245,0.97)",
    btnBg: "#dc2626", btnText: "#ffffff", btnHover: "#991b1b",
  },
  pyrrhic: {
    label: "另类结局 · 惨胜", labelEn: "PYRRHIC",
    pageBg: "#f8f5ff",
    headerFrom: "#7c3aed", headerTo: "#4c1d95",
    headText: "#ffffff",
    accent: "#6d28d9", accentLight: "#f5f3ff", accentMid: "#a78bfa",
    bodyText: "#160a30", mutedText: "#5b21b6",
    cardBg: "#ffffff", cardBorder: "#ddd6fe",
    divBg: "#f5f0ff", divBorder: "#ddd6fe",
    divChapter: { bg: "#f5f0ff", border: "#c4b5fd", dotColor: "#7c3aed", tagBg: "#ede9fe", tagText: "#5b21b6" },
    verdictBg: "#f5f0ff", verdictBorder: "#8b5cf6",
    rippleDot: "#8b5cf6",
    sidebarBg: "#f8f5ff", sidebarBorder: "#ddd6fe",
    footerBg: "rgba(248,245,255,0.97)",
    btnBg: "#7c3aed", btnText: "#ffffff", btnHover: "#5b21b6",
  },
  ambiguous: {
    label: "另类结局 · 迷局", labelEn: "AMBIGUOUS",
    pageBg: "#f4f6fa",
    headerFrom: "#475569", headerTo: "#1e293b",
    headText: "#ffffff",
    accent: "#334155", accentLight: "#f1f5f9", accentMid: "#94a3b8",
    bodyText: "#0f1929", mutedText: "#475569",
    cardBg: "#ffffff", cardBorder: "#cbd5e1",
    divBg: "#eef1f6", divBorder: "#cbd5e1",
    divChapter: { bg: "#eef1f6", border: "#94a3b8", dotColor: "#475569", tagBg: "#e2e8f0", tagText: "#334155" },
    verdictBg: "#eef1f6", verdictBorder: "#64748b",
    rippleDot: "#64748b",
    sidebarBg: "#f1f5f9", sidebarBorder: "#cbd5e1",
    footerBg: "rgba(244,246,250,0.97)",
    btnBg: "#334155", btnText: "#ffffff", btnHover: "#1e293b",
  },
} as const

const EPI_STAGGER = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }
const EPI_FADE = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const } } }
const SERIF = "'Georgia', 'Palatino Linotype', serif"

function TimelineEpilogueOverlay({ onViewReport }: { onViewReport: () => void }) {
  const { state, ws } = useChronoFork()
  const epilogue = state.timelineEpilogue!
  const m = MOOD[epilogue.mood] ?? MOOD.ambiguous
  const cast = state.serverConfig?.cast ?? []
  const [reflectionRequested, setReflectionRequested] = useState(false)

  // Request reflection immediately on mount — timeline_epilogue arrival is the trigger
  useEffect(() => {
    if (state.stage === 3 && !reflectionRequested && !state.reflectionHtml) {
      setReflectionRequested(true)
      ws.send("request_reflection", {})
    }
  }, [state.stage, reflectionRequested, state.reflectionHtml, ws])

  const reportReady = !!state.reflectionHtml

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: m.pageBg, color: m.bodyText }}
    >
      {/* ── Mood header banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 px-8 py-5"
        style={{ background: `linear-gradient(135deg, ${m.headerFrom} 0%, ${m.headerTo} 100%)` }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-mono tracking-[0.3em] uppercase opacity-60" style={{ color: m.headText }}>
                  Timeline Verdict · {m.labelEn}
                </span>
              </div>
              <p className="text-lg font-bold tracking-wide" style={{ color: m.headText, fontFamily: SERIF }}>
                {m.label}
              </p>
            </div>
          </div>
          <div className="text-right">
            {state.serverConfig?.episode && (
              <p className="text-[13px] font-mono opacity-50" style={{ color: m.headText }}>
                {state.serverConfig.episode.emoji} {state.serverConfig.episode.title}
              </p>
            )}
            <p className="text-[11px] font-mono opacity-40 mt-0.5" style={{ color: m.headText }}>
              EPISODE COMPLETE
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Two-column body ── */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: `${m.accentMid}55 transparent` }}>
        <div className="max-w-5xl mx-auto px-8 py-6 pb-32 flex gap-6 items-start">

          {/* LEFT: Narrative main column */}
          <motion.div
            className="flex-1 min-w-0"
            variants={EPI_STAGGER}
            initial="hidden"
            animate="show"
          >
            {/* Title block */}
            <motion.div variants={EPI_FADE} className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-[11px] font-mono font-bold tracking-[0.25em] px-2 py-0.5 rounded-sm"
                  style={{ background: m.accentLight, color: m.accent, border: `1px solid ${m.cardBorder}` }}
                >
                  {m.label}
                </span>
                <span className="text-[11px] font-mono tracking-widest opacity-40" style={{ color: m.mutedText }}>
                  · 偏离正史
                </span>
              </div>
              <h1
                className="text-3xl font-bold leading-snug tracking-tight mb-2"
                style={{ fontFamily: SERIF, color: m.bodyText }}
              >
                {epilogue.timeline_title}
              </h1>
              <p className="text-[16px] italic leading-relaxed" style={{ color: m.accent, fontFamily: SERIF }}>
                {epilogue.tagline}
              </p>
            </motion.div>

            {/* Section: Narrative timeline (chapters) */}
            <motion.div variants={EPI_FADE} className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1" style={{ background: m.cardBorder }} />
                <span className="text-[11px] font-mono tracking-[0.28em]" style={{ color: m.mutedText, opacity: 0.7 }}>
                  你走过的剧情线 · STORY PATH
                </span>
                <div className="h-px flex-1" style={{ background: m.cardBorder }} />
              </div>
              <div className="relative">
                {/* Vertical connector line */}
                <div
                  className="absolute left-[7px] top-2 bottom-2 w-px"
                  style={{ background: `linear-gradient(180deg, ${m.accentMid}60, ${m.cardBorder})` }}
                />
                <div className="space-y-0">
                  {epilogue.chapters.map((ch, i) => {
                    const isDiverged = ch.type === "diverged"
                    const dc = m.divChapter
                    return (
                      <motion.div
                        key={ch.node_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="flex gap-3.5 pl-0"
                      >
                        {/* Timeline node */}
                        <div className="flex flex-col items-center shrink-0" style={{ width: 16 }}>
                          <div
                            className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 mt-3"
                            style={isDiverged
                              ? { background: dc.dotColor, borderColor: dc.dotColor, boxShadow: `0 0 8px ${dc.dotColor}55` }
                              : { background: "#ffffff", borderColor: m.cardBorder }
                            }
                          >
                            {isDiverged && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </div>
                        </div>

                        {/* Chapter card */}
                        <div
                          className="flex-1 mb-2 rounded-lg p-3.5 border"
                          style={isDiverged
                            ? { background: dc.bg, borderColor: dc.border, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }
                            : { background: m.cardBg, borderColor: m.cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }
                          }
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-mono tracking-[0.2em]" style={{ color: m.mutedText, opacity: 0.6 }}>
                              {i + 1}
                            </span>
                            {isDiverged && (
                              <span
                                className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded-sm"
                                style={{ background: dc.tagBg, color: dc.tagText, border: `1px solid ${dc.border}` }}
                              >
                                ★ DIVERGED
                              </span>
                            )}
                            <p className="text-[14px] font-semibold leading-snug flex-1" style={{ fontFamily: SERIF, color: m.bodyText }}>
                              {ch.title}
                            </p>
                          </div>
                          <p className="text-[13px] leading-relaxed mb-1" style={{ color: m.mutedText }}>
                            {ch.pivot}
                          </p>
                          {isDiverged && (
                            <p className="text-[13px] leading-relaxed font-medium" style={{ color: m.accent }}>
                              → {ch.consequence}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Verdict */}
            <motion.div variants={EPI_FADE} className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: m.cardBorder }} />
                <span className="text-[11px] font-mono tracking-[0.28em]" style={{ color: m.mutedText, opacity: 0.7 }}>
                  反事实推演 · VERDICT
                </span>
                <div className="h-px flex-1" style={{ background: m.cardBorder }} />
              </div>
              <div
                className="rounded-lg px-5 py-4 border-l-4"
                style={{ background: m.verdictBg, borderColor: m.verdictBorder, borderLeftWidth: 4, borderLeftStyle: "solid" }}
              >
                <p
                  className="text-[15px] leading-relaxed"
                  style={{ fontFamily: SERIF, color: m.bodyText, lineHeight: 1.8 }}
                >
                  {epilogue.verdict}
                </p>
              </div>
            </motion.div>

            {/* Ripples */}
            <motion.div variants={EPI_FADE}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: m.cardBorder }} />
                <span className="text-[11px] font-mono tracking-[0.28em]" style={{ color: m.mutedText, opacity: 0.7 }}>
                  历史涟漪 · HISTORICAL RIPPLES
                </span>
                <div className="h-px flex-1" style={{ background: m.cardBorder }} />
              </div>
              <div className="space-y-2">
                {(["近期影响", "中期影响", "历史长河"] as const).map((label, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.09, duration: 0.38 }}
                    className="flex items-start gap-3 rounded-lg px-4 py-3 border"
                    style={{ background: m.cardBg, borderColor: m.cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}
                  >
                    <div className="flex flex-col items-center shrink-0 pt-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: m.rippleDot, opacity: 1 - i * 0.22 }}
                      />
                      {i < 2 && <div className="w-px mt-1 flex-1" style={{ background: m.cardBorder, minHeight: 12 }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-[10px] font-mono tracking-[0.2em] block mb-0.5"
                        style={{ color: m.mutedText, opacity: 0.65 }}
                      >
                        {label}
                      </span>
                      <p className="text-[14px] leading-relaxed" style={{ color: m.bodyText }}>{epilogue.ripples[i]}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT: Sidebar */}
          <motion.div
            className="shrink-0 flex flex-col gap-4"
            style={{ width: 200 }}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Cast */}
            {cast.length > 0 && (
              <div
                className="rounded-xl border overflow-hidden"
                style={{ background: m.sidebarBg, borderColor: m.sidebarBorder }}
              >
                <div
                  className="px-3.5 py-2.5 border-b"
                  style={{ borderColor: m.sidebarBorder, background: m.divBg }}
                >
                  <span className="text-[11px] font-mono tracking-[0.25em]" style={{ color: m.mutedText }}>
                    登场人物 CAST
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: m.sidebarBorder }}>
                  {cast.slice(0, 5).map((c) => (
                    <div key={c.name} className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base leading-none">{c.avatar || "👤"}</span>
                        <span className="text-[14px] font-semibold leading-snug" style={{ color: m.bodyText, fontFamily: SERIF }}>
                          {c.name}
                        </span>
                      </div>
                      <p className="text-[12px] leading-snug" style={{ color: m.mutedText }}>{c.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Story progress */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: m.sidebarBg, borderColor: m.sidebarBorder }}
            >
              <div
                className="px-3.5 py-2.5 border-b"
                style={{ borderColor: m.sidebarBorder, background: m.divBg }}
              >
                <span className="text-[11px] font-mono tracking-[0.25em]" style={{ color: m.mutedText }}>
                  剧情进度 STORY
                </span>
              </div>
              <div className="px-3.5 py-3 space-y-2.5">
                {epilogue.chapters.map((ch, i) => {
                  const isDiverged = ch.type === "diverged"
                  return (
                    <div key={ch.node_id} className="flex items-start gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: isDiverged ? m.rippleDot : m.accentMid, opacity: isDiverged ? 1 : 0.45 }}
                      />
                      <p
                        className="text-[12px] leading-snug"
                        style={{ color: isDiverged ? m.accent : m.mutedText, fontWeight: isDiverged ? 600 : 400 }}
                      >
                        {i + 1}. {ch.title}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Sticky bottom footer ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 px-8 py-3.5 border-t"
        style={{ background: m.footerBg, borderColor: m.cardBorder, backdropFilter: "blur(8px)" }}
      >
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {!reportReady ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="flex items-center gap-3"
              >
                <div className="relative shrink-0">
                  <div
                    className="w-7 h-7 rounded-full border-2 bg-white flex items-center justify-center"
                    style={{ borderColor: m.verdictBorder }}
                  >
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: m.accent }} />
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{ scale: [1, 1.65, 1], opacity: [0.45, 0, 0.45] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    style={{ border: `1.5px solid ${m.verdictBorder}` }}
                  />
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: m.bodyText }}>正在生成复盘报告…</p>
                  <p className="text-[12px] mt-0.5" style={{ color: m.mutedText, opacity: 0.6 }}>
                    Generating reflection report · ~30s
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
              >
                <button
                  onClick={onViewReport}
                  className="flex items-center gap-2.5 rounded-lg px-5 h-11 text-[15px] font-semibold transition-all"
                  style={{ background: m.btnBg, color: m.btnText, border: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.background = m.btnHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = m.btnBg)}
                >
                  <BookOpen className="w-4 h-4" />
                  查看复盘报告
                  <ArrowLeft className="w-3.5 h-3.5 rotate-180 opacity-70" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── Reflection Prompt -- 3-state: Request -> Loading -> View ── */
function ReflectionPrompt({ onViewReport }: { onViewReport: () => void }) {
  const { state, ws, dispatch } = useChronoFork()
  const { t } = useI18n()
  const isWS = state.connectionStatus === "connected"
  const reflectionEnabled = !isWS || state.canReflect || !!state.reflectionHtml
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  /* In WS mode, ready when reflectionHtml arrives */
  useEffect(() => {
    if (loading && state.reflectionHtml) {
      setLoading(false)
      setReady(true)
    }
  }, [loading, state.reflectionHtml])

  const handleRequest = () => {
    if (!reflectionEnabled) return
    setLoading(true)
    if (isWS) {
      ws.send("request_reflection", {})
    } else {
      // Mock: simulate loading delay
      setTimeout(() => {
        setLoading(false)
        setReady(true)
      }, 3000)
    }
  }

  const handleView = () => {
    dispatch({ type: "OPEN_REFLECTION" })
    onViewReport()
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center gap-4 py-4"
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${loading ? "animate-pulse-halo-violet" : ""}`}
        style={{ backgroundColor: "var(--chrono-violet-bg)", border: "2px solid var(--chrono-violet)" }}>
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--chrono-violet)" }} />
        ) : ready ? (
          <FileCheck className="w-6 h-6" style={{ color: "var(--chrono-violet)" }} />
        ) : (
          <BookOpen className="w-6 h-6" style={{ color: "var(--chrono-violet)" }} />
        )}
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">
          {loading
            ? t("Generating Reflection... (Take ~30s)")
            : ready
              ? t("Reflection Report Ready")
              : reflectionEnabled
                ? t("Reflection Available")
                : t("Waiting for reflection export to be enabled by the server.")}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {loading
            ? t("Analyzing your intervention and computing outcomes...")
            : ready
              ? t("Your report is ready. Click below to review.")
              : reflectionEnabled
                ? t("Your intervention run is complete. Request the analysis report.")
                : t("Reflection export will unlock when the server enables it.")}
        </p>
      </div>
      {!loading && !ready && reflectionEnabled && (
        <Button size="default" tone="reflection" className="text-sm font-semibold text-primary-foreground gap-2"
          onClick={handleRequest}>
          <BookOpen className="w-4 h-4" /> {t("Request Reflection Report")}
        </Button>
      )}
      {loading && (
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--chrono-violet)" }}
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, delay: i * 0.25, repeat: Infinity }} />
          ))}
        </div>
      )}
      {ready && (
        <Button size="default" tone="reflection" className="text-sm font-semibold text-primary-foreground gap-2"
          onClick={handleView}>
          <BookOpen className="w-4 h-4" /> {t("View Reflection Report")}
        </Button>
      )}
    </motion.div>
  )
}

/* ════════════ REFLECTION REPORT (full-screen overlay card with Close X) ════════════ */

function RadarVisualization({ dimensions }: { dimensions: typeof mockReportData.dimensions }) {
  const cx = 150, cy = 150, maxR = 110, count = dimensions.length
  const angleStep = (Math.PI * 2) / count
  const getPoint = (i: number, v: number) => {
    const angle = angleStep * i - Math.PI / 2
    const r = (v / 100) * maxR
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }
  const toPath = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"
  const canonPts = dimensions.map((d, i) => getPoint(i, d.canonical))
  const divPts = dimensions.map((d, i) => getPoint(i, d.divergent))

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[300px] mx-auto">
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={dimensions.map((_, i) => { const p = getPoint(i, v); return `${p.x},${p.y}` }).join(" ")}
          fill="none" stroke="var(--border)" strokeWidth="0.5" opacity={0.5} />
      ))}
      {dimensions.map((d, i) => {
        const end = getPoint(i, 100), lbl = getPoint(i, 115)
        return (
          <g key={d.label}>
            <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="var(--border)" strokeWidth="0.5" opacity={0.3} />
            <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="central" fill="var(--muted-foreground)" fontSize="9" fontFamily="var(--font-mono)">{d.label}</text>
          </g>
        )
      })}
      <path d={toPath(canonPts)} fill="var(--chrono-teal)" fillOpacity="0.15" stroke="var(--chrono-teal)" strokeWidth="1.5" />
      <path d={toPath(divPts)} fill="var(--chrono-amber)" fillOpacity="0.15" stroke="var(--chrono-amber)" strokeWidth="1.5" />
      {canonPts.map((p, i) => <circle key={`c-${i}`} cx={p.x} cy={p.y} r="3" fill="var(--chrono-teal)" />)}
      {divPts.map((p, i) => <circle key={`d-${i}`} cx={p.x} cy={p.y} r="3" fill="var(--chrono-amber)" />)}
    </svg>
  )
}

function ReflectionReportOverlay({ onReturn }: { onReturn: () => void }) {
  const { state, ws } = useChronoFork()
  const { t } = useI18n()
  const report = mockReportData
  const hasServerHtml = !!state.reflectionHtml
  const isWS = state.connectionStatus === "connected"

  const handleDownloadReportHtml = () => {
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")

    const html = hasServerHtml
      ? state.reflectionHtml!
      : `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.episode)} - Reflection Report</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; line-height: 1.6; color: #1f2937; }
      h1 { margin-bottom: 4px; }
      h2 { margin-top: 28px; margin-bottom: 8px; }
      .meta { color: #6b7280; margin-bottom: 20px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
      ul { margin: 8px 0 0 18px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.episode)}</h1>
    <div class="meta">${escapeHtml(report.duration)} | Forks: ${report.forksCreated} | Fork Node: ${escapeHtml(report.forkNode)}</div>

    <div class="grid">
      <div class="card">
        <h2>${escapeHtml(t("Canonical"))}</h2>
        <ul>
          <li>U-2 Photos Revealed</li>
          <li>ExComm Deliberations</li>
          <li>Quarantine Decision</li>
          <li>Address to Nation</li>
          <li>Black Saturday</li>
        </ul>
      </div>
      <div class="card">
        <h2>${escapeHtml(t("Your Timeline"))}</h2>
        <ul>
          <li>U-2 Photos Revealed</li>
          <li>ExComm Deliberations</li>
          <li>Early Backchannel (Fork)</li>
          <li>Quiet Diplomacy</li>
          <li>Accelerated Resolution</li>
        </ul>
      </div>
    </div>

    <h2>${escapeHtml(t("Trade-offs"))}</h2>
    <ul>${report.tradeoffs.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>

    <h2>${escapeHtml(t("Overlooked"))}</h2>
    <ul>${report.overlooked.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>

    <h2>${escapeHtml(t("Suggestions"))}</h2>
    <ul>${report.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </body>
</html>`

    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = `chronofork-reflection-${Date.now()}.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    toast.success(t("Report HTML downloaded."))
  }

  const handleExportSave = () => {
    if (!isWS) {
      toast.info(t("Export functionality coming soon."))
      return
    }
    ws.send("export_save", {})
    toast.success(t("Save export requested..."))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[70] flex flex-col"
    >
      {/* Dim background */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* Scrollable report card -- offset top to avoid header */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden relative">
            {/* Close X button at top-right */}
            <button
              onClick={onReturn}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("Close report")}
            >
              <X className="w-5 h-5" />
            </button>

            {/* If we have server-provided HTML, render it */}
            {hasServerHtml ? (
              <div className="p-6">
                <div dangerouslySetInnerHTML={{ __html: state.reflectionHtml! }} />
                <div className="flex items-center justify-center gap-3 pt-6 border-t border-border/20 mt-6">
                  <Button variant="outline" size="default" tone="reflection" className="gap-2 text-sm" onClick={onReturn}>
                    <ArrowLeft className="w-4 h-4" /> {t("Return to Console")}
                  </Button>
                  <Button variant="outline" size="default" tone="reflection" className="gap-2 text-sm"
                    onClick={handleDownloadReportHtml}>
                    <Download className="w-4 h-4" /> {t("Download Report HTML")}
                  </Button>
                  <Button variant="outline" size="default" tone="observe" className="gap-2 text-sm"
                    onClick={handleExportSave}>
                    <Download className="w-4 h-4" /> {t("Export Save")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Report header */}
                <div className="text-center py-8 px-6 border-b border-border/20"
                  style={{ backgroundColor: "color-mix(in oklch, var(--chrono-violet) 5%, transparent)" }}>
                  <p className="text-sm font-mono uppercase tracking-[0.3em] mb-2" style={{ color: "var(--chrono-violet)" }}>{t("Aftermath Report")}</p>
                  <h1 className="text-2xl font-bold text-foreground mb-3 text-balance">{report.episode}</h1>
                  <div className="flex items-center justify-center gap-5 text-sm text-muted-foreground font-mono">
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{report.duration}</span>
                    <span className="flex items-center gap-1.5"><GitFork className="w-4 h-4" />{report.forksCreated} {t("fork(s)")}</span>
                    <span className="flex items-center gap-1.5"><Target className="w-4 h-4" />{t("Fork:")} {report.forkNode}</span>
                  </div>
                </div>

                <div className="p-6 flex flex-col gap-8">
                  {/* Timelines */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl p-5 border border-border/20 bg-secondary/10">
                      <p className="text-sm font-mono uppercase tracking-widest mb-3" style={{ color: "var(--chrono-teal)" }}>{t("Canonical")}</p>
                      {["U-2 Photos Revealed", "ExComm Deliberations", "Quarantine Decision", "Address to Nation", "Black Saturday"].map((n, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "var(--chrono-teal)" }} />
                          <span className="text-base text-foreground/80">{n}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl p-5 border border-border/20 bg-secondary/10">
                      <p className="text-sm font-mono uppercase tracking-widest mb-3" style={{ color: "var(--chrono-amber)" }}>{t("Your Timeline")}</p>
                      {["U-2 Photos Revealed", "ExComm Deliberations", "Early Backchannel (Fork)", "Quiet Diplomacy", "Accelerated Resolution"].map((n, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "var(--chrono-amber)" }} />
                          <span className="text-base text-foreground/80">{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Radar */}
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground">{t("Dimension Shift")}</p>
                    <RadarVisualization dimensions={report.dimensions} />
                    <div className="flex items-center gap-6 text-sm font-mono">
                      <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--chrono-teal)" }} />{t("Canonical")}</span>
                      <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--chrono-amber)" }} />{t("Your Timeline")}</span>
                    </div>
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-secondary/10 border-border/20">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">{t("Trade-offs")}</CardTitle></CardHeader>
                      <CardContent><ul className="flex flex-col gap-2">{report.tradeoffs.map((t, i) => <li key={i} className="text-base text-foreground/90 leading-relaxed">{t}</li>)}</ul></CardContent>
                    </Card>
                    <Card className="bg-secondary/10 border-border/20">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">{t("Overlooked")}</CardTitle></CardHeader>
                      <CardContent><ul className="flex flex-col gap-2">{report.overlooked.map((o, i) => <li key={i} className="text-base text-foreground/90 leading-relaxed">{o}</li>)}</ul></CardContent>
                    </Card>
                    <Card className="bg-secondary/10 border-border/20">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">{t("Suggestions")}</CardTitle></CardHeader>
                      <CardContent><ul className="flex flex-col gap-2">{report.recommendations.map((r, i) => <li key={i} className="text-base text-foreground/90 leading-relaxed">{r}</li>)}</ul></CardContent>
                    </Card>
                  </div>

                  {/* Export + Return buttons */}
                  <div className="flex items-center justify-center gap-3 pt-2 pb-4">
                    <Button variant="outline" size="default" tone="reflection" className="gap-2 text-sm" onClick={onReturn}>
                      <ArrowLeft className="w-4 h-4" /> {t("Return to Console")}
                    </Button>
                    <Button variant="outline" size="default" tone="reflection" className="gap-2 text-sm"
                      onClick={handleDownloadReportHtml}>
                      <Download className="w-4 h-4" /> {t("Download Report HTML")}
                    </Button>
                    <Button variant="outline" size="default" tone="observe" className="gap-2 text-sm"
                      onClick={handleExportSave}>
                      <Download className="w-4 h-4" /> {t("Export Save")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Main Interaction Console Card (bottom center) ── */
function InteractionConsole({
  dialogueMode,
  setDialogueMode,
  onManualNext,
  manualWaiting,
  showDialogueControls,
}: {
  dialogueMode: DialogueDisplayMode
  setDialogueMode: (mode: DialogueDisplayMode) => void
  onManualNext: () => void
  manualWaiting: boolean
  showDialogueControls: boolean
}) {
  const { state, dispatch } = useChronoFork()
  const { t } = useI18n()
  const { phase } = state
  const [showReport, setShowReport] = useState(false)

  const handleViewReport = () => {
    dispatch({ type: "OPEN_REFLECTION" })
    setShowReport(true)
  }

  const handleReturnFromReport = () => {
    dispatch({ type: "BACK_TO_OBSERVE_COMPLETE" })
    setShowReport(false)
  }

  let content: React.ReactNode = null
  if (phase === "observe_idle") {
    content = <InteractionIdle />
  } else if (phase === "observe_playing") {
    content = (
      <InteractionObserving
        dialogueMode={dialogueMode}
        setDialogueMode={setDialogueMode}
        onManualNext={onManualNext}
        manualWaiting={manualWaiting}
        showDialogueControls={showDialogueControls}
      />
    )
  } else if (phase === "observe_complete" || phase === "intervene_idle") {
    content = <InteractionBacktrackSetup />
  } else if (phase === "intervene_active") {
    content = (
      <InteractionComposer
        dialogueMode={dialogueMode}
        setDialogueMode={setDialogueMode}
        onManualNext={onManualNext}
        manualWaiting={manualWaiting}
        showDialogueControls={showDialogueControls}
      />
    )
  } else if (phase === "divergence_running") {
    content = (
      <div className="flex items-center justify-center gap-2.5 py-6">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--chrono-amber)" }} />
        <span className="text-sm font-mono" style={{ color: "var(--chrono-amber)" }}>{t("Temporal recalculation…")}</span>
      </div>
    )
  } else if (phase === "branch_complete") {
    content = <ReflectionPrompt onViewReport={handleViewReport} />
  } else if (phase === "divergence_ready") {
    content = (
      <InteractionComposer
        dialogueMode={dialogueMode}
        setDialogueMode={setDialogueMode}
        onManualNext={onManualNext}
        manualWaiting={manualWaiting}
        showDialogueControls={showDialogueControls}
      />
    )
  } else if (phase === "reflection_open") {
    content = <ReflectionPrompt onViewReport={handleViewReport} />
  }

  const isEpilogueLoading = phase === "epilogue_loading"
  const isEpilogue = phase === "epilogue" && !!state.timelineEpilogue

  if (!content && !showReport && !isEpilogueLoading && !isEpilogue) return null

  const pc = phaseColor(phase)

  return (
    <>
      {content && !showReport && !isEpilogueLoading && !isEpilogue && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-xl">
          <div className="glass-panel-heavy rounded-2xl px-5 py-4 shadow-xl border-t-2"
            style={{ borderTopColor: pc }}>
            {content}
          </div>
        </div>
      )}

      {/* Epilogue loading (stage_update 3 received, awaiting timeline_epilogue) */}
      <AnimatePresence>
        {isEpilogueLoading && !showReport && <EpilogueLoadingOverlay />}
      </AnimatePresence>

      {/* Epilogue full-screen overlay (timeline_epilogue received) */}
      <AnimatePresence>
        {isEpilogue && !showReport && (
          <TimelineEpilogueOverlay onViewReport={handleViewReport} />
        )}
      </AnimatePresence>

      {/* Reflection Report overlay */}
      <AnimatePresence>
        {showReport && <ReflectionReportOverlay onReturn={handleReturnFromReport} />}
      </AnimatePresence>
    </>
  )
}

export function CenterStage() {
  const { state, ws, dispatch } = useChronoFork()
  const { setLocale } = useI18n()
  const rm = state.ui.reducedMotion
  const [dialogueMode, setDialogueMode] = useState<DialogueDisplayMode>("manual")
  const [manualWaiting, setManualWaiting] = useState(false)
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null)
  const showDialogueControls = state.stage === 1
  const isDisconnected = state.connectionStatus === "disconnected"
  const currentScene = scenes[state.currentSceneIndex]

  useEffect(() => {
    const promptLang = state.serverConfig?.prompt_lang
    if (promptLang === "zh" || promptLang === "en") {
      setLocale(promptLang)
    }
  }, [setLocale, state.serverConfig?.prompt_lang])

  if (!currentScene && !isDisconnected) return null

  const sceneBeats = currentScene ? dialogueBeats.filter((d) => d.sceneId === currentScene.id) : []
  const currentBeat = sceneBeats[state.currentDialogueIndex]
  const speakingRole = currentBeat ? roles.find((r) => r.id === currentBeat.speakerId) : null
  const tableRoles = roles.filter((r) => r.id !== "facilitator") as StageRole[]
  const speakingIdx = speakingRole ? tableRoles.findIndex((r) => r.id === speakingRole.id) : -1
  const isTopRow = speakingIdx >= 0 && speakingIdx < 3
  const isIdle = state.phase === "observe_idle"
  const isFacilitator = currentBeat?.speakerId === "facilitator"

  /* Facilitator text: prefer server-streamed blocks, fallback to mock */
  const latestFacilitatorBlock = state.facilitatorBlocks.length > 0
    ? state.facilitatorBlocks[state.facilitatorBlocks.length - 1]
    : null
  const serverFacilitatorText = latestFacilitatorBlock?.text
  const wsSpeakableMessages = state.chatHistory.filter((m) => m.type === "dialogue" || m.type === "user_chat" || m.type === "user_diverge")
  const latestWsSpeakableMessage = wsSpeakableMessages.length > 0 ? wsSpeakableMessages[wsSpeakableMessages.length - 1] : null

  useEffect(() => {
    ws.setMessageProcessingMode(dialogueMode)
    if (dialogueMode === "auto") {
      setManualWaiting(false)
    }
  }, [dialogueMode, ws])

  useEffect(() => {
    if (state.stage !== 1 && dialogueMode !== "auto") {
      setDialogueMode("auto")
      setManualWaiting(false)
    }
  }, [state.stage, dialogueMode])

  useEffect(() => {
    if (!latestWsSpeakableMessage?.id) return
    if (latestWsSpeakableMessage.id !== lastSeenMessageId) {
      setLastSeenMessageId(latestWsSpeakableMessage.id)
      if (manualWaiting) {
        setManualWaiting(false)
      }
    }
  }, [latestWsSpeakableMessage?.id, lastSeenMessageId, manualWaiting])

  const handleManualNext = () => {
    if (dialogueMode !== "manual") return

    if (state.connectionStatus === "connected") {
      const queuedBeforeStep = ws.getQueueSnapshot().length
      ws.stepMessageQueue()
      setManualWaiting(queuedBeforeStep === 0)
      return
    }

    // Mock mode manual stepping keeps existing local behavior.
    if (state.phase === "observe_playing") {
      dispatch({ type: "ADVANCE_DIALOGUE" })
      return
    }
  }

  const displayMessage = latestWsSpeakableMessage

  const facilitatorInteractionMessage = state.connectionStatus === "connected" && displayMessage && (
    displayMessage.speakerName === "Facilitator" || displayMessage.targetName === "Facilitator"
  )
    ? displayMessage
    : null
  const facilitatorIsSpeaking = facilitatorInteractionMessage?.speakerName === "Facilitator"
  const facilitatorIsListening = !!facilitatorInteractionMessage && !facilitatorIsSpeaking

  const facilitatorBeat = sceneBeats.find((b) => b.speakerId === "facilitator")
  const mockFacilitatorText = isFacilitator ? currentBeat?.text : (facilitatorBeat?.text ?? currentScene?.directorCaption)
  const facilitatorText = state.connectionStatus === "connected"
    ? (facilitatorIsSpeaking ? facilitatorInteractionMessage?.text : serverFacilitatorText)
    : mockFacilitatorText
  const facilitatorStripInteraction = facilitatorInteractionMessage
    ? {
        isSpeaking: facilitatorIsSpeaking,
        counterpart:
          facilitatorIsSpeaking
            ? (facilitatorInteractionMessage.targetName ? `Facilitator -> ${facilitatorInteractionMessage.targetName}` : "")
            : `${facilitatorInteractionMessage.speakerName} -> Facilitator`,
      }
    : undefined
  const showFacilitatorStrip = !isIdle && (state.connectionStatus === "connected" ? (!!facilitatorText || facilitatorIsListening) : !!facilitatorText)

  return (
    <div className="flex flex-col h-full relative center-spotlight">
      {/* Pre-start connection overlay */}
      <AnimatePresence>
        {isDisconnected && <PreStartOverlay />}
      </AnimatePresence>

      {/* TOP: Scene meta chips -- hidden in idle */}
      {!isIdle && currentScene && (
        <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap justify-center shrink-0 border-b border-border/10">
          {/* <Badge variant="outline" className="text-xs font-mono gap-1 border-border/30 text-muted-foreground bg-card/50 px-2.5 py-1">
            <Clock className="w-3 h-3" /> {currentScene.time}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono gap-1 border-border/30 text-muted-foreground bg-card/50 px-2.5 py-1">
            <MapPin className="w-3 h-3" /> {currentScene.location}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono gap-1 border-border/30 text-foreground/70 bg-card/50 px-2.5 py-1 font-semibold">
            {currentScene.topic}
          </Badge> */}
        </div>
      )}

      {/* Facilitator strip -- standard top position */}
      {showFacilitatorStrip && <FacilitatorStrip text={facilitatorText!} interaction={facilitatorStripInteraction} />}

      {/* Middle: Round table + speech bubble */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-32 relative overflow-hidden -translate-y-8">
        {!isIdle && state.connectionStatus === "mock" && (
          <div className="flex flex-col items-center w-full max-w-lg relative">
            {/* Top row avatars */}
            <div className="flex items-end justify-center gap-8 mb-3 relative z-10">
              {tableRoles.slice(0, 3).map((role) => (
                <Avatar key={role.id} role={role} isSpeaking={currentBeat?.speakerId === role.id}
                  isListening={false}
                  latestEmotion={sceneBeats.slice(0, state.currentDialogueIndex + 1).filter((b) => b.speakerId === role.id).pop()?.emotion}
                />
              ))}
            </div>

            {/* Speech bubble */}
            <AnimatePresence mode="wait">
              {currentBeat && speakingRole && !isFacilitator && (
                <motion.div
                  key={currentBeat.id}
                  initial={rm ? { opacity: 1 } : { opacity: 0, y: isTopRow ? -4 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={rm ? { opacity: 0 } : { opacity: 0 }}
                  transition={{ duration: rm ? 0 : 0.2 }}
                  className={`relative z-20 max-w-md w-full ${isTopRow ? "mb-1" : "mt-1"}`}
                >
                  {isTopRow && (
                    <div className="flex justify-center mb-[-1px]">
                      <div className="w-2.5 h-2.5 rotate-45 border-t border-l bg-card" style={{ borderColor: "var(--border)" }} />
                    </div>
                  )}
                  <div className="bg-card border border-border/50 rounded-xl px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold" style={{ color: getSpeakerColor(speakingRole.name) }}>{speakingRole.shortName}</span>
                      <EmotionDot emotion={currentBeat.emotion} />
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{currentBeat.text}</p>
                  </div>
                  {!isTopRow && (
                    <div className="flex justify-center mt-[-1px]">
                      <div className="w-2.5 h-2.5 rotate-45 border-b border-r bg-card" style={{ borderColor: "var(--border)" }} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Desk divider */}
            <div className="relative w-full flex items-center justify-center py-1.5 z-0">
              <div className="w-full max-w-xs h-px rounded-full" style={{ background: "linear-gradient(90deg, transparent, var(--border), var(--chrono-teal-dim), var(--border), transparent)", opacity: 0.25 }} />
            </div>

            {/* Bottom row avatars */}
            <div className="flex items-start justify-center gap-8 mt-3 relative z-10">
              {tableRoles.slice(3).map((role) => (
                <Avatar key={role.id} role={role} isSpeaking={currentBeat?.speakerId === role.id}
                  isListening={false}
                  latestEmotion={sceneBeats.slice(0, state.currentDialogueIndex + 1).filter((b) => b.speakerId === role.id).pop()?.emotion}
                />
              ))}
            </div>
          </div>
        )}

        {/* WS connected mode: show latest streaming message as speech bubble */}
        {!isIdle && state.connectionStatus === "connected" && displayMessage && (
          <div className="flex flex-col items-center w-full max-w-lg relative">
            {(() => {
              const lastMsg = displayMessage
              if (!lastMsg) return null;
              
              const serverRoles: StageRole[] = (state.serverConfig?.cast ?? []).map((c) => ({
                id: c.name,
                name: c.name,
                title: c.title,
                shortName: c.name.split("·").pop() || c.name,
                stanceTags: ["neutral"],
                portrait: "var(--chrono-teal)",
                avatarEmoji: c.avatar || "👤",
              }))

              const availableRoles: StageRole[] = serverRoles.length > 0 ? serverRoles : tableRoles
              const speakingRole = availableRoles.find((r) => r.name === lastMsg.speakerName || r.shortName === lastMsg.speakerName)
              const listeningRole =
                lastMsg.targetName &&
                lastMsg.targetName !== "Facilitator" &&
                lastMsg.targetName !== "System" &&
                lastMsg.targetName !== "User"
                  ? availableRoles.find((r) => r.name === lastMsg.targetName)
                  : null
              const speakingIdx = speakingRole ? availableRoles.findIndex((r) => r.id === speakingRole.id) : -1
              const isTopRow = speakingIdx >= 0 && speakingIdx < Math.ceil(availableRoles.length / 2)
              const topRoles = availableRoles.slice(0, Math.ceil(availableRoles.length / 2))
              const bottomRoles = availableRoles.slice(Math.ceil(availableRoles.length / 2))
              const isFacilitatorSpeakingTurn = lastMsg.speakerName === "Facilitator"
              
              return (
                <>
                  {/* Top row avatars */}
                  <div className="flex items-end justify-center gap-8 mb-3 relative z-10">
                    {topRoles.map((role) => (
                      <Avatar
                        key={role.id}
                        role={role}
                        isSpeaking={speakingRole?.id === role.id}
                        isListening={listeningRole?.id === role.id && speakingRole?.id !== role.id}
                      />
                    ))}
                  </div>

                  {/* Speech bubble */}
                  <AnimatePresence mode="wait">
                    {!isFacilitatorSpeakingTurn && speakingRole && lastMsg.text && (
                      <motion.div
                        key={lastMsg.id}
                        initial={rm ? { opacity: 1 } : { opacity: 0, y: isTopRow ? -4 : 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={rm ? { opacity: 0 } : { opacity: 0 }}
                        transition={{ duration: rm ? 0 : 0.2 }}
                        className={`relative z-20 max-w-md w-full ${isTopRow ? "mb-1" : "mt-1"}`}
                      >
                        {isTopRow && (
                          <div className="flex justify-center mb-[-1px]">
                            <div className="w-2.5 h-2.5 rotate-45 border-t border-l bg-card" style={{ borderColor: "var(--border)" }} />
                          </div>
                        )}
                        <div className="bg-card border border-border/50 rounded-xl px-5 py-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-semibold" style={{ color: getSpeakerColor(speakingRole.name) }}>{speakingRole.shortName}</span>
                            {lastMsg.targetName && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {"->"} {lastMsg.targetName}
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed text-foreground">{lastMsg.text}</p>
                        </div>
                        {!isTopRow && (
                          <div className="flex justify-center mt-[-1px]">
                            <div className="w-2.5 h-2.5 rotate-45 border-b border-r bg-card" style={{ borderColor: "var(--border)" }} />
                          </div>
                        )}
                      </motion.div>
                    )}

                  </AnimatePresence>

                  {/* Desk divider */}
                  <div className="relative w-full flex items-center justify-center py-1.5 z-0">
                    <div className="w-full max-w-xs h-px rounded-full" style={{ background: "linear-gradient(90deg, transparent, var(--border), var(--chrono-teal-dim), var(--border), transparent)", opacity: 0.25 }} />
                  </div>

                  {/* Bottom row avatars */}
                  <div className="flex items-start justify-center gap-8 mt-3 relative z-10">
                    {bottomRoles.map((role) => (
                      <Avatar
                        key={role.id}
                        role={role}
                        isSpeaking={speakingRole?.id === role.id}
                        isListening={listeningRole?.id === role.id && speakingRole?.id !== role.id}
                      />
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        )}

      </div>

      {/* Interaction Console Card */}
      <InteractionConsole
        dialogueMode={dialogueMode}
        setDialogueMode={setDialogueMode}
        onManualNext={handleManualNext}
        manualWaiting={manualWaiting}
        showDialogueControls={showDialogueControls}
      />
    </div>
  )
}
