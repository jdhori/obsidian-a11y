# Audit 03 — Overlays: Modals, Settings, Command Palette, Quick Switcher, Suggest, Menus

**Target:** Obsidian 1.12.7 desktop (Electron/Chromium)
**Scope:** Settings window, modals/dialogs, command palette, quick switcher, suggestion popovers, context menus, settings navigation.
**Conformance target:** WCAG 2.1 Level A & AA (failures). WCAG 2.2 items flagged RECOMMENDED.
**Method:** Static grep of `/tmp/obs-extract/app.js` (3.6 MB minified) + `app.css`. Evidence cited inline. No logic tracing.
**Constraint:** Community plugin patches the live DOM at runtime; cannot modify Obsidian source.

---

## Baseline (confirmed by grep)

| Token | Count | Note |
|---|---|---|
| `aria-modal` | **0** | No modal is exposed as a modal dialog. |
| `role` (quoted assignments) | `button`×4, `listbox`×1, `option`×2, `rows`×1, `summary`×1 | The `listbox`/`option` are inside **CodeMirror** autocomplete (`x_`, `aria-haspopup":"listbox"`), NOT Obsidian's suggest. |
| `aria-activedescendant` | **3** | All 3 are **CodeMirror** (`x_` autocomplete + lint panel `this.list`). Zero in Obsidian prompt/suggest. |
| `aria-selected` | 15 | None in suggest chooser (those use `is-selected` class only — see SUG-2). |
| `aria-expanded` | 1 | Not on the prompt/combobox input. |
| `aria-live` / `polite` | 2 | Both are CodeMirror `cm-announced` and the PDF findbar. None cover palette/switcher/suggest. |

**Conclusion:** Obsidian's own overlay layer ships effectively zero dialog/listbox/combobox/menu semantics. The only ARIA found in this area belongs to bundled third-party libraries (CodeMirror, DOMPurify allowlist strings).

---

## 1. Findings table

