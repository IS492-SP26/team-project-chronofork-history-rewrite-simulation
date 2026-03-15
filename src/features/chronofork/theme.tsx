"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"

type Theme = "light" | "dark"
interface ThemeCtx { theme: Theme; toggle: () => void }
const ThemeContext = createContext<ThemeCtx>({ theme: "light", toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const stored = localStorage.getItem("chrono-theme") as Theme | null
    if (stored === "dark" || stored === "light") setTheme(stored)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("chrono-theme", theme)
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), [])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() { return useContext(ThemeContext) }
