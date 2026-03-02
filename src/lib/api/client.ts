// ─── ChronoFork API Client ──────────────────────────────────────────
// TODO (Round 2): implement real HTTP/WS client using api.md
import { BACKEND_URL } from "../env"

/**
 * Typed helper to send API messages.
 * No-op in Round 1 (mock only).
 */
export function apiSend(type: string, data: any): void {
  // TODO (Round 2): implement WebSocket /ws using api.md
  if (BACKEND_URL) {
    console.log(`[ChronoFork API] Would send: ${type}`, data)
  }
}
