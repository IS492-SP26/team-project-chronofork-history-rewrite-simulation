// ─── ChronoFork Mock Data ───────────────────────────────────────────
// Cuban Missile Crisis episode — 13 days, October 1962

export interface Role {
  id: string
  name: string
  title: string
  stanceTags: string[]
  portrait: string // placeholder color
  shortName: string
}

export interface Scene {
  id: string
  time: string
  location: string
  topic: string
  artifact: string
  directorCaption: string
}

export interface DialogueBeat {
  id: string
  sceneId: string
  speakerId: string
  text: string
  emotion: "calm" | "concerned" | "angry" | "resolute" | "tense"
}

export interface TimelineNode {
  id: string
  label: string
  summary: string
  constraints: string[]
  canonicalChoice: string
  status: "completed" | "current" | "upcoming" | "divergent"
  branchId: string | null
  parentId: string | null
  sceneId: string
  timestamp: string
}

export interface DivergenceAnalysis {
  plausibility: number
  drivers: string[]
  constraints: string[]
  outcomes: {
    label: string
    canonical: number
    divergent: number
    uncertainty: "low" | "medium" | "high"
  }[]
  causalChain: { id: string; label: string; effect: string }[]
  diffCanonical: string
  diffDivergent: string
}

// ─── Episode ───
export const episode = {
  id: "cuban-missile-crisis",
  title: "Cuban Missile Crisis",
  subtitle: "Thirteen Days on the Brink",
  year: 1962,
  description:
    "October 1962. U-2 spy planes reveal Soviet nuclear missiles in Cuba. The world holds its breath for thirteen days as two superpowers edge toward thermonuclear war.",
}

// ─── Roles ───
export const roles: Role[] = [
  {
    id: "jfk",
    name: "John F. Kennedy",
    title: "President of the United States",
    stanceTags: ["cautious", "diplomatic"],
    portrait: "#2dd4bf",
    shortName: "JFK",
  },
  {
    id: "rfk",
    name: "Robert F. Kennedy",
    title: "Attorney General",
    stanceTags: ["advisory", "moral-compass"],
    portrait: "#5eead4",
    shortName: "RFK",
  },
  {
    id: "mcnamara",
    name: "Robert McNamara",
    title: "Secretary of Defense",
    stanceTags: ["analytical", "pragmatic"],
    portrait: "#67e8f9",
    shortName: "McNamara",
  },
  {
    id: "lemay",
    name: "Curtis LeMay",
    title: "Air Force Chief of Staff",
    stanceTags: ["hawkish", "aggressive"],
    portrait: "#fbbf24",
    shortName: "LeMay",
  },
  {
    id: "khrushchev",
    name: "Nikita Khrushchev",
    title: "Premier of the Soviet Union",
    stanceTags: ["calculating", "brinkmanship"],
    portrait: "#f87171",
    shortName: "Khrushchev",
  },
  {
    id: "facilitator",
    name: "Facilitator",
    title: "Historical Narrator",
    stanceTags: ["neutral"],
    portrait: "#94a3b8",
    shortName: "Narrator",
  },
]

// ─── Scenes ───
export const scenes: Scene[] = [
  {
    id: "scene-1",
    time: "October 16, 1962 — 08:45",
    location: "The White House, Cabinet Room",
    topic: "U-2 Reconnaissance Evidence",
    artifact: "u2-photograph",
    directorCaption:
      "The room falls silent as the U-2 photographs reveal missile sites in San Cristobal...",
  },
  {
    id: "scene-2",
    time: "October 16, 1962 — 11:30",
    location: "The White House, Oval Office",
    topic: "ExComm First Session",
    artifact: "briefing-folder",
    directorCaption:
      "The Executive Committee of the National Security Council convenes for the first time. Every option is on the table.",
  },
  {
    id: "scene-3",
    time: "October 18, 1962 — 14:00",
    location: "The White House, Cabinet Room",
    topic: "Blockade vs. Air Strike Debate",
    artifact: "strategic-map",
    directorCaption:
      "Hawks and doves clash over the response. LeMay pushes for an air strike. McNamara argues for a naval quarantine.",
  },
  {
    id: "scene-4",
    time: "October 22, 1962 — 19:00",
    location: "The White House, Broadcast Room",
    topic: "Address to the Nation",
    artifact: "television-broadcast",
    directorCaption:
      "President Kennedy addresses 80 million Americans. The world learns of the missiles in Cuba.",
  },
  {
    id: "scene-5",
    time: "October 27, 1962 — 10:00",
    location: "The White House, Situation Room",
    topic: "Black Saturday — The Climax",
    artifact: "hotline-telegram",
    directorCaption:
      "A U-2 is shot down over Cuba. Khrushchev's letters arrive with conflicting demands. The clock ticks toward midnight.",
  },
]

