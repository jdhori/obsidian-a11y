# Obsidian Accessibility Audit — Consolidated Summary

**Target:** Obsidian 1.12.7 desktop (Electron / Chromium renderer)
**Standard:** WCAG 2.1 Level A and AA (failures). WCAG 2.2 criteria noted as *recommendations*.
**Method:** 5 parallel `a11y-architect` agents auditing the extracted renderer
(`obsidian.asar` → `app.js` 3.6 MB minified, `app.css` 588 KB). Findings are
code-cited. Per-surface detail lives in `docs/audit/01..05`.

## The one root cause

Obsidian builds its UI from **`<div>`s with click handlers**. There is almost no
ARIA, almost no native interactive elements, and **state is carried by CSS classes
only** (`mod-active`, `is-enabled`, `is-selected`, `is-collapsed`,
`is-left-sidedock-open`). The consequences:

- **Keyboard:** many controls cannot be reached or operated (no `tabindex`, no key handler).
- **Screen reader:** controls have no role, no name, and no state. The app is largely opaque to AT.
- **Low vision:** a global `:focus { outline: none }` (`app.css:3219`) hides keyboard focus across the shell; default-theme contrast fails in several tokens.

### Baseline grep (whole bundle)

| Token | Count | Token | Count |
|---|---|---|---|
| `role=` | 0 | `aria-label` | 25 |
| `aria-labelledby` | 0 | `createEl("button"` | 115 |
| `aria-describedby` | 0 | `setTooltip` | 44 |
| `aria-modal` | 0 | `aria-live` | 2 |
| `aria-pressed`/`current` | 0 | `outline:none` | 18 |
| `aria-expanded` | 1 | `prefers-reduced-motion` | 1 |

> **Premise correction from the audit:** `setTooltip` *does* set a real `aria-label`
> (internal helper `Mv`). A *second* helper (`Sv`) sets `aria-label=""` and stashes the
> text in a JS `WeakMap`. So some controls (view-actions, tab close) are named; ribbon
> and sidebar-toggle controls are not.

## Top findings by surface

| # | Surface | Worst issues | SC |
|---|---|---|---|
| 01 | Chrome (ribbon, sidebar toggles, view headers, status bar) | Ribbon & status-bar items are non-focusable divs; sidebar toggle state not exposed | 2.1.1, 4.1.2 |
| 02 | Tabs & file tree | No `tablist`/`tab`, no `tree`/`treeitem`; active/collapsed state is class-only; collapse arrows unlabeled | 1.3.1, 4.1.2 |
| 03 | Modals, command palette, settings nav, menus | **Settings nav is click-only divs (keyboard cannot change settings section)**; no `dialog`/`combobox`/`listbox`; focus not trapped or restored | 2.1.1, 2.4.3, 4.1.2 |
| 04 | Forms / Setting controls | Names not associated with controls; toggle never sets `aria-checked` and has no key handler | 1.3.1, 2.1.1, 4.1.2 |
| 05 | Visual & dynamic | No focus indicator on nav/tree/tabs; contrast failures; reduced-motion ignored; **Notices silent (no `aria-live`)** | 2.4.7, 1.4.3, 1.4.11, 2.3.3, 4.1.3 |

## Remediation feasibility (drives the plugin design)

- **[PLUGIN-NOW]** — injected CSS: focus-visible rings for every interactive surface,
  contrast token overrides, app-wide `prefers-reduced-motion` honoring, a visually-hidden
  live region. Applied once.
- **[PLUGIN-OBSERVER]** — the bulk: roles, names, states, keyboard operability. Must run
  under a debounced `MutationObserver` because Obsidian re-renders/recycles these nodes
  (tab strip, InfinityScroll file tree, per-invocation modals & suggestions).
- **[CORE-ONLY]** — cannot be done well from a plugin; file upstream: making the modal
  close button a native `<button>`, replacing the blur-based focus containment, native
  focus restoration, and the hostile viewport meta (`maximum-scale=1.0, user-scalable=no`).

## Prioritized fix plan (what the plugin ships)

**P0 — keyboard unblocking + focus visibility (the "can't use it at all" tier)**
1. Make div-buttons operable: `role`, `tabindex`, Enter/Space → activate (Space on keyup for SC 2.5.2). Targets: ribbon, status-bar clickables, **settings nav**, modal close, search clear.
2. Inject focus-visible rings for every interactive surface (overrides `outline:none`).

**P1 — names & states (screen-reader legibility)**
3. Tabs → `tablist`/`tab` + `aria-selected` + roving arrows.
4. File tree → `tree`/`treeitem`/`group` + `aria-expanded`/`aria-level`/`aria-selected`, hide decorative icons.
5. Settings controls → associate name/description via `aria-labelledby`/`aria-describedby`; toggle → `role="switch"` + `aria-checked` mirror + key handler.
6. Modals → `role="dialog"` + `aria-modal` + `aria-labelledby`; focus trap + restore.
7. Command palette / quick switcher → `combobox` + `listbox`/`option` + `aria-activedescendant`.

**P2 — dynamic + visual polish**
8. Mirror Notices into an owned `aria-live` region (4.1.3).
9. Optional contrast-boost token overrides; app-wide reduced-motion override.

**Upstream (CORE-ONLY):** open issues / PRs against Obsidian for the items a plugin can only paper over.

See [README](../README.md) for how these map to plugin modules.