| ID | SC | Severity | Element / Selector | Evidence (app.js / app.css) | What's wrong |
|---|---|---|---|---|---|
| **MOD-1** | 4.1.2, 1.3.1 | Critical | `.modal` (base `Modal` class) | Constructor: `this.modalEl=this.containerEl.createDiv("modal")` — no `setAttribute("role",...)`; `aria-modal` count = 0. | Modal has no `role="dialog"` and no `aria-modal="true"`. SR users are not told a dialog opened; background remains in the a11y tree. |
| **MOD-2** | 4.1.2, 1.3.1, 2.4.6 | Critical | `.modal-title` / `.modal-header` | `this.titleEl=this.headerEl.createDiv("modal-title")`; no `id` linked, no `aria-labelledby` on modalEl. | Dialog has no accessible name. SR announces nothing or "dialog" with no title. |
| **MOD-3** | 4.1.2, 2.4.4 | Critical | `.modal-close-button` | `this.modalEl.createDiv("modal-close-button mod-raised clickable-icon")` then `tv(i,"x")` (renders an SVG icon). No `aria-label`, no text. | Icon-only close button is an empty `div` (not even a `<button>`); invisible/unnamed to SR and not keyboard-focusable (no `tabindex`/role). Empty-button anti-pattern. |
| **MOD-4** | 2.1.2, 2.4.3 | Serious | `.modal-container` focus trap (`Scope.onFocusIn`) | `onFocusIn`: when focus target `!i.contains(r)` it calls `tg(i,...)` and otherwise **blurs** `activeElement`. There is no wrap-around to first/last focusable. | "Trap" works by *blurring* escapees, not by cycling focus. Shift+Tab from the first control / Tab from the last drops focus to nothing (body), so keyboard users fall out of the dialog. Not a keyboard *trap* in the 2.1.2 sense, but focus containment (2.4.3 order) is broken. |
| **MOD-5** | 2.4.3 | Serious | `Modal.close()` | `close()` restores focus only inside `shouldRestoreSelection&&function(e){if(e&&(e.focusEl||e.range))...n.focus()}` — `focusEl` is the **editor** (`cm-content`), and `shouldRestoreSelection` defaults to `!1` (false) for the base Modal. No restore-to-trigger. | Focus is not returned to the element that opened the modal. After close, focus is lost (body), breaking focus order and orientation. |
| **MOD-6** | (pass) | — | `Modal` Escape | Constructor: `this.scope.register([],"Escape",this.onEscapeKey.bind(this))`; `onEscapeKey=function(e){e.defaultPrevented||this.close()}`. | Escape **does** close modals. No defect. Recorded for completeness. |
| **PAL-1 / SUG-1** | 4.1.2, 1.3.1 | Critical | `input.prompt-input` (command palette, quick switcher, all suggest) | `inputEl=e.createEl("input",{cls:"prompt-input",type:"text",attr:{autocapitalize,spellcheck,enterkeyhint}})` — no role/aria attrs. | The search input is a plain textbox. No `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-haspopup`, or `aria-activedescendant`. SR users get no indication a results list exists or which item is active. |
| **SUG-2** | 4.1.2, 1.3.1 | Critical | `.prompt-results` / `.suggestion-container` / `.suggestion-item` (chooser `ob`) | `resultContainerEl=i.createDiv("prompt-results")`; items: `createDiv("suggestion-item")`; selection: `forceSetSelectedItem` → `o.removeClass("is-selected"); a.addClass("is-selected")`. No `role`, no `aria-selected`. | Results list has no `role="listbox"`; items have no `role="option"` and no `aria-selected`. Active option is conveyed by CSS class only. Completely invisible to SR. |
| **SUG-3** | 4.1.3 | Serious | command palette / quick switcher results | Only `aria-live` regions in app.js are CodeMirror `cm-announced` and PDF findbar; none attached to `prompt-results`. | Result count and "no results" (`suggestion-empty`) changes are not announced (no status message / live region). |
| **MENU-1** | 4.1.2, 1.3.1 | Serious | `.menu` (`createDiv("menu")`), `.menu-item` (`createDiv("menu-item tappable")`) | `i=n.dom=createDiv("menu")` — no `role="menu"`. Item: `createDiv("menu-item tappable")` with `menu-item-icon`/`menu-item-title` — no `role="menuitem"`. (The `"menuitem"` strings in app.js are DOMPurify allowlist entries, not menu DOM.) | Context/right-click and command menus have no menu semantics. SR announces nothing meaningful. |
| **MENU-2** | 2.1.1 | Serious (partial) | `.menu` keyboard + focus | Menu `scope` registers `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Enter/Escape` (global keymap scope push). But `n.dom` never gets `tabIndex` or `.focus()`. | Arrow navigation *functions* via the pushed keymap scope (good), but the menu element is never focused and exposes no roles, so SR/AT have no model of it. Borderline 2.1.1 (operable by keyboard) but fails 4.1.2 Name/Role/Value. |
| **MENU-3** | 1.3.1 | Moderate | `.menu-separator` | `createDiv("menu-separator")` | No `role="separator"`; cosmetic only. Minor. |
| **SET-1** | 2.1.1, 4.1.2 | Critical | `.vertical-tab-nav-item` (Settings left nav) | `navEl=createDiv("vertical-tab-nav-item tappable", … )` with `data-setting-id`, then only `n.addEventListener("click",function(){t.openTab(e)})`. No `tabindex`, no keydown handler, no role. | Settings navigation items are mouse-`click`-only `div`s. **Not keyboard focusable or operable** (no Tab stop, no Enter/Space). Keyboard/switch users cannot change settings sections at all. |
| **SET-2** | 1.3.1, 4.1.2 | Serious | `.vertical-tabs-container` + `.vertical-tab-nav-item` + `.vertical-tab-content` | Nav items are `div`s (SET-1); content: `containerEl=createDiv("vertical-tab-content")`. No `role="tablist"`/`tab`/`tabpanel`, no `aria-selected`, no `aria-controls`. | The tab pattern has no tab semantics. Even with a mouse, SR users get no relationship between nav and panel and no selected-state. |
| **SET-3** | 4.1.2, 1.3.1 | Critical | Settings window is a Modal | Settings uses the base `Modal` (`mod-settings`); inherits MOD-1/2/3/5. | Settings window itself is not a `dialog`, has no accessible name, unlabeled close, no focus restoration. |