// ─── Dialogue Beats ───
export const dialogueBeats: DialogueBeat[] = [
  // Scene 1
  {
    id: "d1",
    sceneId: "scene-1",
    speakerId: "mcnamara",
    text: "Mr. President, the photographs are conclusive. Medium-range ballistic missiles, capable of reaching Washington in thirteen minutes.",
    emotion: "tense",
  },
  {
    id: "d2",
    sceneId: "scene-1",
    speakerId: "jfk",
    text: "How long until they're operational?",
    emotion: "calm",
  },
  {
    id: "d3",
    sceneId: "scene-1",
    speakerId: "mcnamara",
    text: "Two weeks. Perhaps less. The construction is proceeding rapidly.",
    emotion: "concerned",
  },
  {
    id: "d4",
    sceneId: "scene-1",
    speakerId: "lemay",
    text: "We should take them out now, before they're armed. A surgical air strike — clean, decisive.",
    emotion: "resolute",
  },
  {
    id: "d5",
    sceneId: "scene-1",
    speakerId: "rfk",
    text: "And if we're wrong about the timing? We'd be launching a Pearl Harbor in reverse.",
    emotion: "concerned",
  },
  // Scene 2
  {
    id: "d6",
    sceneId: "scene-2",
    speakerId: "facilitator",
    text: "The ExComm faces its first real test. Six options lie on the table, each carrying the weight of civilization.",
    emotion: "calm",
  },
  {
    id: "d7",
    sceneId: "scene-2",
    speakerId: "jfk",
    text: "I want every option analyzed. What are the risks? What are the costs? I need clarity, not consensus.",
    emotion: "resolute",
  },
  {
    id: "d8",
    sceneId: "scene-2",
    speakerId: "mcnamara",
    text: "A naval blockade gives us time without committing to immediate hostilities. We call it a 'quarantine' to avoid legal complications.",
    emotion: "calm",
  },
  {
    id: "d9",
    sceneId: "scene-2",
    speakerId: "lemay",
    text: "A blockade is weakness. The Soviets only understand force. Every day we wait, those missiles get closer to operational.",
    emotion: "angry",
  },
  {
    id: "d10",
    sceneId: "scene-2",
    speakerId: "rfk",
    text: "If we strike first, we lose the moral high ground. And we may not get all the missiles.",
    emotion: "concerned",
  },
  // Scene 3
  {
    id: "d11",
    sceneId: "scene-3",
    speakerId: "lemay",
    text: "Mr. President, with all due respect, this blockade is almost as bad as the appeasement at Munich.",
    emotion: "angry",
  },
  {
    id: "d12",
    sceneId: "scene-3",
    speakerId: "jfk",
    text: "General, I appreciate your candor. But I will not be the president who started World War III.",
    emotion: "resolute",
  },
  {
    id: "d13",
    sceneId: "scene-3",
    speakerId: "mcnamara",
    text: "The quarantine gives us escalation control. We tighten or loosen based on Moscow's response.",
    emotion: "calm",
  },
  {
    id: "d14",
    sceneId: "scene-3",
    speakerId: "rfk",
    text: "I've been passing messages through Ambassador Dobrynin. There may be a diplomatic channel we haven't fully explored.",
    emotion: "calm",
  },
  // Scene 4
  {
    id: "d15",
    sceneId: "scene-4",
    speakerId: "facilitator",
    text: "The President steps before the cameras. Eighty million Americans watch as the world changes.",
    emotion: "calm",
  },
  {
    id: "d16",
    sceneId: "scene-4",
    speakerId: "jfk",
    text: "Good evening, my fellow citizens. This government has maintained the closest surveillance of the Soviet military buildup on the island of Cuba...",
    emotion: "resolute",
  },
  {
    id: "d17",
    sceneId: "scene-4",
    speakerId: "khrushchev",
    text: "The Americans have drawn a line. But lines can be redrawn. Let them see how serious we are.",
    emotion: "resolute",
  },
  // Scene 5
  {
    id: "d18",
    sceneId: "scene-5",
    speakerId: "mcnamara",
    text: "Mr. President, we've lost contact with Major Anderson's U-2 over Cuba. We must assume the worst.",
    emotion: "tense",
  },
  {
    id: "d19",
    sceneId: "scene-5",
    speakerId: "lemay",
    text: "They shot down our plane. This is an act of war. We should respond with everything we have.",
    emotion: "angry",
  },
  {
    id: "d20",
    sceneId: "scene-5",
    speakerId: "rfk",
    text: "We've received two letters from Khrushchev — one conciliatory, one hard-line. Bobby suggested we respond only to the first.",
    emotion: "concerned",
  },
  {
    id: "d21",
    sceneId: "scene-5",
    speakerId: "jfk",
    text: "We ignore the second letter. We accept the first. And we make it very clear — privately — about the Jupiter missiles in Turkey.",
    emotion: "resolute",
  },
  {
    id: "d22",
    sceneId: "scene-5",
    speakerId: "khrushchev",
    text: "If the Americans remove their missiles from Turkey... perhaps we can find an arrangement that preserves dignity on both sides.",
    emotion: "calm",
  },
]

