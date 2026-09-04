import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

/** Marks every line before the seek target, so the student sees "everything up to here" as a block. */
export const setPrecedingBlock = StateEffect.define<number | null>();

const precedingLineDecoration = Decoration.line({ class: "cm-preceding-block" });

const precedingBlockField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (!effect.is(setPrecedingBlock)) continue;

      const upToLine = effect.value;
      if (upToLine === null || upToLine <= 0) {
        next = Decoration.none;
        continue;
      }

      const ranges = [];
      const lastLine = Math.min(upToLine, transaction.state.doc.lines);
      for (let line = 1; line <= lastLine; line++) {
        ranges.push(precedingLineDecoration.range(transaction.state.doc.line(line).from));
      }
      next = Decoration.set(ranges);
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Once playback has started, clicking a line seeks the trace to it. While idle
 * the editor behaves normally, so clicking still places a cursor for editing.
 */
export function seekOnClick(isSeekable: () => boolean, onSeek: (line: number) => void) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!isSeekable()) return false;

      // Resolve the line from the clicked element rather than from pixel
      // coordinates: posAtCoords depends on live layout measurement and
      // mis-resolves when the editor is measured mid-layout.
      const target = event.target as HTMLElement | null;
      const lineEl = target?.closest?.(".cm-line");
      const pos = lineEl
        ? view.posAtDOM(lineEl)
        : view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      onSeek(view.state.doc.lineAt(pos).number - 1);
      return true;
    },
  });
}

const seekTheme = EditorView.baseTheme({
  ".cm-preceding-block": {
    backgroundColor: "var(--preceding-block)",
  },
});

export const seekHighlight = [precedingBlockField, seekTheme];
