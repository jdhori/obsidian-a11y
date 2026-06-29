# Obsidian 1.12.7 — Accessibility Audit: Application Chrome (Ribbon, Sidebar Toggles, View Headers, Status Bar)

**Target:** Obsidian 1.12.7 desktop (Electron/Chromium)
**Scope:** Left ribbon, sidebar collapse/expand toggles, view-header action buttons, status bar.
**Conformance target:** WCAG 2.1 Level A & AA (failures). WCAG 2.2 items flagged RECOMMENDED.
**Method:** String-grep of minified renderer `/tmp/obs-extract/app.js` + readable `/tmp/obs-extract/app.css`. Evidence is presence/absence of names, roles, states, focus styling. Control flow not interpreted.

---

## Executive correction to the audit premise

The brief states "only `setTooltip` is used, which gives NO accessible name." **This is partially false in 1.12.7** and the plugin author must not over-patch:

- The tooltip helper **`Mv`** is defined as:
  `function Mv(e,t,n){e.setAttribute("aria-label",t),Ev(e,n),...}`
  So `setTooltip`/`Mv` **does** set a real `aria-label`. View-actions, the view-header sidebar toggle, and ribbon items therefore **do** receive an accessible name.
- The danger is the **second** tooltip helper **`Sv`**:
  `function Sv(e,t,n){e.setAttribute("aria-label",""),yv.set(e,t),...}`
  It sets `aria-label=""` and stores the real text in a JS `WeakMap` (`yv`) for lazy/dynamic tooltip rendering. Elements built with `Sv` ship with an **empty accessible name** in the DOM until something else updates it. The drawer/collapse sidebar toggles use `Sv`.

So the real problems are: **wrong element type (div not button) → not focusable/operable**, **missing/empty names on `Sv`-built controls and status-bar items**, **no visible focus on div-based controls**, and **toggle state not exposed**. Names on `Mv`-built buttons are mostly OK.

---

## 1. Findings Table

| ID | SC | Severity | Element / Selector | Evidence (from app.js / app.css) | What's wrong |
|----|----|----------|--------------------|-----------------------------------|--------------|
| C-01 | 2.1.1, 4.1.2 | **Critical** | Left ribbon icons `div.clickable-icon.side-dock-ribbon-action` | `makeRibbonItemButton=function(...){var i=createDiv("clickable-icon side-dock-ribbon-action");return i.onClickEvent(n),Mv(i,t,...),tv(i,e),i}` | Ribbon actions are `<div>`, not `<button>`. No `tabindex`, no `role`. Not keyboard focusable or operable; not exposed as a control to AT. (Name via `Mv` is present, but it is on a non-focusable div.) |
| C-02 | 2.1.1, 1.3.1, 4.1.2 | **Critical** | Status bar items `div.status-bar-item` | `registerStatusBarItem=function(){return this.containerEl.createDiv("status-bar-item")}` | Status bar items are bare `<div>`. No `role`, no `tabindex`, no name. Clickable status items (e.g. sync, word count) are unreachable by keyboard and have no Name/Role/Value. |
| C-03 | 1.1.1, 4.1.2 | **High** | Status-bar icon-only items `span.status-bar-item-icon` | `var t=e.createSpan("status-bar-item-icon");...tv(t,"lucide-book-open"),Mv(...)` — icon container is a `<span>` inside a non-interactive `<div>`; SVG from `ev()`/`Jm` has **no `aria-hidden`** | Icon-only status info conveyed by SVG glyph with no reliable text alternative on a focusable/announced element. |
| C-04 | 4.1.2, 1.3.1 | **High** | Drawer / collapse sidebar toggle `div.sidebar-toggle-button.mod-left` / `.mod-right` | `...sidebarToggleButtonEl=createDiv("sidebar-toggle-button mod-left",(function(e){Sv(e,(function(){return i.leftSplit.collapsed?...sidebarExpand():...sidebarCollapse...})...` | Built with `Sv`, which sets `aria-label=""`. Element ships with **empty accessible name**; also a `<div>` (not focusable). State (open/closed) only in CSS class `is-left-sidedock-open` / `is-right-sidedock-open`. |
| C-05 | 4.1.2 | **High** | Sidebar toggles (both div and button variants) | Only `aria-expanded` in whole bundle is on the listbox: `...,"listbox"),i.setAttribute("aria-expanded","true")...`. No `aria-pressed`/`aria-expanded` on sidebar toggles. State tracked via CSS: `is-left-sidedock-open`, `is-right-sidedock-open` | Toggle controls expose no programmatic state (no `aria-pressed`/`aria-expanded`). A SR user cannot tell whether the sidebar is open or collapsed. |
| C-06 | 2.4.7 | **High** | All `<div>`-based chrome controls (ribbon, status bar, drawer toggle) | Global rule `:focus { outline: none; }` (app.css:3218). No `focus-visible` rule matches `.clickable-icon`, `.side-dock-ribbon-action`, `.status-bar-item`, or `.view-action`. Only `button:focus-visible{box-shadow:0 0 0 3px ...}` (app.css:6675) | UA outline removed globally; div controls aren't focusable anyway, but if made focusable they have **no visible focus indicator**. |
| C-07 | 1.1.1 | **Med** | All icon controls — SVG glyphs from `ev()`/`Jm()` | `aria-hidden` count in app.js = 1 (a CM6 buffer, unrelated). Icon SVG factory `ev()` adds no `aria-hidden`/`role` | Decorative icon SVGs are not marked `aria-hidden`. Where the parent lacks an `aria-label` (status bar, `Sv` toggles) the SVG is the only content and is announced as an unlabeled graphic / "image". |
| C-08 | 2.4.7 | **Med** | View-action icon buttons `button.clickable-icon.view-action` | `addAction=function(e,t,n){var i=createEl("button","clickable-icon view-action");...tv(i,e),Mv(i,t),...}` | These ARE real `<button>`s with a name (`Mv`) and DO get `button:focus-visible` box-shadow. **Mostly conformant.** Listed for completeness: the global `:focus{outline:none}` means non-`:focus-visible` programmatic focus shows nothing, but keyboard focus is covered. |

