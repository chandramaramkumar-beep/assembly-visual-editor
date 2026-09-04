"use client";

import { toSigned64, type EngineState, type StackSlot } from "@/lib/engine";
import { useStackState, useStore } from "@/lib/store";
import styles from "./StackView.module.css";

interface FrameGroup {
  readonly frameId: number | null;
  readonly label: string;
  readonly slots: readonly { slot: StackSlot; index: number }[];
}

/**
 * Groups stack slots into contiguous runs by frame, so each function call
 * renders as its own labeled block. Slots are rendered top-of-stack first.
 */
function groupByFrame(state: EngineState): FrameGroup[] {
  const groups: FrameGroup[] = [];

  state.stack.forEach((slot, index) => {
    const last = groups[groups.length - 1];
    if (last && last.frameId === slot.frameId) {
      (last.slots as { slot: StackSlot; index: number }[]).push({ slot, index });
      return;
    }
    const frame = state.frames.find((f) => f.id === slot.frameId);
    groups.push({
      frameId: slot.frameId,
      label: frame ? frame.functionLabel : "main",
      slots: [{ slot, index }],
    });
  });

  return groups.reverse();
}

export function StackView() {
  const state = useStackState();
  const canPlay = useStore((s) => s.canPlay);
  const idle = useStore((s) => s.stepIndex < 0);
  const expandedSlots = useStore((s) => s.expandedSlots);
  const toggleSlot = useStore((s) => s.toggleSlot);
  const highlightedIndex = useStore((s) => {
    const step = s.stepIndex >= 0 ? s.trace.steps[s.stepIndex] : null;
    return step && step.delta.stackChange === "push" ? step.delta.stackSlotIndex : null;
  });

  const groups = groupByFrame(state);

  return (
    <section className={styles.panel} aria-label="Stack">
      <div className={styles.header}>
        <h2 className={styles.heading}>Stack</h2>
        <span className={styles.depth}>
          {state.stack.length} {state.stack.length === 1 ? "slot" : "slots"}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className={styles.empty}>
          {canPlay && idle
            ? "Press Play to watch the stack change, step by step."
            : "The stack is empty. Add a push or call to see it grow."}
        </p>
      ) : (
        <div className={styles.frames}>
          {groups.map((group) => (
            <div
              key={`${group.frameId ?? "main"}-${group.slots[0].index}`}
              className={styles.frame}
              data-testid={`frame-${group.label}`}
            >
              <div className={styles.frameLabel}>{group.label}</div>
              <ul className={styles.slots}>
                {[...group.slots].reverse().map(({ slot, index }) => {
                  const expanded = expandedSlots.has(index);
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        className={`${styles.slot} ${
                          highlightedIndex === index ? styles.slotHighlighted : ""
                        } ${slot.kind === "return-address" ? styles.slotReturn : ""}`}
                        onClick={() => toggleSlot(index)}
                        aria-expanded={expanded}
                        data-testid={`slot-${index}`}
                      >
                        <span className={styles.slotValue}>
                          {slot.kind === "return-address"
                            ? "return address"
                            : toSigned64(slot.value).toString()}
                        </span>
                        {index === state.stack.length - 1 && (
                          <span className={styles.rsp}>&larr; rsp</span>
                        )}
                      </button>
                      {expanded && (
                        <dl className={styles.detail}>
                          <dt>slot</dt>
                          <dd>#{index}</dd>
                          <dt>kind</dt>
                          <dd>{slot.kind === "return-address" ? "return address" : "pushed value"}</dd>
                          <dt>raw</dt>
                          <dd>0x{slot.value.toString(16)}</dd>
                          {slot.returnIp !== undefined && (
                            <>
                              <dt>resumes at</dt>
                              <dd>instruction #{slot.returnIp}</dd>
                            </>
                          )}
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
