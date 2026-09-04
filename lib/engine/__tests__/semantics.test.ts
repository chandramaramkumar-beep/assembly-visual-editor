import { describe, expect, it } from "vitest";
import { INITIAL_RSP } from "../constants";
import { parseProgram } from "../parser";
import { generateTrace } from "../trace";
import { toSigned64 } from "../bigint-utils";
import type { Trace } from "../trace";

function run(source: string): Trace {
  const { program, errors } = parseProgram(source);
  expect(errors).toEqual([]);
  return generateTrace(program);
}

function finalState(source: string) {
  const trace = run(source);
  expect(trace.fault).toBeNull();
  return trace.steps[trace.steps.length - 1].state;
}

describe("arithmetic and flags", () => {
  it("mov and add produce the expected value", () => {
    const state = finalState(`
      mov rax, 10
      add rax, 32
    `);
    expect(state.registers.rax).toBe(42n);
  });

  it("sub to zero sets ZF", () => {
    const state = finalState(`
      mov rax, 7
      sub rax, 7
    `);
    expect(state.registers.rax).toBe(0n);
    expect(state.flags.zf).toBe(true);
  });

  it("negative results wrap to two's complement and set SF", () => {
    const state = finalState(`
      mov rax, 5
      sub rax, 8
    `);
    expect(toSigned64(state.registers.rax)).toBe(-3n);
    expect(state.flags.sf).toBe(true);
  });

  it("unsigned wraparound sets CF on borrow", () => {
    const state = finalState(`
      mov rax, 0
      sub rax, 1
    `);
    expect(state.registers.rax).toBe((1n << 64n) - 1n);
    expect(state.flags.cf).toBe(true);
  });

  it("imul multiplies signed values", () => {
    const state = finalState(`
      mov rax, -6
      mov rbx, 7
      imul rax, rbx
    `);
    expect(toSigned64(state.registers.rax)).toBe(-42n);
  });

  it("idiv writes quotient to rax and remainder to rdx", () => {
    const state = finalState(`
      mov rdx, 0
      mov rax, 17
      mov rbx, 5
      idiv rbx
    `);
    expect(state.registers.rax).toBe(3n);
    expect(state.registers.rdx).toBe(2n);
  });

  it("idiv by zero faults instead of producing state", () => {
    const trace = run(`
      mov rax, 1
      mov rbx, 0
      idiv rbx
    `);
    expect(trace.fault?.kind).toBe("divide-by-zero");
  });

  it("xor of a register with itself zeroes it and sets ZF", () => {
    const state = finalState(`
      mov rax, 1234
      xor rax, rax
    `);
    expect(state.registers.rax).toBe(0n);
    expect(state.flags.zf).toBe(true);
  });

  it("shl and shr shift as expected", () => {
    const state = finalState(`
      mov rax, 1
      shl rax, 4
      mov rbx, 256
      shr rbx, 4
    `);
    expect(state.registers.rax).toBe(16n);
    expect(state.registers.rbx).toBe(16n);
  });

  it("cmp sets flags without modifying the register", () => {
    const state = finalState(`
      mov rax, 5
      cmp rax, 9
    `);
    expect(state.registers.rax).toBe(5n);
    expect(state.flags.zf).toBe(false);
    expect(state.flags.sf).toBe(true);
  });

  it("lea computes an address without touching the stack", () => {
    const state = finalState(`
      mov rbp, 1000
      lea rax, [rbp-8]
    `);
    expect(state.registers.rax).toBe(992n);
    expect(state.stack).toHaveLength(0);
  });
});

describe("stack", () => {
  it("push then pop restores the value and the depth", () => {
    const trace = run(`
      mov rax, 99
      push rax
      pop rbx
    `);
    expect(trace.fault).toBeNull();
    const [, afterPush, afterPop] = trace.steps;
    expect(afterPush.state.stack).toHaveLength(1);
    expect(afterPush.state.registers.rsp).toBe(INITIAL_RSP - 8n);
    expect(afterPop.state.stack).toHaveLength(0);
    expect(afterPop.state.registers.rbx).toBe(99n);
    expect(afterPop.state.registers.rsp).toBe(INITIAL_RSP);
  });

  it("popping an empty stack faults", () => {
    const trace = run("pop rax");
    expect(trace.fault?.kind).toBe("stack-underflow");
  });

  it("push records a delta the UI can use to highlight the new slot", () => {
    const trace = run("push 5");
    expect(trace.steps[0].delta.stackChange).toBe("push");
    expect(trace.steps[0].delta.stackSlotIndex).toBe(0);
  });
});

