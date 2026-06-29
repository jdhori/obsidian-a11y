# Obsidian 1.12.7 Accessibility Audit — Document Structure

**Scope:** Workspace tabs, file explorer tree, outline / outgoing links / bookmarks panels, tab/pane navigation and reordering.
**Target:** WCAG 2.1 Level A and AA (failures). WCAG 2.2 criteria flagged as RECOMMENDED, not failures.
**Method:** grep of `/tmp/obs-extract/app.js` (3.6 MB minified) for class names + `createDiv`/`setAttribute`/`setAttr`/`addClass`, cross-referenced against `/tmp/obs-extract/app.css`. Evidence is presence/absence of role/state/name/focus in the construction code. No logic tracing.
**Constraint:** Community plugin patches the live DOM at runtime; cannot modify Obsidian source.

---

## Ground-truth confirmations (what the code actually does)

| Claim | Evidence (app.js / app.css) |
|---|---|
| Tab header is a bare `div`, no role/tabindex/state | `i.tabHeaderEl=createDiv("workspace-tab-header tappable");a.draggable=!0,a.createDiv("workspace-tab-header-inner",…)` — no `role`, no `tabindex`, no `aria-selected`. |
| Active tab is class-only | `tabHeaderEl.addClass("mod-active")` on activate; `tabHeaderEl.removeClass("mod-active")` on deactivate; visual via `.workspace-tab-header.is-active { color: var(--tab-text-color-focused-active) }`. No `aria-selected`/`aria-current`. |
| Tab close button IS labeled | `i.tabHeaderCloseEl=e.createDiv("workspace-tab-header-inner-close-button",(e)=>{tv(e,"lucide-x"),Mv(e,gm.interface.menu.close()),…})`. `Mv(e,t){e.setAttribute("aria-label",t),…}` → close button gets `aria-label="Close"`. But it is a `div`, not a `button`, with click handler only. |
| File tree item is a bare `div` with click handler | `this.el=createDiv("tree-item");var n=this.selfEl=e.createDiv("tree-item-self");n.addEventListener("click",…onSelfClick…)`. No role/tabindex/aria. |
| Collapse arrow unlabeled, no aria-expanded | `tv(n=this.collapseEl=createDiv("tree-item-icon collapse-icon"),"right-triangle"),n.addEventListener("click",…)`. Icon-only `div`, no `aria-label`, no `aria-expanded`. Collapsed state = CSS rotation only: `.is-collapsed svg.svg-icon { transform: rotate(...90deg) }`. |
| Selected/clickable state class-only | `setClickable(e){this.selfEl.toggleClass("is-clickable",e)}`; selection via `is-selected`/`is-active` classes. `.tree-item-self.is-active { color; background-color; font-weight }`. No `aria-selected`. |
| Focused tree item gets visual ring but not DOM focus | `setFocusedItem(e){…e.el.addClass("has-focus"),this.infinityScroll.scrollIntoView(e)…}`; `.tree-item-self.has-focus { box-shadow: 0 0 0 2px var(--background-modifier-border-focus) }`. Roving state is a class, not `tabindex`/`.focus()`, and there is no `aria-activedescendant`. |
| **File tree HAS arrow-key navigation** (mitigation) | `initializeKeyboardNav(){this.scope.register([],"ArrowDown",…),(…)"ArrowUp"…,"ArrowLeft"…,"ArrowRight"…,"Enter",…," ",…,"F2",…,"Delete"/"Backspace"…}` via Obsidian `scope`. |
| **Tab switching HAS keyboard commands** (mitigation) | command ids `workspace:next-tab` (`Go to next tab`), `Go to previous tab`, `Go to tab #{{n}}`, `Focus on tab group above/below` (i18n). Reachable via hotkeys/command palette, NOT by Tab/Arrow on the tablist. |
| Zero real ARIA roles on these widgets | Only `setAttribute("role","listbox"|"option")` (CodeMirror autocomplete) and `setAttr("role","button")` ×4 (graph view, embed link, close-page — out of scope). `"tablist"` string is a context-menu section name (`mod-tab-list`), `"tree"` is a view-mode/parser string — neither is an ARIA role. |
| `aria-selected` ×15, `aria-expanded` ×1 all belong to CodeMirror | All `aria-selected` hits are `.cm-tooltip-autocomplete ul li[aria-selected]`; not on tabs or tree. |
| Icon SVGs are not hidden from AT | `svg-icon` SVGs built with `{viewBox:"0 0 100 100"}` only — no `aria-hidden`, no `role`. The 13 `aria-hidden` in app.js are all CodeMirror widget/measure buffers. |

