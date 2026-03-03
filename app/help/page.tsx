"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, BookOpen, Keyboard, GitFork, Eye, Send } from "lucide-react"
import { useI18n } from "@features/chronofork"

const shortcuts = {
  en: [
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
  ],
  zh: [
    { key: "Space", label: "播放 / 暂停模拟" },
    { key: "N", label: "前进到下一段对话" },
    { key: "B", label: "标记当前决策节点" },
    { key: "F", label: "从选中节点分叉" },
    { key: "R", label: "打开复盘报告（可用时）" },
    { key: "?", label: "显示/隐藏快捷键面板" },
    { key: "1", label: "切换到 OBSERVE 阶段" },
    { key: "2", label: "切换到 INTERVENE 阶段" },
    { key: "[", label: "收起/展开左侧时间线面板" },
    { key: "]", label: "收起/展开右侧战术面板" },
  ],
}

const concepts = {
  en: [
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
  ],
  zh: [
    {
      icon: Eye,
      title: "阶段 1：观察",
      description: "以电影化回放观察历史如何展开。你可以提问澄清并标记关键节点，但不能改变事件走向。",
    },
    {
      icon: GitFork,
      title: "阶段 2：干预",
      description: "从任一已标记决策点分叉，创建新的时间线。拟定替代决策、评估可行性并发送，观察后续影响。",
    },
    {
      icon: Send,
      title: "决策发送",
      description: "在 INTERVENE 模式发送决策后，系统会计算可行性分数、预期结果，以及展示因果链上的连锁反应。",
    },
  ],
}

export default function HelpPage() {
  const { locale, t } = useI18n()
  const list = locale === "zh" ? shortcuts.zh : shortcuts.en
  const conceptList = locale === "zh" ? concepts.zh : concepts.en

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
              {t("Back to Console")}
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">{t("Help Center")}</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {t("Learn how to use the ChronoFork Historical Simulator Console.")}
        </p>

        <div className="flex flex-col gap-6">
          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <BookOpen className="w-4 h-4" />
                {t("Core Concepts")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {conceptList.map((c) => {
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
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{c.description}</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/30 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <Keyboard className="w-4 h-4" />
                {t("Keyboard Shortcuts")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2.5">
                {list.map((s) => (
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
