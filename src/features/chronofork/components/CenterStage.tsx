"use client"

import { useEffect, useState } from "react"
import { DEFAULT_WS_URL } from "@features/chronofork/api/useWebSocket"
import { useChronoFork } from "@features/chronofork/state/context"
import { useI18n } from "@features/chronofork/i18n"
import { phaseColor, phaseTone } from "@features/chronofork/phaseColor"
import { roles, scenes, dialogueBeats, mockDivergenceAnalysis, mockReportData, episode, timelineNodes, type DialogueBeat, type Role } from "@features/chronofork/mock/mockData"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Clock, Play, Pause, Bookmark, Info, Send, Zap, Loader2, Eye, Users, ToggleLeft, ToggleRight, BookOpen, X, ArrowLeft, Download, GitFork, Target, Wifi, WifiOff, Database, Lightbulb, FileCheck } from "lucide-react"
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
  const graphNodeCount = state.serverGraph?.current_path?.length ?? 0
  const totalNodes = Math.max(configuredNodeCount, graphNodeCount, 1)
  const totalSegments = Math.max(totalNodes - 1, 1)

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
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL)
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
      {isWS && state.serverConfig?.cast_data && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {state.serverConfig.cast_data.slice(0, 5).map((c, i) => (
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
  const [paused, setPaused] = useState(false)
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
  const isWS = state.connectionStatus === "connected"
  const playableRoles = roles.filter((r) => r.id !== "facilitator")
  const selectableServerRoles = state.serverConfig?.cast_data ?? []
  const hasNode = !!state.selectedNodeId
  const hasRole = !!state.activeRoleId
  const pc = phaseColor(state.phase)
  const tone = phaseTone(state.phase)
  const selectedNodeLabel = state.selectedNodeId
    ? (state.serverGraph?.nodes.find((node) => node.id === state.selectedNodeId)?.label_id
      ?? timelineNodes.find((node) => node.id === state.selectedNodeId)?.label
      ?? state.selectedNodeId)
    : null
  const selectedNodeTitle = selectedNodeLabel ? t("Selected Node: ") + selectedNodeLabel : null

  const handleBacktrack = () => {
    if (!state.selectedNodeId) return
    if (isWS) {
      // Send backtrack_to via WebSocket
      const perspectiveAgent = state.activeRoleName ?? (state.activeRoleId ? roles.find((r) => r.id === state.activeRoleId)?.name ?? "" : "")
      ws.send("backtrack_to", {
        target_id: state.selectedNodeId,
        perspective_agent: perspectiveAgent,
      })
      toast.success(t("Backtrack request sent..."))
    } else {
      // Mock mode: local dispatch
      dispatch({ type: "BACKTRACK_AND_INTERVENE", data: { nodeId: state.selectedNodeId } })
      toast.success(t("Backtracking..."))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4" style={{ color: pc }} />
        <span className="text-sm font-semibold text-foreground">{t("Backtrack Setup")}</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t("Select a node (left panel) and a character below to backtrack.")}
      </p>
      {/* Show server cast_data if connected, otherwise local roles */}
      {isWS && selectableServerRoles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectableServerRoles.map((c, i) => {
            const isActive = state.activeRoleName === c.name
            return (
              <button
                key={i}
                onClick={() => dispatch({ type: "SET_ROLE", data: { roleId: c.name, roleName: c.name } })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                style={{
                  backgroundColor: isActive ? "color-mix(in oklch, var(--chrono-teal) 15%, transparent)" : "var(--secondary)",
                  borderColor: isActive ? "var(--chrono-teal)" : "transparent",
                  color: isActive ? "var(--chrono-teal)" : "var(--muted-foreground)",
                }}
              >
                <span className="text-lg">{c.avatar}</span>
                {c.name.split(" ").pop()}
              </button>
            )
          })}
        </div>
      ) : (
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
      )}
      <Button
        size="default"
        tone={tone}
        className="w-full text-sm h-9 gap-2 font-semibold text-primary-foreground"
        disabled={!hasNode || (!hasRole && !state.activeRoleName)}
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
  const userRoleName = state.serverConfig?.user_role?.name
  const userRoleTitle = state.serverConfig?.user_role?.title
  const activeRole = state.activeRoleId ? roles.find((r) => r.id === state.activeRoleId) : null
  const roleName = userRoleName ?? state.activeRoleName ?? activeRole?.name ?? activeRole?.shortName ?? "You"
  const targetRoles = roles.filter((r) => r.id !== "facilitator" && r.id !== state.activeRoleId)
  const serverTargets = (state.serverConfig?.cast_data ?? []).filter((c) => c.name !== roleName)
  const [targetId, setTargetId] = useState<string | null>(null)
  const pc = phaseColor(state.phase)
  const tone = phaseTone(state.phase)

  // Auto-select target when a specific agent sends an input_request to the user
  useEffect(() => {
    if (state.inputRequest?.from_name) {
      setTargetId(state.inputRequest.from_name)
    }
  }, [state.inputRequest?.from_name])

  // Apply tip fill: set text + target when TacticalHUDDock selects an option
  useEffect(() => {
    if (state.pendingTipFill) {
      setText(state.pendingTipFill.text)
      setTargetId(state.pendingTipFill.targetName)
      dispatch({ type: "CLEAR_PENDING_TIP_FILL" })
    }
  }, [state.pendingTipFill, dispatch])

  const handleSend = () => {
    if (!text.trim()) return

    if (isWS) {
      const targetName = targetId ?? ""
      if (!targetName) {
        toast.error(t("Select a recipient before sending."))
        return
      }
      ws.send("user_message", { content: text.trim(), target: targetName })
      dispatch({ type: "SEND_CHAT", data: { text: text.trim(), speakerName: roleName, targetName } })
      setText("")
      return
    }

    // Mock mode
    if (text.trim().startsWith("DIVERGE:")) {
      dispatch({ type: "SEND_DIVERGE", data: { text: text.trim(), speakerName: roleName } })
      toast.success(t("Intervention committed. Computing divergence..."))
      setTimeout(() => dispatch({ type: "DIVERGENCE_COMPLETE" }), 1500)
      setTimeout(() => {
        dispatch({ type: "ANALYSIS_COMPLETE", data: { analysis: {
          available: true, plausibility: mockDivergenceAnalysis.plausibility,
          drivers: mockDivergenceAnalysis.drivers, constraints: mockDivergenceAnalysis.constraints,
          outcomes: mockDivergenceAnalysis.outcomes, causalChain: mockDivergenceAnalysis.causalChain,
        }}})
      }, 4000)
    } else {
      dispatch({ type: "SEND_CHAT", data: { text: text.trim(), speakerName: roleName } })
    }
  }

  const handleRequestTip = () => {
    if (isWS) {
      dispatch({ type: "SET_TIP_LOADING", data: { loading: true } })
      ws.send("request_tip", {})
    } else {
      dispatch({ type: "TOGGLE_TIPS" })
    }
  }

  const showCheckPrevious = state.ui.analysisViewed && !state.ui.showAnalysis && (state.analysis.available || !!state.analysisHtml)

  /* Show input_request prompt from server */
  return (
    <div className="flex flex-col gap-2.5">
      {/* Input request prompt from server */}
      {state.inputRequest && (
        <div className="rounded-lg px-2.5 py-1.5 text-xs italic text-foreground/80"
          style={{ backgroundColor: "color-mix(in oklch, var(--chrono-amber) 8%, transparent)", borderLeft: "3px solid var(--chrono-amber)" }}>
          {state.inputRequest.from_name ? (
            <>
              <span className="font-bold not-italic">{state.inputRequest.from_name}</span>
              {t(" is talking to you.")} {t("Respond or select another character.")}
            </>
          ) : (
            state.inputRequest.msg
          )}
        </div>
      )}
      {/* Target person buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground font-mono shrink-0">{t("TO:")}</span>
        {isWS && serverTargets.length > 0 ? (
          serverTargets.map((c, i) => {
            const isT = targetId === c.name
            return (
              <button key={i} onClick={() => setTargetId(isT ? null : c.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${isT ? "text-primary-foreground" : "text-muted-foreground border-border/30 hover:text-foreground"}`}
                style={isT ? { backgroundColor: pc, borderColor: pc } : undefined}
              >
                {c.avatar} {c.name.split(" ").pop()}
              </button>
            )
          })
        ) : (
          targetRoles.map((r) => {
            const isT = targetId === r.id
            return (
              <button key={r.id} onClick={() => setTargetId(isT ? null : r.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${isT ? "text-primary-foreground" : "text-muted-foreground border-border/30 hover:text-foreground"}`}
                style={isT ? { backgroundColor: pc, borderColor: pc } : undefined}
              >
                {r.shortName}
              </button>
            )
          })
        )}
      </div>
      <div className="flex">
        <Textarea
          tone={tone}
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder={`${t("Type in character as")} ${userRoleTitle ? `${roleName} (${userRoleTitle})` : roleName}...`}
          className="min-h-[52px] w-full text-sm bg-card/50 border-border/30 resize-none leading-relaxed" rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        />
      </div>
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
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
          {isWS && (
            <Button
              size="sm"
              variant="outline"
              tone={tone}
              className="text-xs h-7 px-2.5 gap-1 border-border/40"
              onClick={() => dispatch({ type: "BACK_TO_INTERVENE" })}
            >
              <Target className="w-3.5 h-3.5" /> {t("Jump to another node")}
            </Button>
          )}
          <Button size="sm" variant="outline" tone={tone} className="text-xs h-7 px-2.5 gap-1 border-border/40"
            disabled={state.tipLoading}
            onClick={handleRequestTip}>
            {state.tipLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
            {t("Tips (Take ~10s)")}
          </Button>
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
                  setTimeout(() => {
                    dispatch({ type: "ANALYSIS_COMPLETE", data: { analysis: {
                      available: true, plausibility: mockDivergenceAnalysis.plausibility,
                      drivers: mockDivergenceAnalysis.drivers, constraints: mockDivergenceAnalysis.constraints,
                      outcomes: mockDivergenceAnalysis.outcomes, causalChain: mockDivergenceAnalysis.causalChain,
                    }}})
                  }, 4000)
                }
              }}>
              <Zap className="w-3.5 h-3.5" /> {t("Trigger Divergence")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <Button
            size="sm"
            tone={tone}
            className="h-8 px-3 gap-1.5 font-semibold text-primary-foreground"
            disabled={!text.trim()}
            onClick={handleSend}
            aria-label={t("Send")}
          >
            <Send className="w-4 h-4" />
            <span>{t("Send")}</span>
          </Button>
        </div>
      </div>
    </div>
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

  if (!content && !showReport) return null

  const pc = phaseColor(phase)

  return (
    <>
      {content && !showReport && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-xl">
          <div className="glass-panel-heavy rounded-2xl px-5 py-4 shadow-xl border-t-2"
            style={{ borderTopColor: pc }}>
            {content}
          </div>
        </div>
      )}

      {/* Reflection Report overlay */}
      <AnimatePresence>
        {showReport && <ReflectionReportOverlay onReturn={handleReturnFromReport} />}
      </AnimatePresence>
    </>
  )
}

/* ── Main CenterStage ��─ */
function NodeUpdateToast({ msg }: { msg: { id?: string; meta?: { from_id?: string; to_id?: string } } }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(timer)
  }, [msg.id])

  const isStart = msg.meta?.from_id === "start"
  const nodeLabel = msg.meta?.to_id

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="node-update-toast"
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute top-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        >
          <div className="bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl border border-border/50 shadow-xl flex items-center gap-2">
            <span className="text-lg">{isStart ? "🌱" : "📍"}</span>
            <h2 className="text-xs font-bold font-mono tracking-wider text-foreground whitespace-nowrap">
              {isStart
                ? t("Story begins from node ") + nodeLabel + t(" starts")
                : t("Path transition: ") + msg.meta?.from_id + " ➔ " + nodeLabel}
            </h2>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function CenterStage() {
  const { state, ws, dispatch } = useChronoFork()
  const { setLocale, t } = useI18n()
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
      ws.stepMessageQueue()
      setManualWaiting(true)
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
              
              const serverRoles: StageRole[] = (state.serverConfig?.cast_data ?? []).map((c) => ({
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

        {/* Node update toast (auto-dismisses after 3.5s) */}
        {!isIdle && state.connectionStatus === "connected" && (() => {
          const latestNodeUpdate = state.chatHistory.filter((m) => m.type === "node_update").pop()
          return latestNodeUpdate ? <NodeUpdateToast key={latestNodeUpdate.id} msg={latestNodeUpdate} /> : null
        })()}
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