// ─── Timeline Nodes ───
export const timelineNodes: TimelineNode[] = [
  {
    id: "node-1",
    label: "U-2 Photos Revealed",
    summary: "CIA presents photographic evidence of Soviet missile sites in Cuba to President Kennedy.",
    constraints: ["Intelligence accuracy", "Political timing"],
    canonicalChoice: "Convene ExComm secretly",
    status: "completed",
    branchId: null,
    parentId: null,
    sceneId: "scene-1",
    timestamp: "Oct 16, 08:45",
  },
  {
    id: "node-2",
    label: "ExComm Deliberations",
    summary: "The Executive Committee debates six options ranging from diplomacy to full invasion.",
    constraints: ["Time pressure", "Soviet response", "Public opinion"],
    canonicalChoice: "Continue deliberation; narrow to blockade vs. air strike",
    status: "completed",
    branchId: null,
    parentId: "node-1",
    sceneId: "scene-2",
    timestamp: "Oct 16, 11:30",
  },
  {
    id: "node-3",
    label: "Quarantine Decision",
    summary: "Kennedy chooses naval quarantine over air strike after fierce debate.",
    constraints: ["Military readiness", "Allied support", "Legal framework"],
    canonicalChoice: "Naval quarantine with escalation ladder",
    status: "completed",
    branchId: null,
    parentId: "node-2",
    sceneId: "scene-3",
    timestamp: "Oct 18, 14:00",
  },
  {
    id: "node-4",
    label: "Address to the Nation",
    summary: "Kennedy reveals the crisis to 80 million Americans in a televised address.",
    constraints: ["Public panic", "Soviet reaction", "UN diplomacy"],
    canonicalChoice: "Public disclosure with quarantine announcement",
    status: "current",
    branchId: null,
    parentId: "node-3",
    sceneId: "scene-4",
    timestamp: "Oct 22, 19:00",
  },
  {
    id: "node-5",
    label: "Black Saturday",
    summary: "U-2 shot down. Two conflicting Khrushchev letters. The world on the brink.",
    constraints: ["Military escalation", "Diplomatic channels", "Nuclear risk"],
    canonicalChoice: "Respond to first letter only; secret Turkey deal",
    status: "upcoming",
    branchId: null,
    parentId: "node-4",
    sceneId: "scene-5",
    timestamp: "Oct 27, 10:00",
  },
]