### Quick pass/fail per scoped control

| Control | Real button? | Has name? | Keyboard operable? | Visible focus? | State exposed? |
|---|---|---|---|---|---|
| Ribbon icon (`side-dock-ribbon-action`) | No (div) | Yes (`Mv`) | **No** | **No** | n/a |
| Status bar item (`status-bar-item`) | No (div) | **No** | **No** | **No** | **No** |
| Drawer/collapse toggle (`Sv` div) | No (div) | **No (empty)** | **No** | **No** | **No** |
| View-header sidebar toggle (`button` + `Mv`) | Yes | Yes | Yes | Yes | **No** |
| View-action (`button.view-action`) | Yes | Yes | Yes | Yes | n/a |

---

## 2. Remediation (tagged by plugin feasibility)

Feasibility tags: **[PLUGIN-NOW]** one-time DOM patch · **[PLUGIN-OBSERVER]** needs `MutationObserver` because Obsidian re-renders/re-creates the node · **[CORE-ONLY]** not achievable from a plugin.

### C-01 — Ribbon `<div>` not a button → not operable
- **[PLUGIN-OBSERVER]** Ribbon items are created/destroyed as plugins register actions, so observe `.side-dock-ribbon .side-dock-actions`. For each `.side-dock-ribbon-action` (and any `.clickable-icon` div used as a control), patch:
  - `el.setAttribute('role','button')`
  - `el.setAttribute('tabindex','0')`
  - Add a keydown handler firing `el.click()` on `Enter`/`Space` (and `preventDefault` on `Space`). Important: respect **SC 2.5.2** — fire on `keyup`/click, not keydown-only, to mirror pointer-cancellation behavior.
- The accessible name is already present via `Mv`'s `aria-label`; do **not** overwrite it.
- Best-effort only — true semantics would require Obsidian to emit `<button>`. The role/tabindex shim is a legitimate retrofit.

### C-02 — Status bar items are bare divs
- **[PLUGIN-OBSERVER]** Observe `.status-bar`. For each `.status-bar-item` that has a click handler / `mod-clickable`, add `role="button"` + `tabindex="0"` + keyboard activation as in C-01. Non-interactive readout items (e.g. word count display) should instead get `role="status"` or be left as text — do not make passive text focusable.
- **Name:** derive from the item's text content; if icon-only, the plugin must supply an `aria-label` (see C-03). This requires per-item heuristics — **[PLUGIN-OBSERVER]** with a small mapping table keyed on child class (`sync-status-icon`, etc.).

### C-03 — Icon-only status items lack text alternative
- **[PLUGIN-OBSERVER]** When a `.status-bar-item` contains only `.status-bar-item-icon` (no text segment), set an `aria-label` on the item. Source the label from the tooltip the helper stored: Obsidian keeps it in the `yv` WeakMap, which a plugin **cannot read [CORE-ONLY]**, so fall back to mapping the lucide icon class (`lucide-book-open` → "Reading view", etc.) to a string. Maintain this map in the plugin.

