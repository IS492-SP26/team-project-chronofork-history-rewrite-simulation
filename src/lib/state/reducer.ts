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
  phase: "observe_idle",
  selectedNodeId: null,
  activeNodeId: "node-1",
  currentPath: timelineNodes.filter((n) => !n.branchId).map((n) => n.id),
  activeRoleId: null,
  currentSceneIndex: 0,
  currentDialogueIndex: 0,
  observeProgress: 0,
  chatHistory: [],
  decisionPointReached: false,
  divergence: { exists: false, inProgress: false },
  analysis: { available: false },
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

      // Mark decision point reached halfway through
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
      return { ...state, activeRoleId: action.data.roleId }

    case "BACKTRACK_AND_INTERVENE": {
      const canBacktrack = ["observe_complete", "intervene_idle"].includes(state.phase)
      if (!canBacktrack) return state
      return {
        ...state, phase: "intervene_active", selectedNodeId: action.data.nodeId,
        activeRoleId: state.activeRoleId || "jfk",
        divergence: { exists: false, inProgress: false, branchId: `branch-${Date.now()}`, backtrackedNodeId: action.data.nodeId },
        analysis: { available: false },
        ui: { ...state.ui, showNodeDetail: false, rightDockTab: "transcript", showTips: false, showAnalysis: false, analysisViewed: false },
      }
    }

    case "SEND_CHAT": {
      if (state.phase !== "intervene_active") return state
      const msg: ChatMessage = {
        id: `user-chat-${Date.now()}`, type: "user_chat",
        speakerName: action.data.speakerName, text: action.data.text, timestamp: Date.now(),
      }
      return { ...state, chatHistory: [...state.chatHistory, msg] }
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
        ui: { ...state.ui, showNodeDetail: false, rightDockTab: "transcript", showTips: false, showAnalysis: false, analysisViewed: false },
      }

    case "BACK_TO_OBSERVE_COMPLETE":
      return {
        ...state, phase: "observe_complete", selectedNodeId: null,
        divergence: { exists: false, inProgress: false }, analysis: { available: false },
        activeRoleId: null,
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
      // Only one of tips/analysis can be open
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