// ─── Divergence Analysis (mock) ───
export const mockDivergenceAnalysis: DivergenceAnalysis = {
  plausibility: 72,
  drivers: [
    "Soviet desire to avoid nuclear war",
    "American military superiority in Caribbean",
    "Backchannel diplomatic contacts",
    "UN Security Council pressure",
  ],
  constraints: [
    "Soviet prestige on world stage",
    "Cuban sovereignty concerns",
    "NATO alliance obligations",
    "Domestic political pressure (midterm elections)",
  ],
  outcomes: [
    { label: "Nuclear Risk", canonical: 85, divergent: 45, uncertainty: "high" },
    { label: "Public Opinion (US)", canonical: 70, divergent: 55, uncertainty: "medium" },
    { label: "Soviet Relations", canonical: 30, divergent: 60, uncertainty: "medium" },
    { label: "NATO Cohesion", canonical: 75, divergent: 50, uncertainty: "low" },
    { label: "Cuban Stability", canonical: 40, divergent: 65, uncertainty: "high" },
    { label: "Arms Race Impact", canonical: 80, divergent: 35, uncertainty: "medium" },
  ],
  causalChain: [
    { id: "cc1", label: "Backchannel opened", effect: "Reduces escalation pressure" },
    { id: "cc2", label: "Turkey deal proposed early", effect: "Accelerates negotiation" },
    { id: "cc3", label: "Soviet save-face achieved", effect: "Faster withdrawal" },
    { id: "cc4", label: "Crisis shortened by 4 days", effect: "Reduced nuclear risk window" },
  ],
  diffCanonical:
    "Kennedy chose a naval quarantine, revealed the crisis publicly, and negotiated a secret deal to remove Jupiter missiles from Turkey.",
  diffDivergent:
    "You proposed an early backchannel negotiation through Dobrynin, offering the Turkey missile swap before the public address, shortening the crisis.",
}

// ─── Strategy Tips (Structured) ───
export interface StrategyOption {
  id: string
  label: string
  intentType: "escalation" | "de-escalation" | "alliance_building" | "info_gathering"
  targetAgentId: string
  exampleResponse: string
  why: string
  risk: string
}

export interface StructuredTips {
  situationAnalysis: string
  options: StrategyOption[]
}

export const strategyTips = [
  {
    id: "tip-1",
    label: "Backchannel Negotiation",
    description: "Use Ambassador Dobrynin to open private dialogue with Moscow before going public.",
    template: "I propose we establish a backchannel through Ambassador Dobrynin to communicate directly with Premier Khrushchev. Our message should emphasize...",
  },
  {
    id: "tip-2",
    label: "Naval Quarantine",
    description: "Establish a defensive perimeter. Buys time without committing to military action.",
    template: "I recommend implementing a naval quarantine around Cuba, intercepting Soviet vessels carrying offensive weapons. The quarantine line should be set at...",
  },
  {
    id: "tip-3",
    label: "Surgical Strike Threat",
    description: "Signal willingness to use force while keeping the door open for diplomacy.",
    template: "We should communicate to Moscow — through back channels — that unless the missiles are removed within 72 hours, we are prepared to conduct surgical air strikes on...",
  },
]

