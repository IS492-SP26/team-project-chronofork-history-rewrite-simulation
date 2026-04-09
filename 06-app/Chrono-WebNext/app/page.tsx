"use client"

import {
  ChronoForkProvider,
  useChronoFork,
  FlowHeader,
  CenterStage,
  TimeRiverDock,
  TacticalHUDDock,
  HelpPanel,
  TimeWarpOverlay,
} from "@features/chronofork"
import { AnimatePresence } from "framer-motion"

function ConsoleInner() {
  const { state } = useChronoFork()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/war-room-bg.jpg')" }} />
        <div className="absolute inset-0 bg-background/80" />
        <div className="absolute inset-0 film-grain" />
      </div>

      {/* Flow Header */}
      <FlowHeader />

      {/* Main Content -- relative container for floating panels */}
      <div className="flex-1 relative z-10 overflow-hidden">
        {/* CenterStage fills entire area */}
        <div className="absolute inset-0">
          <CenterStage />
        </div>

        {/* Floating panels overlay */}
        <TimeRiverDock />
        <TacticalHUDDock />
      </div>

      {/* Overlays */}
      <AnimatePresence>
        <TimeWarpOverlay active={state.divergence.inProgress && !state.divergence.exists} />
      </AnimatePresence>
      <HelpPanel />
    </div>
  )
}

export default function ConsolePage() {
  return (
    <ChronoForkProvider>
      <ConsoleInner />
    </ChronoForkProvider>
  )
}
