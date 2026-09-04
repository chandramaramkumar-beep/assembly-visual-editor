import { describe, expect, it } from "vitest";
import { generateTrace, parseProgram, type Trace } from "@/lib/engine";
import { findLoops, planPresentation, ITERATIONS_BEFORE_SUMMARY } from "../loops";

function run(source: string): Trace {
  const { program, errors } = parseProgram(source);
  expect(errors).toEqual([]);
  const trace = generateTrace(program);
  expect(trace.fault).toBeNull();
  return trace;
}

const SAME_SHAPE = `
  mov rcx, 5
  mov rax, 0
body:
  inc rax
  loop body
`;

const SHAPE_CHANGING = `
  mov rcx, 4
body:
  push rcx
  loop body
`;

describe("loop detection", () => {
  it("classifies a register-only loop as same-shape", () => {
    const loops = findLoops(run(SAME_SHAPE));
    expect(loops).toHaveLength(1);
    expect(loops[0].kind).toBe("same-shape");
    expect(loops[0].iterations).toHaveLength(5);
  });

  it("classifies a loop that pushes as shape-changing", () => {
    const loops = findLoops(run(SHAPE_CHANGING));
    expect(loops).toHaveLength(1);
    expect(loops[0].kind).toBe("shape-changing");
    expect(loops[0].iterations).toHaveLength(4);
  });

  it("iterations are contiguous and ordered", () => {
    const loops = findLoops(run(SAME_SHAPE));
    const iterations = loops[0].iterations;
    iterations.forEach((iteration, i) => {
      expect(iteration.endStep).toBeGreaterThanOrEqual(iteration.startStep);
      if (i > 0) expect(iteration.startStep).toBe(iterations[i - 1].endStep + 1);
    });
  });

  it("finds no loop in straight-line code", () => {
    expect(findLoops(run("mov rax, 1\nmov rbx, 2\npush rax"))).toHaveLength(0);
  });

  it("does not treat a single backward jump as a loop", () => {
    const trace = run(`
      mov rax, 1
      jmp forward
back:
      mov rbx, 2
      jmp done
forward:
      jmp back
done:
      nop
    `);
    expect(findLoops(trace)).toHaveLength(0);
  });
});

describe("presentation plan", () => {
  it("plays the first iteration of a same-shape loop normally, then pulses", () => {
    const trace = run(SAME_SHAPE);
    const loops = findLoops(trace);
    const plan = planPresentation(trace, loops, false);

    const [first, second] = loops[0].iterations;
    expect(plan[first.startStep].pulse).toBe(false);
    expect(plan[first.startStep].speed).toBe(1);
    expect(plan[second.startStep].pulse).toBe(true);
    expect(plan[second.startStep].speed).toBeLessThan(1);
  });

  it("never compresses a shape-changing loop", () => {
    const trace = run(SHAPE_CHANGING);
    const loops = findLoops(trace);
    const plan = planPresentation(trace, loops, false);

    for (const iteration of loops[0].iterations) {
      for (let s = iteration.startStep; s <= iteration.endStep; s++) {
        expect(plan[s].pulse).toBe(false);
        expect(plan[s].speed).toBe(1);
      }
    }
  });

  it("labels compressed steps with iteration X of Y", () => {
    const trace = run(SAME_SHAPE);
    const plan = planPresentation(trace, findLoops(trace), false);
    const labelled = plan.filter((p) => p.iteration !== null);
    expect(labelled.length).toBeGreaterThan(0);
    expect(labelled[0].iteration).toEqual({ current: 1, total: 5 });
    expect(labelled[labelled.length - 1].iteration).toEqual({ current: 5, total: 5 });
  });

  it("summarises the remainder of a long loop to its final step", () => {
    const trace = run(SAME_SHAPE);
    const loops = findLoops(trace);
    const plan = planPresentation(trace, loops, false);

    expect(loops[0].iterations.length).toBeGreaterThan(ITERATIONS_BEFORE_SUMMARY);
    const summarising = plan.filter((p) => p.summariseTo !== null);
    expect(summarising).toHaveLength(1);
    expect(summarising[0].summariseTo).toBe(
      loops[0].iterations[loops[0].iterations.length - 1].endStep,
    );
  });

  it("does not summarise a loop shorter than the threshold", () => {
    const trace = run(`
      mov rcx, 2
      mov rax, 0
body:
      inc rax
      loop body
    `);
    const plan = planPresentation(trace, findLoops(trace), false);
    expect(plan.every((p) => p.summariseTo === null)).toBe(true);
  });

  it("the student override restores full playback everywhere", () => {
    const trace = run(SAME_SHAPE);
    const plan = planPresentation(trace, findLoops(trace), true);
    expect(plan.every((p) => p.speed === 1 && !p.pulse && p.summariseTo === null)).toBe(true);
  });
});
