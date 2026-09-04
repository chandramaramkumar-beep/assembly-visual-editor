import type { Trace } from "@/lib/engine";

export type LoopKind = "same-shape" | "shape-changing";

export interface LoopIteration {
  /** First trace step of this iteration (inclusive). */
  readonly startStep: number;
  /** The back-edge step that closed this iteration (inclusive). */
  readonly endStep: number;
}

export interface LoopRegion {
  /** Instruction index the back-edge jumps back to — the top of the loop body. */
  readonly bodyStart: number;
  /** Instruction index of the backward branch that closes the loop. */
  readonly backEdge: number;
  readonly iterations: readonly LoopIteration[];
  readonly kind: LoopKind;
}

/** After this many iterations the pattern is established, so the rest is summarised. */
export const ITERATIONS_BEFORE_SUMMARY = 4;

/**
 * Finds loops by locating taken backward branches in the trace. A loop is
 * classified shape-changing if any of its iterations moves the stack — those
 * are never compressed, because seeing that movement is the point of the tool.
 */
export function findLoops(trace: Trace): LoopRegion[] {
  const branches = new Map<number, { bodyStart: number; taken: number[] }>();

  trace.steps.forEach((step, index) => {
    const next = trace.steps[index + 1];
    if (!next || next.instructionIndex >= step.instructionIndex) return;

    const existing = branches.get(step.instructionIndex);
    if (existing) {
      existing.taken.push(index);
      existing.bodyStart = Math.min(existing.bodyStart, next.instructionIndex);
    } else {
      branches.set(step.instructionIndex, { bodyStart: next.instructionIndex, taken: [index] });
    }
  });

  const loops: LoopRegion[] = [];

  for (const [backEdge, { bodyStart, taken }] of branches) {
    if (taken.length === 0) continue;

    // Every execution of the branch closes an iteration — including the final
    // pass, where the branch is evaluated but falls through instead of jumping.
    const ends = trace.steps
      .filter((step) => step.instructionIndex === backEdge && step.index >= taken[0])
      .map((step) => step.index);
    if (ends.length < 2) continue;

    const iterations: LoopIteration[] = [];
    let start = findIterationStart(trace, ends[0], bodyStart);

    for (const end of ends) {
      iterations.push({ startStep: start, endStep: end });
      start = end + 1;
    }

    loops.push({
      bodyStart,
      backEdge,
      iterations,
      kind: classify(trace, iterations),
    });
  }

  return loops.sort((a, b) => a.iterations[0].startStep - b.iterations[0].startStep);
}

/** Walks back from the first back-edge to the first step of the body. */
function findIterationStart(trace: Trace, firstEnd: number, bodyStart: number): number {
  for (let i = firstEnd; i >= 0; i--) {
    if (trace.steps[i].instructionIndex === bodyStart) return i;
  }
  return 0;
}

function classify(trace: Trace, iterations: readonly LoopIteration[]): LoopKind {
  for (const iteration of iterations) {
    for (let i = iteration.startStep; i <= iteration.endStep; i++) {
      if (trace.steps[i]?.delta.stackChange !== "none") return "shape-changing";
    }
  }
  return "same-shape";
}

export interface StepPresentation {
  /** Multiplier on the base step duration; < 1 plays faster. */
  readonly speed: number;
  /** Flash the changed cell/register instead of animating the whole step. */
  readonly pulse: boolean;
  /** Shown as "iteration X of Y" while a loop is compressed. */
  readonly iteration: { readonly current: number; readonly total: number } | null;
  /**
   * Set once a loop has run long enough that the remainder should be summarised
   * via the seek/jump thumbnail rather than animated.
   */
  readonly summariseTo: number | null;
}

const NORMAL: StepPresentation = { speed: 1, pulse: false, iteration: null, summariseTo: null };

/**
 * How each trace step should be presented. Shape-changing loops always play in
 * full; same-shape loops play their first iteration normally and then pulse.
 * The student override forces everything back to full playback.
 */
export function planPresentation(
  trace: Trace,
  loops: readonly LoopRegion[],
  forceFullPlayback: boolean,
): StepPresentation[] {
  const plan: StepPresentation[] = trace.steps.map(() => NORMAL);
  if (forceFullPlayback) return plan;

  for (const loop of loops) {
    const total = loop.iterations.length;
    const lastStep = loop.iterations[total - 1].endStep;

    loop.iterations.forEach((iteration, i) => {
      const iterationNumber = i + 1;
      const compress = loop.kind === "same-shape" && iterationNumber > 1;
      const summarise = iterationNumber === ITERATIONS_BEFORE_SUMMARY && total > ITERATIONS_BEFORE_SUMMARY;

      for (let step = iteration.startStep; step <= iteration.endStep; step++) {
        if (step < 0 || step >= plan.length) continue;
        plan[step] = {
          speed: compress ? 0.35 : 1,
          pulse: compress,
          iteration: { current: iterationNumber, total },
          summariseTo: summarise && step === iteration.endStep ? lastStep : null,
        };
      }
    });
  }

  return plan;
}
