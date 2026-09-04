"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { assembly } from "@/lib/editor/assembly-language";
import { useStore } from "@/lib/store";
import { activeLineHighlight, setActiveLine } from "@/lib/editor/active-line";
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
  const activeLine = useStore((s) => {
    if (s.stepIndex < 0) return null;
    const step = s.trace.steps[s.stepIndex];
    return step ? (s.instructionLines[step.instructionIndex] ?? null) : null;
  });

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
  }, [setSource]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setActiveLine.of(activeLine) });
  }, [activeLine]);

  return <div ref={containerRef} className={styles.editor} data-testid="code-editor" />;
}
