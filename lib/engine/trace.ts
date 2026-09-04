import { MAX_TRACE_STEPS, REGISTER_NAMES, type RegisterName } from "./constants";
import type { Program } from "./program";
import { createInitialState } from "./state";
import { step } from "./transitions";
import {
  EngineFaultError,
  type EngineFault,
  type EngineState,
  type Flags,
  type Instruction,
} from "./types";

export type StackChangeKind = "none" | "push" | "pop";

/** What changed between the previous snapshot and this one — so the UI never has to diff state itself. */
export interface StepDelta {
  readonly changedRegisters: readonly RegisterName[];
  readonly changedFlags: readonly (keyof Flags)[];
  readonly stackChange: StackChangeKind;
  /** Index into `state.stack` of the slot pushed, or of the slot that was popped (its pre-pop index). */
  readonly stackSlotIndex: number | null;
  readonly frameOpened: number | null;
  readonly frameClosed: number | null;
}

export interface TraceStep {
  /** Position in the trace; also the index used by the seek/jump mechanic. */
  readonly index: number;
  /** Index into `program.instructions` of the instruction that produced this step. */
  readonly instructionIndex: number;
  readonly instruction: Instruction;
  /** State *after* this instruction executed. */
  readonly state: EngineState;
  readonly delta: StepDelta;
}

export interface Trace {
  readonly initialState: EngineState;
  readonly steps: readonly TraceStep[];
  /** Set when execution stopped early; the trace still contains every step completed before the fault. */
  readonly fault: EngineFault | null;
}

function diffRegisters(before: EngineState, after: EngineState): RegisterName[] {
  return REGISTER_NAMES.filter((name) => before.registers[name] !== after.registers[name]);
}

function diffFlags(before: Flags, after: Flags): (keyof Flags)[] {
  return (["zf", "sf", "cf", "of"] as const).filter((flag) => before[flag] !== after[flag]);
}

function computeDelta(before: EngineState, after: EngineState): StepDelta {
  const stackGrew = after.stack.length > before.stack.length;
  const stackShrank = after.stack.length < before.stack.length;

  return {
    changedRegisters: diffRegisters(before, after),
    changedFlags: diffFlags(before.flags, after.flags),
    stackChange: stackGrew ? "push" : stackShrank ? "pop" : "none",
    stackSlotIndex: stackGrew
      ? after.stack.length - 1
      : stackShrank
        ? before.stack.length - 1
        : null,
    frameOpened:
      after.frames.length > before.frames.length
        ? after.frames[after.frames.length - 1].id
        : null,
    frameClosed:
      after.frames.length < before.frames.length
        ? before.frames[before.frames.length - 1].id
        : null,
  };
}

/**
 * Runs the program to completion, producing one snapshot per executed instruction.
 * Execution ends when the instruction pointer runs past the end of the program,
 * or when a fault occurs (the fault is reported, not thrown).
 */
export function generateTrace(program: Program): Trace {
  const initialState = createInitialState();
  const steps: TraceStep[] = [];

  let state = initialState;
  let fault: EngineFault | null = null;

  while (state.ip >= 0 && state.ip < program.instructions.length) {
    if (steps.length >= MAX_TRACE_STEPS) {
      fault = {
        kind: "step-limit-exceeded",
        atIp: state.ip,
        message: `Execution exceeded ${MAX_TRACE_STEPS} steps — the program probably loops forever`,
      };
      break;
    }

    const instructionIndex = state.ip;
    const instruction = program.instructions[instructionIndex];

    let nextState: EngineState;
    try {
      nextState = step(state, instruction, program);
    } catch (error) {
      if (error instanceof EngineFaultError) {
        fault = { kind: error.kind, atIp: instructionIndex, message: error.message };
        break;
      }
      throw error;
    }

    steps.push({
      index: steps.length,
      instructionIndex,
      instruction,
      state: nextState,
      delta: computeDelta(state, nextState),
    });

    state = nextState;
  }

  return { initialState, steps, fault };
}

/** State after `stepIndex` steps. -1 (or any negative index) yields the initial state. */
export function stateAtStep(trace: Trace, stepIndex: number): EngineState {
  if (stepIndex < 0) return trace.initialState;
  const step = trace.steps[Math.min(stepIndex, trace.steps.length - 1)];
  return step ? step.state : trace.initialState;
}

/** First trace step produced by the given source instruction, or null if it never executed. */
export function firstStepForInstruction(trace: Trace, instructionIndex: number): TraceStep | null {
  return trace.steps.find((s) => s.instructionIndex === instructionIndex) ?? null;
}

/** Last trace step at or before `fromStep` produced by the given instruction — used by backward seeks. */
export function lastStepForInstruction(
  trace: Trace,
  instructionIndex: number,
): TraceStep | null {
  for (let i = trace.steps.length - 1; i >= 0; i--) {
    if (trace.steps[i].instructionIndex === instructionIndex) return trace.steps[i];
  }
  return null;
}
