import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

/** Sets the currently-animating source line (0-based), or null to clear it. */
export const setActiveLine = StateEffect.define<number | null>();

const activeLineDecoration = Decoration.line({ class: "cm-executing-line" });

const activeLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (!effect.is(setActiveLine)) continue;

      const line = effect.value;
      if (line === null || line >= transaction.state.doc.lines) {
        next = Decoration.none;
        continue;
      }
      const from = transaction.state.doc.line(line + 1).from;
      next = Decoration.set([activeLineDecoration.range(from)]);
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const activeLineTheme = EditorView.baseTheme({
  ".cm-executing-line": {
    backgroundColor: "var(--executing-line)",
    boxShadow: "inset 2px 0 0 var(--accent)",
  },
});

export const activeLineHighlight = [activeLineField, activeLineTheme];
