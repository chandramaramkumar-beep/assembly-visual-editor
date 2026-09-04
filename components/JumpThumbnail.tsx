"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { stateAtStep, toSigned64 } from "@/lib/engine";
import { usePlayback } from "@/lib/playback/PlaybackProvider";
import { useStore } from "@/lib/store";
import styles from "./JumpThumbnail.module.css";

/**
 * The persistent summary of the last seek. Only one exists at a time — a new
 * jump replaces it rather than stacking alongside it — and it stays visible
 * until dismissed, like a macOS screenshot thumbnail.
 */
export function JumpThumbnail() {
  const { jump, isJumped } = usePlayback();
  const trace = useStore((s) => s.trace);
  const instructionLines = useStore((s) => s.instructionLines);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Replay the collapse each time a new jump lands: the summary starts large
  // and centred, then settles into its corner.
  useEffect(() => {
    if (!jump || !cardRef.current) return;
    const tween = gsap.fromTo(
      cardRef.current,
      { scale: 1.5, y: -120, opacity: 0.4 },
      { scale: 1, y: 0, opacity: 1, duration: 1.1, ease: "power3.out" },
    );
    return () => {
      tween.kill();
    };
  }, [jump]);

  if (!jump) return null;

  const state = stateAtStep(trace, jump.stepIndex);
  const step = trace.steps[jump.stepIndex];
  const line = step ? (instructionLines[step.instructionIndex] ?? null) : null;

  return (
    <div
      ref={cardRef}
      className={`${styles.thumbnail} ${isJumped ? styles.expanded : ""}`}
      data-testid="jump-thumbnail"
      role="status"
    >
      <div className={styles.header}>
        <span className={styles.label}>
          jumped to line {line === null ? "?" : line + 1}
        </span>
        <span className={styles.step}>step {jump.stepIndex + 1}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.column}>
          <span className={styles.columnLabel}>stack</span>
          {state.stack.length === 0 ? (
            <span className={styles.emptyStack}>empty</span>
          ) : (
            <ul className={styles.stack}>
              {[...state.stack]
                .reverse()
                .slice(0, 4)
                .map((slot, i) => (
                  <li key={i} className={styles.slot}>
                    {slot.kind === "return-address" ? "ret" : toSigned64(slot.value).toString()}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className={styles.column}>
          <span className={styles.columnLabel}>rax / rsp</span>
          <span className={styles.reg}>{toSigned64(state.registers.rax).toString()}</span>
          <span className={styles.regHex}>0x{state.registers.rsp.toString(16).slice(-6)}</span>
        </div>
      </div>
    </div>
  );
}
