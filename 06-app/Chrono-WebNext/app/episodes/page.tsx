"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, MapPin, Users } from "lucide-react"
import { useI18n } from "@features/chronofork"

const episodes = {
  en: [
    {
      id: "cuban-missile-crisis",
      title: "Cuban Missile Crisis",
      subtitle: "Thirteen Days on the Brink",
      year: 1962,
      duration: "30-45 min",
      location: "Washington D.C. / Moscow",
      roles: 5,
      status: "available" as const,
      description: "Navigate the most dangerous 13 days of the Cold War. Will you prevent nuclear annihilation?",
    },
    {
      id: "fall-of-berlin-wall",
      title: "Fall of the Berlin Wall",
      subtitle: "The Night the Wall Came Down",
      year: 1989,
      duration: "25-35 min",
      location: "Berlin, Germany",
      roles: 4,
      status: "coming-soon" as const,
      description: "A press conference gone awry leads to the most iconic moment of the 20th century.",
    },
    {
      id: "moon-landing",
      title: "Apollo 11 Decision",
      subtitle: "One Giant Leap",
      year: 1969,
      duration: "20-30 min",
      location: "Houston / Washington D.C.",
      roles: 4,
      status: "coming-soon" as const,
      description: "Behind the scenes of Kennedy's moonshot decision and the race against the Soviets.",
    },
  ],
  zh: [
    {
      id: "cuban-missile-crisis",
      title: "古巴导弹危机",
      subtitle: "危机边缘的十三天",
      year: 1962,
      duration: "30-45 分钟",
      location: "华盛顿 / 莫斯科",
      roles: 5,
      status: "available" as const,
      description: "置身冷战最危险的 13 天。你能否避免核灾难？",
    },
    {
      id: "fall-of-berlin-wall",
      title: "柏林墙倒塌",
      subtitle: "那一夜，围墙倒下",
      year: 1989,
      duration: "25-35 分钟",
      location: "德国柏林",
      roles: 4,
      status: "coming-soon" as const,
      description: "一次发布会失误，触发了 20 世纪最具标志性的历史瞬间。",
    },
    {
      id: "moon-landing",
      title: "阿波罗 11 决策",
      subtitle: "迈向月球的一大步",
      year: 1969,
      duration: "20-30 分钟",
      location: "休斯顿 / 华盛顿",
      roles: 4,
      status: "coming-soon" as const,
      description: "走进肯尼迪“登月决策”幕后，见证美苏太空竞赛的关键博弈。",
    },
  ],
}

export default function EpisodesPage() {
  const { locale, t } = useI18n()
  const list = locale === "zh" ? episodes.zh : episodes.en

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: "url('/images/war-room-bg.jpg')" }} />
        <div className="absolute inset-0 bg-background/90" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              {t("Back to Console")}
            </Button>
          </Link>
        </div>

        <div className="text-center mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground mb-2">
            {t("Episode Gallery")}
          </p>
          <h1 className="text-3xl font-bold text-foreground text-balance">{t("Historical Simulations")}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            {t("Choose a pivotal moment in history to explore. Each episode features AI-driven characters and branching decisions.")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((ep) => (
            <Card
              key={ep.id}
              className={`bg-card/50 border-border/30 backdrop-blur transition-all ${
                ep.status === "available" ? "hover:border-chrono-teal/40 cursor-pointer" : "opacity-60"
              }`}
              style={ep.status === "available" ? { borderColor: "var(--chrono-teal-dim)" } : undefined}
            >
              <CardContent className="pt-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="text-[9px] font-mono"
                    style={ep.status === "available" ? { borderColor: "var(--chrono-teal)", color: "var(--chrono-teal)" } : {}}
                  >
                    {ep.status === "available" ? t("AVAILABLE") : t("COMING SOON")}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">{ep.year}</span>
                </div>

                <h3 className="text-lg font-semibold text-foreground">{ep.title}</h3>
                <p className="text-[11px] text-muted-foreground italic">{ep.subtitle}</p>
                <p className="text-xs text-foreground/85 leading-relaxed">{ep.description}</p>

                <div className="flex items-center gap-3 mt-auto pt-2 text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ep.duration}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ep.location}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ep.roles} {t("roles")}</span>
                </div>

                {ep.status === "available" && (
                  <Link href="/">
                    <Button
                      size="sm"
                      className="w-full mt-2 text-xs text-white"
                      style={{ backgroundColor: "var(--chrono-teal)" }}
                    >
                      {t("Launch Simulation")}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
