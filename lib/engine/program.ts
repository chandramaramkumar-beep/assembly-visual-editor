import type { Instruction } from "./types";

export interface Program {
  readonly instructions: readonly Instruction[];
  readonly labels: ReadonlyMap<string, number>;
}

/**
 * Builds a Program from a flat instruction list plus a label table (index
 * into `instructions` that each label name points at). Used directly by
 * tests that want to construct a program without going through the text
 * parser, and by the parser itself.
 */
export function buildProgram(
  instructions: readonly Instruction[],
  labels: ReadonlyMap<string, number> = new Map(),
): Program {
  return { instructions, labels };
}

export function resolveLabel(program: Program, target: string): number | undefined {
  return program.labels.get(target);
}
