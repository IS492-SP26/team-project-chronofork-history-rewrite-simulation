// ─── ChronoFork State Types ─────────────────────────────────────────

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "mock"

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

export type ChatMessageType = "dialogue" | "user_chat" | "user_diverge" | "system" | "clarify" | "node_update" | "backtrack_complete" | "history_divider"

export interface ChatMessage {
  id: string
  type: ChatMessageType
  speakerId?: string
  speakerName: string
  targetName?: string
  text: string
  timestamp: number
  isKeyMoment?: boolean
  meta?: any // For storing from_id, to_id, etc.
}

/* ── Server-side config from system_init ── */
export interface ServerConfig {
  episode: {
    emoji: string
    title: string
    desc: string
  }
  storyline: {
    title: string
    choice: string
    desc: string
  }[]
  cast_data: {
    name: string
    title: string
    desc: string
    avatar: string
  }[]
  user_role: {
    name: string
    title: string
    desc: string
    avatar: string
  }
  prompt_lang: string
}

/* ── Server graph structure from graph_update ── */
export interface ServerGraphNode {
  id: string
  label_id: string
  hover_title: string
  hover_desc: string
  status: "UNFINISHED" | "IN_PROGRESS" | "COMPLETED" | "SUSPENDED"
}

export interface ServerGraphData {
  nodes: ServerGraphNode[]
  edges: [string, string][]
  pos: Record<string, [number, number]>
  edge_label_data: { x: number; y: number; text: string }[]
  active_id: string
  current_path: string[]
}

/* ── Tip data from tip_data server message ── */
export interface ServerTipOption {
  label: string
  target_agent: string
  example_response: string
  rationale: string
  risks: string
  intent_type: "Escalation" | "De-escalation" | "Alliance Building" | "Info Gathering"
}

export interface ServerTipData {
  situation_analysis: string
  options: ServerTipOption[]
}

/* ── Facilitator stream block ── */
export interface FacilitatorBlock {
  text: string
  complete: boolean
}

export interface SaveExportPayload {
  filename: string
  json_content: string
}

export interface RunState {
  /* ── Connection ── */
  connectionStatus: ConnectionStatus
  serverConfig: ServerConfig | null
  stage: 1 | 2

  /* ── Core flow ── */
  phase: FlowPhase
  selectedNodeId: string | null
  activeNodeId: string | null
  currentPath: string[]
  activeRoleId: string | null
  activeRoleName: string | null
  currentSceneIndex: number
  currentDialogueIndex: number
  observeProgress: number
  chatHistory: ChatMessage[]
  decisionPointReached: boolean

  /* ── Server graph data ── */
  serverGraph: ServerGraphData | null

  /* ── Streaming state ── */
  currentStreamKey: string | null   // "agent::target" key for the current streaming message
  currentStreamMessageId: string | null
  facilitatorBlocks: FacilitatorBlock[]

  /* ── Divergence ── */
  divergence: {
    exists: boolean
    inProgress: boolean
    branchId?: string
    backtrackedNodeId?: string
  }

  /* ── Analysis / reflection ── */
  analysis: {
    available: boolean
    plausibility?: number
    drivers?: string[]
    constraints?: string[]
    outcomes?: { label: string; canonical: number; divergent: number; uncertainty: "low" | "medium" | "high" }[]
    causalChain?: { id: string; label: string; effect: string }[]
  }
  analysisHtml: string | null
  reflectionHtml: string | null
  canReflect: boolean
  saveExport: SaveExportPayload | null

  /* ── Tips ── */
  tipData: ServerTipData | null
  tipLoading: boolean
  tipError: string | null

  /* ── Input request ── */
  inputRequest: { msg: string; from_name: string } | null

    /* ── Pending tip fill (tip selection → composer auto-fill) ── */
    pendingTipFill: { text: string; targetName: string } | null

  /* ── UI ── */
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
  | { type: "SET_ROLE"; data: { roleId: string; roleName?: string } }
  | { type: "BACKTRACK_AND_INTERVENE"; data: { nodeId: string } }
  | { type: "SEND_CHAT"; data: { text: string; speakerName: string; targetName?: string } }
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
  /* ── WebSocket / server-driven actions ── */
  | { type: "SET_CONNECTION_STATUS"; data: { status: ConnectionStatus } }
  | { type: "SET_SERVER_CONFIG"; data: { config: ServerConfig } }
  | { type: "SET_STAGE"; data: { stage: 1 | 2 } }
  | { type: "SET_SERVER_GRAPH"; data: { graph: ServerGraphData } }
  | { type: "STREAM_TOKEN"; data: { agent: string; token: string; target: string } }
  | { type: "FACILITATOR_STREAM"; data: { token: string } }
  | { type: "NODE_UPDATE"; data: { from_id: string; to_id: string } }
  | { type: "ACTION_UPDATE_BACKTRACK"; data: { new_node_id: string; new_role: string } }
  | { type: "COMPLETE_HISTORY_REVIEW" }
  | { type: "ACTION_UPDATE_DIVERGENCE_IN_PROGRESS" }
  | { type: "ACTION_UPDATE_DIVERGENCE_COMPLETE"; data: { report: string } }
  | { type: "SET_ANALYSIS_HTML"; data: { html: string } }
  | { type: "SET_REFLECTION_HTML"; data: { html: string } }
  | { type: "ENABLE_REFLECTION" }
  | { type: "SET_SAVE_EXPORT"; data: SaveExportPayload }
  | { type: "SET_TIP_DATA"; data: ServerTipData }
  | { type: "SET_TIP_ERROR"; data: { msg: string } }
  | { type: "SET_TIP_LOADING"; data: { loading: boolean } }
  | { type: "SET_INPUT_REQUEST"; data: { msg: string; from_name: string } | null }
  | { type: "SET_PENDING_TIP_FILL"; data: { text: string; targetName: string } }
  | { type: "CLEAR_PENDING_TIP_FILL" }
