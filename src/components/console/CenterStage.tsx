"use client"

import { useState } from "react"
import { useChronoFork } from "@/src/lib/state/context"
import { phaseColor } from "@/src/lib/phaseColor"
import { roles, scenes, dialogueBeats, mockDivergenceAnalysis, mockReportData, episode, type DialogueBeat, type Role } from "@/src/lib/mock/mockData"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Clock, Play, Pause, Bookmark, Info, Send, Zap, Loader2, Eye, Users, ToggleLeft, ToggleRight, BookOpen, X, ArrowLeft, Download, GitFork, Target } from "lucide-react"
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
    <div className={`flex flex-col items-center gap-1.5 transition-opacity duration-200 ${isSpeaking ? "opacity-100" : "opacity-30"}`}>
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold transition-all ${isSpeaking ? "animate-breathe" : ""}`}
        style={{
          backgroundColor: fs.bg, color: fs.ring,
          border: isSpeaking ? `2.5px solid ${fs.ring}` : "2px solid transparent",
          boxShadow: isSpeaking ? fs.glow : "none",
        }}
      >
        {role.shortName.slice(0, 2)}
      </div>
      <span className="text-sm font-semibold text-muted-foreground max-w-[70px] truncate text-center leading-tight">
        {role.shortName}
      </span>
      {latestEmotion && isSpeaking && <EmotionDot emotion={latestEmotion} />}
    </div>
  )
}

/* ── Facilitator Strip -- standard glass card, constrained width ── */
function FacilitatorStrip({ text }: { text: string }) {
  return (
    <div className="flex justify-center px-4 py-2 shrink-0">
      <div className="glass-panel max-w-lg w-full rounded-xl px-5 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "color-mix(in oklch, var(--chrono-violet) 15%, transparent)" }}>
            <Eye className="w-3.5 h-3.5" style={{ color: "var(--chrono-violet)" }} />
          </div>
          <span className="text-sm font-mono uppercase tracking-wider font-bold" style={{ color: "var(--chrono-violet)" }}>Facilitator</span>
        </div>
        <p className="text-base text-foreground/80 italic leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   INTERACTION CONSOLE CARDS -- scaled up text/components
   ════════════════════════════════════════════════════════════════ */

function InteractionIdle() {
  const { dispatch } = useChronoFork()
  const currentScene = scenes[0]
  return (
    <div className="flex flex-col gap-5 py-3">
      <div className="text-center">
        <p className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-1">{episode.year}</p>
        <h2 className="text-xl font-bold text-foreground text-balance">{episode.title}: {episode.subtitle}</h2>
        <p className="text-base text-muted-foreground leading-relaxed mt-3 max-w-md mx-auto">{episode.description}</p>
      </div>
      {currentScene && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-sm font-mono gap-1 border-border/30 text-muted-foreground bg-card/50 px-3 py-1">
            <Clock className="w-3.5 h-3.5" /> {currentScene.time}
          </Badge>
          <Badge variant="outline" className="text-sm font-mono gap-1 border-border/30 text-muted-foreground bg-card/50 px-3 py-1">
            <MapPin className="w-3.5 h-3.5" /> {currentScene.location}
          </Badge>
        </div>
      )}
      <div className="flex items-center justify-center gap-3">
        <Button
          size="lg"
          className="gap-2 text-base font-semibold text-primary-foreground animate-glow-cta"
          style={{ backgroundColor: "var(--chrono-teal)" }}
          onClick={() => dispatch({ type: "START_OBSERVE" })}
        >
          <Play className="w-5 h-5" />
          Start Observation
        </Button>
        <Button size="lg" variant="outline" className="gap-2 text-base border-border/40 text-muted-foreground">
          Load Different Episode
        </Button>
      </div>
    </div>
  )
}

function InteractionObserving() {
  const { state } = useChronoFork()
  const [paused, setPaused] = useState(false)
  const pc = phaseColor(state.phase)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Eye className="w-5 h-5" style={{ color: pc }} />
        <span className="text-base font-semibold text-foreground">Observation Mode</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out progress-bar-animated"
            style={{ width: `${state.observeProgress}%`, backgroundColor: pc }}
          />
        </div>
        <span className="text-sm text-muted-foreground font-mono w-12 text-right">{state.observeProgress}%</span>
      </div>
      <p className="text-base text-muted-foreground leading-relaxed">Watch how characters negotiate constraints and trade-offs.</p>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="default" variant="outline" className="text-sm h-9 px-3.5 gap-1.5 border-border/40" onClick={() => toast.info("Mock: Scene summarized")}>
          <Info className="w-4 h-4" /> Summarize
        </Button>
        <Button size="default" variant="outline" className="text-sm h-9 px-3.5 gap-1.5 border-border/40" onClick={() => toast.info("Mock: Term explained")}>
          Explain term
        </Button>
        <Button size="default" variant="outline"
          className="text-sm h-9 px-3.5 gap-1.5 border-border/40"
          disabled={!state.decisionPointReached}
          onClick={() => toast.success("Mock: Moment bookmarked")}
        >
          <Bookmark className="w-4 h-4" /> Bookmark
        </Button>
        <Button size="default" variant={paused ? "default" : "outline"}
          className={`text-sm h-9 px-3.5 gap-1.5 ml-auto ${paused ? "text-primary-foreground" : "border-border/40"}`}
          style={paused ? { backgroundColor: pc } : undefined}
          onClick={() => { setPaused(!paused); toast.info(paused ? "Resumed" : "Paused (mock)") }}
        >
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>
    </div>
  )
}

function InteractionBacktrackSetup() {
  const { state, dispatch } = useChronoFork()
  const playableRoles = roles.filter((r) => r.id !== "facilitator")
  const hasNode = !!state.selectedNodeId
  const hasRole = !!state.activeRoleId
  const pc = phaseColor(state.phase)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" style={{ color: pc }} />
        <span className="text-base font-semibold text-foreground">Backtrack Setup</span>
      </div>
      <p className="text-base text-muted-foreground leading-relaxed">
        Select a node (left panel) and a character below to backtrack.
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
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-all border"
              style={{
                backgroundColor: isActive ? `color-mix(in oklch, ${fs.ring} 15%, transparent)` : "var(--secondary)",
                borderColor: isActive ? fs.ring : "transparent",
                color: isActive ? fs.ring : "var(--muted-foreground)",
              }}
            >
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: isActive ? fs.ring : "var(--muted)" }} />
              {r.shortName}
            </button>
          )
        })}
      </div>
      <Button
        size="lg"
        className="w-full text-base h-11 gap-2 font-semibold text-primary-foreground"
        style={{ backgroundColor: pc }}
        disabled={!hasNode || !hasRole}
        onClick={() => {
          if (state.selectedNodeId) {
            dispatch({ type: "BACKTRACK_AND_INTERVENE", data: { nodeId: state.selectedNodeId } })
            toast.success("Backtracking...")
          }
        }}
      >
        Backtrack to Node
      </Button>
      {!hasNode && <p className="text-sm text-muted-foreground text-center">Select a node from the Timeline panel.</p>}
    </div>
  )
}

function InteractionComposer() {
  const { state, dispatch } = useChronoFork()
  const [text, setText] = useState("")
  const [isIntervention, setIsIntervention] = useState(false)
  const activeRole = state.activeRoleId ? roles.find((r) => r.id === state.activeRoleId) : null
  const roleName = activeRole?.shortName ?? "You"
  const targetRoles = roles.filter((r) => r.id !== "facilitator" && r.id !== state.activeRoleId)
  const [targetId, setTargetId] = useState<string | null>(null)
  /* After backtrack, theme stays amber */
  const pc = "var(--chrono-amber)"

  const handleSend = () => {
    if (!text.trim()) return
    if (isIntervention || text.trim().startsWith("DIVERGE:")) {
      dispatch({ type: "SEND_DIVERGE", data: { text: text.trim(), speakerName: roleName } })
      toast.success("Intervention committed. Computing divergence...")
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

  const showCheckPrevious = state.ui.analysisViewed && !state.ui.showAnalysis && state.analysis.available

  return (
    <div className="flex flex-col gap-3">
      {/* Target person buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground font-mono shrink-0">TO:</span>
        {targetRoles.map((r) => {
          const isT = targetId === r.id
          return (
            <button key={r.id} onClick={() => setTargetId(isT ? null : r.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${isT ? "text-primary-foreground" : "text-muted-foreground border-border/30 hover:text-foreground"}`}
              style={isT ? { backgroundColor: pc, borderColor: pc } : undefined}
            >
              {r.shortName}
            </button>
          )
        })}
      </div>
      <Textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder={isIntervention ? "Write your alternative decision..." : `Type in character as ${roleName}...`}
        className="min-h-[64px] text-base bg-card/50 border-border/30 resize-none leading-relaxed" rows={2}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="default" variant="outline" className="text-sm h-9 px-3.5 gap-1.5 border-border/40"
          onClick={() => dispatch({ type: "TOGGLE_TIPS" })}>
          Tips
        </Button>
        {showCheckPrevious && (
          <Button size="default" variant="outline" className="text-sm h-9 px-3.5 gap-1.5 border-border/40"
            onClick={() => dispatch({ type: "OPEN_ANALYSIS" })}>
            Check previous analysis
          </Button>
        )}
        <Button size="default" variant="outline" className="text-sm h-9 px-3.5 gap-1.5 border-border/40 text-muted-foreground"
          onClick={() => {
            if (!text.trim()) {
              dispatch({ type: "SEND_DIVERGE", data: { text: "DEBUG: Trigger divergence", speakerName: roleName } })
              toast.success("DEBUG: Computing divergence...")
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
          <Zap className="w-4 h-4" /> Trigger Divergence
        </Button>
        <button onClick={() => setIsIntervention(!isIntervention)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ml-auto ${isIntervention ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-secondary/40"}`}
          style={isIntervention ? { backgroundColor: pc } : undefined}>
          {isIntervention ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          Intervention
        </button>
        <Button size="default" className="text-sm h-9 px-5 gap-1.5 font-semibold text-primary-foreground"
          style={{ backgroundColor: pc }}
          disabled={!text.trim()} onClick={handleSend}>
          <Send className="w-4 h-4" /> Send
        </Button>
      </div>
    </div>
  )
}

/* ── Reflection Prompt -- shows "View Report" with NO close button ── */
function ReflectionPrompt({ onViewReport }: { onViewReport: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center gap-5 py-5"
    >
      <div className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--chrono-violet-bg)", border: "2px solid var(--chrono-violet)" }}>
        <BookOpen className="w-7 h-7" style={{ color: "var(--chrono-violet)" }} />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">Reflection Available</p>
        <p className="text-base text-muted-foreground mt-1">Your intervention run is complete. Review the analysis report.</p>
      </div>
      <Button size="lg" className="text-base font-semibold text-primary-foreground gap-2"
        style={{ backgroundColor: "var(--chrono-violet)" }}
        onClick={onViewReport}>
        <BookOpen className="w-5 h-5" /> View Reflection Report
      </Button>
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
  const report = mockReportData
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[70] flex flex-col"
    >
      {/* Dim background -- bg + header remain visible underneath */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* Scrollable report card */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden relative">
            {/* Close X button at top-right */}
            <button
              onClick={onReturn}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close report"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Report header */}
            <div className="text-center py-8 px-6 border-b border-border/20"
              style={{ backgroundColor: "color-mix(in oklch, var(--chrono-violet) 5%, transparent)" }}>
              <p className="text-sm font-mono uppercase tracking-[0.3em] mb-2" style={{ color: "var(--chrono-violet)" }}>Aftermath Report</p>
              <h1 className="text-2xl font-bold text-foreground mb-3 text-balance">{report.episode}</h1>
              <div className="flex items-center justify-center gap-5 text-sm text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{report.duration}</span>
                <span className="flex items-center gap-1.5"><GitFork className="w-4 h-4" />{report.forksCreated} fork(s)</span>
                <span className="flex items-center gap-1.5"><Target className="w-4 h-4" />Fork: {report.forkNode}</span>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-8">
              {/* Timelines */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-5 border border-border/20 bg-secondary/10">
                  <p className="text-sm font-mono uppercase tracking-widest mb-3" style={{ color: "var(--chrono-teal)" }}>Canonical</p>
                  {["U-2 Photos Revealed", "ExComm Deliberations", "Quarantine Decision", "Address to Nation", "Black Saturday"].map((n, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "var(--chrono-teal)" }} />
                      <span className="text-base text-foreground/80">{n}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-5 border border-border/20 bg-secondary/10">
                  <p className="text-sm font-mono uppercase tracking-widest mb-3" style={{ color: "var(--chrono-amber)" }}>Your Timeline</p>
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
                <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Dimension Shift</p>
                <RadarVisualization dimensions={report.dimensions} />
                <div className="flex items-center gap-6 text-sm font-mono">
                  <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--chrono-teal)" }} />Canonical</span>
                  <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--chrono-amber)" }} />Your Fork</span>
                </div>
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-secondary/10 border-border/20">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Trade-offs</CardTitle></CardHeader>
                  <CardContent><ul className="flex flex-col gap-2">{report.tradeoffs.map((t, i) => <li key={i} className="text-base text-foreground/90 leading-relaxed">{t}</li>)}</ul></CardContent>
                </Card>
                <Card className="bg-secondary/10 border-border/20">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Overlooked</CardTitle></CardHeader>
                  <CardContent><ul className="flex flex-col gap-2">{report.overlooked.map((o, i) => <li key={i} className="text-base text-foreground/90 leading-relaxed">{o}</li>)}</ul></CardContent>
                </Card>
                <Card className="bg-secondary/10 border-border/20">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Suggestions</CardTitle></CardHeader>
                  <CardContent><ul className="flex flex-col gap-2">{report.recommendations.map((r, i) => <li key={i} className="text-base text-foreground/90 leading-relaxed">{r}</li>)}</ul></CardContent>
                </Card>
              </div>

              {/* Placeholder for future backend HTML */}
              <div className="rounded-xl border border-dashed border-border/40 p-6 text-center">
                <p className="text-sm text-muted-foreground font-mono">Additional report content (backend HTML) will render here.</p>
              </div>

              {/* Return button at bottom */}
              <div className="flex justify-center pt-2 pb-4">
                <Button variant="outline" size="lg" className="gap-2 text-base" style={{ color: "var(--chrono-violet)", borderColor: "color-mix(in oklch, var(--chrono-violet) 30%, transparent)" }} onClick={onReturn}>
                  <ArrowLeft className="w-4 h-4" /> Return to Console
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Main Interaction Console Card (bottom center) ── */
function InteractionConsole() {
  const { state, dispatch } = useChronoFork()
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
      <div className="flex items-center justify-center gap-3 py-8">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--chrono-amber)" }} />
        <span className="text-base font-mono" style={{ color: "var(--chrono-amber)" }}>{"Temporal recalculation\u2026"}</span>
      </div>
    )
  } else if (phase === "branch_complete") {
    content = <ReflectionPrompt onViewReport={handleViewReport} />
  } else if (phase === "divergence_ready") {
    content = <InteractionComposer />
  } else if (phase === "reflection_open") {
    /* While viewing report, keep showing reflection prompt (no close allowed) */
    content = <ReflectionPrompt onViewReport={handleViewReport} />
  }

  if (!content && !showReport) return null

  /* Phase-based border accent */
  const pc = phaseColor(phase)

  return (
    <>
      {content && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-xl">
          <div className="glass-panel-heavy rounded-2xl px-6 py-5 shadow-xl border-t-2"
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

/* ── Main CenterStage ── */
export function CenterStage() {
  const { state } = useChronoFork()
  const rm = state.ui.reducedMotion
  const currentScene = scenes[state.currentSceneIndex]
  if (!currentScene) return null

  const sceneBeats = dialogueBeats.filter((d) => d.sceneId === currentScene.id)
  const currentBeat = sceneBeats[state.currentDialogueIndex]
  const speakingRole = currentBeat ? roles.find((r) => r.id === currentBeat.speakerId) : null
  const tableRoles = roles.filter((r) => r.id !== "facilitator")
  const speakingIdx = speakingRole ? tableRoles.findIndex((r) => r.id === speakingRole.id) : -1
  const isTopRow = speakingIdx >= 0 && speakingIdx < 3
  const speakingFaction = speakingRole ? getFaction(speakingRole) : "neutral"
  const fs = factionStyle(speakingFaction)
  const isIdle = state.phase === "observe_idle"
  const isFacilitator = currentBeat?.speakerId === "facilitator"

  const facilitatorBeat = sceneBeats.find((b) => b.speakerId === "facilitator")
  const facilitatorText = isFacilitator ? currentBeat?.text : (facilitatorBeat?.text ?? currentScene.directorCaption)

  return (
    <div className="flex flex-col h-full relative center-spotlight">
      {/* TOP: Scene meta chips -- hidden in idle */}
      {!isIdle && (
        <div className="flex items-center gap-2 px-4 py-3 flex-wrap justify-center shrink-0 border-b border-border/10">
          <Badge variant="outline" className="text-sm font-mono gap-1.5 border-border/30 text-muted-foreground bg-card/50 px-3 py-1.5">
            <Clock className="w-3.5 h-3.5" /> {currentScene.time}
          </Badge>
          <Badge variant="outline" className="text-sm font-mono gap-1.5 border-border/30 text-muted-foreground bg-card/50 px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5" /> {currentScene.location}
          </Badge>
          <Badge variant="outline" className="text-sm font-mono gap-1.5 border-border/30 text-foreground/70 bg-card/50 px-3 py-1.5 font-semibold">
            {currentScene.topic}
          </Badge>
        </div>
      )}

      {/* Facilitator strip -- standard glass card */}
      {!isIdle && facilitatorText && <FacilitatorStrip text={facilitatorText} />}

      {/* Middle: Round table + speech bubble */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {!isIdle && (
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
                  <div className="bg-card border border-border/50 rounded-xl px-6 py-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-semibold" style={{ color: fs.ring }}>{speakingRole.shortName}</span>
                      <EmotionDot emotion={currentBeat.emotion} />
                    </div>
                    <p className="text-lg leading-relaxed text-foreground">{currentBeat.text}</p>
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
      </div>

      {/* Interaction Console Card */}
      <InteractionConsole />
    </div>
  )
}
