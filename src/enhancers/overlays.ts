// Audit 03 — overlays: modals (dialog + focus trap/restore), the settings
// navigation (keyboard-operable tabs), the command palette / quick switcher /
// suggestions (combobox + listbox), and menus.

import {
  ensureId,
  isVisible,
  makeActivatable,
  once,
  removeAttr,
  setAttr,
  setRoleIfAbsent,
  visibleText,
} from "../dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"], .clickable-icon';

function focusables(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

/** The topmost (last in DOM order) open modal container, if any. */
function topModal(doc: Document): Element | null {
  const all = doc.querySelectorAll<HTMLElement>(".modal-container");
  return all.length ? all[all.length - 1] : null;
}

function installModalTrap(container: HTMLElement): void {
  if (!once(container, "Trap")) return;
  const doc = container.ownerDocument;
  const win = (doc.defaultView ?? window) as Window;

  // Capture the trigger only if focus is still outside the dialog. By the time
  // the sweep runs, Obsidian may already have moved focus inside; in that case
  // we have no reliable trigger and skip restoration rather than focus a
  // soon-to-be-removed node.
  const raw = doc.activeElement as HTMLElement | null;
  const trigger = raw && !container.contains(raw) ? raw : null;

  // Initial focus into the dialog.
  const initial = focusables(container);
  (initial[0] ?? container).focus();

  container.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    // Only the topmost modal traps; a nested dialog handles its own Tab.
    if (container !== topModal(doc)) return;
    const els = focusables(container);
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    const active = doc.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Restore focus when the dialog leaves the DOM. Watch the body subtree (the
  // container may be reparented), bail as soon as it disconnects, and add a
  // safety timeout so the observer can never outlive a stuck dialog.
  const mo = new MutationObserver(() => {
    if (!container.isConnected) finish();
  });
  mo.observe(doc.body, { childList: true, subtree: true });
  const bail = win.setTimeout(() => mo.disconnect(), 120_000);
  function finish(): void {
    mo.disconnect();
    win.clearTimeout(bail);
    trigger?.focus?.();
  }
}

function enhanceModals(doc: Document): void {
  // Boundary unification: the dialog role, aria-modal, label, and focus trap all
  // live on .modal-container, so the trapped region and the dialog region match
  // and the close button (a child of the container) stays reachable.
  doc.querySelectorAll<HTMLElement>(".modal-container").forEach((container) => {
    setRoleIfAbsent(container, "dialog");
    setAttr(container, "aria-modal", "true");

    if (
      !container.hasAttribute("aria-label") &&
      !container.hasAttribute("aria-labelledby")
    ) {
      const title = container.querySelector<HTMLElement>(
        ".modal-title, .setting-item-heading .setting-item-name, h1, h2",
      );
      if (title && visibleText(title)) {
        setAttr(container, "aria-labelledby", ensureId(title));
      } else {
        setAttr(container, "aria-label", "Dialog");
      }
    }

    const close = container.querySelector<HTMLElement>(".modal-close-button");
    if (close) {
      makeActivatable(close, { role: "button" });
      if (!visibleText(close) && !close.getAttribute("aria-label")) {
        setAttr(close, "aria-label", "Close");
      }
    }

    installModalTrap(container);
  });
}

// Vertical tablist arrow navigation for the Settings section list. Without it,
// the nav items are focusable but Up/Down just scrolls the panel — the user is
// stranded on whichever section was active and can't reach the others.
function installVerticalTabKeys(nav: HTMLElement): void {
  if (!once(nav, "VTabKeys")) return;
  nav.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = Array.from(
      nav.querySelectorAll<HTMLElement>(".vertical-tab-nav-item"),
    ).filter(isVisible);
    if (!items.length) return;
    const cur = (e.target as HTMLElement)?.closest?.(".vertical-tab-nav-item");
    const i = cur ? items.indexOf(cur as HTMLElement) : -1;
    let next: HTMLElement | undefined;
    if (e.key === "ArrowDown") next = items[i + 1] ?? items[0];
    else if (e.key === "ArrowUp") next = items[i - 1] ?? items[items.length - 1];
    else if (e.key === "Home") next = items[0];
    else next = items[items.length - 1];
    if (!next) return;
    e.preventDefault();
    items.forEach((it) => {
      const on = it === next;
      setAttr(it, "tabindex", on ? "0" : "-1");
      setAttr(it, "aria-selected", String(on));
    });
    // Automatic activation switches (and may re-render) the section, so focus
    // AFTER the click and re-query the live active node to avoid focus loss.
    next.click();
    const live =
      nav.querySelector<HTMLElement>(".vertical-tab-nav-item.is-active") ?? next;
    live.focus();
  });
}

