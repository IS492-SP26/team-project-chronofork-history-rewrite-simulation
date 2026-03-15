"use client"
// ─── ChronoFork WebSocket Hook ──────────────────────────────────────
// Implements full WS connection, message routing, and mock fallback
// per api.md specification.

import { useRef, useCallback, useEffect } from "react"
import type { Dispatch } from "react"
import type { RunAction, ConnectionStatus, ServerConfig, ServerGraphData, ServerTipData } from "../state/types"

const DEFAULT_WS_URL = "ws://localhost:8000/ws"

export interface UseWebSocketReturn {
  connect: (url?: string) => void
  disconnect: () => void
  send: (type: string, data?: Record<string, unknown>) => void
  isConnected: () => boolean
  setMessageProcessingMode: (mode: "auto" | "manual") => void
  stepMessageQueue: () => void
  getQueueSnapshot: () => readonly EnvelopeMessage[]
}

export interface EnvelopeMessage {
  type: string
  data?: Record<string, unknown>
}

function downloadSaveExport(filename: string, jsonContent: string) {
  if (typeof window === "undefined") return

  const blob = new Blob([jsonContent], { type: "application/json" })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = filename.split("/").pop() || "chronofork-save.json"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

/**
 * Core WebSocket hook. Manages connection lifecycle and routes
 * all server-push messages to the reducer via dispatch.
 */
export function useWebSocket(dispatch: Dispatch<RunAction>): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const statusRef = useRef<ConnectionStatus>("disconnected")
  const queueRef = useRef<EnvelopeMessage[]>([])
  const processingRef = useRef(false)
  const modeRef = useRef<"auto" | "manual">("manual")
  const manualPrimedRef = useRef(false)
  const bootstrapStreamKeyRef = useRef<string | null>(null)
  const waitingStepRef = useRef(false)
  const stepStreamKeyRef = useRef<string | null>(null)
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoIntervalDrainingRef = useRef(false)

  const streamKeyFromEnvelope = useCallback((msg: EnvelopeMessage): string | null => {
    if (msg.type !== "stream_token") return null
    const agent = asString(msg.data?.agent)
    const target = asString(msg.data?.target)
    if (!agent || !target) return null
    return `${agent}::${target}`
  }, [])

  /* ── Send helper ── */
  const send = useCallback((type: string, data: Record<string, unknown> = {}) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }))
    } else {
      console.warn("[ChronoFork WS] Cannot send, socket not open:", type, data)
    }
  }, [])

  /* ── Message Router (Server -> Client) ── */
  const routeEnvelope = useCallback(
    (msg: EnvelopeMessage) => {
      const { type, data = {} } = msg

      switch (type) {
        /* ── system_init ── */
        case "system_init": {
          if (data.status === "ready" && data.config) {
            dispatch({ type: "SET_SERVER_CONFIG", data: { config: data.config as ServerConfig } })
          } else if (data.status === "error_no_config") {
            console.error("[ChronoFork WS] Server config error")
          }
          break
        }

        /* ── graph_update ── */
        case "graph_update": {
          dispatch({ type: "SET_SERVER_GRAPH", data: { graph: data as unknown as ServerGraphData } })
          break
        }

        /* ── stage_update ── */
        case "stage_update": {
          if (data.stage === 1 || data.stage === 2) {
            dispatch({ type: "SET_STAGE", data: { stage: data.stage } })
          }
          break
        }

        /* ── node_update ── */
        case "node_update": {
          const fromId = asString(data.from_id)
          const toId = asString(data.to_id)
          if (fromId && toId) {
            dispatch({ type: "NODE_UPDATE", data: { from_id: fromId, to_id: toId } })
          }
          break
        }

        /* ── agent_thinking ── */
        case "agent_thinking": {
          // Optional: could show a "thinking" indicator for the agent
          // For now we just log it
          console.log("[ChronoFork WS] Agent thinking:", data.agent)
          break
        }

        /* ── stream_token ── */
        case "stream_token": {
          const agent = asString(data.agent)
          const token = asString(data.token)
          const target = asString(data.target)
          if (agent && token && target) {
            dispatch({
              type: "STREAM_TOKEN",
              data: { agent, token, target },
            })
          }
          break
        }

        /* ── input_request ── */
        case "input_request": {
          const msgText = asString(data.msg)
          const fromName = asString(data.from_name)
          if (msgText && fromName) {
            dispatch({
              type: "SET_INPUT_REQUEST",
              data: { msg: msgText, from_name: fromName },
            })
          }
          break
        }

        /* ── facilitator_stream ── */
        case "facilitator_stream": {
          const token = asString(data.token)
          if (token) {
            dispatch({ type: "FACILITATOR_STREAM", data: { token } })
          }
          break
        }

        /* ── complete_history_review ── */
        case "complete_history_review": {
          dispatch({ type: "COMPLETE_HISTORY_REVIEW" })
          break
        }

        /* ── action_update ── */
        case "action_update": {
          if (data.action === "backtrack_complete") {
            const newNodeId = asString(data.new_node_id)
            const newRole = asString(data.new_role)
            if (!newNodeId || !newRole) break
            dispatch({
              type: "ACTION_UPDATE_BACKTRACK",
              data: { new_node_id: newNodeId, new_role: newRole },
            })
          } else if (data.action === "divergence_in_progress") {
            dispatch({ type: "ACTION_UPDATE_DIVERGENCE_IN_PROGRESS" })
          } else if (data.action === "divergence_complete") {
            const report = asString(data.report)
            if (!report) break
            dispatch({
              type: "ACTION_UPDATE_DIVERGENCE_COMPLETE",
              data: { report },
            })
          }
          break
        }

        /* ── enable_reflection ── */
        case "enable_reflection": {
          dispatch({ type: "ENABLE_REFLECTION" })
          break
        }

        /* ── reflection_report ── */
        case "reflection_report": {
          const report = asString(data.report)
          if (report) {
            dispatch({ type: "SET_REFLECTION_HTML", data: { html: report } })
          }
          break
        }

        /* ── save_complete ── */
        case "save_complete": {
          const filename = typeof data.filename === "string" ? data.filename : "chronofork-save.json"
          const jsonContent = typeof data.json_content === "string" ? data.json_content : ""
          dispatch({
            type: "SET_SAVE_EXPORT",
            data: {
              filename,
              json_content: jsonContent,
            },
          })
          downloadSaveExport(filename, jsonContent)
          console.log("[ChronoFork WS] Save complete:", filename)
          break
        }

        /* ── tip_data ── */
        case "tip_data": {
          dispatch({ type: "SET_TIP_DATA", data: data as unknown as ServerTipData })
          break
        }

        /* ── tip_error ── */
        case "tip_error": {
          const msgText = asString(data.msg)
          if (msgText) {
            dispatch({ type: "SET_TIP_ERROR", data: { msg: msgText } })
          }
          break
        }

        default:
          console.log("[ChronoFork WS] Unknown message type:", type, data)
      }
    },
    [dispatch],
  )

  const processQueue = useCallback(() => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      if (modeRef.current === "auto") {
        while (queueRef.current.length > 0) {
          const msg = queueRef.current.shift()
          if (!msg) break
          routeEnvelope(msg)
        }
        return
      }

      // Manual mode bootstrap: process normally until first stream_token block completes.
      if (!manualPrimedRef.current) {
        while (queueRef.current.length > 0) {
          const peek = queueRef.current[0]
          const key = streamKeyFromEnvelope(peek)

          if (!bootstrapStreamKeyRef.current) {
            queueRef.current.shift()
            routeEnvelope(peek)
            if (key) bootstrapStreamKeyRef.current = key
            continue
          }

          if (key && key === bootstrapStreamKeyRef.current) {
            queueRef.current.shift()
            routeEnvelope(peek)
            continue
          }

          // first stream block finished; pause before the next envelope
          manualPrimedRef.current = true
          return
        }
        return
      }

      // Manual stepped processing: advance until next stream block completes.
      if (!waitingStepRef.current) return

      while (queueRef.current.length > 0) {
        const peek = queueRef.current[0]
        const key = streamKeyFromEnvelope(peek)

        if (!stepStreamKeyRef.current) {
          queueRef.current.shift()
          routeEnvelope(peek)
          if (key) stepStreamKeyRef.current = key
          continue
        }

        if (key && key === stepStreamKeyRef.current) {
          queueRef.current.shift()
          routeEnvelope(peek)
          continue
        }

        // one full stream block processed; pause again
        waitingStepRef.current = false
        stepStreamKeyRef.current = null
        return
      }
    } finally {
      processingRef.current = false
    }
  }, [routeEnvelope, streamKeyFromEnvelope])

  const processSingleAutoBlock = useCallback(() => {
    if (processingRef.current) return
    processingRef.current = true
    try {
      let currentBlockKey: string | null = null
      let processedCount = 0
      while (queueRef.current.length > 0) {
        const peek = queueRef.current[0]
        const key = streamKeyFromEnvelope(peek)

        // If this tick didn't enter a stream block, process only one envelope to avoid instant flushing.
        if (!currentBlockKey && !key && processedCount > 0) {
          return
        }

        if (!currentBlockKey) {
          queueRef.current.shift()
          routeEnvelope(peek)
          processedCount += 1
          if (key) currentBlockKey = key
          if (!key) return
          continue
        }
        if (key && key === currentBlockKey) {
          queueRef.current.shift()
          routeEnvelope(peek)
          processedCount += 1
          continue
        }
        return
      }
    } finally {
      processingRef.current = false
    }
  }, [routeEnvelope, streamKeyFromEnvelope])

  const startAutoIntervalDrain = useCallback(() => {
    if (autoIntervalDrainingRef.current) return
    autoIntervalDrainingRef.current = true
    processSingleAutoBlock()
    autoIntervalRef.current = setInterval(() => {
      if (queueRef.current.length === 0 || modeRef.current !== "auto") {
        clearInterval(autoIntervalRef.current!)
        autoIntervalRef.current = null
        autoIntervalDrainingRef.current = false
        return
      }
      processSingleAutoBlock()
    }, 2000)
  }, [processSingleAutoBlock])

  const enqueueRawMessage = useCallback((raw: string) => {
    let msg: EnvelopeMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      console.warn("[ChronoFork WS] Non-JSON message:", raw)
      return
    }
    queueRef.current.push(msg)
    if (!autoIntervalDrainingRef.current) {
      processQueue()
    }
  }, [processQueue])

  const setMessageProcessingMode = useCallback((mode: "auto" | "manual") => {
    const previousMode = modeRef.current
    if (previousMode === mode) return

    // Clear any running auto-drain interval when switching modes.
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current)
      autoIntervalRef.current = null
      autoIntervalDrainingRef.current = false
    }
    modeRef.current = mode

    if (mode === "auto") {
      waitingStepRef.current = false
      stepStreamKeyRef.current = null

      // On manual -> auto, replay queued stream blocks every 2s until empty.
      if (previousMode === "manual" && queueRef.current.length > 0) {
        startAutoIntervalDrain()
        return
      }

      // Queue already empty (or not coming from manual): true real-time auto mode.
      processQueue()
      return
    }

    // In manual mode, keep paused unless bootstrap has not completed yet.
    if (!manualPrimedRef.current) {
      processQueue()
    }
  }, [processQueue, startAutoIntervalDrain])

  const stepMessageQueue = useCallback(() => {
    if (modeRef.current !== "manual") return
    waitingStepRef.current = true
    processQueue()
  }, [processQueue])

  const getQueueSnapshot = useCallback((): readonly EnvelopeMessage[] => {
    return queueRef.current
  }, [])

  /* ── Connect ── */
  const connect = useCallback(
    (url?: string) => {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      const wsUrl = url || DEFAULT_WS_URL
      statusRef.current = "connecting"
      dispatch({ type: "SET_CONNECTION_STATUS", data: { status: "connecting" } })

      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        queueRef.current = []
        processingRef.current = false
        manualPrimedRef.current = false
        bootstrapStreamKeyRef.current = null
        waitingStepRef.current = false
        stepStreamKeyRef.current = null
        if (autoIntervalRef.current) {
          clearInterval(autoIntervalRef.current)
          autoIntervalRef.current = null
        }
        autoIntervalDrainingRef.current = false

        ws.onopen = () => {
          statusRef.current = "connected"
          dispatch({ type: "SET_CONNECTION_STATUS", data: { status: "connected" } })
          console.log("[ChronoFork WS] Connected to", wsUrl)
        }

        ws.onmessage = (event) => {
          enqueueRawMessage(event.data)
        }

        ws.onclose = (event) => {
          console.log("[ChronoFork WS] Disconnected:", event.code, event.reason)
          statusRef.current = "disconnected"
          dispatch({ type: "SET_CONNECTION_STATUS", data: { status: "disconnected" } })
          wsRef.current = null
        }

        ws.onerror = (error) => {
          console.error("[ChronoFork WS] Error:", error)
          // onclose will fire after onerror, so we don't double-set status
        }
      } catch (err) {
        console.error("[ChronoFork WS] Failed to create WebSocket:", err)
        statusRef.current = "disconnected"
        dispatch({ type: "SET_CONNECTION_STATUS", data: { status: "disconnected" } })
      }
    },
    [dispatch, enqueueRawMessage],
  )

  /* ── Disconnect ── */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    statusRef.current = "disconnected"
    dispatch({ type: "SET_CONNECTION_STATUS", data: { status: "disconnected" } })
  }, [dispatch])

  /* ── isConnected ── */
  const isConnected = useCallback(() => {
    return statusRef.current === "connected" && wsRef.current?.readyState === WebSocket.OPEN
  }, [])

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current)
        autoIntervalRef.current = null
      }
    }
  }, [])

  return { connect, disconnect, send, isConnected, setMessageProcessingMode, stepMessageQueue, getQueueSnapshot }
}
