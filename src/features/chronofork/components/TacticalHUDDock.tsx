"use client"

import { useState, useRef, useEffect } from "react"
import { useChronoFork } from "@features/chronofork/state/context"
import { phaseColor } from "@features/chronofork/phaseColor"
import { roles, structuredTips, mockAnalysisHtml, scenes, dialogueBeats } from "@features/chronofork/mock/mockData"
import type { StrategyOption } from "@features/chronofork/mock/mockData"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronDown, ChevronUp, X,
  Zap, Anchor, ArrowRight, Users, Target, AlertTriangle, Search, Shield,
  Loader2, Info,
} from "lucide-react"
import type { ChatMessage } from "@features/chronofork/state/types"
import { toast } from "sonner"

/* ════════════════════════════════════════════════════════════════
   TRANSCRIPT PANEL -- no timestamps, centered speakers
   ════════════════════════════════════════════════════════════════ */

function TranscriptPanel() {
  const { state } = useChronoFork()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [state.chatHistory.length])

  const groups = groupBySpeakerPair(state.chatHistory)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {state.chatHistory.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-muted-foreground italic">
              {state.phase === "observe_idle" ? "Start observation to see transcript." : "Waiting for dialogue..."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group, gi) => (
              <div key={gi}>
                {/* Centered speaker header -- no timestamps */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <SpeakerPill name={group.speakerName} color={group.color} />
                  {group.targetName && (
                    <>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                      <SpeakerPill name={group.targetName} color={group.targetColor ?? "var(--muted-foreground)"} />
                    </>
                  )}
                </div>
                {/* Messages */}
                <div className="flex flex-col gap-1 pl-2.5 border-l-2 border-border/15 ml-1">
                  {group.messages.map((msg) => (
                    <TranscriptLine key={msg.id} message={msg} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SpeakerPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-md"
      style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`, color }}>
      {name}
    </span>
  )
}

/* ── Grouping helper -- no timestamps ── */
interface MessageGroup {
  speakerName: string
  color: string
  targetName?: string
  targetColor?: string
  sceneLabel?: string
  messages: ChatMessage[]
}

function groupBySpeakerPair(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentGroup: MessageGroup | null = null

  for (const msg of messages) {
    const role = msg.speakerId ? roles.find((r) => r.id === msg.speakerId) : null
    const color = role?.portrait ?? (msg.type === "user_chat" || msg.type === "user_diverge" ? "var(--chrono-teal)" : "var(--muted-foreground)")
    const speakerName = msg.speakerName

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
      let targetColor: string | undefined
      const idx = messages.indexOf(msg)
      if (idx > 0) {
        const prev = messages[idx - 1]
        if (prev.speakerName !== speakerName) {
          targetName = prev.speakerName
          const tRole = prev.speakerId ? roles.find((r) => r.id === prev.speakerId) : null
          targetColor = tRole?.portrait ?? "var(--muted-foreground)"
        }
      }
      currentGroup = { speakerName, color, targetName, targetColor, sceneLabel, messages: [msg] }
      groups.push(currentGroup)
    } else {
      currentGroup.messages.push(msg)
    }
  }
  return groups
}

function TranscriptLine({ message }: { message: ChatMessage }) {
  const isDiverge = message.type === "user_diverge"
  const isSystem = message.type === "system"
  if (isSystem) return <div className="text-center py-1"><span className="text-xs text-muted-foreground font-mono">{message.text}</span></div>

  return (
    <div className={`py-1 ${isDiverge ? "rounded-lg px-2.5 -mx-1" : ""}`}
      style={isDiverge ? { backgroundColor: "color-mix(in oklch, var(--chrono-amber) 8%, transparent)" } : undefined}>
      <p className="text-xs text-foreground/90 leading-relaxed">
        {isDiverge && <Badge variant="outline" className="text-[10px] font-mono mr-1 py-0" style={{ color: "var(--chrono-amber)", borderColor: "color-mix(in oklch, var(--chrono-amber) 30%, transparent)" }}>DIVERGE</Badge>}
        {message.text}
      </p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   TIPS PANEL -- Structured per spec
   ════════════════════════════════════════════════════════════════ */

const intentColors: Record<string, { bg: string; text: string; label: string }> = {
  escalation: { bg: "color-mix(in oklch, var(--chrono-red) 12%, transparent)", text: "var(--chrono-red)", label: "Escalation" },
  "de-escalation": { bg: "color-mix(in oklch, var(--chrono-teal) 12%, transparent)", text: "var(--chrono-teal)", label: "De-escalation" },
  alliance_building: { bg: "color-mix(in oklch, var(--faction-us) 12%, transparent)", text: "var(--faction-us)", label: "Alliance Building" },
  info_gathering: { bg: "color-mix(in oklch, var(--chrono-amber) 12%, transparent)", text: "var(--chrono-amber)", label: "Info Gathering" },
}

function intentIcon(type: string) {
  switch (type) {
    case "escalation": return <AlertTriangle className="w-3.5 h-3.5" />
    case "de-escalation": return <Shield className="w-3.5 h-3.5" />
    case "alliance_building": return <Users className="w-3.5 h-3.5" />
    case "info_gathering": return <Search className="w-3.5 h-3.5" />
    default: return <Zap className="w-3.5 h-3.5" />
  }
}

function OptionCard({ option, onSelect }: { option: StrategyOption; onSelect: () => void }) {
  const ic = intentColors[option.intentType] ?? intentColors.info_gathering
  const targetRole = roles.find((r) => r.id === option.targetAgentId)

  return (
    <div className="flex flex-col rounded-xl border border-border/30 bg-card/60 overflow-hidden">
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        {/* Intent badge */}
        <div className="flex items-center gap-2">
          <Badge className="text-[10px] font-mono gap-1 py-0.5 px-2 border-0" style={{ backgroundColor: ic.bg, color: ic.text }}>
            {intentIcon(option.intentType)} {ic.label}
          </Badge>
        </div>
        {/* Target */}
        {targetRole && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-mono">TO:</span>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{ backgroundColor: `color-mix(in oklch, ${targetRole.portrait} 20%, transparent)`, color: targetRole.portrait }}>
              {targetRole.shortName.slice(0, 2)}
            </div>
            <span className="text-xs font-medium text-foreground">{targetRole.shortName}</span>
          </div>
        )}
        {/* Label */}
        <p className="text-xs font-semibold text-foreground leading-snug">{option.label}</p>
        {/* Example response quote */}
        <blockquote className="border-l-2 border-border/30 pl-2.5 text-xs text-muted-foreground italic leading-relaxed">
          {option.exampleResponse}
        </blockquote>
        {/* Why / Risk blocks */}
        <div className="flex flex-col gap-1.5">
          <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "color-mix(in oklch, var(--chrono-teal) 6%, transparent)" }}>
            <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "var(--chrono-teal)" }}>Why</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{option.why}</p>
          </div>
          <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "color-mix(in oklch, var(--chrono-red) 6%, transparent)" }}>
            <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "var(--chrono-red)" }}>Risk</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{option.risk}</p>
          </div>
        </div>
      </div>
      {/* Select button */}
      <button onClick={onSelect}
        className="w-full py-2 text-xs font-semibold transition-colors hover:opacity-90 text-primary-foreground"
        style={{ backgroundColor: ic.text }}>
        Select Option
      </button>
    </div>
  )
}

function TipsPanelContent({ onSelectOption }: { onSelectOption: (opt: StrategyOption) => void }) {
  const { state } = useChronoFork()

  /* Use server-driven tips if available, otherwise fall back to mock */
  const serverTips = state.tipData
  const tips = structuredTips

  /* Map server tip options to StrategyOption format */
  const serverOptions: StrategyOption[] | null = serverTips ? serverTips.options.map((o, i) => {
    const intentMap: Record<string, StrategyOption["intentType"]> = {
      "Escalation": "escalation",
      "De-escalation": "de-escalation",
      "Alliance Building": "alliance_building",
      "Info Gathering": "info_gathering",
    }
    const targetRole = roles.find((r) => r.name === o.target_agent || r.shortName === o.target_agent)
    return {
      id: `server-opt-${i}`,
      label: o.label,
      intentType: intentMap[o.intent_type] ?? "info_gathering",
      targetAgentId: targetRole?.id ?? o.target_agent,
      exampleResponse: o.example_response,
      why: o.rationale,
      risk: o.risks,
    }
  }) : null

  const displaySituation = serverTips?.situation_analysis ?? tips.situationAnalysis
  const displayOptions = serverOptions ?? tips.options

  /* Show error if tip request failed */
  if (state.tipError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 px-4">
        <AlertTriangle className="w-7 h-7" style={{ color: "var(--chrono-red)" }} />
        <p className="text-sm text-center text-foreground/80">{state.tipError}</p>
      </div>
    )
  }

  /* Show loading if tips are being fetched */
  if (state.tipLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--chrono-amber)" }} />
        <p className="text-sm font-mono" style={{ color: "var(--chrono-amber)" }}>Generating strategic advice...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Situation Analysis */}
      <div className="rounded-xl p-3 border-l-4 flex gap-2.5"
        style={{ borderLeftColor: "var(--faction-us)", backgroundColor: "color-mix(in oklch, var(--faction-us) 5%, transparent)" }}>
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--faction-us)" }} />
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--faction-us)" }}>Situation Analysis</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{displaySituation}</p>
        </div>
      </div>
      {/* Options -- single column */}
      <div className="flex flex-col gap-3">
        {displayOptions.map((opt) => (
          <OptionCard key={opt.id} option={opt} onSelect={() => onSelectOption(opt)} />
        ))}
      </div>
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
      <div className="rounded-xl border p-5 shadow-sm"
        style={{
          backgroundColor: "color-mix(in oklch, var(--chrono-amber) 4%, var(--card))",
          borderColor: "color-mix(in oklch, var(--chrono-amber) 20%, transparent)",
        }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}

/* ── Divergence Loader ── */
function DivergenceLoader() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 gap-3">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--chrono-amber)" }} />
      <p className="text-sm font-mono" style={{ color: "var(--chrono-amber)" }}>{"Temporal recalculation\u2026"}</p>
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
  const { phase } = state
  const [transcriptOpen, setTranscriptOpen] = useState(true)
  const showDivergenceLoader = phase === "divergence_running"
  const pc = phaseColor(phase)

  /* Only one of tips/analysis open at a time */
  const showAnalysisCard = state.ui.showAnalysis || showDivergenceLoader
  const showTipsCard = state.ui.showTips && !showAnalysisCard
  const hasBottomPanel = showTipsCard || showAnalysisCard

  const handleSelectOption = (opt: StrategyOption) => {
    dispatch({ type: "CLOSE_TIPS" })
    toast.success(`Selected: ${opt.label}. Response inserted.`)
  }

  return (
    <div className="absolute right-3 top-3 bottom-3 z-30 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 320, width: 300 }}>
      {/* Transcript Card -- shrinks to header when collapsed, grows to fill otherwise */}
      <FloatingCard
        className="pointer-events-auto flex flex-col min-h-0"
        style={{ flex: transcriptOpen ? (hasBottomPanel ? "1 1 50%" : "1 1 100%") : "0 0 auto", minHeight: 0 }}
      >
        <button
          onClick={() => setTranscriptOpen(!transcriptOpen)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-secondary/20 transition-colors shrink-0"
          aria-label={transcriptOpen ? "Collapse transcript" : "Expand transcript"}
        >
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground flex-1">Transcript</h3>
          {transcriptOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </button>
        {transcriptOpen && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col border-t border-border/20">
            <TranscriptPanel />
          </div>
        )}
      </FloatingCard>

      {/* Tips Card -- 50% of space */}
      <AnimatePresence>
        {showTipsCard && (
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
                <Target className="w-3.5 h-3.5" style={{ color: pc }} />
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest flex-1" style={{ color: pc }}>Strategic Advisor</h3>
                <button onClick={() => dispatch({ type: "CLOSE_TIPS" })} className="text-muted-foreground hover:text-foreground" aria-label="Close tips">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="border-t border-border/20" />
              <div className="flex-1 overflow-y-auto min-h-0">
                <TipsPanelContent onSelectOption={handleSelectOption} />
              </div>
            </FloatingCard>
          </motion.div>
        )}
      </AnimatePresence>

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
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest flex-1" style={{ color: pc }}>Analysis</h3>
                {!showDivergenceLoader && (
                  <button onClick={() => dispatch({ type: "CLOSE_ANALYSIS" })} className="text-muted-foreground hover:text-foreground" aria-label="Close analysis">
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
