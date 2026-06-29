// Audit 01 — application chrome: ribbon, sidebar toggles, view-header actions,
// status bar. Root problem: icon controls are <div>s with no role/tabindex, and
// sidebar open/closed state lives only in body CSS classes. Several icon-only
// controls (settings gear, the tab-list selector, sidebar toggles, help) also
// ship with NO accessible name, so once they become role="button" a screen
// reader announces a bare "button". We derive a name from the lucide icon class.

import { makeActivatable, setAttr, setRoleIfAbsent, visibleText } from "../dom";

/** Known icon → label. Keys are matched against the svg's class tokens. */
const ICON_LABELS: Record<string, string> = {
  "lucide-settings": "Settings",
  "lucide-help-circle": "Help",
  help: "Help",
  "lucide-bell": "Notifications",
  "lucide-more-horizontal": "More options",
  "lucide-more-vertical": "More options",
};

/** Does the element already expose an accessible name? */
function hasAccessibleName(el: HTMLElement): boolean {
  const label = el.getAttribute("aria-label");
  if (label && label.trim()) return true;
  if (el.getAttribute("aria-labelledby")) return true;
  if (el.getAttribute("title")?.trim()) return true;
  return !!visibleText(el);
}

/** Prettify a lucide token as a last resort: "lucide-chevron-down" → "Chevron down". */
function prettifyIcon(token: string): string {
  const words = token.replace(/^lucide-/, "").replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/** Best-effort accessible name for an unlabeled icon control, from context + icon. */
function deriveIconLabel(el: HTMLElement): string | null {
  // Sidebar collapse toggles: name by side.
  const toggle = el.closest<HTMLElement>(".sidebar-toggle-button");
  if (toggle || el.querySelector(".sidebar-toggle-button-icon")) {
    const host = toggle ?? el;
    if (host.classList.contains("mod-right")) return "Toggle right sidebar";
    if (host.classList.contains("mod-left")) return "Toggle left sidebar";
    return "Toggle sidebar";
  }

  const svg = el.querySelector("svg");
  const tokens = (svg?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

  // The chevron in the tab-header strip opens the list of open tabs.
  if (
    tokens.includes("lucide-chevron-down") &&
    el.closest(".workspace-tab-header-container")
  ) {
    return "List of open tabs";
  }

  for (const token of tokens) {
    if (ICON_LABELS[token]) return ICON_LABELS[token];
  }

  // Last resort: a prettified lucide name beats a nameless button.
  const lucide = tokens.find((t) => t.startsWith("lucide-"));
  return lucide ? prettifyIcon(lucide) : null;
}

/** Give an icon control an accessible name if it lacks one (idempotent). */
function ensureName(el: HTMLElement): void {
  if (hasAccessibleName(el)) return;
  const name = deriveIconLabel(el);
  if (name) setAttr(el, "aria-label", name);
}

export function enhanceChrome(doc: Document): void {
  // Every clickable-icon that is not already a native button → operable button.
  doc.querySelectorAll<HTMLElement>(".clickable-icon").forEach((el) => {
    if (el.tagName === "BUTTON") return;
    makeActivatable(el, { role: "button" });
    ensureName(el);
  });

  // Status-bar items that are interactive.
  doc
    .querySelectorAll<HTMLElement>(".status-bar-item.mod-clickable")
    .forEach((el) => {
      makeActivatable(el, { role: "button" });
      ensureName(el);
    });

  // Sidebar collapse toggles: expose open/closed state from the body classes.
  const body = doc.body;
  const leftOpen = body.classList.contains("is-left-sidedock-open");
  const rightOpen = body.classList.contains("is-right-sidedock-open");
  doc.querySelectorAll<HTMLElement>(".sidebar-toggle-button").forEach((el) => {
    makeActivatable(el, { role: "button" });
    ensureName(el);
    const isRight = el.classList.contains("mod-right");
    setAttr(el, "aria-expanded", String(isRight ? rightOpen : leftOpen));
  });

  // The whole left ribbon is a toolbar of actions.
  const ribbon = doc.querySelector<HTMLElement>(".side-dock-ribbon, .workspace-ribbon");
  if (ribbon) setRoleIfAbsent(ribbon, "toolbar");
}
