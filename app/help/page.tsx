import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, BookOpen, Keyboard, GitFork, Eye, Send } from "lucide-react"

const shortcuts = [
  { key: "Space", label: "Play / Pause simulation" },
  { key: "N", label: "Advance to next dialogue beat" },
  { key: "B", label: "Bookmark current decision node" },
  { key: "F", label: "Fork from selected timeline node" },
  { key: "R", label: "Open reflection report (when available)" },
  { key: "?", label: "Toggle keyboard shortcuts overlay" },
  { key: "1", label: "Switch to OBSERVE stage" },
  { key: "2", label: "Switch to INTERVENE stage" },
  { key: "[", label: "Toggle left dock (Timeline)" },
  { key: "]", label: "Toggle right dock (Tactical HUD)" },
]

const concepts = [
  {
    icon: Eye,
    title: "Stage 1: OBSERVE",
    description: "Watch history unfold in cinematic playback. You can ask clarifying questions and bookmark key decision points, but you cannot change the course of events.",
  },
  {
    icon: GitFork,
    title: "Stage 2: INTERVENE",
    description: "Fork from any bookmarked decision point to create a divergent timeline. Draft your alternative decision, run a plausibility check, and transmit it to see the consequences.",
  },
  {
    icon: Send,
    title: "Decision Transmission",
    description: "When you transmit a decision in INTERVENE mode, the system calculates a plausibility score, projected outcomes, and a causal chain showing the ripple effects of your choice.",
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: "url('/images/war-room-bg.jpg')" }} />
        <div className="absolute inset-0 bg-background/95" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Console
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Help Center</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Learn how to use the ChronoFork Historical Simulator Console.
        </p>

        <div className="flex flex-col gap-6">
          {/* Concepts */}
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <BookOpen className="w-4 h-4" />
                Core Concepts
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {concepts.map((c) => {
                const Icon = c.icon
                return (
                  <div key={c.title} className="flex gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: "var(--chrono-teal)",
                        color: "white",
                        opacity: 0.8,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        {c.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <Keyboard className="w-4 h-4" />
                Keyboard Shortcuts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2.5">
                {shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <kbd className="px-2 py-0.5 rounded bg-secondary text-foreground text-[10px] font-mono border border-border/50">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
