import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { INITIAL_RSP, MASK64, REGISTER_NAMES } from "../constants";
import { buildProgram } from "../program";
import { generateTrace, stateAtStep } from "../trace";
import { createInitialState } from "../state";
import { step } from "../transitions";
import {
  balancedStackProgramArb,
  mixedInstructionArb,
  registerOnlyInstructionArb,
  safeMixedProgramArb,
} from "./arbitraries";

describe("engine invariants", () => {
  it("every register always holds a value in the unsigned 64-bit range", () => {
    fc.assert(
      fc.property(fc.array(mixedInstructionArb, { maxLength: 60 }), (instructions) => {
        const trace = generateTrace(buildProgram(instructions));
        for (const traceStep of trace.steps) {
          for (const name of REGISTER_NAMES) {
            const value = traceStep.state.registers[name];
            expect(value >= 0n && value <= MASK64).toBe(true);
          }
        }
      }),
    );
  });

  it("stack depth always equals pushes minus pops so far", () => {
    fc.assert(
      fc.property(balancedStackProgramArb, ({ instructions }) => {
        const trace = generateTrace(buildProgram(instructions));
        expect(trace.fault).toBeNull();

        let expectedDepth = 0;
        for (const traceStep of trace.steps) {
          if (traceStep.instruction.op === "push") expectedDepth++;
          if (traceStep.instruction.op === "pop") expectedDepth--;
          expect(traceStep.state.stack.length).toBe(expectedDepth);
        }
      }),
    );
  });

  it("rsp always tracks stack depth exactly: rsp === INITIAL_RSP - 8 * depth", () => {
    fc.assert(
      fc.property(balancedStackProgramArb, ({ instructions }) => {
        const trace = generateTrace(buildProgram(instructions));
        for (const traceStep of trace.steps) {
          const expected = INITIAL_RSP - 8n * BigInt(traceStep.state.stack.length);
          expect(traceStep.state.registers.rsp).toBe(expected);
        }
      }),
    );
  });

  it("register-only instructions never change the stack", () => {
    fc.assert(
      fc.property(fc.array(registerOnlyInstructionArb, { maxLength: 60 }), (instructions) => {
        const trace = generateTrace(buildProgram(instructions));
        for (const traceStep of trace.steps) {
          expect(traceStep.state.stack).toHaveLength(0);
          expect(traceStep.state.registers.rsp).toBe(INITIAL_RSP);
          expect(traceStep.delta.stackChange).toBe("none");
        }
      }),
    );
  });

  it("snapshots are immutable: re-running a step never mutates the prior state", () => {
    fc.assert(
      fc.property(safeMixedProgramArb, (instructions) => {
        const program = buildProgram(instructions);
        let state = createInitialState();

        for (const instruction of instructions) {
          const before = structuredClone({
            registers: state.registers,
            stack: state.stack,
            flags: state.flags,
            frames: state.frames,
            ip: state.ip,
          });

          let nextState;
          try {
            nextState = step(state, instruction, program);
          } catch {
            break;
          }

          expect(state.registers).toEqual(before.registers);
          expect(state.stack).toEqual(before.stack);
          expect(state.flags).toEqual(before.flags);
          expect(state.frames).toEqual(before.frames);
          expect(state.ip).toBe(before.ip);

          state = nextState;
        }
      }),
    );
  });

  it("the engine is deterministic: the same program always produces an identical trace", () => {
    fc.assert(
      fc.property(safeMixedProgramArb, (instructions) => {
        const program = buildProgram(instructions);
        const first = generateTrace(program);
        const second = generateTrace(program);
        expect(second.steps).toEqual(first.steps);
        expect(second.fault).toEqual(first.fault);
      }),
    );
  });

  it("stateAtStep matches replaying the trace step by step", () => {
    fc.assert(
      fc.property(safeMixedProgramArb, (instructions) => {
        const trace = generateTrace(buildProgram(instructions));
        expect(stateAtStep(trace, -1)).toEqual(trace.initialState);
        trace.steps.forEach((traceStep, index) => {
          expect(stateAtStep(trace, index)).toEqual(traceStep.state);
        });
      }),
    );
  });

  it("the reported delta always matches an actual diff of consecutive snapshots", () => {
    fc.assert(
      fc.property(safeMixedProgramArb, (instructions) => {
        const trace = generateTrace(buildProgram(instructions));

        trace.steps.forEach((traceStep, index) => {
          const before = index === 0 ? trace.initialState : trace.steps[index - 1].state;
          const after = traceStep.state;

          const actuallyChanged = REGISTER_NAMES.filter(
            (name) => before.registers[name] !== after.registers[name],
          );
          expect([...traceStep.delta.changedRegisters].sort()).toEqual([...actuallyChanged].sort());

          const depthDiff = after.stack.length - before.stack.length;
          const expectedChange = depthDiff > 0 ? "push" : depthDiff < 0 ? "pop" : "none";
          expect(traceStep.delta.stackChange).toBe(expectedChange);
        });
      }),
    );
  });

  it("pop always yields the most recently pushed value (LIFO)", () => {
    fc.assert(
      fc.property(balancedStackProgramArb, ({ instructions }) => {
        const trace = generateTrace(buildProgram(instructions));
        const shadow: bigint[] = [];

        trace.steps.forEach((traceStep, index) => {
          const before = index === 0 ? trace.initialState : trace.steps[index - 1].state;
          const instruction = traceStep.instruction;

          if (instruction.op === "push") {
            shadow.push(traceStep.state.stack[traceStep.state.stack.length - 1].value);
          } else if (instruction.op === "pop") {
            const expected = shadow.pop();
            expect(traceStep.state.registers[instruction.dst]).toBe(expected);
            expect(before.stack[before.stack.length - 1].value).toBe(expected);
          }
        });
      }),
    );
  });
});
