"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useMachine } from "@xstate/react";
import { stateAtStep, type EngineState } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { findLoops, planPresentation, type StepPresentation } from "@/lib/analysis/loops";
import { DEFAULT_STEP_DURATION, playbackMachine, type PlaybackEvent } from "./machine";

interface PlaybackApi {
  stepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  isJumped: boolean;
  isFinished: boolean;
  /** True once playback has started, which is when clicking a line seeks. */
  isSeekable: boolean;
  forceFullPlayback: boolean;
  /** Playback rate multiplier; lower is slower. */
  speed: number;
  jump: { stepIndex: number } | null;
  /** How the step currently on screen should be presented (loop compression). */
  presentation: StepPresentation | null;
  send: (event: PlaybackEvent) => void;
}

const PlaybackContext = createContext<PlaybackApi | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const trace = useStore((s) => s.trace);
  const totalSteps = trace.steps.length;
  const [state, send] = useMachine(playbackMachine, { input: { totalSteps } });

  const { stepIndex, forceFullPlayback, speed } = state.context;

  const plan = useMemo(
    () => planPresentation(trace, findLoops(trace), forceFullPlayback),
    [trace, forceFullPlayback],
  );

  const current = stepIndex >= 0 ? (plan[stepIndex] ?? null) : null;

  useEffect(() => {
    send({ type: "TRACE_CHANGED", totalSteps });
  }, [totalSteps, send]);

  // Compressed loop iterations advance faster than fully-played ones, scaled by
  // the student's chosen playback rate.
  useEffect(() => {
    send({
      type: "SET_DURATION",
      duration: Math.round((DEFAULT_STEP_DURATION * (current?.speed ?? 1)) / speed),
    });
  }, [current?.speed, speed, send]);

  // Once a loop's pattern is established, summarise the remainder by reusing
  // the seek/jump thumbnail rather than animating every remaining iteration.
  const summariseTo = current?.summariseTo ?? null;
  useEffect(() => {
    if (summariseTo !== null) send({ type: "JUMP", stepIndex: summariseTo });
  }, [summariseTo, send]);

  const api = useMemo<PlaybackApi>(
    () => ({
      stepIndex: state.context.stepIndex,
      totalSteps: state.context.totalSteps,
      isPlaying: state.matches("playing"),
      isJumped: state.matches("jumped"),
      isFinished: state.matches("finished"),
      isSeekable: state.context.stepIndex >= 0,
      forceFullPlayback: state.context.forceFullPlayback,
      speed: state.context.speed,
      jump: state.context.jump,
      presentation: current,
      send,
    }),
    [state, current, send],
  );

  return <PlaybackContext.Provider value={api}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): PlaybackApi {
  const context = useContext(PlaybackContext);
  if (!context) throw new Error("usePlayback must be used inside PlaybackProvider");
  return context;
}

/**
 * Registers update live as the student types: when idle they show the program's
 * end state, so a plain `mov` is visible without touching the play control.
 */
export function useRegisterState(): EngineState {
  const trace = useStore((s) => s.trace);
  const { stepIndex } = usePlayback();
  return stepIndex < 0 && trace.steps.length > 0
    ? trace.steps[trace.steps.length - 1].state
    : stateAtStep(trace, stepIndex);
}

/** The stack follows playback position only — watching it change is the point of the tool. */
export function useStackState(): EngineState {
  const trace = useStore((s) => s.trace);
  const { stepIndex } = usePlayback();
  return stateAtStep(trace, stepIndex);
}

/** Source line to highlight for the current playback position, or null when idle. */
export function useActiveLine(): number | null {
  const trace = useStore((s) => s.trace);
  const instructionLines = useStore((s) => s.instructionLines);
  const { stepIndex } = usePlayback();

  if (stepIndex < 0) return null;
  const step = trace.steps[stepIndex];
  return step ? (instructionLines[step.instructionIndex] ?? null) : null;
}

/** The delta for the step currently being shown, for highlighting what changed. */
export function useCurrentDelta() {
  const trace = useStore((s) => s.trace);
  const { stepIndex } = usePlayback();
  return stepIndex >= 0 ? (trace.steps[stepIndex]?.delta ?? null) : null;
}
