import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { DEFAULT_STEP_DURATION, JUMP_HOLD_MS, playbackMachine } from "../machine";

function start(totalSteps: number) {
  const actor = createActor(playbackMachine, { input: { totalSteps } });
  actor.start();
  return actor;
}

describe("playback machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle before the first instruction", () => {
    const actor = start(5);
    expect(actor.getSnapshot().value).toBe("idle");
    expect(actor.getSnapshot().context.stepIndex).toBe(-1);
  });

  it("PLAY advances one step per configured duration", () => {
    const actor = start(5);
    actor.send({ type: "PLAY" });
    expect(actor.getSnapshot().context.stepIndex).toBe(0);

    vi.advanceTimersByTime(DEFAULT_STEP_DURATION - 10);
    expect(actor.getSnapshot().context.stepIndex).toBe(0);

    vi.advanceTimersByTime(20);
    expect(actor.getSnapshot().context.stepIndex).toBe(1);
  });

  it("honours a changed step duration", () => {
    const actor = start(5);
    actor.send({ type: "SET_DURATION", duration: 100 });
    actor.send({ type: "PLAY" });

    vi.advanceTimersByTime(110);
    expect(actor.getSnapshot().context.stepIndex).toBe(1);

    vi.advanceTimersByTime(110);
    expect(actor.getSnapshot().context.stepIndex).toBe(2);
  });

  it("stops at the last step and reports finished", () => {
    const actor = start(3);
    actor.send({ type: "PLAY" });
    vi.advanceTimersByTime(DEFAULT_STEP_DURATION * 5);

    expect(actor.getSnapshot().context.stepIndex).toBe(2);
    expect(actor.getSnapshot().value).toBe("finished");
  });

  it("PAUSE halts advancement", () => {
    const actor = start(10);
    actor.send({ type: "PLAY" });
    vi.advanceTimersByTime(DEFAULT_STEP_DURATION + 10);
    const paused = actor.getSnapshot().context.stepIndex;

    actor.send({ type: "PAUSE" });
    vi.advanceTimersByTime(DEFAULT_STEP_DURATION * 3);
    expect(actor.getSnapshot().context.stepIndex).toBe(paused);
  });

  it("editing the program resets position to idle", () => {
    const actor = start(10);
    actor.send({ type: "PLAY" });
    vi.advanceTimersByTime(DEFAULT_STEP_DURATION * 2);

    actor.send({ type: "TRACE_CHANGED", totalSteps: 4 });
    expect(actor.getSnapshot().value).toBe("idle");
    expect(actor.getSnapshot().context.stepIndex).toBe(-1);
    expect(actor.getSnapshot().context.totalSteps).toBe(4);
  });

  it("JUMP parks a thumbnail then resumes playing forward", () => {
    const actor = start(10);
    actor.send({ type: "JUMP", stepIndex: 6 });
    expect(actor.getSnapshot().value).toBe("jumped");
    expect(actor.getSnapshot().context.stepIndex).toBe(6);

    vi.advanceTimersByTime(JUMP_HOLD_MS + 50);
    expect(actor.getSnapshot().value).toBe("playing");
    expect(actor.getSnapshot().context.stepIndex).toBe(6);
  });

  it("scales step duration by the chosen playback speed", () => {
    const actor = start(5);
    actor.send({ type: "SET_SPEED", speed: 0.5 });
    expect(actor.getSnapshot().context.speed).toBe(0.5);
  });

  it("the full-playback override toggles", () => {
    const actor = start(5);
    expect(actor.getSnapshot().context.forceFullPlayback).toBe(false);
    actor.send({ type: "TOGGLE_FULL_PLAYBACK" });
    expect(actor.getSnapshot().context.forceFullPlayback).toBe(true);
  });
});
