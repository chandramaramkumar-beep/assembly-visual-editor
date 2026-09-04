"use client";

import { AnimatePresence, motion } from "motion/react";
import { toSigned64, type EngineState, type StackSlot } from "@/lib/engine";
import { useCurrentDelta, usePlayback, useStackState } from "@/lib/playback/PlaybackProvider";
import { useStore } from "@/lib/store";
import styles from "./StackView.module.css";

interface FrameGroup {
  readonly frameId: number | null;
  readonly label: string;
  readonly slots: readonly { slot: StackSlot; index: number }[];
}

/**
 * Groups stack slots into contiguous runs by frame, so each function call
 * renders as its own labeled block, newest frame first.
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
  const delta = useCurrentDelta();
  const { stepIndex } = usePlayback();
  const canPlay = useStore((s) => s.canPlay);
  const expandedSlots = useStore((s) => s.expandedSlots);
  const toggleSlot = useStore((s) => s.toggleSlot);

  const highlightedIndex = delta?.stackChange === "push" ? delta.stackSlotIndex : null;
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
          {canPlay && stepIndex < 0
            ? "Press Play to watch the stack change, step by step."
            : "The stack is empty. Add a push or call to see it grow."}
        </p>
      ) : (
        <div className={styles.frames}>
          <AnimatePresence initial={false} mode="popLayout">
            {groups.map((group) => (
              <motion.div
                key={group.frameId ?? "main"}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className={styles.frame}
                data-testid={`frame-${group.label}`}
              >
                <div className={styles.frameLabel}>{group.label}</div>
                <ul className={styles.slots}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {[...group.slots].reverse().map(({ slot, index }) => {
                      const expanded = expandedSlots.has(index);
                      return (
                        <motion.li
                          key={index}
                          layout
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -6 }}
                          transition={{ type: "spring", stiffness: 480, damping: 36 }}
                        >
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
                              <motion.span layoutId="rsp-pointer" className={styles.rsp}>
                                &larr; rsp
                              </motion.span>
                            )}
                          </button>
                          {expanded && (
                            <dl className={styles.detail}>
                              <dt>slot</dt>
                              <dd>#{index}</dd>
                              <dt>kind</dt>
                              <dd>
                                {slot.kind === "return-address" ? "return address" : "pushed value"}
                              </dd>
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
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
