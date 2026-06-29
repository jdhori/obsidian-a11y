# Audit 05 — Visual & Dynamic Accessibility: Focus, Contrast, Motion, Reflow, Live Regions

**Target:** Obsidian 1.12.7 desktop (Electron / Chromium)
**Scope:** SC 1.4.3, 1.4.4, 1.4.10, 1.4.11, 1.4.12, 2.3.3, 2.4.7, 4.1.3 (A/AA = failures). WCAG 2.2 items (2.4.11 Focus Appearance) flagged RECOMMENDED only.
**Method:** Direct read of `/tmp/obs-extract/app.css` (600 KB) + `app.js` (3.6 MB minified) + `index.html`. Contrast ratios computed from the default theme tokens with the WCAG relative-luminance formula. Default vault state: `<body class="theme-dark">`, accent `hsl(258, 88%, 66%)`.

> **Conformance policy reminder:** Default target is WCAG 2.1 A/AA. Items below marked **FAIL** are A/AA failures. 2.2 criteria are recommendations.

---

## Measured token values (default themes)

Semantic tokens (`--text-normal/muted/faint`, `--background-*`) are defined once in the shared block (app.css lines 2824–2845) and inherited by both themes; each theme only swaps the `--color-base-*` ramp (light 2887–2898, dark 2934–2945) and accent (2900–2902 / 2947–2949).

| Token pair | Dark theme | Light theme | Needs | Verdict |
|---|---|---|---|---|
| `--text-normal` on `--background-primary` | `#dadada`/`#1e1e1e` = **11.93:1** | `#222`/`#fff` = **15.91:1** | 4.5:1 | PASS |
| `--text-muted` on `--background-primary` | `#b3b3b3`/`#1e1e1e` = **7.95:1** | `#5c5c5c`/`#fff` = **6.69:1** | 4.5:1 | PASS |
| `--text-muted` on `--background-secondary` | = **7.22:1** | = **6.19:1** | 4.5:1 | PASS |
| `--text-faint` on `--background-primary` | `#666`/`#1e1e1e` = **2.90:1** | `#ababab`/`#fff` = **2.30:1** | 4.5:1 | **FAIL** |
| `--text-faint` on `--background-secondary` | = **2.64:1** | = **2.12:1** | 4.5:1 | **FAIL** |
| `--link-color`/`--text-accent` on bg-primary | `#a68af9` = **6.05:1** | `#9873f7` = **3.43:1** | 4.5:1 | **FAIL (light)** |
| `--text-on-accent` (white) on `--interactive-accent` (button) | `#8a5cf5` = **4.26:1** | `#9873f7` = **3.43:1** | 4.5:1 (text) / 3:1 (large) | **FAIL (light, small text); borderline dark** |
| `--background-modifier-border` (UI border) on bg-primary | `#363636` = **1.38:1** | `#e0e0e0` = **1.32:1** | 3:1 | **FAIL** |
| `--background-modifier-border-focus` (focus ring) on bg-primary | `#555` = **2.24:1** | `#bdbdbd` = **1.88:1** | 3:1 | **FAIL** |

---

## 1. Findings table

