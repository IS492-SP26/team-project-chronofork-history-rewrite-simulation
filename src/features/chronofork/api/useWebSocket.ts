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
}

interface EnvelopeMessage {
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
  const routeMessage = useCallback(
    (raw: string) => {
      let msg: EnvelopeMessage
      try {
        msg = JSON.parse(raw)
      } catch {
        console.warn("[ChronoFork WS] Non-JSON message:", raw)
        return
      }

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

        ws.onopen = () => {
          statusRef.current = "connected"
          dispatch({ type: "SET_CONNECTION_STATUS", data: { status: "connected" } })
          console.log("[ChronoFork WS] Connected to", wsUrl)
        }

        ws.onmessage = (event) => {
          routeMessage(event.data)
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
    [dispatch, routeMessage],
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
    }
  }, [])

  return { connect, disconnect, send, isConnected }
}