---

## 2. Remediation

Tags: **[PLUGIN-NOW]** = patchable once at load; **[PLUGIN-OBSERVER]** = needs a `MutationObserver` because overlays are created/destroyed per-invocation; **[CORE-ONLY]** = cannot be done reliably from a plugin / needs Obsidian source.

### Architecture note
Every overlay in scope (modals, prompt, suggest, menu) is **created on demand and detached on close** (`attachDom`/`detachDom`, `containerEl.detach()`, `r.detach()`). A one-time querySelector at plugin load will miss them. The plugin must run a single `MutationObserver` on `document.body` (and on each popout window's `document.body` for multi-window) watching `childList`, then decorate nodes matching `.modal-container`, `.prompt`, `.suggestion-container`, `.menu`, and `.vertical-tabs-container` as they appear. Use a `WeakSet` to avoid re-decorating.

### Modals

**[PLUGIN-OBSERVER] MOD-1/2/3 — dialog semantics + name + labeled close**
On each new `.modal-container > .modal`:
```js
const modalEl = node.querySelector(':scope > .modal') ?? node;
modalEl.setAttribute('role', 'dialog');
modalEl.setAttribute('aria-modal', 'true');
const titleEl = modalEl.querySelector('.modal-title, .modal-setting-title');
if (titleEl) {
  if (!titleEl.id) titleEl.id = 'a11y-modal-title-' + crypto.randomUUID();
  modalEl.setAttribute('aria-labelledby', titleEl.id);
} else {
  modalEl.setAttribute('aria-label', 'Dialog'); // fallback; prefer titleEl
}
const close = modalEl.querySelector('.modal-close-button');
if (close) {
  close.setAttribute('role', 'button');
  close.setAttribute('aria-label', 'Close');
  if (!close.hasAttribute('tabindex')) close.tabIndex = 0;
  // close already has a click listener; add keyboard activation:
  close.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close.click(); }
  });
}
```
Caveat: `aria-modal="true"` does NOT remove background content from the AT tree in all SRs. For robustness also set `aria-hidden="true"` (or `inert`) on the app's main containers (`.workspace`, `.titlebar`, `.status-bar`) while a modal is open, and remove it on close. Track via the same observer (added/removed `.modal-container`). Be careful not to hide the modal-container itself or sibling popovers.

**[PLUGIN-OBSERVER] MOD-4 — focus containment**
Replace the blur-on-escape behavior with a real cycle. On the decorated dialog, add a `keydown` handler for `Tab`:
```js
function focusables(root){return [...root.querySelectorAll(
  'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),.modal-close-button'
)].filter(el => el.offsetParent !== null && !el.hasAttribute('disabled'));}
modalEl.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const f = focusables(modalEl); if (!f.length) return;
  const first = f[0], last = f[f.length-1];
  if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});
```
Note: Obsidian's `Scope.onFocusIn` will still fire, but since our handler keeps focus *inside* the container it won't trigger the blur path. Verify no double-handling.

**[PLUGIN-OBSERVER] MOD-5 / SET-3 — focus restoration to trigger**
The plugin can capture `document.activeElement` *before* a modal appears (the observer fires after insertion, so capture must be proactive): keep a rolling `lastFocusedBeforeOverlay` updated on every `focusin` at the document level, and snapshot it when a `.modal-container` is added. On removal of that container, if the snapshot is still connected, call `.focus()` on it. Also move initial focus into the dialog on open (first focusable, or the title if none) so SR users land inside.
```js
let lastFocused = null;
document.addEventListener('focusin', e => {
  if (!e.target.closest('.modal-container,.prompt,.suggestion-container,.menu'))
    lastFocused = e.target;
}, true);
// on container added: store trigger = lastFocused
// on container removed: if (trigger?.isConnected) trigger.focus();
```

**MOD-6 — Escape:** no change (already works).

### Command palette / Quick switcher / Suggest

**[PLUGIN-OBSERVER] PAL-1/SUG-1 — combobox on the input**
On each new `.prompt input.prompt-input` (and editor `.suggestion-container` paired input):
```js
const list = container.querySelector('.prompt-results, .suggestion');
if (!list.id) list.id = 'a11y-listbox-' + crypto.randomUUID();
input.setAttribute('role', 'combobox');
input.setAttribute('aria-expanded', 'true');   // suggest is open whenever shown
input.setAttribute('aria-controls', list.id);
input.setAttribute('aria-autocomplete', 'list');
input.setAttribute('aria-haspopup', 'listbox');
```

**[PLUGIN-OBSERVER] SUG-2 — listbox + options + active descendant**
On the results container and each `.suggestion-item`:
```js
list.setAttribute('role', 'listbox');
// per item, assign id + role:
items.forEach(it => {
  it.setAttribute('role', 'option');
  if (!it.id) it.id = 'a11y-opt-' + crypto.randomUUID();
  it.setAttribute('aria-selected', it.classList.contains('is-selected') ? 'true' : 'false');
});
```
Selection changes via `forceSetSelectedItem` only toggle `is-selected`. The observer must also watch `attributes: ['class']` (subtree) on `.prompt-results`/`.suggestion` so that when `is-selected` moves, the plugin updates `aria-selected` on both old and new items AND sets `input.setAttribute('aria-activedescendant', newItem.id)`. This is the single most important live update for SR usability of the palette.

**[PLUGIN-OBSERVER] SUG-3 — announce results / empty state**
Inject one visually-hidden `aria-live="polite"` region inside the prompt and update its text when the result count changes or `.suggestion-empty` appears:
```js
liveEl.textContent = items.length ? `${items.length} results` : 'No results';
```
Throttle updates (input fires per keystroke) to avoid SR chatter.

### Menus

**[PLUGIN-OBSERVER] MENU-1/3 — menu semantics**
On each new `.menu`: `setAttribute('role','menu')`; per `.menu-item`: `role="menuitem"` (or `menuitemcheckbox` when it has `.mod-checked`, with `aria-checked`); per `.menu-separator`: `role="separator"`. Submenu carriers (`.menu-item-icon.mod-submenu`): set `aria-haspopup="menu"` and `aria-expanded` on the parent item.

**[PLUGIN-OBSERVER] MENU-2 — focus the menu so SR follows arrows**
Arrow nav already works via Obsidian's scope, but the menu is never focused. Give `.menu` `tabindex="-1"` and `.focus()` it on appearance; give the active `.menu-item` (`.is-selected`/`.selected`) `tabindex="-1"` + roving focus, and on the class change (observer on `class`) call `.focus()` on the newly-active item or set `aria-activedescendant` on the menu. Prefer `aria-activedescendant` to avoid fighting Obsidian's own selection logic.

### Settings navigation

**[PLUGIN-OBSERVER] SET-1 — make nav items keyboard operable (CRITICAL)**
On each `.vertical-tab-nav-item`:
```js
item.setAttribute('tabindex', item.classList.contains('is-active') ? '0' : '-1'); // roving
item.setAttribute('role', 'tab');
item.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
  // also implement ArrowUp/Down roving across siblings -> focus + click
});
```
This restores the *only* way for keyboard users to switch settings sections. The existing `click` listener (`openTab`) is reused via `item.click()`.

**[PLUGIN-OBSERVER] SET-2 — tab/tablist/tabpanel relationships**
On `.vertical-tabs-container` nav region: `role="tablist"`, `aria-orientation="vertical"`. Each nav item `role="tab"` + `aria-selected` synced to `.is-active` (observe `class`). Link to panel: give `.vertical-tab-content` `role="tabpanel"` + an `id`, set `aria-controls` on the active tab and `aria-labelledby` on the panel pointing at the active tab.

### CORE-ONLY (flag upstream; plugin can only mitigate)
- **[CORE-ONLY]** Replacing the close button `div` with a real `<button>` element — plugin can only bolt `role`/`tabindex`/`aria-label` on (done in MOD-3), which is acceptable but a native `<button>` would be more robust. Recommend upstream.
- **[CORE-ONLY]** `Scope.onFocusIn` blur-based containment is structurally wrong; plugin overlays a real trap (MOD-4) but cannot delete the core handler. Recommend upstream rewrite to standard focus-cycling.
- **[CORE-ONLY]** `shouldRestoreSelection` defaulting to false and only restoring editor selection — plugin reimplements trigger-restore (MOD-5) but core should own this.

---

## 3. Highest-impact 5

1. **SET-1 — Settings nav items are click-only `div`s (2.1.1).** Keyboard and switch users **cannot change any settings section**. Total block on the entire settings surface. `[PLUGIN-OBSERVER]` add `tabindex` + Enter/Space + arrow roving.
2. **SUG-2 + SUG-1 — Command palette / quick switcher have no combobox/listbox/option/`aria-selected`/`aria-activedescendant` (4.1.2).** The two primary navigation surfaces of Obsidian are opaque to screen readers; the active result is conveyed by CSS class only. `[PLUGIN-OBSERVER]` add roles + live `aria-activedescendant` sync on `is-selected` mutation.
3. **MOD-1/2/3 — Modals lack `role="dialog"`, accessible name, and a labeled close button (4.1.2).** Every dialog (including Settings) is announced as nothing; the close affordance is an unnamed, unfocusable icon `div`. `[PLUGIN-OBSERVER]`.
4. **MOD-4/5 — Broken focus containment + no focus restoration (2.4.3).** Tab falls out of dialogs to `body`; on close, focus is lost rather than returned to the trigger. Disorienting for keyboard and SR users. `[PLUGIN-OBSERVER]` real focus trap + trigger snapshot/restore.
5. **MENU-1/2 — Context/command menus have no menu semantics and never receive focus (4.1.2).** Arrow keys work but AT has no model of the menu. `[PLUGIN-OBSERVER]` add `role=menu/menuitem` + focus + `aria-activedescendant`.

---

## Evidence appendix (key strings, app.js)

- Modal ctor: `this.scope.register([],"Escape",this.onEscapeKey.bind(this)) … this.containerEl=createDiv("modal-container") … this.modalEl=this.containerEl.createDiv("modal") … this.modalEl.createDiv("modal-close-button mod-raised clickable-icon"); tv(i,"x") … this.titleEl=this.headerEl.createDiv("modal-title") … this.scope.setTabFocusContainerEl(this.containerEl)`
- Blur-based containment: `onFocusIn=function(e){ … !i.contains(r)&&setTimeout(()=>{ … e.blur()})}`
- Focus restore only for editor: `shouldRestoreSelection&&function(e){if(e&&(e.focusEl||e.range)){ … n.hasClass("cm-content") … n.focus()}}`; defaults `shouldRestoreSelection=!1`.
- Prompt input: `inputEl=e.createEl("input",{cls:"prompt-input",type:"text",attr:{autocapitalize:"off",spellcheck:"false",enterkeyhint:…}})`
- Results: `resultContainerEl=i.createDiv("prompt-results")`; items `createDiv("suggestion-item")`; selection `forceSetSelectedItem … o.removeClass("is-selected") … a.addClass("is-selected")` (no aria).
- Menu: `n.dom=createDiv("menu") … createDiv("menu-item tappable")`; scope registers `ArrowUp/Down/Left/Right/Enter/Escape`; no `role`, no `tabIndex`, no `.focus()` on `dom`.
- Settings nav: `navEl=createDiv("vertical-tab-nav-item tappable", … n.addEventListener("click",()=>t.openTab(e)))` — click only; `containerEl=createDiv("vertical-tab-content")`.
- ARIA found only in CodeMirror/PDF: `aria-activedescendant` ×3 (CM), `aria-live":"polite"` (cm-announced, pdf-findbar), `aria-haspopup":"listbox"` (CM autocomplete).
