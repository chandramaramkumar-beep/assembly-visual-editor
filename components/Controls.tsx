"use client";

import { useStore } from "@/lib/store";
import styles from "./Controls.module.css";

export function Controls() {
  const canPlay = useStore((s) => s.canPlay);
  const stepIndex = useStore((s) => s.stepIndex);
  const totalSteps = useStore((s) => s.trace.steps.length);
  const setStepIndex = useStore((s) => s.setStepIndex);

  const atEnd = stepIndex >= totalSteps - 1;

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={`${styles.play} ${canPlay ? styles.playEnabled : ""}`}
        disabled={!canPlay}
        onClick={() => setStepIndex(atEnd ? 0 : stepIndex + 1)}
        title={
          canPlay
            ? "Step forward through the trace"
            : "Add a push, pop, call, or ret to enable playback"
        }
        data-testid="play-button"
      >
        <span className={styles.icon} aria-hidden>
          {"▶"}
        </span>
        {stepIndex < 0 ? "Play" : atEnd ? "Restart" : "Step"}
      </button>

      <button
        type="button"
        className={styles.secondary}
        disabled={stepIndex < 0}
        onClick={() => setStepIndex(-1)}
        data-testid="reset-button"
      >
        Reset
      </button>

      <span className={styles.position} data-testid="step-position">
        {stepIndex < 0 ? `${totalSteps} steps` : `step ${stepIndex + 1} / ${totalSteps}`}
      </span>
    </div>
  );
}
