"use client"

import { useRef, useEffect } from "react"
import { useChronoFork } from "@features/chronofork/state/context"
import { useI18n } from "@features/chronofork/i18n"
import { phaseColor } from "@features/chronofork/phaseColor"
import { roles, mockAnalysisHtml, scenes, dialogueBeats } from "@features/chronofork/mock/mockData"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown, ChevronUp, X,
  Zap, ArrowRight,
  Loader2,
} from "lucide-react"
import type { ChatMessage } from "@features/chronofork/state/types"

/* ════════════════════════════════════════════════════════════════
   TRANSCRIPT PANEL -- no timestamps, centered speakers
   ════════════════════════════════════════════════════════════════ */

const SPEAKER_COLORS = [
  "#0284c7", // Sky
  "#ea580c", // Amber
  "#059669", // Emerald
  "#4f46e5", // Indigo
  "#db2777", // Pink
  "#e11d48", // Rose
  "#7c3aed", // Violet
  "#d97706", // Orange
]

function getSpeakerColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length]
}

/** Resolve shortName/display name → canonical role.name so colors stay consistent with CenterStage avatars */
function resolveRoleName(name: string): string {
  return roles.find((r) => r.name === name || r.shortName === name)?.name ?? name
}

function getSpeakerEmoji(name: string, config: any): string | undefined {
  if (!config || !name) return undefined
  
  // Try exact match or substring match for user role
  const ur = config.user_role
  if (ur && (ur.name === name || name.includes(ur.name) || ur.name.includes(name))) {
    return ur.avatar
  }
  
  // Try exact match or substring match for cast data
  if (config.cast) {
    const cast = config.cast.find((c: any) => 
      c.name === name || name.includes(c.name) || c.name.includes(name)
    )
    if (cast) return cast.avatar
  }
  
  return undefined
}

function TranscriptPanel() {
  const { state } = useChronoFork()
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [state.chatHistory.length])

  const groups = groupBySpeakerPair(state.chatHistory, state.serverConfig)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {state.chatHistory.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-muted-foreground italic">
              {state.phase === "observe_idle" ? t("Start observation to see transcript.") : t("Waiting for dialogue...")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group, gi) => {
              const isSpecial = group.speakerName === "System" && !group.color
              return (
              <div key={gi} className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both">
                {/* Centered speaker header -- no timestamps */}
                {!isSpecial && (
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-[10px] text-muted-foreground/70">🗣️</span>
                    <SpeakerPill name={group.speakerName} emoji={group.emoji} color={group.color} />
                    {group.targetName && (
                      <>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground/70">👂</span>
                        <SpeakerPill name={group.targetName} emoji={group.targetEmoji} color={group.targetColor ?? "var(--muted-foreground)"} />
                      </>
                    )}
                  </div>
                )}
                {/* Messages */}
                <div className={`flex flex-col gap-1 ${isSpecial ? "" : "pl-2.5 border-l-[3px] ml-1"}`}
                  style={!isSpecial ? { borderLeftColor: `color-mix(in oklch, ${group.color} 30%, transparent)` } : {}}>
                  {group.messages.map((msg) => (
                    <TranscriptLine key={msg.id} message={msg} />
                  ))}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}

function SpeakerPill({ name, emoji, color }: { name: string; emoji?: string; color?: string }) {
  if (!color) return null
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md drop-shadow-sm tracking-wide bg-background/50 border border-border/50 flex items-center gap-1.5"
      style={{ color }}>
      {emoji && <span className="text-xs">{emoji}</span>}
      <span>{name}</span>
    </span>
  )
}

/* ── Grouping helper -- no timestamps ── */
interface MessageGroup {
  speakerName: string
  emoji?: string
  color: string
  targetName?: string
  targetEmoji?: string
  targetColor?: string
  sceneLabel?: string
  messages: ChatMessage[]
}

function groupBySpeakerPair(messages: ChatMessage[], config: any): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentGroup: MessageGroup | null = null

  for (const msg of messages) {
    if (msg.type === "node_update" || msg.type === "backtrack_complete" || msg.type === "history_divider") {
      groups.push({ speakerName: "System", color: "", messages: [msg] })
      currentGroup = null
      continue
    }

    const speakerName = msg.speakerName
    let color = getSpeakerColor(resolveRoleName(speakerName))
    if (msg.type === "user_chat" || msg.type === "user_diverge") color = "var(--chrono-teal)"
    const emoji = getSpeakerEmoji(speakerName, config)

    /* Scene label from matching beat */
    let sceneLabel: string | undefined
    if (msg.type === "dialogue" && msg.speakerId) {
      const matchingBeat = dialogueBeats.find((d) => d.speakerId === msg.speakerId && msg.text === d.text)
      if (matchingBeat) {
        const scene = scenes.find((s) => s.id === matchingBeat.sceneId)
        if (scene) sceneLabel = scene.time.split(" — ")[0]
      }
    }

    if (!currentGroup || currentGroup.speakerName !== speakerName) {
      let targetName: string | undefined
      let targetEmoji: string | undefined
      let targetColor: string | undefined
      
      if (msg.targetName && msg.targetName !== speakerName && msg.targetName !== "System" && msg.targetName !== "User") {
        targetName = msg.targetName
        targetEmoji = getSpeakerEmoji(msg.targetName, config)
        targetColor = getSpeakerColor(resolveRoleName(msg.targetName))
      } else if (msg.targetName === "User") {
        targetName = "User"
        targetEmoji = "👤"
        targetColor = "var(--chrono-teal)"
      }
      
      currentGroup = { speakerName, emoji, color, targetName, targetEmoji, targetColor, sceneLabel, messages: [msg] }
      groups.push(currentGroup)
    } else {
      currentGroup.messages.push(msg)
    }
  }
  return groups
}

