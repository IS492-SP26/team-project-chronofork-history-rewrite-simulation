"use client"
import React, { createContext, useContext, useReducer, useEffect, useCallback, type Dispatch } from "react"
import type { RunState, RunAction } from "./types"
import { runReducer, initialState } from "./reducer"
import { useWebSocket, type UseWebSocketReturn } from "../api/useWebSocket"

interface ChronoForkContextValue {
  state: RunState
  dispatch: Dispatch<RunAction>
  ws: UseWebSocketReturn
  connectToServer: (url?: string) => void
  useMockData: () => void
}

const ChronoForkContext = createContext<ChronoForkContextValue | null>(null)

export function ChronoForkProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(runReducer, initialState)
  const ws = useWebSocket(dispatch)

  /* ── Connect to real WebSocket server ── */
  const connectToServer = useCallback((url?: string) => {
    ws.connect(url)
  }, [ws])

  /* ── Use mock data -- bypass WebSocket entirely ── */
  const useMockData = useCallback(() => {
    dispatch({ type: "SET_CONNECTION_STATUS", data: { status: "mock" } })
  }, [])

  /* ── Reduced motion detection ── */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    dispatch({ type: "SET_REDUCED_MOTION", data: { enabled: mq.matches } })
    const handler = (e: MediaQueryListEvent) => dispatch({ type: "SET_REDUCED_MOTION", data: { enabled: e.matches } })
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  /* ── Mock mode: auto-advance dialogue (same as R1 behavior) ── */
  useEffect(() => {
    // Only auto-advance in mock mode during observe_playing
    if (state.connectionStatus !== "mock" || state.phase !== "observe_playing") return
    const interval = setInterval(() => dispatch({ type: "ADVANCE_DIALOGUE" }), 3000)
    return () => clearInterval(interval)
  }, [state.connectionStatus, state.phase])

  return (
    <ChronoForkContext.Provider value={{ state, dispatch, ws, connectToServer, useMockData }}>
      {children}
    </ChronoForkContext.Provider>
  )
}

export function useChronoFork() {
  const ctx = useContext(ChronoForkContext)
  if (!ctx) throw new Error("useChronoFork must be used within ChronoForkProvider")
  return ctx
}