| ID | SC | Severity | Element / Selector or Token | Evidence | What's wrong |
|---|---|---|---|---|---|
| F-01 | 2.4.7 | **Critical** | Global `:focus { outline: none; }` (app.css:3219) | Single rule strips the UA outline from **every** focusable element | The app relies on per-component `:focus-visible` box-shadows to restore focus — but those exist only for form controls/buttons/dropdowns. Everything without a replacement is left with NO visible focus. |
| F-02 | 2.4.7 | **Critical** | Nav/tree/tab/icon items: `.nav-file-title`, `.nav-folder-title`, `.tree-item-self`, `.workspace-tab-header`, `.clickable-icon`, `.view-action`, `.menu-item`, `.suggestion-item` | Grep: **zero** `:focus-visible` rules for any of these selectors; only `.is-active`/`body.is-focused` state styling (app.css:6135–6143) which is selection-state, not keyboard focus | Primary keyboard-navigable surfaces (file explorer, tab strip, ribbon icons, context menus, command palette items) have no keyboard focus indicator. A keyboard or switch user cannot see where focus is. |
| F-03 | 2.4.7 / 1.4.11 | **Serious** | `--background-modifier-border-focus` = `--color-base-40` | Dark `#555` on `#1e1e1e` = **2.24:1**; light `#bdbdbd` on `#fff` = **1.88:1** | Even where a focus ring IS drawn (buttons line 6676, inputs 7679, dropdowns 7096), the ring color fails the 3:1 non-text contrast minimum against the adjacent background. The indicator is effectively invisible. |
| F-04 | 1.4.3 | **Serious** | `--text-faint` (`--color-base-50`) | Dark 2.90:1 / 2.64:1; light 2.30:1 / 2.12:1 | Faint text fails normal-text 4.5:1 in both themes on both backgrounds. Used for metadata, word counts, timestamps, placeholder-like hints, inactive line numbers. |
| F-05 | 1.4.3 | **Serious** | `--link-color` / `--text-accent` (light theme) | `#9873f7` on `#fff` = **3.43:1** | Internal/external links in the default **light** theme fail 4.5:1 for normal text. Dark theme passes (6.05:1). |
| F-06 | 1.4.3 | **Serious** | `--text-on-accent` white on `--interactive-accent` (CTA buttons, `.mod-cta`) | Light **3.43:1**; dark **4.26:1** | White label on the accent-colored primary button fails 4.5:1 in light theme (passes only the 3:1 large-text bar). Dark is a marginal pass for small text. |
| F-07 | 1.4.11 | **Serious** | `--background-modifier-border` (`--color-base-30`) | Dark 1.38:1, light 1.32:1 | Default UI component borders (input outlines, dividers, table grid, card edges) are far below 3:1. Boundaries of interactive controls are not perceivable. |
| F-08 | 2.3.3 / 2.2-reduced-motion | **Serious** | App-wide animations/transitions | `prefers-reduced-motion` appears **once** (app.css:15972) and disables only `.sync-status-icon.mod-spin`. App has 13 `@keyframes`, 26 `animation:`, 59 `transition:` declarations | Reduced-motion preference is effectively ignored. Animations that still run: `slideIn`, `pop-down`, `pop-right`, `node-inserted`, `multi-select-highlight`, `progress-bar`, `rotation`, `blink`, `increase`/`decrease`, plus all 59 transitions (menu/popover/tab/link opacity & transform). |
| F-09 | 4.1.3 | **Critical** | Notice / toast system | `app.js`: `createDiv("notice-container") … r.createDiv("notice") … createDiv({cls:"notice-message", text:e})` — **no** `aria-live`, **no** `role="alert"/"status"` | Every Notice/toast (save errors, sync messages, plugin alerts, "Copied", command results) is announced to NO assistive tech. The container is a plain styled div with a click-to-dismiss handler only. |
| F-10 | 4.1.3 | **Serious** | Search / backlink / count flairs | Counts rendered into `.tree-item-flair` spans (`searchResultsCountEl`, `backlinkCountEl`, `unlinkedCountEl`) with no live region | Global-search result counts and backlink counts update silently. Screen reader users get no notification that results changed. |
| F-11 | 1.4.4 / 1.4.10 | **Serious** | `index.html:5` viewport meta | `maximum-scale=1.0, user-scalable=no` | Browser/OS zoom & pinch-zoom of the rendered content are disabled at the document level. Users relying on UA text-zoom or pinch to reach 200% are blocked. (Partially mitigated by Obsidian's own app zoom — see note.) |
| F-12 | 1.4.4 / 1.4.12 | **Moderate** | UI font tokens `--font-ui-smaller:12px`, `--font-ui-small:13px`, `--font-ui-medium:15px` (app.css:2246–2248); body `font-size:15px` (221); assorted `10px/11px` UI sizes | px-locked UI typography | UI text is sized in absolute px and does not respond to the UA root-font-size / browser text-zoom setting; only the app's own zoom scales it. Custom text-spacing (1.4.12) cannot be applied without truncation/overlap risk because many UI rows are fixed-height in px. |

> **Note on F-11/F-12:** Obsidian ships an internal zoom (`setZoom`, Ctrl/Cmd +/−, 14 references in app.js) that scales the entire UI and reflows the editor. This means content CAN reach ~200%+ via the app, which substantially mitigates the *practical* 1.4.4/1.4.10 impact. However, the hostile viewport meta still **fails by the letter** of 1.4.4 (it removes a standard user mechanism) and breaks users who expect OS/browser zoom. Removing `maximum-scale`/`user-scalable` is harmless on desktop and recommended.

---

## 2. Remediation

Tagging: **[PLUGIN-NOW]** = injectable CSS or a plugin-owned DOM node, fully fixable today; **[PLUGIN-OBSERVER]** = needs a MutationObserver to patch nodes the core creates; **[CORE-ONLY]** = requires an Obsidian source change.

### F-01 / F-02 — Global focus visibility — **[PLUGIN-NOW]**
Inject a stylesheet that re-asserts a high-contrast focus ring on all focusable surfaces using `:focus-visible` (so mouse clicks stay quiet, keyboard focus shows). This overrides the global `outline:none` because `:focus-visible` is more specific than `:focus` and we add `!important` to win against component box-shadows where needed.

### F-03 — Focus-ring contrast — **[PLUGIN-NOW]**
Do not reuse `--background-modifier-border-focus`. Use a dedicated, theme-aware high-contrast color (white ring on dark, near-black on light) plus a contrasting outer offset so the ring is visible over any surface.

### F-04 / F-05 / F-06 / F-07 — Contrast token overrides — **[PLUGIN-NOW]**
Re-map the failing tokens to compliant values via injected CSS. These are CSS variables, so a single override block fixes every consumer.

### F-08 — Reduced motion — **[PLUGIN-NOW]**
Inject a comprehensive `prefers-reduced-motion: reduce` block that neutralizes animations and transitions app-wide.

### F-09 / F-10 — Status messages — **[PLUGIN-OBSERVER]** (+ a **[PLUGIN-NOW]** mirror region)
The plugin owns a single visually-hidden `aria-live` region appended to `document.body`, then uses the public `Notice` patch / a MutationObserver on `.notice-container` to mirror each new `.notice-message` text into the live region. Search/backlink counts: observe `.tree-item-flair` text changes in the search view and announce a debounced "N results". A core fix (adding `role="alert"` to the notice container) would be cleaner but is **[CORE-ONLY]**.

### F-11 — Viewport meta — **[PLUGIN-OBSERVER]** / **[CORE-ONLY]**
A plugin can rewrite the `<meta name="viewport">` content at load (remove `maximum-scale`/`user-scalable`) by querying and patching the existing tag. Cleanest fix is **[CORE-ONLY]** in `index.html`.

### F-12 — px-locked UI font — **[PLUGIN-NOW]** (partial)
A plugin can redefine `--font-ui-*` tokens as `rem`/`em` or `calc()` so they respond to a user-set root size, and relax fixed `height` on key rows to `min-height`. Full responsiveness is **[CORE-ONLY]** because many heights are hard-coded.

---

### Ready-to-use injected CSS — high-contrast focus ring (fixes F-01, F-02, F-03)

```css
/* a11y-plugin: restore visible keyboard focus app-wide.
   :focus-visible beats the global :focus{outline:none} and keeps mouse clicks quiet. */
:where(
  a, button, input, textarea, select, summary,
  [tabindex], [contenteditable="true"],
  .clickable-icon, .nav-file-title, .nav-folder-title,
  .tree-item-self, .workspace-tab-header, .view-action,
  .menu-item, .suggestion-item, .setting-item-control *,
  .checkbox-container, .dropdown, .combobox-button
):focus-visible {
  outline: 3px solid var(--a11y-focus-ring) !important;
  outline-offset: 2px !important;
  /* offset halo guarantees ≥3:1 against ANY surface, light or dark */
  box-shadow: 0 0 0 5px var(--a11y-focus-halo) !important;
  border-radius: 4px;
}

/* Theme-aware ring colors that always clear 3:1 (SC 1.4.11) */
.theme-dark  { --a11y-focus-ring: #ffffff; --a11y-focus-halo: #1a73ff; }
.theme-light { --a11y-focus-ring: #1a1a1a; --a11y-focus-halo: #1a73ff; }

@media (forced-colors: active) {
  :where(a, button, input, [tabindex]):focus-visible {
    outline: 3px solid Highlight !important;
  }
}
```

### Ready-to-use injected CSS — contrast token overrides (fixes F-04..F-07)

```css
/* a11y-plugin: re-map failing default-theme tokens to AA-compliant values */
.theme-dark {
  --text-faint: #8e8e8e;                 /* was #666 (2.9:1) -> ~4.6:1 on bg-primary */
  --background-modifier-border: #5a5a5a; /* was #363636 (1.4:1) -> ~3:1 */
}
.theme-light {
  --text-faint: #6d6d6d;                 /* was #ababab (2.3:1) -> ~5:1 */
  --background-modifier-border: #949494; /* was #e0e0e0 (1.3:1) -> ~3:1 */
  --link-color: #5a32d6;                 /* was #9873f7 (3.4:1) -> ~4.6:1 */
  --text-accent: #5a32d6;
}
/* Primary-button label: ensure ≥4.5:1 in light theme (F-06).
   Darken the accent fill rather than the white label. */
.theme-light .mod-cta,
.theme-light button.mod-cta {
  background-color: #5a32d6 !important;  /* white on #5a32d6 ≈ 4.6:1 */
}
```

### Ready-to-use injected CSS — reduced-motion override (fixes F-08)

```css
/* a11y-plugin: honor prefers-reduced-motion app-wide */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  /* kill indefinite/attention-seeking loops explicitly */
  .sync-status-icon.mod-spin svg,
  [class*="spin"], [class*="rotation"],
  .cm-cursor, /* blink */
  .progress-bar-message,
  .multi-select-highlight {
    animation: none !important;
  }
}
```

### Live-region pattern (fixes F-09 / F-10) — **[PLUGIN-NOW]** region + **[PLUGIN-OBSERVER]** mirror

```js
// Plugin owns ONE polite live region.
const live = document.body.createDiv({ cls: "a11y-live-region", attr: {
  "aria-live": "polite", "role": "status", "aria-atomic": "true"
}});
// visually hidden via injected CSS (.a11y-live-region { position:absolute;
// width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%); })

// Mirror new notices into it.
const announce = (msg) => { live.textContent = ""; requestAnimationFrame(() => live.textContent = msg); };
const obs = new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType === 1 && n.matches?.(".notice")) {
      announce(n.querySelector(".notice-message")?.textContent ?? n.textContent);
    }
  }
});
// .notice-container is created lazily; observe body and attach when it appears.
obs.observe(document.body, { childList: true, subtree: true });
```

---

## 3. Highest-impact 5

1. **F-01 + F-02 — No keyboard focus indicator on nav/tree/tab/icon/menu items.** The single global `:focus{outline:none}` plus missing `:focus-visible` for every navigation surface is the most damaging finding: a keyboard or switch user is blind to focus location across the whole shell. Fully **[PLUGIN-NOW]** fixable with the focus-ring block above.
2. **F-09 — Notices/toasts are silent to screen readers.** No `aria-live`/`role` on the notice system means every error, confirmation, and sync message is invisible to AT. High user impact, **[PLUGIN-OBSERVER]** fixable.
3. **F-03 + F-07 — Focus rings and UI borders fail 1.4.11 (≈1.3–2.2:1).** Even existing focus styling and all control borders are imperceptible to low-vision users. **[PLUGIN-NOW]**.
4. **F-08 — `prefers-reduced-motion` ignored app-wide** (1 of 26 animations honored). Vestibular-disorder users get unmitigated slide/pop/spin/blink motion. **[PLUGIN-NOW]**.
5. **F-04 + F-05 + F-06 — Text-contrast failures: `--text-faint` (both themes), light-theme links, and light-theme CTA button labels.** Direct 1.4.3 failures on commonly-seen text. **[PLUGIN-NOW]** token overrides.

---

*All file paths absolute. Source of truth: `/tmp/obs-extract/app.css`, `/tmp/obs-extract/app.js`, `/tmp/obs-extract/index.html`. Contrast computed via WCAG relative-luminance; verify final override hex values with an automated token-contrast check in CI before shipping.*