function TranscriptLine({ message }: { message: ChatMessage }) {
  const { t } = useI18n()
  
  if (message.type === "node_update") {
    const { from_id, to_id } = message.meta || {}
    if (from_id === 'start') {
      return (
        <div className="text-center text-[#28a745] my-5 font-bold animate-in fade-in zoom-in duration-500">
          🌱 {t("Story begins from node ")}{to_id}{t(" starts")}
        </div>
      )
    } else if (to_id === 'end') {
      return (
        <div className="text-center text-[#dc3545] my-5 font-bold animate-in fade-in zoom-in duration-500">
          🏁 {t("Reached ending (node ")}{from_id}{t(")")}
        </div>
      )
    } else {
      return (
        <div className="text-center text-[#888] text-[0.9em] my-[15px] animate-in fade-in duration-500 flex items-center justify-center gap-2">
          <span className="h-px bg-border flex-1" />
          <span>── 📍 {t("Path transition: ")}{from_id} ➔ {to_id} ──</span>
          <span className="h-px bg-border flex-1" />
        </div>
      )
    }
  }

  if (message.type === "backtrack_complete") {
    const { new_role, new_node_id } = message.meta || {}
    return (
      <div className="my-6 p-4 rounded-xl bg-muted/40 border border-border/50 backdrop-blur-sm text-center animate-in slide-in-from-bottom-2 fade-in duration-500">
        <h4 className="text-sm font-bold mb-1 flex items-center justify-center gap-1.5"><Zap className="w-4 h-4 text-chrono-teal" /> 🔄 {t("Backtrack complete")}</h4>
        <p className="text-xs text-muted-foreground">
          {t("Backtracked as ")}<b className="text-foreground">{new_role}</b>{t(" to node ")}<b className="text-foreground">{new_node_id}</b>{t("。")}
        </p>
      </div>
    )
  }

  if (message.type === "history_divider") {
    return (
      <div className="text-center text-muted-foreground/80 font-mono text-[10px] my-6 flex items-center justify-center gap-2 animate-in fade-in duration-700">
        <span className="h-px bg-border/50 flex-1" />
        <span className="px-2 py-0.5 rounded-full bg-muted/30 border border-border/30">── 📝 {t("Previous interaction context")} ──</span>
        <span className="h-px bg-border/50 flex-1" />
      </div>
    )
  }

  const isDiverge = message.type === "user_diverge"
  const isSystem = message.type === "system"
  if (isSystem) return <div className="text-center py-2"><span className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-2 py-0.5 rounded-md">{message.text}</span></div>

  const isUser = message.type === "user_chat" || message.type === "user_diverge"

  return (
    <div className={`py-1.5 px-3 rounded-xl my-0.5 transition-colors hover:bg-muted/30 ${isDiverge ? "border border-chrono-amber/20" : ""}`}
      style={isDiverge ? { backgroundColor: "color-mix(in oklch, var(--chrono-amber) 6%, transparent)" } : 
             isUser ? { backgroundColor: "color-mix(in oklch, var(--chrono-teal) 4%, transparent)" } : undefined}>
      <p className="text-[13px] text-foreground/90 leading-[1.6]">
        {isDiverge && <Badge variant="outline" className="text-[9px] font-mono mr-1.5 py-0 px-1 rounded-sm" style={{ color: "var(--chrono-amber)", borderColor: "color-mix(in oklch, var(--chrono-amber) 30%, transparent)", backgroundColor: "color-mix(in oklch, var(--chrono-amber) 10%, transparent)" }}>{t("DIVERGE")}</Badge>}
        {message.text}
      </p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   ANALYSIS PANEL -- HTML container via dangerouslySetInnerHTML
   ════════════════════════════════════════════════════════════════ */

function AnalysisPanelContent() {
  const { state } = useChronoFork()
  /* Use server-provided HTML if available, otherwise fall back to mock */
  const html = state.analysisHtml ?? mockAnalysisHtml

  return (
    <div className="p-4">
      <div className="rounded-xl border p-5 shadow-sm divergence-report"
        style={{
          backgroundColor: "color-mix(in oklch, var(--chrono-amber) 4%, var(--card))",
          borderColor: "color-mix(in oklch, var(--chrono-amber) 20%, transparent)",
        }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <style jsx global>{`
        .divergence-report .divergence-quote {
          font-style: italic;
          color: var(--foreground);
          line-height: 1.65;
          border-left: 3px solid color-mix(in oklch, var(--chrono-amber) 40%, transparent);
          padding-left: 10px;
          margin-bottom: 12px;
          font-size: 12px;
        }
        .divergence-report .score-container {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 12px;
          font-size: 12px;
        }
        .divergence-report .progress-track {
          flex: 1;
          height: 8px;
          border-radius: 9999px;
          background: color-mix(in oklch, var(--border) 70%, transparent);
          overflow: hidden;
        }
        .divergence-report .progress-fill {
          height: 100%;
          border-radius: 9999px;
        }
        .divergence-report .drivers-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 10px;
        }
        @media (min-width: 640px) {
          .divergence-report .drivers-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .divergence-report .driver-col {
          border: 1px solid color-mix(in oklch, var(--border) 65%, transparent);
          border-radius: 10px;
          padding: 10px;
          background: color-mix(in oklch, var(--background) 85%, transparent);
        }
        .divergence-report .driver-col h4 {
          margin: 0 0 8px;
          font-size: 12px;
          color: var(--foreground);
        }
        .divergence-report .driver-col ul {
          margin: 0;
          padding-left: 16px;
        }
        .divergence-report .driver-col li {
          margin-bottom: 4px;
          color: var(--foreground);
          font-size: 12px;
          line-height: 1.5;
        }
        /* Override backend inline font-size for projected outcomes block */
        .divergence-report div[style*="font-size: 1.1em"] {
          font-size: 13px !important;
          line-height: 1.45 !important;
        }
        .divergence-report div[style*="margin-bottom: 4px"] {
          font-size: 12px !important;
          line-height: 1.55 !important;
        }
        .divergence-report div[style*="margin-bottom: 4px"] span {
          font-size: inherit !important;
        }
        .divergence-report div[style*="font-size: 0.95em"] {
          font-size: 11px !important;
          line-height: 1.45 !important;
        }
      `}</style>
    </div>
  )
}

/* ── Divergence Loader ── */
function DivergenceLoader() {
  const { t } = useI18n()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 gap-3">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--chrono-amber)" }} />
      <p className="text-sm font-mono" style={{ color: "var(--chrono-amber)" }}>{t("Temporal recalculation…")}</p>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--chrono-amber)" }}
            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }} />
        ))}
      </div>
    </motion.div>
  )
}

