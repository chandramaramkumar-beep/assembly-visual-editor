"use client";

import { create } from "zustand";
import {
  generateTrace,
  parseProgram,
  stateAtStep,
  type EngineState,
  type ParseError,
  type Trace,
} from "./engine";

export const DEFAULT_SOURCE = [
  "; Try editing — registers update as you type.",
  "  mov rax, 5",
  "  mov rbx, 3",
  "  add rax, rbx",
  "",
  "  push rax",
  "  call double",
  "  jmp done",
  "",
  "double:",
  "  push rbx",
  "  imul rax, 2",
  "  pop rbx",
  "  ret",
  "",
  "done:",
  "  pop rcx",
].join("\n");

/** True when the program contains at least one instruction that moves the stack pointer. */
function hasStackActivity(trace: Trace): boolean {
  return trace.steps.some((step) => step.delta.stackChange !== "none");
}

interface EditorSlice {
  source: string;
  setSource: (source: string) => void;
}

interface DerivedSlice {
  trace: Trace;
  parseErrors: readonly ParseError[];
  /** Source line number for each instruction index, for highlighting the active line. */
  instructionLines: readonly number[];
  canPlay: boolean;
}

interface PlaybackSlice {
  /** -1 means "before the first instruction". */
  stepIndex: number;
  setStepIndex: (index: number) => void;
}

interface UiSlice {
  expandedSlots: ReadonlySet<number>;
  toggleSlot: (index: number) => void;
  expandedFrames: ReadonlySet<number>;
  toggleFrame: (id: number) => void;
}

type Store = EditorSlice & DerivedSlice & PlaybackSlice & UiSlice;

function derive(source: string): DerivedSlice {
  const { program, errors, instructionLines } = parseProgram(source);
  const trace = generateTrace(program);
  return {
    trace,
    parseErrors: errors,
    instructionLines,
    canPlay: hasStackActivity(trace),
  };
}

export const useStore = create<Store>((set) => ({
  source: DEFAULT_SOURCE,
  ...derive(DEFAULT_SOURCE),
  stepIndex: -1,
  expandedSlots: new Set<number>(),
  expandedFrames: new Set<number>(),

  setSource: (source) =>
    set(() => ({
      source,
      ...derive(source),
      // Editing invalidates the old trace position — start over rather than
      // pointing at a step that no longer exists.
      stepIndex: -1,
    })),

  setStepIndex: (index) => set(() => ({ stepIndex: index })),

  toggleSlot: (index) =>
    set((state) => {
      const next = new Set(state.expandedSlots);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { expandedSlots: next };
    }),

  toggleFrame: (id) =>
    set((state) => {
      const next = new Set(state.expandedFrames);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedFrames: next };
    }),
}));

/**
 * Registers update live as the student types: when idle they show the program's
 * end state, so a plain `mov` is visible without touching the play control.
 */
export function useRegisterState(): EngineState {
  return useStore((s) =>
    s.stepIndex < 0 && s.trace.steps.length > 0
      ? s.trace.steps[s.trace.steps.length - 1].state
      : stateAtStep(s.trace, s.stepIndex),
  );
}

/**
 * The stack follows playback position only — it is empty until the student
 * presses play, because watching it change is the point of the tool.
 */
export function useStackState(): EngineState {
  return useStore((s) => stateAtStep(s.trace, s.stepIndex));
}

/** Source line to highlight for the current playback position, or null when idle. */
export function useActiveLine(): number | null {
  return useStore((s) => {
    if (s.stepIndex < 0) return null;
    const step = s.trace.steps[s.stepIndex];
    return step ? (s.instructionLines[step.instructionIndex] ?? null) : null;
  });
}
