// Audit 01 — application chrome: ribbon, sidebar toggles, view-header actions,
// status bar. Root problem: icon controls are <div>s with no role/tabindex, and
// sidebar open/closed state lives only in body CSS classes.

import { makeActivatable, setAttr, setRoleIfAbsent } from "../dom";

export function enhanceChrome(doc: Document): void {
  // Every clickable-icon that is not already a native button → operable button.
  doc.querySelectorAll<HTMLElement>(".clickable-icon").forEach((el) => {
    if (el.tagName === "BUTTON") return;
    makeActivatable(el, { role: "button" });
  });

  // Status-bar items that are interactive.
  doc
    .querySelectorAll<HTMLElement>(".status-bar-item.mod-clickable")
    .forEach((el) => makeActivatable(el, { role: "button" }));

  // Sidebar collapse toggles: expose open/closed state from the body classes.
  const body = doc.body;
  const leftOpen = body.classList.contains("is-left-sidedock-open");
  const rightOpen = body.classList.contains("is-right-sidedock-open");
  doc
    .querySelectorAll<HTMLElement>(".sidebar-toggle-button")
    .forEach((el) => {
      makeActivatable(el, { role: "button" });
      const isRight = el.classList.contains("mod-right");
      setAttr(el, "aria-expanded", String(isRight ? rightOpen : leftOpen));
    });

  // The whole left ribbon is a toolbar of actions.
  const ribbon = doc.querySelector<HTMLElement>(".side-dock-ribbon, .workspace-ribbon");
  if (ribbon) setRoleIfAbsent(ribbon, "toolbar");
}
