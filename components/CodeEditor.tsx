"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { assembly } from "@/lib/editor/assembly-language";
import { seekTargetForInstruction } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { useActiveLine, usePlayback } from "@/lib/playback/PlaybackProvider";
import { activeLineHighlight, setActiveLine } from "@/lib/editor/active-line";
import { seekHighlight, seekOnClick, setPrecedingBlock } from "@/lib/editor/seek";
import styles from "./CodeEditor.module.css";

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-keyword)" },
  { tag: tags.variableName, color: "var(--syntax-register)" },
  { tag: tags.number, color: "var(--syntax-number)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.labelName, color: "var(--syntax-label)" },
]);

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "0.85rem", backgroundColor: "transparent" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7" },
  ".cm-content": { caretColor: "var(--accent)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--muted)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
});

export function CodeEditor() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const setSource = useStore((s) => s.setSource);
  const activeLine = useActiveLine();
  const { isSeekable, jump, stepIndex, send } = usePlayback();

  // Read through refs so the editor is constructed once; rebuilding it on every
  // playback tick would destroy the student's cursor and undo history.
  const seekableRef = useRef(isSeekable);
  const stepIndexRef = useRef(stepIndex);

  useEffect(() => {
    seekableRef.current = isSeekable;
    stepIndexRef.current = stepIndex;
  }, [isSeekable, stepIndex]);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: useStore.getState().source,
        extensions: [
          lineNumbers(),
          history(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          assembly(),
          syntaxHighlighting(highlightStyle),
          activeLineHighlight,
          seekHighlight,
          seekOnClick(
            () => seekableRef.current,
            (line) => {
              const { trace, instructionLines } = useStore.getState();
              const instructionIndex = instructionLines.indexOf(line);
              if (instructionIndex === -1) return;

              const target = seekTargetForInstruction(
                trace,
                instructionIndex,
                stepIndexRef.current,
              );
              if (target !== null) send({ type: "JUMP", stepIndex: target });
            },
          ),
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) setSource(update.state.doc.toString());
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [setSource, send]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setActiveLine.of(activeLine) });
  }, [activeLine]);

  // While a jump is on screen, everything before the target reads as one block.
  useEffect(() => {
    const { instructionLines, trace } = useStore.getState();
    const step = jump ? trace.steps[jump.stepIndex] : null;
    const line = step ? (instructionLines[step.instructionIndex] ?? null) : null;
    viewRef.current?.dispatch({ effects: setPrecedingBlock.of(line) });
  }, [jump]);

  return <div ref={containerRef} className={styles.editor} data-testid="code-editor" />;
}
