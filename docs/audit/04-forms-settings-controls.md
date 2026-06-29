# Audit 04 — Form Controls: Obsidian Setting Components

**Target:** Obsidian 1.12.7 desktop (Electron/Chromium)
**Scope:** `Setting` rows and their controls (toggles, dropdowns, sliders, text/search inputs) used in settings panels and plugin UIs.
**Conformance target:** WCAG 2.1 Level A & AA (failures). WCAG 2.2 noted as RECOMMENDED.
**Method:** Static analysis of minified `/tmp/obs-extract/app.js` (3.6 MB) and `/tmp/obs-extract/app.css` (588 KB). Byte-offset extraction of the component factory classes; cross-check against `app.css`.

---

## Source map (minified identifiers → public API)

The `Setting` class (`zk` @ byte 1164783) builds every settings row. Its `controlEl` is populated by component classes:

| Public method | Class | Element produced |
|---|---|---|
| `addButton` | `Wk` @ 1168630 | `<button>` |
| `addExtraButton` | `_k` @ 1169917 | clickable `<div>` icon |
| `addToggle` | `Gk` @ 1170535 | `<label class="checkbox-container" tabindex=0>` > `<input type=checkbox>` |
| base input | `Kk` @ 1171635 | shared input behavior (no label wiring) |
| `addText` | `Yk` @ 1172188 | `<input type=text>` |
| `addSearch` | `Qk` @ 1172392 | `.search-input-container` > `<input type=search>` + clear `<div>` |
| `addTextArea` | `Xk` @ 1173234 | `<textarea>` |
| `addDropdown` | `Jk` @ 1174377 | `<select class="dropdown">` |
| `addSlider` | `tC` @ 1175592 | `<input type=range class="slider">` |

