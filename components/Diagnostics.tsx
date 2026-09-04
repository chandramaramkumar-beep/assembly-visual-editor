"use client";

import { useStore } from "@/lib/store";
import styles from "./Diagnostics.module.css";

export function Diagnostics() {
  const parseErrors = useStore((s) => s.parseErrors);
  const fault = useStore((s) => s.trace.fault);

  if (parseErrors.length === 0 && !fault) return null;

  return (
    <div className={styles.diagnostics} role="status" data-testid="diagnostics">
      {parseErrors.slice(0, 3).map((error) => (
        <p key={`${error.line}-${error.message}`} className={styles.entry}>
          <span className={styles.line}>line {error.line + 1}</span>
          {error.message}
        </p>
      ))}
      {fault && (
        <p className={styles.entry} data-testid="fault">
          <span className={styles.line}>stopped</span>
          {fault.message}
        </p>
      )}
    </div>
  );
}
