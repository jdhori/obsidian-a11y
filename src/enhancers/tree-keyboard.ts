// APG tree keyboard interaction model for Obsidian's side menus (file explorer,
// outline, bookmarks). Obsidian renders tree rows as non-focusable <div>s with
// only class-based state, so a keyboard user can Tab *past* the side menu but
// never traverse it. This adds the standard tree model on top of the roles the
// structure enhancer already applies:
//
//   ArrowUp/ArrowDown  move between visible items (roving tabindex)
//   ArrowRight         expand a collapsed folder, else move to first child
//   ArrowLeft          collapse an expanded folder, else move to parent
//   Home/End           first / last visible item
//   Enter              activate immediately (open file / toggle folder)
//   Space              activate on key-up, cancellable by moving focus first
//
// role="treeitem" lives on the .tree-item WRAPPER (valid tree>treeitem>group
// ownership); activation clicks the inner .tree-item-self row that Obsidian
// already wired.

import { isVisible, once, setAttr } from "../dom";

const TREEITEM = '[role="treeitem"]';

function visibleItems(tree: Element): HTMLElement[] {
  return Array.from(tree.querySelectorAll<HTMLElement>(TREEITEM)).filter(isVisible);
}

function rowOf(item: HTMLElement): HTMLElement | null {
  return item.querySelector<HTMLElement>(":scope > .tree-item-self");
}

function isFolder(item: HTMLElement): boolean {
  return item.hasAttribute("aria-expanded");
}

function isExpanded(item: HTMLElement): boolean {
  return item.getAttribute("aria-expanded") === "true";
}

function activate(item: HTMLElement): void {
  rowOf(item)?.click();
}

function parentItem(item: HTMLElement, tree: Element): HTMLElement | null {
  let p: HTMLElement | null = item.parentElement;
  while (p && p !== tree) {
    if (p.matches(TREEITEM)) return p;
    p = p.parentElement;
  }
  return null;
}

/** Move the single tab stop to `target` and focus it. */
function focusItem(tree: Element, target: HTMLElement): void {
  tree.querySelectorAll<HTMLElement>(TREEITEM).forEach((t) => {
    setAttr(t, "tabindex", t === target ? "0" : "-1");
  });
  target.focus();
  target.scrollIntoView({ block: "nearest" });
}

/** Ensure exactly one treeitem in the tree is the tab stop (tabindex=0). */
function ensureRoving(tree: Element): void {
  const all = Array.from(tree.querySelectorAll<HTMLElement>(TREEITEM));
  if (!all.length) return;
  const current = all.find((t) => t.getAttribute("tabindex") === "0" && isVisible(t));
  if (current) {
    all.forEach((t) => {
      if (t !== current) setAttr(t, "tabindex", "-1");
    });
    return;
  }
  const vis = all.filter(isVisible);
  const start =
    vis.find((t) => t.getAttribute("aria-selected") === "true") ?? vis[0] ?? all[0];
  all.forEach((t) => setAttr(t, "tabindex", t === start ? "0" : "-1"));
}

export function installTreeKeyboard(tree: HTMLElement): void {
  ensureRoving(tree); // runs every sweep to keep the tab stop valid
  if (!once(tree, "TreeKbd")) return;

  let spaceArmed: HTMLElement | null = null;

  tree.addEventListener("keydown", (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    // Don't hijack typing (e.g. inline rename input, search filter).
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;

    const cur = t.closest?.(TREEITEM) as HTMLElement | null;
    if (!cur || !tree.contains(cur)) return;

    // Any non-Space key cancels a pending Space activation, even when it doesn't
    // move focus (e.g. expand/collapse/Enter in place) — prevents a double-fire.
    if (e.key !== " " && e.key !== "Spacebar") spaceArmed = null;

    const list = visibleItems(tree);
    const i = list.indexOf(cur);

    switch (e.key) {
      case "ArrowDown":
        if (i > -1 && i < list.length - 1) { e.preventDefault(); focusItem(tree, list[i + 1]); }
        break;
      case "ArrowUp":
        if (i > 0) { e.preventDefault(); focusItem(tree, list[i - 1]); }
        break;
      case "Home":
        if (list.length) { e.preventDefault(); focusItem(tree, list[0]); }
        break;
      case "End":
        if (list.length) { e.preventDefault(); focusItem(tree, list[list.length - 1]); }
        break;
      case "ArrowRight":
        e.preventDefault();
        if (isFolder(cur)) {
          if (!isExpanded(cur)) {
            activate(cur); // expand in place
          } else {
            // Step into the first actual child (not merely the next visible row,
            // which could be a sibling when an expanded folder is empty).
            const child = cur.querySelector<HTMLElement>(
              `:scope > .tree-item-children > ${TREEITEM}`,
            );
            if (child && isVisible(child)) focusItem(tree, child);
          }
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (isFolder(cur) && isExpanded(cur)) {
          activate(cur); // collapse in place
        } else {
          const p = parentItem(cur, tree);
          if (p) focusItem(tree, p);
        }
        break;
      case "Enter":
        e.preventDefault();
        activate(cur); // immediate
        break;
      case " ":
      case "Spacebar":
        e.preventDefault(); // suppress scroll; activate on key-up
        spaceArmed = cur;
        break;
      default:
        break;
    }
  });

  tree.addEventListener("keyup", (e: KeyboardEvent) => {
    if (e.key !== " " && e.key !== "Spacebar") return;
    const cur = (e.target as HTMLElement)?.closest?.(TREEITEM) as HTMLElement | null;
    if (spaceArmed && cur === spaceArmed) {
      e.preventDefault();
      activate(cur); // committed activation
    }
    spaceArmed = null;
  });

  // Moving focus away (arrow nav, blur) cancels a pending Space activation.
  tree.addEventListener("focusout", () => {
    spaceArmed = null;
  });
}
