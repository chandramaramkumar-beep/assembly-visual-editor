import { CodeEditor } from "@/components/CodeEditor";
import { Controls } from "@/components/Controls";
import { Diagnostics } from "@/components/Diagnostics";
import { JumpThumbnail } from "@/components/JumpThumbnail";
import { RegisterPanel } from "@/components/RegisterPanel";
import { StackView } from "@/components/StackView";
import { PlaybackProvider } from "@/lib/playback/PlaybackProvider";
import styles from "./page.module.css";

export default function Home() {
  return (
    <PlaybackProvider>
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

        <JumpThumbnail />
      </main>
    </PlaybackProvider>
  );
}
