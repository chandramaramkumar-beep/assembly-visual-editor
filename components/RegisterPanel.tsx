"use client";

import { REGISTER_NAMES, toSigned64, type RegisterName } from "@/lib/engine";
import { useRegisterState, useStore } from "@/lib/store";
import styles from "./RegisterPanel.module.css";

/** Stable reference — a Zustand selector must never build a new object per render. */
const NO_CHANGES: readonly RegisterName[] = [];

function formatValue(value: bigint): string {
  const signed = toSigned64(value);
  return signed.toString();
}

function formatHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

export function RegisterPanel() {
  const state = useRegisterState();
  const changed = useStore((s) =>
    s.stepIndex >= 0
      ? (s.trace.steps[s.stepIndex]?.delta.changedRegisters ?? NO_CHANGES)
      : NO_CHANGES,
  );

  return (
    <section className={styles.panel} aria-label="Registers">
      <h2 className={styles.heading}>Registers</h2>
      <ul className={styles.list}>
        {REGISTER_NAMES.map((name) => {
          const value = state.registers[name];
          const isPointer = name === "rsp" || name === "rbp";
          return (
            <li
              key={name}
              className={`${styles.row} ${changed.includes(name) ? styles.changed : ""}`}
              data-testid={`register-${name}`}
            >
              <span className={styles.name}>{name}</span>
              <span className={styles.value} title={formatHex(value)}>
                {isPointer ? formatHex(value) : formatValue(value)}
              </span>
            </li>
          );
        })}
      </ul>

      <h2 className={styles.heading}>Flags</h2>
      <ul className={styles.flags}>
        {(["zf", "sf", "cf", "of"] as const).map((flag) => (
          <li
            key={flag}
            className={`${styles.flag} ${state.flags[flag] ? styles.flagSet : ""}`}
            data-testid={`flag-${flag}`}
          >
            <span className={styles.flagName}>{flag.toUpperCase()}</span>
            <span className={styles.flagValue}>{state.flags[flag] ? "1" : "0"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
