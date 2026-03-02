"use client"
import React, { createContext, useContext, useReducer, useEffect, type Dispatch } from "react"
import type { RunState, RunAction } from "./types"
import { runReducer, initialState } from "./reducer"

interface ChronoForkContextValue { state: RunState; dispatch: Dispatch<RunAction> }
const ChronoForkContext = createContext<ChronoForkContextValue | null>(null)

export function ChronoForkProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(runReducer, initialState)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    dispatch({ type: "SET_REDUCED_MOTION", data: { enabled: mq.matches } })
    const handler = (e: MediaQueryListEvent) => dispatch({ type: "SET_REDUCED_MOTION", data: { enabled: e.matches } })
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (state.phase !== "observe_playing") return
    const interval = setInterval(() => dispatch({ type: "ADVANCE_DIALOGUE" }), 3000)
    return () => clearInterval(interval)
  }, [state.phase])

  return <ChronoForkContext.Provider value={{ state, dispatch }}>{children}</ChronoForkContext.Provider>
}

export function useChronoFork() {
  const ctx = useContext(ChronoForkContext)
  if (!ctx) throw new Error("useChronoFork must be used within ChronoForkProvider")
  return ctx
}