**Setting row construction (verbatim, byte 1164783):**
```js
var t=this.settingEl=e.createDiv("setting-item"),
    n=this.infoEl=t.createDiv("setting-item-info");
this.nameEl=n.createDiv("setting-item-name");      // plain DIV, setText only
this.descEl=n.createDiv("setting-item-description");// plain DIV, setText only
this.controlEl=t.createDiv("setting-item-control");
```
`setName`/`setDesc` call `setText` on these DIVs. **No `id`, no `for`, no `aria-labelledby`, no `aria-describedby` is ever generated** linking the name/description to the control. A scan of the entire component-factory region (bytes 1168630–1175630) returns **zero** occurrences of `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `htmlFor`, or `for`.

---

## 1. Findings table

| ID | SC | Severity | Element / Selector | Evidence | What's wrong |
|---|---|---|---|---|---|
| F-01 | 1.3.1, 4.1.2 | **Critical** | `.setting-item-name` ↔ `.setting-item-control *` | `nameEl`/`descEl` are plain `createDiv`; no id/for/labelledby generated (byte 1164783; zero ARIA in factory region) | Visible name & description are **not programmatically associated** with the control. Every toggle/select/slider/input is announced with no accessible name. |
| F-02 | 4.1.2 | **Critical** | `.checkbox-container input[type=checkbox]` | Toggle `Gk` sets state via `toggleEl.toggleClass("is-enabled",e)` only; `input.checked` is **never** set; no `aria-checked` (byte 1170535). CSS state from `.is-enabled` not `:checked` (app.css 9224, 9257). | Toggle on/off state is invisible to AT. Screen reader always reads "checkbox, not checked" regardless of real value. State is CSS-class-only. |
| F-03 | 2.1.1 | **Critical** | `label.checkbox-container[tabindex=0]` | `Gk` creates focusable `<label tabindex=0>` with **no keydown handler** (0 `keydown` in class body); change listener is on the label, toggle fires from mouse click only. | Toggle is focusable but **not keyboard operable**. A bare `<label>` does not activate a wrapped checkbox via Space/Enter; only pointer click toggles. Keyboard/switch users cannot change toggles. |
| F-04 | 1.3.1, 4.1.2 | **Critical** | `.setting-item-control select.dropdown` | `Jk` = native `<select class="dropdown">`, no label/for/aria-label (byte 1174377). | Native select is keyboard-operable and has a role (good), but has **no accessible name**. Announced as unlabeled combobox. |
| F-05 | 1.3.1, 4.1.2 | **Critical** | `.setting-item-control input.slider[type=range]` | `tC` = native `<input type=range>`, no name; value surfaced only via `setDynamicTooltip` `mouseenter` tooltip (byte 1175592). | Slider is keyboard-operable (native range) but has **no accessible name**. Where the numeric value is non-obvious, **no `aria-valuetext`** — the human-readable value (`getValuePretty`) is mouse-hover-only, hidden from AT. |
| F-06 | 1.3.1, 4.1.2 | **Critical** | `.setting-item-control input[type=text]`, `textarea` | `Yk`/`Xk` create bare inputs; base class `Kk` only wires value/placeholder, no label (byte 1172188, 1171635). | Text/textarea inputs have **no accessible name**. Placeholder (when set) is not a substitute for a label (1.3.1 / 3.3.2). |
| F-07 | 1.3.1, 4.1.2, 3.3.2 | **High** | `.search-input-container input[type=search]` | `Qk` builds `<input type=search>` with no label and no associated visible name (byte 1172392). | Search input has **no accessible name** and no programmatic label. |
| F-08 | 4.1.2, 2.1.1 | **High** | `.search-input-clear-button` | `Qk`: clear button is a `<div>` with `mousedown`/`click` only — no `role`, no `aria-label`, not focusable (byte 1172392). | "Clear" control is an unlabeled, non-focusable `<div>`: invisible to AT and unreachable by keyboard. |
| F-09 | 4.1.2, 2.1.1 | **High** | `.setting-item-control > div` (`addExtraButton`, `_k`) | `_k` produces a clickable icon `<div>`, not a `<button>` (byte 1169917). | Icon "extra buttons" (common in plugin settings) are non-semantic clickable DIVs unless the icon's tooltip is wired — typically no role/name/keyboard. |
| F-10 | 3.3.1, 3.3.3 | **High** | (whole `Setting` API) | No validation/error API exists on `Setting`; `setDesc` is the only text channel and is not an `aria-describedby` error region. | **No error identification or suggestion mechanism.** Invalid input in settings/plugin forms is not programmatically announced (no `aria-invalid`, no `aria-errormessage`, no live region). |
| F-11 | 2.4.6 | Medium | `.setting-item-heading` | `setHeading` adds `setting-item-heading` class to a `<div>`; not a real heading element/`role=heading` (byte 1165300). | Setting group headings are styled DIVs, not headings — they do not appear in the AT heading list, weakening labeling/navigation of grouped controls. |
| F-12 | 2.5.8 (2.2) | RECOMMENDED | `.search-input-clear-button`, small toggles `.mod-small` | Clear button and small toggles render below 24×24 CSS px in dense panels. | Target size below 24×24 — WCAG 2.2 recommendation, not a 2.1 failure. |
| F-13 | 3.3.7 (2.2) | RECOMMENDED | settings/onboarding flows | No redundant-entry mitigation API. | Redundant entry — WCAG 2.2 recommendation only. |

> **Net effect:** Because association (F-01) is missing at the `Setting` base, *every* control type inherits "no accessible name." Combined with F-02/F-03, the toggle — Obsidian's single most common settings control — is effectively unusable by screen-reader and keyboard-only users.

---

## 2. Remediation

Tagging:
- **[PLUGIN-NOW]** — fixable at plugin load by walking the DOM of already-rendered setting panels.
- **[PLUGIN-OBSERVER]** — requires a `MutationObserver` because settings tabs / plugin UIs render lazily and re-render on tab switch.
- **[CORE-ONLY]** — cannot be reliably patched from a plugin; needs Obsidian source change (file upstream).

A plugin can patch all of these because the markup is deterministic and stable across rebuilds (class names verified above). Settings panels are destroyed/recreated on every tab open, so a `MutationObserver` on the settings modal (`.modal-container`, `.vertical-tab-content`) plus the workspace is required for durability.

### F-01 Name/description association — [PLUGIN-OBSERVER]
For each `.setting-item` that contains exactly one focusable control, link them. Prefer **`aria-labelledby`** (keeps Obsidian's visible DIV as the label source; survives re-render better than synthesizing `<label for>` because we don't control DOM order/IDs upstream):

```js
function patchSettingRow(row) {
  const control = row.querySelector(
    '.setting-item-control input, .setting-item-control select, ' +
    '.setting-item-control textarea, .setting-item-control .checkbox-container'
  );
  if (!control) return;
  const name = row.querySelector('.setting-item-name');
  const desc = row.querySelector('.setting-item-description');
  if (name && name.textContent.trim()) {
    name.id ||= 'a11y-name-' + crypto.randomUUID();
    control.setAttribute('aria-labelledby', name.id);
  }
  if (desc && desc.textContent.trim()) {
    desc.id ||= 'a11y-desc-' + crypto.randomUUID();
    control.setAttribute('aria-describedby', desc.id);
  }
}
```
Use `aria-labelledby` (not `<label for>`) because (a) the visible name is a `<div>`, not a `<label>`, and we should not restructure Obsidian's DOM; (b) the toggle's real control is a hidden `<input>` inside a `<label>` — pointing `for` at it is fragile. `aria-labelledby` on the input/select/range works regardless.

### F-02 Toggle has no `aria-checked` / state not exposed — [PLUGIN-OBSERVER]
Two options. Cleanest: promote the **container** to `role="switch"` and keep its state synced, since the visual truth lives on `.is-enabled`:

```js
function patchToggle(label) { // label = .checkbox-container
  label.setAttribute('role', 'switch');
  const sync = () => label.setAttribute('aria-checked',
    String(label.classList.contains('is-enabled')));
  sync();
  // .is-enabled flips via toggleClass on change; observe attribute changes
  new MutationObserver(sync).observe(label,
    { attributes: true, attributeFilter: ['class'] });
}
```
Alternatively keep the inner `<input type=checkbox>` and set `input.checked` in the observer — but the container approach is more robust because `.is-enabled` is the single source of truth and the inner input is `opacity:0`/offscreen.

### F-03 Toggle not keyboard operable — [PLUGIN-OBSERVER]
Add a keydown handler that activates the existing click path:

```js
label.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    label.click();           // existing change listener toggles state
  }
});
```
`label.click()` triggers the change handler Obsidian already attached (`addEventListener("change", n.onClick…)` via the wrapped input). Pair with F-02's `role=switch` so AT announces the result.

### F-04 Dropdown unlabeled — [PLUGIN-OBSERVER]
Covered by F-01 (`aria-labelledby`). No further work; native `<select>` already has role + keyboard.

### F-05 Slider unlabeled + no `aria-valuetext` — [PLUGIN-OBSERVER]
F-01 supplies the name. Add human-readable value text mirroring `getValuePretty`:

```js
function patchSlider(range) { // input.slider[type=range]
  const sync = () => {
    const v = range.valueAsNumber;
    const step = range.step;
    const pretty = (step === 'any' || parseFloat(step) < 1)
      ? v.toFixed(2) : String(v);
    range.setAttribute('aria-valuetext', pretty);
  };
  sync();
  range.addEventListener('input', sync);
  range.addEventListener('change', sync);
}
```
Only emit `aria-valuetext` where the value is non-obvious (formatted units, percentages). For a plain integer range, `aria-valuenow` (native) already suffices — skip to avoid double announcement.

### F-06 / F-07 Text, textarea, search inputs unlabeled — [PLUGIN-OBSERVER]
Covered by F-01. For rows with no `.setting-item-name` (e.g., standalone search bars outside a `setting-item`), fall back to the placeholder or a tooltip as `aria-label`:

```js
if (!control.hasAttribute('aria-labelledby') && !control.getAttribute('aria-label')) {
  const ph = control.getAttribute('placeholder');
  if (ph) control.setAttribute('aria-label', ph);
}
```

### F-08 Search clear button is an unlabeled, non-focusable div — [PLUGIN-OBSERVER]
```js
function patchClear(div) { // .search-input-clear-button
  div.setAttribute('role', 'button');
  div.setAttribute('aria-label', 'Clear search');
  div.tabIndex = 0;
  div.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); div.click(); }
  });
}
```
Note: Obsidian preventDefaults `mousedown` and handles `click`; `div.click()` reuses that path.

### F-09 ExtraButton icon divs — [PLUGIN-OBSERVER]
Where `.setting-item-control > div[class*=clickable]` / extra-button icons appear, add `role=button`, `tabindex=0`, keydown→click, and derive `aria-label` from the element's tooltip (`aria-label`/`data-tooltip`/title set by Obsidian's `setTooltip`, if present). If no tooltip exists, this is best-effort only.

### F-10 No error identification / suggestion — [CORE-ONLY] (plugin-mitigable per-plugin)
There is no validation channel on the `Setting` API, so generic patching cannot detect "invalid." This is **CORE-ONLY** for Obsidian's own settings. **Plugin authors** building their own settings can mitigate by adding an `aria-describedby` error region with `aria-invalid` and `role=alert` on their own controls (provide a helper). File upstream for a first-class `Setting.setError()`/`setValidation()` API.

### F-11 Setting headings not real headings — [PLUGIN-OBSERVER]
```js
el.querySelectorAll('.setting-item-heading .setting-item-name')
  .forEach(h => { h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '3'); });