/* ── Glass Card Wrapper ── */
function FloatingCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`glass-panel rounded-xl shadow-lg overflow-hidden ${className}`} style={style}>
      {children}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN DOCK -- Flex column, transcript + tips/analysis 50/50 split
   ════════════════════════════════════════════════════════════════ */

export function TacticalHUDDock() {
  const { state, dispatch } = useChronoFork()
  const { t } = useI18n()
  const { phase } = state
  const isOpen = state.ui.docks.rightOpen
  const showDivergenceLoader = phase === "divergence_running"
  const pc = phaseColor(phase)

  const showAnalysisCard = state.ui.showAnalysis || showDivergenceLoader
  const hasBottomPanel = showAnalysisCard

  return (
    <div className="absolute right-3 top-3 bottom-3 z-30 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380, width: 350 }}>
      {/* Transcript Card -- shrinks to header when collapsed, grows to fill otherwise */}
      <FloatingCard
        className="pointer-events-auto flex flex-col min-h-0"
        style={{ flex: isOpen ? (hasBottomPanel ? "1 1 50%" : "1 1 100%") : "0 0 auto", minHeight: 0 }}
      >
        <button
          onClick={() => dispatch({ type: "TOGGLE_DOCK", data: { dock: "right" } })}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-secondary/20 transition-colors shrink-0"
          aria-label={isOpen ? t("Collapse transcript") : t("Expand transcript")}
        >
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground flex-1">{t("Transcript")}</h3>
          {isOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </button>
        {isOpen && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col border-t border-border/20">
            <TranscriptPanel />
          </div>
        )}
      </FloatingCard>

      {/* Analysis Card -- 50% of space, shows loader first, then HTML container */}
      <AnimatePresence>
        {showAnalysisCard && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto flex flex-col min-h-0"
            style={{ flex: "1 1 50%", minHeight: 0 }}
          >
            <FloatingCard className="flex flex-col h-full min-h-0">
              <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
                <Zap className="w-3.5 h-3.5" style={{ color: pc }} />
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest flex-1" style={{ color: pc }}>{t("Analysis")}</h3>
                {!showDivergenceLoader && (
                  <button onClick={() => dispatch({ type: "CLOSE_ANALYSIS" })} className="text-muted-foreground hover:text-foreground" aria-label={t("Close analysis")}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="border-t border-border/20" />
              <div className="flex-1 overflow-y-auto min-h-0">
                {showDivergenceLoader && !state.analysis.available ? <DivergenceLoader /> : <AnalysisPanelContent />}
              </div>
            </FloatingCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