function enhanceSettingsNav(doc: Document): void {
  // .vertical-tab-header is the direct container of the nav items; tag only it
  // as the tablist (tagging the outer group too would nest tablists).
  doc.querySelectorAll<HTMLElement>(".vertical-tab-header").forEach((h) => {
    setRoleIfAbsent(h, "tablist");
    setAttr(h, "aria-orientation", "vertical");
    installVerticalTabKeys(h);
  });

  doc.querySelectorAll<HTMLElement>(".vertical-tab-nav-item").forEach((item) => {
    const active = item.classList.contains("is-active");
    makeActivatable(item, { role: "tab", tabindex: active ? 0 : -1 });
    setAttr(item, "aria-selected", String(active));
  });

  // Wire the section content as the tab panel for the active tab, so screen
  // readers announce a panel boundary when Tab enters the settings content.
  doc.querySelectorAll<HTMLElement>(".vertical-tab-content").forEach((panel) => {
    setRoleIfAbsent(panel, "tabpanel");
    setAttr(panel, "tabindex", "-1");
    const container = panel.closest(".vertical-tabs-container");
    const activeTab = container?.querySelector<HTMLElement>(
      ".vertical-tab-nav-item.is-active",
    );
    if (activeTab) {
      setAttr(panel, "aria-labelledby", ensureId(activeTab));
      setAttr(activeTab, "aria-controls", ensureId(panel));
    }
  });
}

function enhanceSuggest(doc: Document): void {
  doc.querySelectorAll<HTMLElement>(".prompt-input").forEach((input) => {
    setRoleIfAbsent(input, "combobox");
    setAttr(input, "aria-autocomplete", "list");

    const results = input
      .closest(".prompt")
      ?.querySelector<HTMLElement>(".prompt-results");
    const options = results
      ? Array.from(results.querySelectorAll<HTMLElement>(".suggestion-item"))
      : [];

    // aria-expanded must track whether the popup actually presents options.
    setAttr(input, "aria-expanded", String(options.length > 0));

    if (!results || options.length === 0) {
      removeAttr(input, "aria-activedescendant");
      return;
    }
    setRoleIfAbsent(results, "listbox");
    setAttr(input, "aria-controls", ensureId(results));

    let activeId = "";
    options.forEach((opt) => {
      setRoleIfAbsent(opt, "option");
      const selected = opt.classList.contains("is-selected");
      setAttr(opt, "aria-selected", String(selected));
      if (selected) activeId = ensureId(opt);
    });
    if (activeId) setAttr(input, "aria-activedescendant", activeId);
    else removeAttr(input, "aria-activedescendant");
  });

  // Inline editor suggesters.
  doc.querySelectorAll<HTMLElement>(".suggestion-container .suggestion").forEach((list) => {
    setRoleIfAbsent(list, "listbox");
    list.querySelectorAll<HTMLElement>(".suggestion-item").forEach((opt) => {
      setRoleIfAbsent(opt, "option");
      setAttr(opt, "aria-selected", String(opt.classList.contains("is-selected")));
    });
  });
}

function enhanceMenus(doc: Document): void {
  // Obsidian provides native arrow/Escape handling for menus via its keymap
  // scope, so adding the roles completes (rather than fakes) the menu pattern.
  doc.querySelectorAll<HTMLElement>(".menu").forEach((menu) => {
    setRoleIfAbsent(menu, "menu");
    menu.querySelectorAll<HTMLElement>(".menu-item").forEach((mi) => {
      setRoleIfAbsent(mi, "menuitem");
    });
  });
}

export function enhanceOverlays(doc: Document): void {
  enhanceModals(doc);
  enhanceSettingsNav(doc);
  enhanceSuggest(doc);
  enhanceMenus(doc);
}
