// ─── ChronoFork State Types ─────────────────────────────────────────

export type FlowPhase =
  | "observe_idle"        // initial — waiting for user to press Start
  | "observe_playing"     // system plays canonical timeline
  | "observe_complete"    // canonical finished — select a node
  | "intervene_idle"      // user must pick node + role
  | "intervene_active"    // user is roleplaying
  | "divergence_running"  // system computing divergence
  | "divergence_ready"    // analysis available
  | "branch_complete"     // branch run ended
  | "reflection_open"     // user on report page

export type ChatMessageType = "dialogue" | "user_chat" | "user_diverge" | "system" | "clarify"

export interface ChatMessage {
  id: string
  type: ChatMessageType
  speakerId?: string
  speakerName: string
  text: string
  timestamp: number
  isKeyMoment?: boolean
}

export interface RunState {
  phase: FlowPhase
  selectedNodeId: string | null
  activeNodeId: string | null
  currentPath: string[]
  activeRoleId: string | null
  currentSceneIndex: number
  currentDialogueIndex: number
  observeProgress: number
  chatHistory: ChatMessage[]
  decisionPointReached: boolean
  divergence: {
    exists: boolean
    inProgress: boolean
    branchId?: string
    backtrackedNodeId?: string
  }
  analysis: {
    available: boolean
    plausibility?: number
    drivers?: string[]
    constraints?: string[]
    outcomes?: { label: string; canonical: number; divergent: number; uncertainty: "low" | "medium" | "high" }[]
    causalChain?: { id: string; label: string; effect: string }[]
  }
  ui: {
    docks: { leftOpen: boolean; rightOpen: boolean }
    reducedMotion: boolean
    showNodeDetail: boolean
    showHelpPanel: boolean
    showTips: boolean
    showAnalysis: boolean
    analysisViewed: boolean
    rightDockTab: "transcript" | "analysis" | "tips"
  }
}

export type RunAction =
  | { type: "START_OBSERVE" }
  | { type: "ADVANCE_DIALOGUE" }
  | { type: "OBSERVE_COMPLETE" }
  | { type: "SELECT_NODE"; data: { nodeId: string | null } }
  | { type: "SET_ROLE"; data: { roleId: string } }
  | { type: "BACKTRACK_AND_INTERVENE"; data: { nodeId: string } }
  | { type: "SEND_CHAT"; data: { text: string; speakerName: string } }
  | { type: "SEND_DIVERGE"; data: { text: string; speakerName: string } }
  | { type: "SEND_CLARIFY"; data: { text: string } }
  | { type: "DIVERGENCE_COMPLETE" }
  | { type: "ANALYSIS_COMPLETE"; data: { analysis: RunState["analysis"] } }
  | { type: "BRANCH_COMPLETE" }
  | { type: "OPEN_REFLECTION" }
  | { type: "BACK_TO_INTERVENE" }
  | { type: "SET_ACTIVE_NODE"; data: { nodeId: string } }
  | { type: "TOGGLE_DOCK"; data: { dock: "left" | "right" } }
  | { type: "TOGGLE_NODE_DETAIL" }
  | { type: "TOGGLE_HELP_PANEL" }
  | { type: "SET_REDUCED_MOTION"; data: { enabled: boolean } }
  | { type: "SET_OBSERVE_PROGRESS"; data: { progress: number } }
  | { type: "SET_RIGHT_DOCK_TAB"; data: { tab: "transcript" | "analysis" | "tips" } }
  | { type: "ADD_CHAT_MESSAGE"; data: { message: ChatMessage } }
  | { type: "TOGGLE_TIPS" }
  | { type: "TOGGLE_ANALYSIS" }
  | { type: "CLOSE_TIPS" }
  | { type: "CLOSE_ANALYSIS" }
  | { type: "OPEN_ANALYSIS" }
  | { type: "BACK_TO_OBSERVE_COMPLETE" }
