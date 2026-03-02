"use client"

import { useChronoFork } from "@/src/lib/state/context"
import { episode } from "@/src/lib/mock/mockData"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Play,
  Pause,
  SkipForward,
  Undo2,
  FileText,
  HelpCircle,
  ChevronDown,
  Wifi,
  WifiOff,
  User,
} from "lucide-react"
import { StageStepBar } from "./StageStepBar"

export function GlobalHeader() {
  const { state, dispatch } = useChronoFork()

  return (
    <header className="glass-panel sticky top-0 z-50 flex items-center justify-between px-4 py-2 gap-4">
      {/* Left: Logo + Episode */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <div className="flex items-center gap-2">
          {/* ChronoFork logo glyph */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            className="shrink-0"
            aria-hidden="true"
          >
            <circle cx="14" cy="14" r="12" stroke="var(--chrono-teal)" strokeWidth="1.5" fill="none" />
            <path
              d="M14 6v8l4 4"
              stroke="var(--chrono-teal)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 14l-3 5"
              stroke="var(--chrono-amber)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="2 2"
            />
          </svg>
          <span className="font-mono text-sm font-semibold tracking-wider text-foreground hidden sm:inline">
            CHRONOFORK
          </span>
        </div>
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          {episode.title}
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Center: Stage Step Bar */}
      <div className="flex-1 flex justify-center min-w-0">
        <StageStepBar />
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Time Travel Controls */}
        {state.stage === 1 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => dispatch({ type: "TOGGLE_PLAY" })}
              aria-label={state.playing ? "Pause" : "Play"}
            >
              {state.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-0.5">
              {([1, 1.5, 2] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => dispatch({ type: "SET_SPEED", data: { speed: s } })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    state.speed === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Next decision"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Rewind"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 text-xs font-mono gap-1.5 ${
                state.reflection.enabled
                  ? "text-chrono-amber animate-glow-cta-amber"
                  : "text-muted-foreground opacity-50 cursor-not-allowed"
              }`}
              disabled={!state.reflection.enabled}
              onClick={() => {
                if (state.reflection.enabled) {
                  window.location.href = "/report/mock-run-001"
                }
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              Report
            </Button>
          </div>
        )}

        {/* Status Strip */}
        <div className="hidden lg:flex items-center gap-2 px-2 py-1 rounded bg-secondary/50 text-[9px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <WifiOff className="w-2.5 h-2.5" />
            WS: disconnected
          </span>
          <span>{"Latency: --"}</span>
        </div>

        {/* Help */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => dispatch({ type: "TOGGLE_KEYBOARD_SHORTCUTS" })}
          aria-label="Help and keyboard shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>

        {/* User avatar placeholder */}
        <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
    </header>
  )
}
