"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type Locale = "zh" | "en"

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  t: (key: string) => string
}

const zhDict: Record<string, string> = {
  "Story begins from node ": "故事从节点 ",
  " starts": " 开始",
  "Reached ending (node ": "到达结局（节点 ",
  ")": "）",
  "Path transition: ": "流转：",
  "Backtrack complete": "回溯完成",
  "Backtracked as ": "已以 ",
  " to node ": " 身份回溯到节点 ",
  "。": "。",
  "Previous interaction context": "之前的交互上下文",
  "Back to Console": "返回控制台",
  "Help Center": "帮助中心",
  "Learn how to use the ChronoFork Historical Simulator Console.": "了解如何使用 ChronoFork 历史模拟控制台。",
  "Core Concepts": "核心概念",
  "Keyboard Shortcuts": "快捷键",
  "Episode Gallery": "剧集总览",
  "Historical Simulations": "历史模拟",
  "Choose a pivotal moment in history to explore. Each episode features AI-driven characters and branching decisions.": "选择历史中的关键时刻进行探索。每个剧集都包含 AI 驱动角色与分支决策。",
  "AVAILABLE": "可用",
  "COMING SOON": "即将上线",
  "roles": "角色",
  "Launch Simulation": "启动模拟",
  "Settings": "设置",
  "Display": "显示",
  "Theme": "主题",
  "Light (War Room)": "浅色（作战室）",
  "Reduced Motion": "减少动画",
  "System Default": "系统默认",
  "Audio": "音频",
  "Sound Effects": "音效",
  "Coming Soon": "即将上线",
  "Connection": "连接",
  "Backend URL": "后端地址",
  "Not configured": "未配置",
  "WebSocket Status": "WebSocket 状态",
  "Disconnected (Mock Mode)": "未连接（模拟模式）",
  "Back": "返回",
  "Export": "导出",
  "Aftermath Report": "结果复盘报告",
  "fork(s)": "条分支",
  "Fork:": "分叉点：",
  "Canonical": "历史原线",
  "Your Timeline": "你的时间线",
  "Dimension Shift": "维度变化",
  "Trade-offs": "权衡点",
  "Overlooked": "忽略点",
  "Suggestions": "建议",
  "How ChronoFork Works": "ChronoFork 使用说明",
  "Observe": "观察",
  "Intervene": "干预",
  "Reflection": "复盘",
  "Close": "关闭",
  "Path transition": "路径切换",
  "Decision:": "决策：",
  "Timeline": "时间线",
  "Collapse timeline": "收起时间线",
  "Expand timeline": "展开时间线",
  "Start observation to see transcript.": "开始观察后可查看对话记录。",
  "Waiting for dialogue...": "等待对话中...",
  "DIVERGE": "分叉",
  "Escalation": "升级",
  "De-escalation": "降级",
  "Alliance Building": "联盟构建",
  "Info Gathering": "信息收集",
  "TO:": "目标：",
  "Why": "原因",
  "Risk": "风险",
  "Select Option": "选择方案",
  "Generating strategic advice...": "正在生成策略建议...",
  "Situation Analysis": "局势分析",
  "Temporal recalculation…": "时间线重算中…",
  "Collapse transcript": "收起记录",
  "Expand transcript": "展开记录",
  "Transcript": "对话记录",
  "Strategic Advisor": "策略顾问",
  "Close tips": "关闭建议",
  "Analysis": "分析",
  "Close analysis": "关闭分析",
  "Selected:": "已选择：",
  "Response inserted.": "回复已插入。",
  "Facilitator": "引导者",
  "ChronoFork Console": "ChronoFork 控制台",
  "Connect to a running backend server or explore with mock data.": "连接正在运行的后端，或使用本地模拟数据体验。",
  "Server Address": "服务器地址",
  "Connecting...": "连接中...",
  "Connect to Server": "连接服务器",
  "Use Mock Data": "使用模拟数据",
  "Mock mode uses local data for all interactions.": "模拟模式下所有交互均使用本地数据。",
  "Role:": "角色：",
  "Start Observation": "开始观察",
  "Load Different Episode": "加载其他剧集",
  "Observation Mode": "观察模式",
  "Summarize": "总结",
  "Explain term": "解释术语",
  "Bookmark": "标记",
  "Resumed": "已继续",
  "Paused (mock)": "已暂停（模拟）",
  "Resume": "继续",
  "Pause": "暂停",
  "Backtrack Setup": "回溯设置",
  "Select a node (left panel) and a character below to backtrack.": "在左侧选择节点，并在下方选择角色以回溯。",
  "Backtrack request sent...": "回溯请求已发送...",
  "Backtracking...": "正在回溯...",
  "Backtrack to Node": "回溯到该节点",
  "Select a node from the Timeline panel.": "请先在时间线面板中选择节点。",
  "Write your alternative decision...": "写下你的替代决策...",
  "Type in character as": "以该角色身份输入：",
  "Tips": "建议",
  "Check previous analysis": "查看上次分析",
  "DEBUG: Trigger divergence": "调试：触发分叉",
  "DEBUG: Computing divergence...": "调试：正在计算分叉...",
  "Trigger Divergence": "触发分叉",
  "Intervention": "干预",
  "Send": "发送",
  "Generating Reflection...": "正在生成复盘...",
  "Reflection Report Ready": "复盘报告已就绪",
  "Reflection Available": "可请求复盘",
  "Analyzing your intervention and computing outcomes...": "正在分析你的干预并计算结果...",
  "Your report is ready. Click below to review.": "报告已生成，点击下方查看。",
  "Your intervention run is complete. Request the analysis report.": "你的干预流程已结束，可请求分析报告。",
  "Request Reflection Report": "请求复盘报告",
  "View Reflection Report": "查看复盘报告",
  "Close report": "关闭报告",
  "Return to Console": "返回控制台",
  "Export Report": "导出报告",
  "Export Save": "导出存档",
  "Export functionality coming soon.": "导出功能即将上线。",
  "Reflection export will unlock when the server enables it.": "服务端启用后才可导出复盘结果。",
  "Waiting for reflection export to be enabled by the server.": "正在等待服务端开放复盘导出。",
  "Save export requested...": "已请求导出存档...",
  "Select a recipient before sending.": "发送前请先选择目标角色。",
  "Watch the historical event unfold. This is system-controlled -- press Start and watch.": "观察历史事件展开。此阶段由系统控制，点击开始后观看即可。",
  "After observation, select a timeline node to backtrack. Roleplay as a historical figure and make a different choice.": "观察结束后，选择时间线节点进行回溯。扮演历史角色并做出不同选择。",
  "When your intervention ends, a report compares your timeline with canonical history.": "干预结束后，报告会将你的时间线与历史原线进行对比。",
  "The scene is unfolding. Key actors are establishing their positions...": "场景正在展开，关键角色正逐步明确立场……",
  "Tensions are building. Arguments are crystallizing around key options...": "紧张局势正在上升，关键方案的分歧开始成形……",
  "A decision point approaches. Watch for moments where history could fork...": "关键决策点正在逼近，留意可能引发历史分叉的瞬间……",
  "The critical juncture is near. Prepare to intervene when you see an opening.": "临界时刻将至，发现窗口后准备介入。",
  "Observation complete. You may now select a node to backtrack.": "观察已完成，你现在可以选择节点回溯。",
  "Intervention committed. Computing divergence...": "干预已提交，正在计算分叉……",
  "Mock: Scene summarized": "模拟：场景已总结",
  "Mock: Term explained": "模拟：术语已解释",
  "Mock: Moment bookmarked": "模拟：关键时刻已标记",
  "Repeat Intervene-Reflect from different nodes. The DAG on the left shows all branches.": "从不同节点重复“干预-复盘”流程。左侧 DAG 会展示全部分支。",
  "Selected Node: ": "已选节点：",
  "Jump to another node": "重新选择跳转节点",
  "Dialogue Display": "对话展示",
  "Auto": "自动",
  "Manual": "手动",
  "Show Next Dialogue": "显示下一条对话",
  "Waiting for next dialogue...": "等待下一条对话...",
  " is talking to you.": " 正在和你说话。",
  "Respond or select another character.": "请回应或选择其他角色。",
  "Speaking": "说话中",
  "Listening": "正在听",
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    const stored = localStorage.getItem("chrono-locale")
    if (stored === "zh" || stored === "en") {
      setLocaleState(stored)
      return
    }
    const browserLocale = navigator.language.toLowerCase()
    if (browserLocale.startsWith("zh")) {
      setLocaleState("zh")
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
    localStorage.setItem("chrono-locale", locale)
  }, [locale])

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
  }, [])

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === "en" ? "zh" : "en"))
  }, [])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: (key: string) => (locale === "zh" ? (zhDict[key] ?? key) : key),
    }),
    [locale, setLocale, toggleLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