describe("control flow", () => {
  it("jmp skips over instructions", () => {
    const state = finalState(`
      mov rax, 1
      jmp done
      mov rax, 999
      done:
      inc rax
    `);
    expect(state.registers.rax).toBe(2n);
  });

  it("je is taken only when ZF is set", () => {
    const taken = finalState(`
      mov rax, 5
      cmp rax, 5
      je equal
      mov rbx, 111
      equal:
      mov rcx, 222
    `);
    expect(taken.registers.rbx).toBe(0n);
    expect(taken.registers.rcx).toBe(222n);

    const notTaken = finalState(`
      mov rax, 5
      cmp rax, 6
      je equal
      mov rbx, 111
      equal:
      mov rcx, 222
    `);
    expect(notTaken.registers.rbx).toBe(111n);
  });

  it("jg uses signed comparison", () => {
    const state = finalState(`
      mov rax, -1
      cmp rax, 1
      jg greater
      mov rbx, 1
      jmp done
      greater:
      mov rbx, 2
      done:
      nop
    `);
    expect(state.registers.rbx).toBe(1n);
  });

  it("loop decrements rcx and repeats until it hits zero", () => {
    const trace = run(`
      mov rcx, 3
      mov rax, 0
      body:
      inc rax
      loop body
    `);
    expect(trace.fault).toBeNull();
    const state = trace.steps[trace.steps.length - 1].state;
    expect(state.registers.rax).toBe(3n);
    expect(state.registers.rcx).toBe(0n);
  });
});

describe("calls and frames", () => {
  it("call opens a frame and pushes a return address; ret closes it", () => {
    const trace = run(`
      call helper
      jmp end
      helper:
      mov rax, 7
      ret
      end:
      nop
    `);
    expect(trace.fault).toBeNull();

    const afterCall = trace.steps[0];
    expect(afterCall.state.frames).toHaveLength(1);
    expect(afterCall.state.frames[0].functionLabel).toBe("helper");
    expect(afterCall.state.stack[0].kind).toBe("return-address");
    expect(afterCall.delta.frameOpened).toBe(0);

    const retStep = trace.steps.find((s) => s.instruction.op === "ret");
    expect(retStep?.state.frames).toHaveLength(0);
    expect(retStep?.state.stack).toHaveLength(0);
    expect(retStep?.delta.frameClosed).toBe(0);

    const final = trace.steps[trace.steps.length - 1].state;
    expect(final.registers.rax).toBe(7n);
  });

  it("nested calls produce nested frames with distinct ids", () => {
    const trace = run(`
      call outer
      jmp end
      outer:
      call inner
      ret
      inner:
      mov rax, 1
      ret
      end:
      nop
    `);
    expect(trace.fault).toBeNull();

    const deepest = trace.steps.reduce(
      (max, s) => Math.max(max, s.state.frames.length),
      0,
    );
    expect(deepest).toBe(2);

    const twoDeep = trace.steps.find((s) => s.state.frames.length === 2);
    expect(twoDeep?.state.frames.map((f) => f.id)).toEqual([0, 1]);
    expect(twoDeep?.state.frames.map((f) => f.functionLabel)).toEqual(["outer", "inner"]);
  });

  it("values pushed inside a frame are tagged with that frame id", () => {
    const trace = run(`
      call helper
      jmp end
      helper:
      push 42
      pop rax
      ret
      end:
      nop
    `);
    const pushStep = trace.steps.find((s) => s.instruction.op === "push");
    const pushed = pushStep?.state.stack[pushStep.state.stack.length - 1];
    expect(pushed?.value).toBe(42n);
    expect(pushed?.frameId).toBe(0);
  });

  it("ret without a matching call faults", () => {
    const trace = run("ret");
    expect(trace.fault?.kind).toBe("ret-without-call");
  });

  it("ret over an unbalanced stack faults instead of silently jumping to garbage", () => {
    const trace = run(`
      call helper
      jmp end
      helper:
      push 5
      ret
      end:
      nop
    `);
    expect(trace.fault?.kind).toBe("ret-corrupted-stack");
  });
});

describe("faults", () => {
  it("an infinite loop stops at the step limit rather than hanging", () => {
    const trace = run(`
      spin:
      jmp spin
    `);
    expect(trace.fault?.kind).toBe("step-limit-exceeded");
  });

  it("a trace with a fault still contains every step completed before it", () => {
    const trace = run(`
      mov rax, 1
      mov rbx, 2
      pop rcx
    `);
    expect(trace.fault?.kind).toBe("stack-underflow");
    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[1].state.registers.rbx).toBe(2n);
  });
});