export const structuredTips: StructuredTips = {
  situationAnalysis: "The ExComm is deadlocked between hawks and doves. LeMay pushes for air strikes while McNamara favors a naval quarantine. A decision must be made within 48 hours before the missiles become operational. Your position as President gives you the final say, but consensus matters for execution.",
  options: [
    {
      id: "opt-1",
      label: "Open Backchannel via Dobrynin",
      intentType: "de-escalation",
      targetAgentId: "khrushchev",
      exampleResponse: "I propose we establish a private backchannel through Ambassador Dobrynin. We can signal our willingness to negotiate on the Jupiter missiles in Turkey if the Soviets halt construction immediately.",
      why: "Creates a private negotiation path that avoids public humiliation for either side, dramatically reducing the chance of miscalculation.",
      risk: "If the backchannel leaks, it could be seen as weakness by hawks in Congress and the military. LeMay may escalate independently.",
    },
    {
      id: "opt-2",
      label: "Demand Immediate Withdrawal",
      intentType: "escalation",
      targetAgentId: "khrushchev",
      exampleResponse: "Mr. Khrushchev, the United States demands the immediate withdrawal of all offensive weapons from Cuba. Failure to comply within 24 hours will result in decisive action.",
      why: "Projects strength and may force a rapid Soviet capitulation if Khrushchev believes the US is willing to use force.",
      risk: "High risk of escalation to armed conflict. Khrushchev may feel cornered and unable to back down without losing face domestically.",
    },
    {
      id: "opt-3",
      label: "Propose UN Inspection Framework",
      intentType: "alliance_building",
      targetAgentId: "mcnamara",
      exampleResponse: "I suggest we propose a UN-supervised inspection regime for Cuba. This internationalizes the crisis and builds a coalition that makes unilateral Soviet action politically untenable.",
      why: "Builds international coalition support and creates legitimate framework for verification, strengthening the US legal and moral position.",
      risk: "The UN process is slow. Missiles may become operational before inspectors are deployed. Soviets may use delays tactically.",
    },
    {
      id: "opt-4",
      label: "Request CIA Deep Assessment",
      intentType: "info_gathering",
      targetAgentId: "mcnamara",
      exampleResponse: "Before we commit to any course of action, I need a full CIA assessment of Soviet submarine positions, the exact operational timeline of the missiles, and any intelligence on Khrushchev's inner circle deliberations.",
      why: "Better intelligence reduces uncertainty and may reveal options not currently visible. Knowledge of Soviet submarine positions is critical for quarantine planning.",
      risk: "Time is the enemy. Every hour spent gathering intelligence is an hour closer to operational missiles. Analysis paralysis could be fatal.",
    },
  ],
}

// ─── Analysis HTML (mock -- simulates backend-provided HTML) ───
export const mockAnalysisHtml = `
<div style="font-family: var(--font-sans);">
  <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">Divergence Analysis Report</h3>
  <p style="color: var(--muted-foreground); font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
    Your intervention at the <strong>Quarantine Decision</strong> node created a significant divergence from the canonical timeline.
    By proposing an early backchannel negotiation through Ambassador Dobrynin, you bypassed the public confrontation phase entirely.
  </p>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
    <div style="padding: 12px; border-radius: 8px; background: color-mix(in oklch, var(--chrono-teal) 8%, transparent); border: 1px solid color-mix(in oklch, var(--chrono-teal) 20%, transparent);">
      <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--chrono-teal); margin: 0 0 6px 0;">Canonical Path</p>
      <p style="font-size: 13px; color: var(--foreground); margin: 0; line-height: 1.5;">Naval quarantine announced publicly, 13-day standoff, secret Turkey deal.</p>
    </div>
    <div style="padding: 12px; border-radius: 8px; background: color-mix(in oklch, var(--chrono-amber) 8%, transparent); border: 1px solid color-mix(in oklch, var(--chrono-amber) 20%, transparent);">
      <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--chrono-amber); margin: 0 0 6px 0;">Your Fork</p>
      <p style="font-size: 13px; color: var(--foreground); margin: 0; line-height: 1.5;">Early backchannel, Turkey swap proposed before public address, crisis shortened by 4 days.</p>
    </div>
  </div>
  <h4 style="font-size: 13px; font-weight: 700; margin: 0 0 8px 0;">Key Drivers</h4>
  <ul style="margin: 0 0 16px 0; padding-left: 18px; font-size: 13px; line-height: 1.8; color: var(--foreground);">
    <li>Soviet desire to avoid nuclear war</li>
    <li>American military superiority in the Caribbean</li>
    <li>Backchannel diplomatic contacts through Dobrynin</li>
    <li>UN Security Council pressure on both sides</li>
  </ul>
  <h4 style="font-size: 13px; font-weight: 700; margin: 0 0 8px 0;">Plausibility Assessment</h4>
  <p style="font-size: 14px; color: var(--foreground); margin: 0; line-height: 1.6;">
    <strong style="color: var(--chrono-teal);">72%</strong> &mdash; Your timeline is historically plausible. The backchannel approach was actually considered but rejected due to timing concerns.
    Your early proposal could have worked if Khrushchev&rsquo;s internal position was stronger than historians believe.
  </p>
</div>
`

