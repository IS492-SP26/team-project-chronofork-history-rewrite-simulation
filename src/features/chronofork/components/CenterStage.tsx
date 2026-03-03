"use client"

import { useEffect, useState } from "react"
import { useChronoFork } from "@features/chronofork/state/context"
import { useI18n } from "@features/chronofork/i18n"
import { phaseColor } from "@features/chronofork/phaseColor"
import { roles, scenes, dialogueBeats, mockDivergenceAnalysis, mockReportData, episode, type DialogueBeat, type Role } from "@features/chronofork/mock/mockData"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Clock, Play, Pause, Bookmark, Info, Send, Zap, Loader2, Eye, Users, ToggleLeft, ToggleRight, BookOpen, X, ArrowLeft, Download, GitFork, Target, Wifi, WifiOff, Database } from "lucide-react"
import { toast } from "sonner"

/* ── helpers ── */
function getFaction(role: Role): "us" | "soviet" | "neutral" {
  if (["jfk", "rfk", "mcnamara", "lemay"].includes(role.id)) return "us"
  if (["khrushchev"].includes(role.id)) return "soviet"
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

function Avatar({ role, isSpeaking, latestEmotion }: { role: Role; isSpeaking: boolean; latestEmotion?: DialogueBeat["emotion"] }) {
  const f = getFaction(role)
  const fs = factionStyle(f)
  return (
    <div className={`flex flex-col items-center gap-1 transition-opacity duration-200 ${isSpeaking ? "opacity-100" : "opacity-30"}`}>
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold transition-all ${isSpeaking ? "animate-breathe" : ""}`}
        style={{
          backgroundColor: fs.bg, color: fs.ring,
          border: isSpeaking ? `2px solid ${fs.ring}` : "2px solid transparent",
          boxShadow: isSpeaking ? fs.glow : "none",
        }}
      >
        {role.shortName.slice(0, 2)}
      </div>
      <span className="text-xs font-semibold text-muted-foreground max-w-[60px] truncate text-center leading-tight">
        {role.shortName}
      </span>
      {latestEmotion && isSpeaking && <EmotionDot emotion={latestEmotion} />}
    </div>
  )
}

/* ── Facilitator Strip -- standard glass card, constrained width ── */
function FacilitatorStrip({ text }: { text: string }) {
  const { t } = useI18n()
  return (
    <div className="flex justify-center px-4 py-1.5 shrink-0">
      <div className="glass-panel max-w-lg w-full rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "color-mix(in oklch, var(--chrono-violet) 15%, transparent)" }}>
            <Eye className="w-3 h-3" style={{ color: "var(--chrono-violet)" }} />
          </div>
          <span className="text-xs font-mono uppercase tracking-wider font-bold" style={{ color: "var(--chrono-violet)" }}>{t("Facilitator")}</span>
        </div>
        <p className="text-sm text-foreground/80 italic leading-relaxed">{text}</p>
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
  const [wsUrl, setWsUrl] = useState("ws://localhost:8000/ws")
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
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">{t("Server Address")}</label>
            <input
              type="text"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-card/80 border border-border/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              placeholder="ws://localhost:8000/ws"
              disabled={isConnecting}
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2 w-full">
            <Button
              size="default"
              className="w-full gap-2 text-sm font-semibold text-primary-foreground"
              style={{ backgroundColor: "var(--chrono-teal)" }}
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
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
          {state.serverConfig?.episode?.emoji ?? ""} {state.serverConfig?.episode?.title ? "" : episode.year}
        </p>
        <h2 className="text-lg font-bold text-foreground text-balance">
          {state.serverConfig?.episode?.title ?? episode.title}: {episode.subtitle}
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
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-secondary border border-border/30">
                {c.avatar}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[60px]">{c.name.split(" ").pop()}</span>
            </div>
          ))}
        </div>
      )}
      {/* User role badge from server config */}
      {isWS && state.serverConfig?.user_role && (
        <div className="flex justify-center">
          <Badge variant="outline" className="text-sm font-mono gap-1.5 px-3 py-1.5" style={{ borderColor: "var(--chrono-amber)", color: "var(--chrono-amber)" }}>
            <Target className="w-3.5 h-3.5" />
            {t("Role:")} {state.serverConfig.user_role.name} ({state.serverConfig.user_role.title})
          </Badge>
        </div>
      )}
      <div className="flex items-center justify-center gap-2.5">
        <Button
          size="default"
          className="gap-2 text-sm font-semibold text-primary-foreground animate-glow-cta"
          style={{ backgroundColor: "var(--chrono-teal)" }}
          onClick={handleStart}
        >
          <Play className="w-4 h-4" />
          {t("Start Observation")}
        </Button>
        {isMock && (
          <Button size="default" variant="outline" className="gap-2 text-sm border-border/40 text-muted-foreground">
            {t("Load Different Episode")}
          </Button>
        )}
      </div>
    </div>
  )
}

function InteractionObserving() {
  const { state } = useChronoFork()
  const { t } = useI18n()
  const [paused, setPaused] = useState(false)
  const pc = phaseColor(state.phase)
  /* Progress description instead of distracting bar */
  const progressDesc = state.observeProgress < 25
    ? t("The scene is unfolding. Key actors are establishing their positions...")
    : state.observeProgress < 50
    ? t("Tensions are building. Arguments are crystallizing around key options...")
    : state.observeProgress < 75
    ? t("A decision point approaches. Watch for moments where history could fork...")
    : state.observeProgress < 100
    ? t("The critical juncture is near. Prepare to intervene when you see an opening.")
    : t("Observation complete. You may now select a node to backtrack.")

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4" style={{ color: pc }} />
        <span className="text-sm font-semibold text-foreground">{t("Observation Mode")}</span>
        <span className="text-[10px] font-mono ml-auto px-2 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in oklch, ${pc} 10%, transparent)`, color: pc }}>{state.observeProgress}%</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed italic">{progressDesc}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 gap-1 border-border/40" onClick={() => toast.info(t("Mock: Scene summarized"))}>
          <Info className="w-3.5 h-3.5" /> {t("Summarize")}
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 gap-1 border-border/40" onClick={() => toast.info(t("Mock: Term explained"))}>
          {t("Explain term")}
        </Button>
        <Button size="sm" variant="outline"
          className="text-xs h-7 px-2.5 gap-1 border-border/40"
          disabled={!state.decisionPointReached}
          onClick={() => toast.success(t("Mock: Moment bookmarked"))}
        >
          <Bookmark className="w-3.5 h-3.5" /> {t("Bookmark")}
        </Button>
        <Button size="sm" variant={paused ? "default" : "outline"}
          className={`text-xs h-7 px-2.5 gap-1 ml-auto ${paused ? "text-primary-foreground" : "border-border/40"}`}
          style={paused ? { backgroundColor: pc } : undefined}
          onClick={() => { setPaused(!paused); toast.info(paused ? t("Resumed") : t("Paused (mock)")) }}
        >
          {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          {paused ? t("Resume") : t("Pause")}
        </Button>
      </div>
    </div>
  )
}