```

### F-12 / F-13 — [CORE-ONLY] (2.2 recommendations)
Target size and redundant entry are layout/flow concerns better addressed upstream; flag as recommendations, do not block.

### Observer wiring (applies to all PLUGIN-OBSERVER fixes)
```js
const apply = (root) => {
  root.querySelectorAll('.setting-item').forEach(patchSettingRow);
  root.querySelectorAll('.checkbox-container').forEach(el => { patchToggle(el); /* +keydown */ });
  root.querySelectorAll('input.slider[type=range]').forEach(patchSlider);
  root.querySelectorAll('.search-input-clear-button').forEach(patchClear);
};
const mo = new MutationObserver(muts => muts.forEach(m =>
  m.addedNodes.forEach(n => n.nodeType === 1 && apply(n))));
mo.observe(document.body, { childList: true, subtree: true });
apply(document.body); // catch already-open panels
```
Make each patch idempotent (guard on a `data-a11y-patched` flag) since panels re-render frequently.

---

## 3. Highest-impact 5

1. **F-03 — Make toggles keyboard operable** (`keydown`→`click` on `.checkbox-container`). Toggles are the most common settings control; today they cannot be changed by keyboard/switch users at all. [PLUGIN-OBSERVER]
2. **F-02 — Expose toggle state** (`role=switch` + synced `aria-checked` from `.is-enabled`). Without this, AT reports the wrong state for every toggle. [PLUGIN-OBSERVER]
3. **F-01 — Associate name/description with control** (`aria-labelledby`/`aria-describedby`). Single fix that gives an accessible name to every toggle, select, slider, and input across all settings and plugin panels. [PLUGIN-OBSERVER]
4. **F-08 — Fix the search clear button** (`role=button` + `aria-label` + focusable + keydown). Restores a keyboard-/AT-reachable clear action used throughout search and plugin UIs. [PLUGIN-OBSERVER]
5. **F-05 — Slider accessible value** (`aria-valuetext` mirroring `getValuePretty`). Surfaces the formatted value that is otherwise mouse-hover-only. [PLUGIN-OBSERVER]

All five are PLUGIN-OBSERVER — fully achievable from a community plugin with a MutationObserver, no source change required.
