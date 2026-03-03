"use client"

import { I18nProvider, ThemeProvider } from "@features/chronofork"
import { useI18n } from "@features/chronofork"
import { usePathname } from "next/navigation"

function GlobalLocaleToggle() {
  const pathname = usePathname()
  const { locale, toggleLocale } = useI18n()

  // Home page already has a language switch in FlowHeader.
  if (pathname === "/") return null

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="fixed top-3 right-3 z-[95] h-8 px-2.5 rounded-md border border-border/40 bg-card/70 text-[10px] font-mono tracking-wider hover:bg-secondary/50 transition-colors"
      aria-label={locale === "zh" ? "切换到英文" : "Switch to Chinese"}
    >
      {locale === "zh" ? "中" : "EN"}
    </button>
  )
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <GlobalLocaleToggle />
        {children}
      </I18nProvider>
    </ThemeProvider>
  )
}
