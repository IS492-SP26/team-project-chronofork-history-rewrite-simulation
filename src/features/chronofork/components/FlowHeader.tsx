"use client"

import { useChronoFork } from "@features/chronofork/state/context"
import { useTheme } from "@features/chronofork/theme"
import { useI18n, type Locale } from "@features/chronofork/i18n"
import { episode } from "@features/chronofork/mock/mockData"
import type { FlowPhase } from "@features/chronofork/state/types"
import type { ConnectionStatus } from "@features/chronofork/state/types"
import { phaseTone } from "@features/chronofork/phaseColor"
import { HelpCircle, Eye, Swords, BookOpen, Check, Lock, Sun, Moon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type SegId = "observe" | "intervene" | "reflection"
const segments: { id: SegId; icon: React.ElementType }[] = [
  { id: "observe", icon: Eye },
  { id: "intervene", icon: Swords },
  { id: "reflection", icon: BookOpen },
]

function segState(id: SegId, phase: FlowPhase): "active" | "done" | "locked" {
  const obs: FlowPhase[] = ["observe_idle", "observe_playing", "observe_complete"]
  const int: FlowPhase[] = ["intervene_idle", "intervene_active", "divergence_running", "divergence_ready", "branch_complete"]
  const ref: FlowPhase[] = ["branch_complete", "reflection_open"]
  if (id === "observe") return obs.includes(phase) ? "active" : "done"
  if (id === "intervene") return int.includes(phase) && !ref.includes(phase) ? "active" : ref.includes(phase) ? "done" : "locked"
  return ref.includes(phase) ? "active" : "locked"
}

function segColor(id: SegId): string {
  if (id === "observe") return "var(--chrono-teal)"
  if (id === "intervene") return "var(--chrono-amber)"
  return "var(--chrono-violet)"
}

function wsStatusInfo(status: ConnectionStatus, locale: Locale): { color: string; label: string; pulsing: boolean } {
  const label = locale === "zh"
    ? { connected: "WS: 已连接", connecting: "WS: 连接中", mock: "WS: 模拟模式", disconnected: "WS: 未连接" }
    : { connected: "WS: Connected", connecting: "WS: Connecting", mock: "WS: Mock", disconnected: "WS: Disconnected" }
  switch (status) {
    case "connected": return { color: "var(--chrono-teal)", label: label.connected, pulsing: false }
    case "connecting": return { color: "var(--chrono-amber)", label: label.connecting, pulsing: true }
    case "mock": return { color: "var(--chrono-violet)", label: label.mock, pulsing: false }
    default: return { color: "var(--chrono-red)", label: label.disconnected, pulsing: false }
  }
}

export function FlowHeader() {
  const { state, dispatch } = useChronoFork()
  const { theme, toggle: toggleTheme } = useTheme()
  const { locale, toggleLocale, t } = useI18n()
  const { phase, connectionStatus, serverConfig } = state
  const isIdle = phase === "observe_idle"
  const isObsPlaying = phase === "observe_playing"
  const wsInfo = wsStatusInfo(connectionStatus, locale)
  const displayTitle = serverConfig?.episode?.title ?? episode.title
  const segLabel: Record<SegId, string> = { observe: t("Observe"), intervene: t("Intervene"), reflection: t("Reflection") }
  const tone = phaseTone(phase)

  return (
    <header className="flex items-center px-5 py-3 gap-4 glass-panel border-b border-border/30 relative z-40" style={{ minHeight: 56 }}>
      {/* Logo + episode */}
      <div className="flex items-center gap-2.5 shrink-0">
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="12" stroke="var(--chrono-teal)" strokeWidth="1.5" fill="none" opacity="0.6" />
          <path d="M14 6v8l4 4" stroke="var(--chrono-teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 14l-3 5" stroke="var(--chrono-amber)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
        </svg>
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase">ChronoFork</span>
          <span className="text-sm text-foreground font-semibold hidden sm:block">{displayTitle}</span>
        </div>
      </div>

      <div className="w-px h-8 bg-border/40 hidden sm:block" />

      {/* Flow rail */}
      <div className="flex items-center gap-1 flex-1 justify-center">
        {segments.map((seg, i) => {
          const ss = segState(seg.id, phase)
          const color = segColor(seg.id)
          const Icon = seg.icon
          /* Observe pill: show percentage only when actively playing */
          const isObsActive = seg.id === "observe" && (isObsPlaying || (ss === "active" && !isIdle))
          /* When idle, the observe pill is dim/unlit */
          const isIdleObs = seg.id === "observe" && isIdle

          return (
            <div key={seg.id} className="flex items-center">
              <div className="flex flex-col gap-0.5">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all border ${
                    isObsPlaying && seg.id === "observe" ? "animate-pulse-halo" : ""
                  }`}
                  style={{
                    backgroundColor: isIdleObs
                      ? "var(--secondary)"
                      : ss !== "locked"
                        ? `color-mix(in oklch, ${color} 10%, transparent)`
                        : "var(--secondary)",
                    color: isIdleObs ? "var(--muted-foreground)" : ss === "locked" ? "var(--muted-foreground)" : color,
                    borderColor: ss === "active" && !isIdleObs
                      ? `color-mix(in oklch, ${color} 25%, transparent)`
                      : "transparent",
                    opacity: ss === "locked" ? 0.4 : isIdleObs ? 0.5 : 1,
                    boxShadow: isObsPlaying && seg.id === "observe"
                      ? `0 0 12px 2px color-mix(in oklch, ${color} 30%, transparent)`
                      : "none",
                  }}
                >
                  {ss === "done" ? <Check className="w-3.5 h-3.5" /> : ss === "locked" ? <Lock className="w-3 h-3" /> : <Icon className="w-3.5 h-3.5" />}
                  <span className="hidden md:inline">{segLabel[seg.id]}</span>
                  {/* Percentage shown inline on observe pill */}
                  {isObsActive && (
                    <span className="text-[10px] font-mono ml-1 opacity-80">{state.observeProgress}%</span>
                  )}
                </div>
              </div>
              {i < segments.length - 1 && (
                <div className="w-5 h-px mx-1" style={{ backgroundColor: ss === "done" ? color : "var(--border)" }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Right utils */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* WS connection status indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono tracking-wider"
          style={{ backgroundColor: `color-mix(in oklch, ${wsInfo.color} 10%, transparent)`, color: wsInfo.color }}>
          {connectionStatus === "connecting" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: wsInfo.color }} />
          )}
          <span className="hidden lg:inline">{wsInfo.label}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          tone={tone}
          className="h-8 px-2.5 text-[12px] font-mono uppercase tracking-wider border-border/40"
          onClick={toggleLocale}
          aria-label={locale === "zh" ? "切换到英文" : "Switch to Chinese"}
        >
          {locale === "zh" ? "中" : "EN"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          tone={tone}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          aria-label={locale === "zh" ? "切换主题" : "Toggle theme"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          tone={tone}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => dispatch({ type: "TOGGLE_HELP_PANEL" })}
          aria-label={locale === "zh" ? "帮助" : "Help"}
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