---

## 1. Findings

| ID | SC | Severity | Element / Selector | Evidence | What's wrong |
|---|---|---|---|---|---|
| DS-01 | 4.1.2, 1.3.1 | **Critical** | `.workspace-tab-header` (tab headers) | `createDiv("workspace-tab-header tappable")` — no role | Tabs have no `role="tab"`, are not in a `role="tablist"`. AT announces "(blank)" / generic group. No Name/Role/Value. |
| DS-02 | 4.1.2, 1.3.1 | **Critical** | `.workspace-tab-header.mod-active` / `.is-active` | `tabHeaderEl.addClass("mod-active")`; CSS color-only | Active tab conveyed by class + color only; no `aria-selected="true"` / `aria-current`. Screen reader cannot tell which tab is active. |
| DS-03 | 2.1.1, 2.1.2 | **High** | `.workspace-tab-header` strip | No `scope.register` arrow keys for the tab strip; no `tabindex` | Tabs are not arrow-navigable or Tab-reachable as a widget. Mitigated (not eliminated) by `workspace:next-tab` / "Focus on tab group" commands, so partial keyboard access exists via hotkeys only. |
| DS-04 | 1.3.1, 4.1.2 | **High** | `.nav-files-container` / `.tree-item` | `createDiv("tree-item")` + `tree-item-self` div, no role | File explorer is not a `role="tree"` of `role="treeitem"`. No `aria-level`, `aria-setsize`, `aria-posinset`. AT sees a stack of unlabeled groups/clickable divs. |
| DS-05 | 4.1.2, 1.3.1 | **High** | `.tree-item-icon.collapse-icon` (folder arrows) | `createDiv("tree-item-icon collapse-icon")` + click only; `.is-collapsed` CSS rotation | Collapse arrows have no `aria-label`, no `role="button"`, and expanded/collapsed state has no `aria-expanded`. State is visual rotation only. |
| DS-06 | 4.1.2, 1.3.1 | **High** | `.tree-item-self.is-active` / `.is-selected` | `toggleClass("is-selected"/"is-active")` | Selected file/folder conveyed by class + color/background/weight only; no `aria-selected`. |
| DS-07 | 4.1.2, 2.4.3 | **Medium** | `.tree-item-self.has-focus` | `addClass("has-focus")` + `scrollIntoView`; no `tabindex`/`.focus()`/`aria-activedescendant` | Roving focus is simulated with a class. The container that owns the scope holds no programmatic focus pointer AT can follow, so the focused row is not exposed to the accessibility tree. (Visual ring exists: `box-shadow 0 0 0 2px`.) |
| DS-08 | 1.1.1 | **Medium** | `.workspace-tab-header-inner-icon`, `.tree-item-icon`, `svg.svg-icon` | `svg-icon` built with `{viewBox}` only; no `aria-hidden` | Decorative status/type icons are not hidden from AT. Where a control has a real label this is noise; where it does not (DS-05) it is the only "name." |
| DS-09 | 2.1.1 | **High** | Tab/pane reorder = drag-only | `a.draggable=!0; a.addEventListener("dragstart",…onDragLeaf…)`; no key handler for reordering | Tab and pane reordering is pointer-drag only. No keyboard alternative to move/reorder a tab. (2.2 SC 2.5.7 Dragging Movements is RECOMMENDED; the keyboard-operability gap is the 2.1.1 failure.) |
| DS-10 | 1.3.1, 4.1.2 | **High** | Outline / outgoing-links / bookmarks panels | All build on the same `tree-item` base (`createDiv("tree-item")`, `setCollapsible`); `OutlineView` present, no tree roles | Every secondary navigation panel inherits the same missing tree semantics, collapse-arrow labels, and selection state as DS-04/05/06. |
| DS-11 | 4.1.2 | **Medium** | `.workspace-tab-header-inner-title` | Title text in a `div`; no association to the (rootless) tab | Even after adding `role="tab"`, the accessible name must be wired (the title `div` text or `aria-labelledby` to it); today there is no name binding because there is no role. |