function InteractionBacktrackSetup() {
  const { state, dispatch, ws } = useChronoFork()
  const { t } = useI18n()
  const isWS = state.connectionStatus === "connected"
  const isMock = state.connectionStatus === "mock"
  const playableRoles = roles.filter((r) => r.id !== "facilitator")
  const hasNode = !!state.selectedNodeId
  const hasRole = !!state.activeRoleId
  const pc = phaseColor(state.phase)

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
      {isWS && state.serverConfig?.cast_data ? (
        <div className="flex flex-wrap gap-2">
          {state.serverConfig.cast_data.map((c, i) => {
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
        className="w-full text-sm h-9 gap-2 font-semibold text-primary-foreground"
        style={{ backgroundColor: pc }}
        disabled={!hasNode || (!hasRole && !state.activeRoleName)}
        onClick={handleBacktrack}
      >
        {t("Backtrack to Node")}
      </Button>
      {!hasNode && <p className="text-xs text-muted-foreground text-center">{t("Select a node from the Timeline panel.")}</p>}
    </div>
  )
}

function InteractionComposer() {
  const { state, dispatch, ws } = useChronoFork()
  const { t } = useI18n()
  const isWS = state.connectionStatus === "connected"
  const [text, setText] = useState("")
  const [isIntervention, setIsIntervention] = useState(false)
  const activeRole = state.activeRoleId ? roles.find((r) => r.id === state.activeRoleId) : null
  const roleName = state.activeRoleName ?? activeRole?.shortName ?? "You"
  const targetRoles = roles.filter((r) => r.id !== "facilitator" && r.id !== state.activeRoleId)
  const [targetId, setTargetId] = useState<string | null>(null)
  const pc = "var(--chrono-amber)"

  const handleSend = () => {
    if (!text.trim()) return

    if (isWS) {
      // Send via WebSocket
      const targetRole = targetId ? roles.find((r) => r.id === targetId) : null
      const targetName = targetRole?.name ?? (targetId || "")
      ws.send("user_message", { content: text.trim(), target: targetName })
      dispatch({ type: "SEND_CHAT", data: { text: text.trim(), speakerName: roleName, targetName } })
      setText("")
      setIsIntervention(false)
      return
    }

    // Mock mode
    if (isIntervention || text.trim().startsWith("DIVERGE:")) {
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
    setText(""); setIsIntervention(false)
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
  const inputPrompt = state.inputRequest?.msg

  return (
    <div className="flex flex-col gap-2.5">
      {/* Input request prompt from server */}
      {inputPrompt && (
        <div className="rounded-lg px-2.5 py-1.5 text-xs italic text-foreground/80"
          style={{ backgroundColor: "color-mix(in oklch, var(--chrono-amber) 8%, transparent)", borderLeft: "3px solid var(--chrono-amber)" }}>
          {inputPrompt}
        </div>
      )}
      {/* Target person buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground font-mono shrink-0">{t("TO:")}</span>
        {isWS && state.serverConfig?.cast_data ? (
          state.serverConfig.cast_data.map((c, i) => {
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
      <Textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder={isIntervention ? t("Write your alternative decision...") : `${t("Type in character as")} ${roleName}...`}
        className="min-h-[52px] text-sm bg-card/50 border-border/30 resize-none leading-relaxed" rows={2}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 gap-1 border-border/40"
          disabled={state.tipLoading}
          onClick={handleRequestTip}>
          {state.tipLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {t("Tips")}
        </Button>
        {showCheckPrevious && (
          <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 gap-1 border-border/40"
            onClick={() => dispatch({ type: "OPEN_ANALYSIS" })}>
            {t("Check previous analysis")}
          </Button>
        )}
        {!isWS && (
          <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 gap-1 border-border/40 text-muted-foreground"
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
        <button onClick={() => setIsIntervention(!isIntervention)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ml-auto ${isIntervention ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-secondary/40"}`}
          style={isIntervention ? { backgroundColor: pc } : undefined}>
          {isIntervention ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
          {t("Intervention")}
        </button>
        <Button size="sm" className="text-xs h-7 px-4 gap-1 font-semibold text-primary-foreground"
          style={{ backgroundColor: pc }}
          disabled={!text.trim()} onClick={handleSend}>
          <Send className="w-3.5 h-3.5" /> {t("Send")}
        </Button>
      </div>
    </div>
  )
}

/* ── Reflection Prompt -- 3-state: Request -> Loading -> View ── */
function ReflectionPrompt({ onViewReport }: { onViewReport: () => void }) {
  const { state, ws, dispatch } = useChronoFork()
  const { t } = useI18n()
  const isWS = state.connectionStatus === "connected"
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
        {loading ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--chrono-violet)" }} /> : <BookOpen className="w-6 h-6" style={{ color: "var(--chrono-violet)" }} />}
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">
          {loading ? t("Generating Reflection...") : ready ? t("Reflection Report Ready") : t("Reflection Available")}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? t("Analyzing your intervention and computing outcomes...") : ready ? t("Your report is ready. Click below to review.") : t("Your intervention run is complete. Request the analysis report.")}
        </p>
      </div>
      {!loading && !ready && (
        <Button size="default" className="text-sm font-semibold text-primary-foreground gap-2"
          style={{ backgroundColor: "var(--chrono-violet)" }}
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
        <Button size="default" className="text-sm font-semibold text-primary-foreground gap-2"
          style={{ backgroundColor: "var(--chrono-violet)" }}
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
  const { state } = useChronoFork()
  const { t } = useI18n()
  const report = mockReportData
  const hasServerHtml = !!state.reflectionHtml

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
                  <Button variant="outline" size="default" className="gap-2 text-sm" style={{ color: "var(--chrono-violet)", borderColor: "color-mix(in oklch, var(--chrono-violet) 30%, transparent)" }} onClick={onReturn}>
                    <ArrowLeft className="w-4 h-4" /> {t("Return to Console")}
                  </Button>
                  <Button variant="outline" size="default" className="gap-2 text-sm" style={{ color: "var(--chrono-teal)", borderColor: "color-mix(in oklch, var(--chrono-teal) 30%, transparent)" }}
                    onClick={() => toast.info(t("Export functionality coming soon."))}>
                    <Download className="w-4 h-4" /> {t("Export Report")}
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
                    <Button variant="outline" size="default" className="gap-2 text-sm" style={{ color: "var(--chrono-violet)", borderColor: "color-mix(in oklch, var(--chrono-violet) 30%, transparent)" }} onClick={onReturn}>
                      <ArrowLeft className="w-4 h-4" /> {t("Return to Console")}
                    </Button>
                    <Button variant="outline" size="default" className="gap-2 text-sm" style={{ color: "var(--chrono-teal)", borderColor: "color-mix(in oklch, var(--chrono-teal) 30%, transparent)" }}
                      onClick={() => toast.info(t("Export functionality coming soon."))}>
                      <Download className="w-4 h-4" /> {t("Export Report")}
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
function InteractionConsole() {
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
    content = <InteractionObserving />
  } else if (phase === "observe_complete" || phase === "intervene_idle") {
    content = <InteractionBacktrackSetup />
  } else if (phase === "intervene_active") {
    content = <InteractionComposer />
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
    content = <InteractionComposer />
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
export function CenterStage() {
  const { state } = useChronoFork()
  const rm = state.ui.reducedMotion
  const isDisconnected = state.connectionStatus === "disconnected"
  const currentScene = scenes[state.currentSceneIndex]
  if (!currentScene && !isDisconnected) return null

  const sceneBeats = currentScene ? dialogueBeats.filter((d) => d.sceneId === currentScene.id) : []
  const currentBeat = sceneBeats[state.currentDialogueIndex]
  const speakingRole = currentBeat ? roles.find((r) => r.id === currentBeat.speakerId) : null
  const tableRoles = roles.filter((r) => r.id !== "facilitator")
  const speakingIdx = speakingRole ? tableRoles.findIndex((r) => r.id === speakingRole.id) : -1
  const isTopRow = speakingIdx >= 0 && speakingIdx < 3
  const speakingFaction = speakingRole ? getFaction(speakingRole) : "neutral"
  const fs = factionStyle(speakingFaction)
  const isIdle = state.phase === "observe_idle"
  const isFacilitator = currentBeat?.speakerId === "facilitator"

  /* Facilitator text: prefer server-streamed blocks, fallback to mock */
  const latestFacilitatorBlock = state.facilitatorBlocks.length > 0
    ? state.facilitatorBlocks[state.facilitatorBlocks.length - 1]
    : null
  const serverFacilitatorText = latestFacilitatorBlock?.text

  const facilitatorBeat = sceneBeats.find((b) => b.speakerId === "facilitator")
  const facilitatorText = serverFacilitatorText
    ?? (isFacilitator ? currentBeat?.text : (facilitatorBeat?.text ?? currentScene?.directorCaption))

  return (
    <div className="flex flex-col h-full relative center-spotlight">
      {/* Pre-start connection overlay */}
      <AnimatePresence>
        {isDisconnected && <PreStartOverlay />}
      </AnimatePresence>

      {/* TOP: Scene meta chips -- hidden in idle */}
      {!isIdle && currentScene && (
        <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap justify-center shrink-0 border-b border-border/10">
          <Badge variant="outline" className="text-xs font-mono gap-1 border-border/30 text-muted-foreground bg-card/50 px-2.5 py-1">
            <Clock className="w-3 h-3" /> {currentScene.time}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono gap-1 border-border/30 text-muted-foreground bg-card/50 px-2.5 py-1">
            <MapPin className="w-3 h-3" /> {currentScene.location}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono gap-1 border-border/30 text-foreground/70 bg-card/50 px-2.5 py-1 font-semibold">
            {currentScene.topic}
          </Badge>
        </div>
      )}

      {/* Facilitator strip -- standard glass card */}
      {!isIdle && facilitatorText && <FacilitatorStrip text={facilitatorText} />}

      {/* Middle: Round table + speech bubble */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {!isIdle && state.connectionStatus === "mock" && (
          <div className="flex flex-col items-center w-full max-w-lg relative">
            {/* Top row avatars */}
            <div className="flex items-end justify-center gap-7 mb-3 relative z-10">
              {tableRoles.slice(0, 3).map((role) => (
                <Avatar key={role.id} role={role} isSpeaking={currentBeat?.speakerId === role.id}
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
                      <span className="text-sm font-semibold" style={{ color: fs.ring }}>{speakingRole.shortName}</span>
                      <EmotionDot emotion={currentBeat.emotion} />
                    </div>
                    <p className="text-base leading-relaxed text-foreground">{currentBeat.text}</p>
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
            <div className="flex items-start justify-center gap-7 mt-3 relative z-10">
              {tableRoles.slice(3).map((role) => (
                <Avatar key={role.id} role={role} isSpeaking={currentBeat?.speakerId === role.id}
                  latestEmotion={sceneBeats.slice(0, state.currentDialogueIndex + 1).filter((b) => b.speakerId === role.id).pop()?.emotion}
                />
              ))}
            </div>
          </div>
        )}

        {/* WS connected mode: show latest streaming message as speech bubble */}
        {!isIdle && state.connectionStatus === "connected" && state.chatHistory.length > 0 && (
          <div className="flex flex-col items-center w-full max-w-lg relative">
            {(() => {
              const lastMsg = state.chatHistory[state.chatHistory.length - 1]
              return (
                <motion.div
                  key={lastMsg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-md w-full"
                >
                  <div className="bg-card border border-border/50 rounded-xl px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold" style={{ color: "var(--chrono-teal)" }}>{lastMsg.speakerName}</span>
                      {lastMsg.targetName && (
                        <span className="text-xs text-muted-foreground">
                          {"-> "}{lastMsg.targetName}
                        </span>
                      )}
                    </div>
                    <p className="text-base leading-relaxed text-foreground">{lastMsg.text}</p>
                  </div>
                </motion.div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Interaction Console Card */}
      <InteractionConsole />
    </div>
  )
}
