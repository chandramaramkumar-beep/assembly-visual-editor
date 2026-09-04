"use client";

import { usePlayback } from "@/lib/playback/PlaybackProvider";
import { useStore } from "@/lib/store";
import styles from "./Controls.module.css";

export function Controls() {
  const canPlay = useStore((s) => s.canPlay);
  const { stepIndex, totalSteps, isPlaying, isFinished, forceFullPlayback, presentation, send } =
    usePlayback();
  const iteration = presentation?.iteration ?? null;

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={`${styles.play} ${canPlay ? styles.playEnabled : ""}`}
        disabled={!canPlay}
        onClick={() => send({ type: isPlaying ? "PAUSE" : "PLAY" })}
        title={
          canPlay
            ? "Play the trace from the top"
            : "Add a push, pop, call, or ret to enable playback"
        }
        data-testid="play-button"
      >
        <span className={styles.icon} aria-hidden>
          {isPlaying ? "❚❚" : "▶"}
        </span>
        {isPlaying ? "Pause" : isFinished ? "Replay" : "Play"}
      </button>

      <button
        type="button"
        className={styles.secondary}
        disabled={!canPlay || isPlaying || stepIndex >= totalSteps - 1}
        onClick={() => send({ type: "STEP" })}
        data-testid="step-button"
      >
        Step
      </button>

      <button
        type="button"
        className={styles.secondary}
        disabled={stepIndex < 0}
        onClick={() => send({ type: "RESET" })}
        data-testid="reset-button"
      >
        Reset
      </button>

      <label className={styles.toggle} title="Play every loop iteration instead of compressing">
        <input
          type="checkbox"
          checked={forceFullPlayback}
          onChange={() => send({ type: "TOGGLE_FULL_PLAYBACK" })}
          data-testid="full-playback-toggle"
        />
        Full loops
      </label>

      {iteration && (
        <span
          className={`${styles.iteration} ${presentation?.pulse ? styles.iterationPulse : ""}`}
          data-testid="iteration-counter"
        >
          iteration {iteration.current} of {iteration.total}
        </span>
      )}

      <span className={styles.position} data-testid="step-position">
        {stepIndex < 0 ? `${totalSteps} steps` : `step ${stepIndex + 1} / ${totalSteps}`}
      </span>
    </div>
  );
}
