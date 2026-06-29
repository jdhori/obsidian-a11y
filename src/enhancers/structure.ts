// Audit 02 — document structure: workspace tabs (tablist/tab) and the file /
// outline trees (tree/treeitem/group). State is otherwise class-only.

import {
  hideFromAT,
  makeActivatable,
  once,
  removeAttr,
  setAttr,
  setRoleIfAbsent,
  visibleText,
} from "../dom";
import { installTreeKeyboard } from "./tree-keyboard";

function enhanceTabs(doc: Document): void {
  doc
    .querySelectorAll<HTMLElement>(".workspace-tab-header-container")
    .forEach((container) => setRoleIfAbsent(container, "tablist"));

  doc.querySelectorAll<HTMLElement>(".workspace-tab-header").forEach((tab) => {
    const active =
      tab.classList.contains("is-active") || tab.classList.contains("mod-active");
    makeActivatable(tab, { role: "tab", tabindex: active ? 0 : -1 });
    setAttr(tab, "aria-selected", String(active));

    const title = visibleText(tab.querySelector(".workspace-tab-header-inner-title"));
    if (title && !tab.hasAttribute("aria-label")) setAttr(tab, "aria-label", title);

    // Roving arrow navigation. Manual activation: arrows move focus only; the
    // user presses Enter/Space (via makeActivatable) to actually switch tabs, so
    // arrowing past a tab never triggers a document load.
    if (once(tab, "TabArrows")) {
      tab.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const group = Array.from(
          tab.parentElement?.querySelectorAll<HTMLElement>(".workspace-tab-header") ?? [],
        );
        const i = group.indexOf(tab);
        const next =
          e.key === "ArrowRight"
            ? group[i + 1] ?? group[0]
            : group[i - 1] ?? group[group.length - 1];
        if (next) {
          e.preventDefault();
          next.focus();
        }
      });
    }
  });
}

/** Tree depth (1-based) by counting enclosing groups up to the tree root. */
function levelOf(item: Element): number {
  let level = 1;
  let p: Element | null = item.parentElement;
  while (p) {
    if (p.classList.contains("tree-item-children")) level++;
    p = p.parentElement;
  }
  return level;
}

function enhanceTrees(doc: Document): void {
  doc.querySelectorAll<HTMLElement>(".tree-item").forEach((item) => {
    // The role goes on the WRAPPER so the tree → treeitem → group ownership
    // chain validates (the wrapper is a direct child of the tree root or of a
    // parent's group; its own .tree-item-children is the nested group).
    setRoleIfAbsent(item, "treeitem");
    setAttr(item, "aria-level", String(levelOf(item)));

    const self = item.querySelector<HTMLElement>(":scope > .tree-item-self");

    // Single-select tree: only the active node carries aria-selected.
    const selected =
      !!self &&
      (self.classList.contains("is-active") || self.classList.contains("has-focus"));
    if (selected) setAttr(item, "aria-selected", "true");
    else removeAttr(item, "aria-selected");

    const children = item.querySelector<HTMLElement>(":scope > .tree-item-children");
    const collapsible =
      !!children ||
      item.classList.contains("nav-folder") ||
      !!self?.classList.contains("mod-collapsible");
    if (collapsible) {
      setAttr(item, "aria-expanded", String(!item.classList.contains("is-collapsed")));
    }

    const label = visibleText(self?.querySelector(".tree-item-inner") ?? null);
    if (label && !item.hasAttribute("aria-label")) setAttr(item, "aria-label", label);

    // Collapse triangle is decorative once state is on aria-expanded.
    hideFromAT(self?.querySelector(".tree-item-icon") ?? null);

    if (children) setRoleIfAbsent(children, "group");

    // Root container: a .tree-item whose parent is not itself a group marks the
    // top of a tree. Tag that parent as the tree root.
    const parent = item.parentElement;
    if (
      parent &&
      !parent.classList.contains("tree-item-children") &&
      !parent.hasAttribute("role")
    ) {
      setAttr(parent, "role", "tree");
      setAttr(parent, "aria-multiselectable", "false");
    }
  });

  // Install the keyboard model on each tree (idempotent; maintains roving).
  doc.querySelectorAll<HTMLElement>('[role="tree"]').forEach(installTreeKeyboard);
}

export function enhanceStructure(doc: Document): void {
  enhanceTabs(doc);
  enhanceTrees(doc);
}
