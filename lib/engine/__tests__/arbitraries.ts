import fc from "fast-check";
import { REGISTER_NAMES, type RegisterName } from "../constants";
import type { Instruction, Operand } from "../types";

/** rsp/rbp are excluded so generated programs can't corrupt the stack pointer under us. */
export const GENERAL_REGISTERS = REGISTER_NAMES.filter(
  (name) => name !== "rsp" && name !== "rbp",
) as readonly Exclude<RegisterName, "rsp" | "rbp">[];

export const registerArb = fc.constantFrom(...GENERAL_REGISTERS);

export const immediateArb: fc.Arbitrary<Operand> = fc
  .bigInt({ min: -(2n ** 40n), max: 2n ** 40n })
  .map((value) => ({ kind: "immediate", value }) as const);

export const operandArb: fc.Arbitrary<Operand> = fc.oneof(
  registerArb.map((name) => ({ kind: "register", name }) as const),
  immediateArb,
);

/** Instructions that never touch the stack and never jump — safe to sequence arbitrarily. */
export const registerOnlyInstructionArb: fc.Arbitrary<Instruction> = fc.oneof(
  fc.record({ op: fc.constant("mov" as const), dst: registerArb, src: operandArb }),
  fc.record({ op: fc.constant("add" as const), dst: registerArb, src: operandArb }),
  fc.record({ op: fc.constant("sub" as const), dst: registerArb, src: operandArb }),
  fc.record({ op: fc.constant("inc" as const), dst: registerArb }),
  fc.record({ op: fc.constant("dec" as const), dst: registerArb }),
  fc.record({ op: fc.constant("imul" as const), dst: registerArb, src: operandArb }),
  fc.record({ op: fc.constant("neg" as const), dst: registerArb }),
  fc.record({ op: fc.constant("and" as const), dst: registerArb, src: operandArb }),
  fc.record({ op: fc.constant("or" as const), dst: registerArb, src: operandArb }),
  fc.record({ op: fc.constant("xor" as const), dst: registerArb, src: operandArb }),
  fc.record({ op: fc.constant("not" as const), dst: registerArb }),
  fc.record({
    op: fc.constant("shl" as const),
    dst: registerArb,
    count: fc.bigInt({ min: 0n, max: 63n }).map((value) => ({ kind: "immediate", value }) as const),
  }),
  fc.record({
    op: fc.constant("shr" as const),
    dst: registerArb,
    count: fc.bigInt({ min: 0n, max: 63n }).map((value) => ({ kind: "immediate", value }) as const),
  }),
  fc.record({ op: fc.constant("cmp" as const), left: registerArb, right: operandArb }),
  fc.record({ op: fc.constant("test" as const), left: registerArb, right: operandArb }),
  fc.constant({ op: "nop" as const }),
);

/** push/pop only, for stack-shape invariants. */
export const stackInstructionArb: fc.Arbitrary<Instruction> = fc.oneof(
  fc.record({ op: fc.constant("push" as const), src: operandArb }),
  fc.record({ op: fc.constant("pop" as const), dst: registerArb }),
);

export const mixedInstructionArb: fc.Arbitrary<Instruction> = fc.oneof(
  { arbitrary: registerOnlyInstructionArb, weight: 3 },
  { arbitrary: stackInstructionArb, weight: 1 },
);

/**
 * Sequences of push/pop that never underflow, by tracking depth while generating.
 * Returns the instructions plus the net stack depth they produce.
 */
export const balancedStackProgramArb = fc
  .array(fc.tuple(fc.boolean(), operandArb, registerArb), { minLength: 0, maxLength: 40 })
  .map((entries) => {
    const instructions: Instruction[] = [];
    let depth = 0;

    for (const [wantsPush, src, dst] of entries) {
      if (wantsPush || depth === 0) {
        instructions.push({ op: "push", src });
        depth++;
      } else {
        instructions.push({ op: "pop", dst });
        depth--;
      }
    }

    return { instructions, finalDepth: depth };
  });

/**
 * Register ops interleaved with depth-tracked push/pop, so traces run to
 * completion instead of aborting on an underflow. Used by invariants that
 * need long traces to be meaningful.
 */
export const safeMixedProgramArb: fc.Arbitrary<readonly Instruction[]> = fc
  .array(
    fc.oneof(
      { arbitrary: registerOnlyInstructionArb.map((i) => ({ tag: "reg" as const, i })), weight: 3 },
      {
        arbitrary: fc
          .tuple(fc.boolean(), operandArb, registerArb)
          .map(([wantsPush, src, dst]) => ({ tag: "stack" as const, wantsPush, src, dst })),
        weight: 2,
      },
    ),
    { maxLength: 60 },
  )
  .map((entries) => {
    const instructions: Instruction[] = [];
    let depth = 0;

    for (const entry of entries) {
      if (entry.tag === "reg") {
        instructions.push(entry.i);
      } else if (entry.wantsPush || depth === 0) {
        instructions.push({ op: "push", src: entry.src });
        depth++;
      } else {
        instructions.push({ op: "pop", dst: entry.dst });
        depth--;
      }
    }

    return instructions;
  });
