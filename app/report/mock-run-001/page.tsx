"use client"

import Link from "next/link"
import { mockReportData, mockDivergenceAnalysis } from "@/src/lib/mock/mockData"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Download, GitFork, Clock, Target } from "lucide-react"
import { ThemeProvider } from "@/src/lib/theme"

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
    <svg viewBox="0 0 300 300" className="w-full max-w-[280px] mx-auto">
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={dimensions.map((_, i) => { const p = getPoint(i, v); return `${p.x},${p.y}` }).join(" ")}
          fill="none" stroke="var(--border)" strokeWidth="0.5" opacity={0.5} />
      ))}
      {dimensions.map((d, i) => {
        const end = getPoint(i, 100), lbl = getPoint(i, 115)
        return (
          <g key={d.label}>
            <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="var(--border)" strokeWidth="0.5" opacity={0.3} />
            <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="central" fill="var(--muted-foreground)" fontSize="7" fontFamily="var(--font-mono)">{d.label}</text>
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

function MiniTimeline({ label, color, nodes }: { label: string; color: string; nodes: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color }}>{label}</span>
      <div className="flex flex-col gap-1">
        {nodes.map((node, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
            <span className="text-[10px] text-muted-foreground">{node}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportContent() {
  const report = mockReportData

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: "url('/images/war-room-bg.jpg')" }} />
        <div className="absolute inset-0 bg-background/95" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Back</Button></Link>
          <Button variant="outline" size="sm" className="gap-2 text-muted-foreground border-border/50"><Download className="w-3.5 h-3.5" />Export</Button>
        </div>

        <div className="text-center mb-10">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-muted-foreground mb-2">Aftermath Report</p>
          <h1 className="text-2xl font-bold text-foreground mb-2 text-balance">{report.episode}</h1>
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-mono">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{report.duration}</span>
            <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{report.forksCreated} fork(s)</span>
            <span className="flex items-center gap-1"><Target className="w-3 h-3" />Fork: {report.forkNode}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardContent className="pt-6">
              <MiniTimeline label="Canonical" color="var(--chrono-teal)" nodes={["U-2 Photos Revealed", "ExComm Deliberations", "Quarantine Decision", "Address to Nation", "Black Saturday"]} />
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardContent className="pt-6">
              <MiniTimeline label="Your Timeline" color="var(--chrono-amber)" nodes={["U-2 Photos Revealed", "ExComm Deliberations", "Early Backchannel (Fork)", "Quiet Diplomacy", "Accelerated Resolution"]} />
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50 border-border/30 backdrop-blur mb-10">
          <CardHeader><CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Dimension Shift</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <RadarVisualization dimensions={report.dimensions} />
              <div className="flex items-center gap-6 text-[9px] font-mono">
                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--chrono-teal)" }} />Canonical</span>
                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--chrono-amber)" }} />Your Fork</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader><CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Trade-offs</CardTitle></CardHeader>
            <CardContent><ul className="flex flex-col gap-3">{report.tradeoffs.map((t, i) => <li key={i} className="text-xs text-foreground/90 leading-relaxed">{t}</li>)}</ul></CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader><CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Overlooked</CardTitle></CardHeader>
            <CardContent><ul className="flex flex-col gap-3">{report.overlooked.map((o, i) => <li key={i} className="text-xs text-foreground/90 leading-relaxed">{o}</li>)}</ul></CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader><CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Suggestions</CardTitle></CardHeader>
            <CardContent><ul className="flex flex-col gap-3">{report.recommendations.map((r, i) => <li key={i} className="text-xs text-foreground/90 leading-relaxed">{r}</li>)}</ul></CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Link href="/"><Button size="lg" className="gap-2 text-primary-foreground" style={{ backgroundColor: "var(--chrono-amber)" }}><ArrowLeft className="w-4 h-4" />Back to Console</Button></Link>
        </div>
      </div>
    </div>
  )
}

export default function ReportPage() {
  return (
    <ThemeProvider>
      <ReportContent />
    </ThemeProvider>
  )
}
