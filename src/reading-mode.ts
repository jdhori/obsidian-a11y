// Default markdown documents to Reading view.
//
// Rationale (accessibility): opening a note drops the user straight into the
// CodeMirror editor, which traps Tab (the very gap escape-editable.ts mitigates)
// and presents raw markup to a screen reader. Defaulting to Reading view keeps
// editing **opt-in** — the user activates it deliberately via the view's edit
// toggle (a .view-action that already carries an aria-label). We only ever act on
// a file-open: once the user toggles a view to editing, we never pull it back, so
// editing stays put until the next file is opened.

import { App, MarkdownView } from "obsidian";

/**
 * If the active view is a markdown editor still in source/live-preview mode,
 * switch it to Reading view. Idempotent — a no-op once the view is in preview,
 * which is why it is safe to call on every file-open without fighting the user.
 */
export function forceActiveReading(app: App): void {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view || view.getMode() !== "source") return;

  const leaf = view.leaf;
  const vs = leaf.getViewState();
  vs.state = { ...vs.state, mode: "preview", source: false };
  leaf.setViewState(vs).catch((err: unknown) => {
    console.warn("[a11y-enhancer] could not switch to Reading view", err);
  });
}