// ─── Report Data ───
export const mockReportData = {
  runId: "mock-run-001",
  episode: episode.title,
  duration: "34 minutes",
  forksCreated: 1,
  forkNode: "Quarantine Decision",
  dimensions: [
    { label: "Nuclear Danger", canonical: 85, divergent: 45 },
    { label: "Public Opinion", canonical: 70, divergent: 55 },
    { label: "Ally Relations", canonical: 75, divergent: 50 },
    { label: "Soviet Relations", canonical: 30, divergent: 60 },
    { label: "Cuban Stability", canonical: 40, divergent: 65 },
    { label: "Arms Race", canonical: 80, divergent: 35 },
  ],
  tradeoffs: [
    "You reduced nuclear risk significantly by proposing early negotiations, but weakened the public perception of American resolve.",
    "The early Turkey missile swap preserved Soviet dignity but raised concerns among NATO allies about American commitments.",
  ],
  overlooked: [
    "The domestic political dimension: midterm elections were 2 weeks away. Early concessions could have been politically costly.",
    "Cuban reaction: Castro was not consulted in your timeline either, potentially leading to independent Cuban escalation.",
  ],
  recommendations: [
    "Try forking at 'Black Saturday' to explore the most dangerous moment of the crisis.",
    "Experiment with the air strike option to see how Soviet responses differ.",
    "Consider the role of the UN — Ambassador Stevenson's dramatic presentation was a key moment.",
  ],
}

// ─── DAG Graph (position-based for SVG visualization) ───
export interface GraphNode {
  id: string
  label: string
  status: "completed" | "in_progress" | "unfinished" | "suspended" | "divergent"
  branch: "canonical" | "divergent"
  pos: { x: number; y: number }
  sceneId?: string
  hoverTitle: string
  hoverDesc: string
}

export interface GraphEdge {
  from: string
  to: string
  branch: "canonical" | "divergent"
}

export const graphNodes: GraphNode[] = [
  {
    id: "node-1", label: "U-2 Photos", status: "completed", branch: "canonical",
    pos: { x: 100, y: 40 }, sceneId: "scene-1",
    hoverTitle: "U-2 Photos Revealed", hoverDesc: "CIA presents photographic evidence of Soviet missile sites.",
  },
  {
    id: "node-2", label: "ExComm", status: "completed", branch: "canonical",
    pos: { x: 100, y: 120 }, sceneId: "scene-2",
    hoverTitle: "ExComm Deliberations", hoverDesc: "The Executive Committee debates six options.",
  },
  {
    id: "node-3", label: "Quarantine", status: "completed", branch: "canonical",
    pos: { x: 100, y: 200 }, sceneId: "scene-3",
    hoverTitle: "Quarantine Decision", hoverDesc: "Kennedy chooses naval quarantine over air strike.",
  },
  {
    id: "node-4", label: "Address", status: "in_progress", branch: "canonical",
    pos: { x: 100, y: 280 }, sceneId: "scene-4",
    hoverTitle: "Address to the Nation", hoverDesc: "Kennedy reveals the crisis to 80 million Americans.",
  },
  {
    id: "node-5", label: "Black Sat.", status: "unfinished", branch: "canonical",
    pos: { x: 100, y: 360 }, sceneId: "scene-5",
    hoverTitle: "Black Saturday", hoverDesc: "U-2 shot down. Two conflicting Khrushchev letters.",
  },
  // Divergent branch (mock -- appears after user intervenes)
  {
    id: "node-3b", label: "Backchannel", status: "divergent", branch: "divergent",
    pos: { x: 200, y: 240 },
    hoverTitle: "Early Backchannel", hoverDesc: "You proposed direct negotiation through Dobrynin.",
  },
  {
    id: "node-4b", label: "Quiet Diplo.", status: "divergent", branch: "divergent",
    pos: { x: 200, y: 320 },
    hoverTitle: "Quiet Diplomacy", hoverDesc: "Secret negotiations bypass the public confrontation.",
  },
]

export const graphEdges: GraphEdge[] = [
  { from: "node-1", to: "node-2", branch: "canonical" },
  { from: "node-2", to: "node-3", branch: "canonical" },
  { from: "node-3", to: "node-4", branch: "canonical" },
  { from: "node-4", to: "node-5", branch: "canonical" },
  // Divergent branch
  { from: "node-3", to: "node-3b", branch: "divergent" },
  { from: "node-3b", to: "node-4b", branch: "divergent" },
]
