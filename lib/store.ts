"use client";

import { create } from "zustand";
import { generateTrace, parseProgram, type ParseError, type Trace } from "./engine";

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

interface DerivedSlice {
  trace: Trace;
  parseErrors: readonly ParseError[];
  /** Source line number for each instruction index, for highlighting the active line. */
  instructionLines: readonly number[];
  canPlay: boolean;
}

/**
 * Editor content and general UI state. Playback position lives in the XState
 * machine (lib/playback), not here — one owner per concern.
 */
interface Store extends DerivedSlice {
  source: string;
  setSource: (source: string) => void;
  expandedSlots: ReadonlySet<number>;
  toggleSlot: (index: number) => void;
}

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
  expandedSlots: new Set<number>(),

  setSource: (source) => set(() => ({ source, ...derive(source) })),

  toggleSlot: (index) =>
    set((state) => {
      const next = new Set(state.expandedSlots);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { expandedSlots: next };
    }),
}));
