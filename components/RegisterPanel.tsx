"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { REGISTER_NAMES, toSigned64, type RegisterName } from "@/lib/engine";
import { useCurrentDelta, useRegisterState } from "@/lib/playback/PlaybackProvider";
import styles from "./RegisterPanel.module.css";

const NO_CHANGES: readonly RegisterName[] = [];

function formatHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

export function RegisterPanel() {
  const state = useRegisterState();
  const delta = useCurrentDelta();
  const changed = delta?.changedRegisters ?? NO_CHANGES;
  const rowRefs = useRef(new Map<RegisterName, HTMLLIElement>());

  // GSAP flashes only the rows that actually changed, so attention lands on the
  // delta rather than the whole panel redrawing.
  useEffect(() => {
    if (changed.length === 0) return;
    const targets = changed
      .map((name) => rowRefs.current.get(name))
      .filter((el): el is HTMLLIElement => Boolean(el));
    if (targets.length === 0) return;

    const tween = gsap.fromTo(
      targets,
      { backgroundColor: "var(--highlight)" },
      { backgroundColor: "rgba(0,0,0,0)", duration: 1.6, ease: "power2.out" },
    );
    return () => {
      tween.kill();
    };
  }, [changed]);

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
              ref={(el) => {
                if (el) rowRefs.current.set(name, el);
                else rowRefs.current.delete(name);
              }}
              className={styles.row}
              data-testid={`register-${name}`}
            >
              <span className={styles.name}>{name}</span>
              <span className={styles.value} title={formatHex(value)}>
                {isPointer ? formatHex(value) : toSigned64(value).toString()}
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
