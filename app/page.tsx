import { CodeEditor } from "@/components/CodeEditor";
import { Controls } from "@/components/Controls";
import { Diagnostics } from "@/components/Diagnostics";
import { RegisterPanel } from "@/components/RegisterPanel";
import { StackView } from "@/components/StackView";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Assembly Visual Editor</h1>
        <p className={styles.subtitle}>x86_64 &middot; Intel syntax &middot; NASM conventions</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.editorColumn}>
          <Controls />
          <Diagnostics />
          <CodeEditor />
        </div>
        <StackView />
        <RegisterPanel />
      </div>
    </main>
  );
}
