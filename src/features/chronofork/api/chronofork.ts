// ─── ChronoFork API Functions ───────────────────────────────────────
// TODO (Round 2): implement WebSocket /ws using api.md
// All functions return mock data or no-op in Round 1.

import { apiSend } from "./client"
import {
  episode,
  roles,
  scenes,
  dialogueBeats,
  timelineNodes,
  mockDivergenceAnalysis,
  mockReportData,
} from "../mock/mockData"

interface MockWSClient {
  send: (type: string, data: any) => void
  close: () => void
}

/** Connect to WebSocket. Returns mock client in Round 1. */
export function connectWS(): MockWSClient {
  // TODO (Round 2): implement WebSocket /ws using api.md
  return {
    send: (type: string, data: any) => apiSend(type, data),
    close: () => {
      console.log("[ChronoFork] Mock WS closed")
    },
  }
}

/** Initialize the experience with episode data. */
export function startExperience() {
  // TODO (Round 2): implement WebSocket /ws using api.md
  return { episode, roles, scenes, dialogueBeats, timelineNodes }
}

/** Send a user message to an agent target. */
export function sendUserMessage(content: string, target: string) {
  // TODO (Round 2): implement WebSocket /ws using api.md
  apiSend("user_message", { content, target })
  return { status: "sent" }
}

/** Backtrack timeline to a specific node. */
export function backtrackTo(targetId: string, perspectiveAgent: string) {
  // TODO (Round 2): implement WebSocket /ws using api.md
  apiSend("backtrack", { targetId, perspectiveAgent })
  return { status: "backtracked", targetId }
}

/** Request strategic tip. */
export function requestTip() {
  // TODO (Round 2): implement WebSocket /ws using api.md
  return { tips: [] }
}

/** Request reflection report. */
export function requestReflection() {
  // TODO (Round 2): implement WebSocket /ws using api.md
  return { report: mockReportData }
}

/** Export save data. */
export function exportSave() {
  // TODO (Round 2): implement WebSocket /ws using api.md
  return {
    episode: episode.id,
    analysis: mockDivergenceAnalysis,
    report: mockReportData,
  }
}