### C-04 — Drawer/collapse toggle has empty name + is a div
- **[PLUGIN-OBSERVER]** Observe `.sidebar-toggle-button.mod-left` / `.mod-right`. Patch:
  - `role="button"`, `tabindex="0"`, keyboard activation (C-01 pattern).
  - Replace the empty `aria-label`: set `aria-label="Toggle left sidebar"` / `"Toggle right sidebar"`. Re-apply on mutation because `Sv`'s lazy tooltip can overwrite `aria-label` back to `""` on hover — so observe the attribute (`attributeFilter:['aria-label']`) and reassert if it becomes empty.
- The `<button>`-variant view-header toggle already has a name; only patch the empty-name `Sv` divs.

### C-05 — Toggle state not exposed
- **[PLUGIN-OBSERVER]** For every sidebar toggle (both variants), reflect state. Observe the workspace root for class changes `is-left-sidedock-open` / `is-right-sidedock-open` and set `aria-expanded="true|false"` (toggles that show/hide a region → `aria-expanded` is the correct attribute) on the corresponding toggle. This is fully achievable: the state class is in the DOM.

### C-06 — No visible focus on retrofitted controls
- **[PLUGIN-NOW]** Inject a stylesheet (one-time) that adds a `:focus-visible` ring scoped to the controls the plugin makes focusable, overriding the global `:focus{outline:none}`:
  ```css
  .side-dock-ribbon-action:focus-visible,
  .status-bar-item[tabindex]:focus-visible,
  .sidebar-toggle-button:focus-visible,
  .clickable-icon:focus-visible {
    outline: 2px solid var(--background-modifier-border-focus, #4080ff);
    outline-offset: 2px;
    box-shadow: 0 0 0 3px var(--background-modifier-border-focus);
  }
  ```
  One injected `<style>` survives re-renders, so PLUGIN-NOW (not observer). Verify contrast of the ring meets **SC 1.4.11 (3:1)** against adjacent chrome backgrounds.

### C-07 — Decorative icon SVGs not hidden
- **[PLUGIN-OBSERVER]** When the parent control has an `aria-label`, mark the inner `svg.svg-icon` `aria-hidden="true"` to prevent double/garbled announcement. Observe because icons are re-created by `tv()` on state change. Skip this when the SVG is the **only** name source (then prefer C-03 labeling instead).

### C-08 — View-actions (mostly fine)
- **No action required** for keyboard focus/name — `addAction` produces real `<button>` + `Mv` name + `button:focus-visible` ring.
- **[PLUGIN-NOW]** Optional: the global `:focus{outline:none}` (app.css:3218) removes focus for any control relying on plain `:focus`. The injected stylesheet from C-06 covers this. **[CORE-ONLY]** to remove the offending global rule itself; the plugin should override per-selector rather than try to delete it.

### Cannot be fixed from a plugin (summary)
- **[CORE-ONLY]** Making ribbon/status/drawer controls *natively* `<button>` elements (only DOM-shim possible).
- **[CORE-ONLY]** Reading the `yv` tooltip WeakMap to recover the intended name of `Sv`-built controls (plugin must re-derive labels).
- **[CORE-ONLY]** Removing the global `:focus { outline:none }` declaration (can only be overridden, not deleted).

---

## 3. Highest-impact 5

1. **C-01 Ribbon icons are non-focusable `<div>`s** — the primary left-nav of the app is invisible to keyboard and switch users. Shim `role=button`+`tabindex`+keyboard activation via observer. (2.1.1, 4.1.2)
2. **C-02 Status bar items are bare `<div>`s** — no role, no tabindex, no name; clickable status controls unreachable by keyboard. (2.1.1, 1.3.1, 4.1.2)
3. **C-04 Drawer/collapse sidebar toggles ship `aria-label=""`** (built via `Sv`) and are divs — empty name + not operable; reassert label on attribute mutation. (4.1.2)
4. **C-06/global `:focus{outline:none}`** — once controls are made focusable, there is no visible focus anywhere on chrome. One injected stylesheet fixes all retrofitted controls. (2.4.7)
5. **C-05 Sidebar toggle state never exposed** — mirror `is-…-sidedock-open` classes into `aria-expanded`; cheap, fully plugin-doable, high SR value. (4.1.2)

---

## Notes for the plugin author
- Reassert patched attributes on `attributeFilter:['aria-label','class']` — Obsidian's lazy tooltip (`Sv`/`yv`) and `tv()` icon re-render will clobber your changes.
- Do **not** add `aria-label` to controls that already have one via `Mv` (view-actions, view-header toggle, ribbon name) — you'll cause double-labeling.
- Keyboard activation must fire on key**up**/click (SC 2.5.2 pointer-cancellation parity), never keydown-only.
