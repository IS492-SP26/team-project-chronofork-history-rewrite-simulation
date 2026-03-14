// ─── ChronoFork Reducer ──────────────────────────────────────────────
import type { RunState, RunAction, ChatMessage } from "./types"
import { timelineNodes, scenes, dialogueBeats, roles } from "../mock/mockData"

function makeDialogueChatMessage(beatIdx: number, sceneId: string): ChatMessage | null {
  const beats = dialogueBeats.filter((d) => d.sceneId === sceneId)
  const beat = beats[beatIdx]
  if (!beat) return null
  const role = roles.find((r) => r.id === beat.speakerId)
  return {
    id: `chat-${beat.id}`,
    type: "dialogue",
    speakerId: beat.speakerId,
    speakerName: role?.shortName ?? beat.speakerId,
    text: beat.text,
    timestamp: Date.now(),
    isKeyMoment: beat.speakerId === "facilitator",
  }
}

export const initialState: RunState = {
  /* ── Connection ── */
  connectionStatus: "disconnected",
  serverConfig: null,
  stage: 1,

  /* ── Core flow ── */
  phase: "observe_idle",
  selectedNodeId: null,
  activeNodeId: "node-1",
  currentPath: timelineNodes.filter((n) => !n.branchId).map((n) => n.id),
  activeRoleId: null,
  activeRoleName: null,
  currentSceneIndex: 0,
  currentDialogueIndex: 0,
  observeProgress: 0,
  chatHistory: [],
  decisionPointReached: false,

  /* ── Server graph data ── */
  serverGraph: null,

  /* ── Streaming state ── */
  currentStreamKey: null,
  facilitatorBlocks: [],

  /* ── Divergence ── */
  divergence: { exists: false, inProgress: false },

  /* ── Analysis / reflection ── */
  analysis: { available: false },
  analysisHtml: null,
  reflectionHtml: null,
  canReflect: false,

  /* ── Tips ── */
  tipData: null,
  tipLoading: false,
  tipError: null,

  /* ── Input request ── */
  inputRequest: null,

  /* ── UI ── */
  ui: {
    docks: { leftOpen: false, rightOpen: false },
    reducedMotion: false,
    showNodeDetail: false,
    showHelpPanel: false,
    showTips: false,
    showAnalysis: false,
    analysisViewed: false,
    rightDockTab: "transcript",
  },
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    /* ═══════════════════════════════════════════════
       WebSocket / Server-driven actions
       ═══════════════════════════════════════════════ */

    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.data.status }

    case "SET_SERVER_CONFIG":
      return { ...state, serverConfig: action.data.config }

    case "SET_STAGE": {
      const newStage = action.data.stage
      if (newStage === 2 && state.stage === 1) {
        // Transition to intervene phase
        return {
          ...state,
          stage: 2,
          phase: "observe_complete",
          observeProgress: 100,
          decisionPointReached: true,
          ui: { ...state.ui, docks: { leftOpen: true, rightOpen: true } },
        }
      }
      return { ...state, stage: newStage }
    }

    case "SET_SERVER_GRAPH":
      return {
        ...state,
        serverGraph: action.data.graph,
        activeNodeId: action.data.graph.active_id,
        currentPath: action.data.graph.current_path,
      }

    case "STREAM_TOKEN": {
      const { agent, token, target } = action.data
      const streamKey = `${agent}::${target}`
      const history = [...state.chatHistory]

      // If this is a continuation of the same stream, append to last message
      if (state.currentStreamKey === streamKey && history.length > 0) {
        const last = { ...history[history.length - 1] }
        last.text = last.text + token
        history[history.length - 1] = last
        return { ...state, chatHistory: history }
      }

      // New stream -- create a new message
      const speakerRole = roles.find((r) => r.name === agent || r.shortName === agent)
      const newMsg: ChatMessage = {
        id: `stream-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "dialogue",
        speakerId: speakerRole?.id,
        speakerName: agent,
        targetName: target,
        text: token,
        timestamp: Date.now(),
      }
      return {
        ...state,
        chatHistory: [...history, newMsg],
        currentStreamKey: streamKey,
      }
    }

    case "FACILITATOR_STREAM": {
      const { token } = action.data
      const blocks = [...state.facilitatorBlocks]

      if (token === "<END>") {
        // Mark current block as complete
        if (blocks.length > 0) {
          blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], complete: true }
        }
        return { ...state, facilitatorBlocks: blocks }
      }

      // Append to current block or create new one
      if (blocks.length === 0 || blocks[blocks.length - 1].complete) {
        blocks.push({ text: token, complete: false })
      } else {
        blocks[blocks.length - 1] = {
          ...blocks[blocks.length - 1],
          text: blocks[blocks.length - 1].text + token,
        }
      }
      return { ...state, facilitatorBlocks: blocks }
    }

    case "NODE_UPDATE": {
      // Update active node on node transition
      const { from_id, to_id } = action.data
      const newHistory = [...state.chatHistory]
      
      const sysMsg: ChatMessage = {
        id: `node_update_${from_id}_${to_id}_${Date.now()}`,
        type: "node_update",
        speakerName: "System",
        text: "",
        timestamp: Date.now(),
        meta: { from_id, to_id }
      }
      
      // If we are observing or just got updated
      newHistory.push(sysMsg)

      if (to_id === "end") {
        return { ...state, phase: "observe_complete", observeProgress: 100, decisionPointReached: true, chatHistory: newHistory }
      }
      return { ...state, activeNodeId: to_id, chatHistory: newHistory }
    }

    case "ACTION_UPDATE_BACKTRACK":
      const backMsg: ChatMessage = {
        id: `backtrack_${Date.now()}`,
        type: "backtrack_complete",
        speakerName: "System",
        text: "",
        timestamp: Date.now(),
        meta: { new_node_id: action.data.new_node_id, new_role: action.data.new_role }
      }
      return {
        ...state,
        phase: "intervene_active",
        activeNodeId: action.data.new_node_id,
        activeRoleName: action.data.new_role,
        divergence: { ...state.divergence, backtrackedNodeId: action.data.new_node_id },
        ui: { ...state.ui, showNodeDetail: false, rightDockTab: "transcript", showTips: false, showAnalysis: false },
        chatHistory: [backMsg] // Clear previous history and set the backtrack message
      }

    case "ACTION_UPDATE_DIVERGENCE_IN_PROGRESS":
      return {
        ...state,
        phase: "divergence_running",
        divergence: { ...state.divergence, inProgress: true },
        ui: { ...state.ui, showAnalysis: true },
      }

    case "ACTION_UPDATE_DIVERGENCE_COMPLETE":
      return {
        ...state,
        phase: "branch_complete",
        divergence: { ...state.divergence, exists: true, inProgress: false },
        analysisHtml: action.data.report,
        ui: { ...state.ui, showAnalysis: true, analysisViewed: true },
      }

    case "SET_ANALYSIS_HTML":
      return { ...state, analysisHtml: action.data.html }

    case "SET_REFLECTION_HTML":
      return { ...state, reflectionHtml: action.data.html }

    case "ENABLE_REFLECTION":
      return { ...state, canReflect: true }

    case "SET_TIP_DATA":
      return { ...state, tipData: action.data, tipLoading: false, tipError: null, ui: { ...state.ui, showTips: true } }

    case "SET_TIP_ERROR":
      return { ...state, tipError: action.data.msg, tipLoading: false }

    case "SET_TIP_LOADING":
      return { ...state, tipLoading: action.data.loading }

    case "SET_INPUT_REQUEST":
      return { ...state, inputRequest: action.data }

    case "COMPLETE_HISTORY_REVIEW":
      // Stage2 history replay ended -- enable interaction
      const divMsg: ChatMessage = {
        id: `history_divider_${Date.now()}`,
        type: "history_divider",
        speakerName: "System",
        text: "── 📝 之前的交互上下文 ──",
        timestamp: Date.now()
      }
      return { ...state, phase: "intervene_active", chatHistory: [...state.chatHistory, divMsg] }

    /* ═══════════════════════════════════════════════
       Local / mock-driven actions (preserved from R1)
       ═══════════════════════════════════════════════ */

    case "START_OBSERVE":
      if (state.phase !== "observe_idle") return state
      return { ...state, phase: "observe_playing", ui: { ...state.ui, docks: { leftOpen: true, rightOpen: true } } }

    case "ADVANCE_DIALOGUE": {
      if (state.phase !== "observe_playing") return state
      const currentScene = scenes[state.currentSceneIndex]
      if (!currentScene) return { ...state, phase: "observe_complete", ui: { ...state.ui, docks: { ...state.ui.docks, leftOpen: true } } }
      const sceneBeats = dialogueBeats.filter((d) => d.sceneId === currentScene.id)
      const nextIdx = state.currentDialogueIndex + 1
      const totalBeats = dialogueBeats.length
      const beatsBeforeCurrent = dialogueBeats.findIndex(
        (d) => d.sceneId === currentScene.id && d === sceneBeats[state.currentDialogueIndex]
      )
      const progress = Math.min(100, Math.round(((beatsBeforeCurrent + 1) / totalBeats) * 100))
      const chatMsg = makeDialogueChatMessage(state.currentDialogueIndex, currentScene.id)
      const newHistory = chatMsg ? [...state.chatHistory, chatMsg] : state.chatHistory
      const decisionPointReached = state.decisionPointReached || progress > 50

      if (nextIdx < sceneBeats.length) {
        return { ...state, currentDialogueIndex: nextIdx, observeProgress: progress, chatHistory: newHistory, decisionPointReached }
      }
      const nextSceneIdx = state.currentSceneIndex + 1
      if (nextSceneIdx < scenes.length) {
        const nextNode = timelineNodes.find((n) => n.sceneId === scenes[nextSceneIdx].id)
        return {
          ...state, currentSceneIndex: nextSceneIdx, currentDialogueIndex: 0,
          activeNodeId: nextNode?.id ?? state.activeNodeId, observeProgress: progress, chatHistory: newHistory, decisionPointReached,
        }
      }
      return { ...state, phase: "observe_complete", observeProgress: 100, chatHistory: newHistory, decisionPointReached: true, ui: { ...state.ui, docks: { ...state.ui.docks, leftOpen: true } } }
    }

    case "OBSERVE_COMPLETE":
      return { ...state, phase: "observe_complete", observeProgress: 100, ui: { ...state.ui, docks: { ...state.ui.docks, leftOpen: true } } }

    case "SELECT_NODE": {
      const canSelect = ["observe_complete", "intervene_idle"].includes(state.phase)
      if (!canSelect) return state
      return { ...state, selectedNodeId: action.data.nodeId, ui: { ...state.ui, showNodeDetail: action.data.nodeId !== null } }
    }

    case "SET_ROLE":
      return { ...state, activeRoleId: action.data.roleId, activeRoleName: action.data.roleName ?? state.activeRoleName }

    case "BACKTRACK_AND_INTERVENE": {
      const canBacktrack = ["observe_complete", "intervene_idle"].includes(state.phase)
      if (!canBacktrack) return state
      return {
        ...state, phase: "intervene_active", selectedNodeId: action.data.nodeId,
        activeRoleId: state.activeRoleId || "jfk",
        divergence: { exists: false, inProgress: false, branchId: `branch-${Date.now()}`, backtrackedNodeId: action.data.nodeId },
        analysis: { available: false },
        analysisHtml: null,
        ui: { ...state.ui, showNodeDetail: false, rightDockTab: "transcript", showTips: false, showAnalysis: false, analysisViewed: false },
      }
    }

    case "SEND_CHAT": {
      if (state.phase !== "intervene_active") return state
      const msg: ChatMessage = {
        id: `user-chat-${Date.now()}`, type: "user_chat",
        speakerName: action.data.speakerName, targetName: action.data.targetName, text: action.data.text, timestamp: Date.now(),
      }
      return { ...state, chatHistory: [...state.chatHistory, msg], inputRequest: null }
    }

    case "SEND_DIVERGE": {
      if (state.phase !== "intervene_active") return state
      const msg: ChatMessage = {
        id: `user-diverge-${Date.now()}`, type: "user_diverge",
        speakerName: action.data.speakerName, text: action.data.text, timestamp: Date.now(), isKeyMoment: true,
      }
      return {
        ...state, phase: "divergence_running",
        chatHistory: [...state.chatHistory, msg],
        divergence: { ...state.divergence, inProgress: true },
        ui: { ...state.ui, showTips: false, showAnalysis: true },
      }
    }

    case "SEND_CLARIFY": {
      const msg: ChatMessage = {
        id: `clarify-${Date.now()}`, type: "clarify", speakerName: "You", text: action.data.text, timestamp: Date.now(),
      }
      return { ...state, chatHistory: [...state.chatHistory, msg] }
    }

    case "ADD_CHAT_MESSAGE":
      return { ...state, chatHistory: [...state.chatHistory, action.data.message] }

    case "DIVERGENCE_COMPLETE":
      return { ...state, phase: "divergence_ready", divergence: { ...state.divergence, exists: true, inProgress: false } }

    case "ANALYSIS_COMPLETE":
      return {
        ...state,
        analysis: { ...action.data.analysis, available: true },
        phase: "branch_complete",
        ui: { ...state.ui, showAnalysis: true, analysisViewed: true },
      }

    case "BRANCH_COMPLETE":
      return { ...state, phase: "branch_complete" }

    case "OPEN_REFLECTION":
      return { ...state, phase: "reflection_open" }

    case "BACK_TO_INTERVENE":
      return {
        ...state, phase: "intervene_idle", selectedNodeId: null,
        divergence: { exists: false, inProgress: false }, analysis: { available: false },
        analysisHtml: null, tipData: null,
        ui: { ...state.ui, showNodeDetail: false, rightDockTab: "transcript", showTips: false, showAnalysis: false, analysisViewed: false },
      }

    case "BACK_TO_OBSERVE_COMPLETE":
      return {
        ...state, phase: "observe_complete", selectedNodeId: null,
        divergence: { exists: false, inProgress: false }, analysis: { available: false },
        activeRoleId: null, activeRoleName: null,
        analysisHtml: null, tipData: null, reflectionHtml: null, canReflect: false,
        ui: { ...state.ui, docks: { leftOpen: true, rightOpen: true }, showNodeDetail: false, rightDockTab: "transcript", showTips: false, showAnalysis: false, analysisViewed: false },
      }

    case "SET_ACTIVE_NODE":
      return { ...state, activeNodeId: action.data.nodeId }

    case "TOGGLE_DOCK":
      return {
        ...state, ui: { ...state.ui, docks: {
          ...state.ui.docks,
          [action.data.dock === "left" ? "leftOpen" : "rightOpen"]:
            !state.ui.docks[action.data.dock === "left" ? "leftOpen" : "rightOpen"],
        }},
      }

    case "TOGGLE_NODE_DETAIL":
      return { ...state, ui: { ...state.ui, showNodeDetail: !state.ui.showNodeDetail } }

    case "TOGGLE_HELP_PANEL":
      return { ...state, ui: { ...state.ui, showHelpPanel: !state.ui.showHelpPanel } }

    case "SET_REDUCED_MOTION":
      return { ...state, ui: { ...state.ui, reducedMotion: action.data.enabled } }

    case "SET_OBSERVE_PROGRESS":
      return { ...state, observeProgress: action.data.progress }

    case "SET_RIGHT_DOCK_TAB":
      return { ...state, ui: { ...state.ui, rightDockTab: action.data.tab } }

    case "TOGGLE_TIPS":
      return { ...state, ui: { ...state.ui, showTips: !state.ui.showTips, showAnalysis: state.ui.showTips ? state.ui.showAnalysis : false } }

    case "CLOSE_TIPS":
      return { ...state, ui: { ...state.ui, showTips: false } }

    case "TOGGLE_ANALYSIS":
      return { ...state, ui: { ...state.ui, showAnalysis: !state.ui.showAnalysis, showTips: state.ui.showAnalysis ? state.ui.showTips : false } }

    case "CLOSE_ANALYSIS":
      return { ...state, ui: { ...state.ui, showAnalysis: false } }

    case "OPEN_ANALYSIS":
      return { ...state, ui: { ...state.ui, showAnalysis: true, showTips: false } }

    default:
      return state
  }
}