**Not a finding (positive):** tab **close** button already carries `aria-label="Close"` via `Mv()` (DS evidence row). It still needs `role="button"` + keyboard, but the name exists.

---

## 2. Remediation

Tags: **[PLUGIN-NOW]** = set once after layout ready; **[PLUGIN-OBSERVER]** = needs `MutationObserver` because Obsidian re-renders/re-classes nodes (active tab, collapse, selection, virtualized tree rows via InfinityScroll); **[CORE-ONLY]** = cannot be done robustly from a plugin / needs Obsidian source.

> Implementation note: the tree uses **InfinityScroll virtualization** (`infinityScroll`, `scrollIntoView`) — rows are recycled. Any attribute you stamp on `.tree-item` must be (re)applied on mutation, so tree work is **[PLUGIN-OBSERVER]**, not one-shot.

### Workspace tabs

**DS-01 / DS-11 — tablist + tab roles + names** — **[PLUGIN-OBSERVER]**
- On `.workspace-tab-header-container` (the tab strip): `setAttribute("role","tablist")`. Add `aria-label` (e.g. the split's orientation/"Open tabs").
- On each `.workspace-tab-header`: `role="tab"`, `tabindex` roving (`0` for active, `-1` for others), and bind name via `aria-labelledby` → the existing `.workspace-tab-header-inner-title` (give it a generated `id`). If title may be empty (pinned/icon tabs), fall back to `aria-label` from the leaf display text.
- Link tab → panel: `aria-controls` = the leaf's `.workspace-leaf-content` (stamp a generated `id` on it). Set `role="tabpanel"` + `aria-labelledby` back to the tab.

**DS-02 — active tab state** — **[PLUGIN-OBSERVER]** (must watch `mod-active`/`is-active` class flips)
- When a header has `mod-active`/`is-active`: `aria-selected="true"`, else `aria-selected="false"`. Mirror roving `tabindex` (active=`0`).

**DS-03 — arrow-key tab navigation** — **[PLUGIN-NOW]** (listener) + **[PLUGIN-OBSERVER]** (roving tabindex upkeep)
- Add a `keydown` handler on the `role="tablist"`: ArrowLeft/Right move roving focus and call `.focus()` on the target header; Home/End jump ends; Enter/Space activate (dispatch the existing click). Respect `dir` for RTL (CSS uses `--direction`).
- Keep Obsidian's existing `workspace:next-tab` commands as the non-focus path.

**DS-09 — keyboard tab reorder** — **[PLUGIN-NOW]** (add commands) / **[CORE-ONLY]** (true parity)
- A plugin can register commands ("Move tab left/right", "Move tab to new pane") that call the workspace reorder API, giving a keyboard alternative to drag. Pixel-accurate keyboard DnD parity with the mouse path is **[CORE-ONLY]**.

**Tab close button** — **[PLUGIN-OBSERVER]**
- Already `aria-label`'d. Add `role="button"` and `tabindex="0"` + Enter/Space handler so it is independently operable, and include it in the tab's roving sequence.

### File explorer / outline / outgoing / bookmarks (shared `tree-item` base — fix once, apply to all containers)

**DS-04 — tree / treeitem roles + structure** — **[PLUGIN-OBSERVER]**
- On the scroll container (`.nav-files-container`, and the equivalent in outline/outgoing/bookmarks): `role="tree"`, `aria-label` (e.g. "Files", "Outline", "Bookmarks"), `aria-multiselectable="true"` for the file explorer (it supports multi-select via Shift/Mod-Arrow).
- On each `.tree-item-self` (the interactive row): `role="treeitem"`.
- On `.tree-item-children` / `.nav-folder-children`: `role="group"`.
- Compute and set `aria-level` (depth, 1-based), `aria-setsize`, `aria-posinset` per row — re-derive on mutation because rows recycle.
- Name: `aria-labelledby` → existing `.tree-item-inner-text` / `.nav-file-title-content` / `.nav-folder-title-content` (stamp ids).

**DS-05 — collapse arrows: label + expanded state** — **[PLUGIN-OBSERVER]** (watch `mod-collapsible` add and `is-collapsed` flips)
- On any `.tree-item-self.mod-collapsible` (the row, which is the treeitem): set `aria-expanded="true"` when NOT `is-collapsed`, `"false"` when `is-collapsed`. (Put `aria-expanded` on the treeitem row, per ARIA tree pattern — not on the arrow icon.)
- On `.collapse-icon`: it is part of the row; mark the icon SVG `aria-hidden="true"` (DS-08) so it is not double-announced, since `aria-expanded` on the row now conveys state.

**DS-06 — selection state** — **[PLUGIN-OBSERVER]** (watch `is-selected`/`is-active`)
- Mirror `is-selected`/`is-active` → `aria-selected="true"`, else `"false"` (only meaningful once `role="treeitem"` exists).

**DS-07 — roving focus / aria-activedescendant** — **[PLUGIN-OBSERVER]** + **[PLUGIN-NOW]** (container tabindex)
- Make the tree container focusable (`tabindex="0"`) so Tab reaches it and Obsidian's existing `scope` arrow keys fire.
- Stamp a generated `id` on each `.tree-item-self`; when Obsidian moves `has-focus`, mirror it to `aria-activedescendant` on the container (matches the existing roving model without fighting Obsidian's focus logic). Alternative (heavier): real roving `tabindex` + `.focus()`, but this risks fighting Obsidian's `scrollIntoView`/recycling.

**DS-08 — hide decorative icons** — **[PLUGIN-OBSERVER]**
- `aria-hidden="true"` on `.svg-icon` inside labeled controls (status icons, type icons, collapse arrow). Skip any icon that is the sole accessible name of an unlabeled control until that control gets a real label.

**DS-10 — outline / outgoing / bookmarks** — **[PLUGIN-OBSERVER]**
- Apply the identical DS-04…DS-08 treatment to each panel's tree container. Because they share the `tree-item` construction, a single observer keyed on `.tree-item`/`.tree-item-self` under each known view container covers all of them.

### Core-only / cannot fully fix from a plugin
- Native, ergonomic **keyboard drag-and-drop parity** for tabs and panes (DS-09) — **[CORE-ONLY]**.
- Guaranteeing semantics survive **every** Obsidian re-render without observer churn / race windows — fundamentally **[CORE-ONLY]**; the plugin can only approximate via `MutationObserver`.
- First-render flash before the observer stamps attributes is **[CORE-ONLY]** to eliminate.

---

## 3. Highest-impact 5

1. **DS-04 — Real `role="tree"` / `role="treeitem"` on the file explorer** (1.3.1, 4.1.2). The file tree is the primary navigation surface; today it is an unlabeled div stack. **[PLUGIN-OBSERVER]**
2. **DS-01 + DS-02 — `role="tablist"`/`role="tab"` + `aria-selected` on workspace tabs** (4.1.2, 1.3.1). Users cannot tell tabs exist or which is active. **[PLUGIN-OBSERVER]**
3. **DS-05 — Collapse arrows: `aria-expanded` on the treeitem + label/hide the arrow** (4.1.2, 1.3.1). Expand/collapse is core to tree use and is currently invisible to AT. **[PLUGIN-OBSERVER]**
4. **DS-03 — Arrow-key navigation + roving focus on the tab strip** (2.1.1, 2.1.2). Makes tabs operable as a widget, not just via buried commands. **[PLUGIN-NOW + OBSERVER]**
5. **DS-07 — Container `tabindex="0"` + `aria-activedescendant` for the tree** (2.4.3, 4.1.2). Unlocks the *already-present* arrow-key `scope` for keyboard users and exposes the focused row. **[PLUGIN-NOW + OBSERVER]**
