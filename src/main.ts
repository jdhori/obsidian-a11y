import { Plugin } from "obsidian";
import { A11ySettings, DEFAULT_SETTINGS } from "./types";
import { A11yObserver } from "./observer";
import { Announcer } from "./announcer";
import { enhanceChrome } from "./enhancers/chrome";
import { enhanceStructure } from "./enhancers/structure";
import { enhanceOverlays } from "./enhancers/overlays";
import { enhanceForms } from "./enhancers/forms";
import { A11ySettingTab } from "./settings";

interface DocContext {
  observer: A11yObserver;
  announcer: Announcer;
}

export default class A11yEnhancerPlugin extends Plugin {
  settings: A11ySettings = DEFAULT_SETTINGS;
  private contexts = new Map<Document, DocContext>();

  async onload(): Promise<void> {
    await this.loadSettings();
    console.info("[a11y-enhancer] loaded");
    this.applyBodyFlags(document);
    this.addSettingTab(new A11ySettingTab(this.app, this));

    // Main window now; pop-out windows as they open.
    this.attach(document);
    this.registerEvent(
      this.app.workspace.on("window-open", (_win: unknown, win: Window) => {
        if (win?.document) this.attach(win.document);
      }),
    );
    this.registerEvent(
      this.app.workspace.on("window-close", (_win: unknown, win: Window) => {
        if (win?.document) this.detach(win.document);
      }),
    );
  }

  onunload(): void {
    for (const doc of Array.from(this.contexts.keys())) this.detach(doc);
    // The main document is in `contexts`, so detach() already cleared its flags.
  }

  private attach(doc: Document): void {
    if (this.contexts.has(doc)) return;
    this.applyBodyFlags(doc);
    const announcer = new Announcer(doc);
    if (this.settings.announcer) announcer.mount();
    const observer = new A11yObserver(doc, (d) => this.sweep(d, announcer));
    observer.start();
    this.contexts.set(doc, { observer, announcer });
  }

  private detach(doc: Document): void {
    const ctx = this.contexts.get(doc);
    if (!ctx) return;
    ctx.observer.stop();
    ctx.announcer.unmount();
    this.clearBodyFlags(doc);
    this.contexts.delete(doc);
  }

  /** Idempotent pass over a document; run by the observer on every change. */
  private sweep(doc: Document, announcer: Announcer): void {
    const s = this.settings;
    if (s.chrome) enhanceChrome(doc);
    if (s.structure) enhanceStructure(doc);
    if (s.overlays) enhanceOverlays(doc);
    if (s.forms) enhanceForms(doc);
    if (s.announcer) announcer.sweepNotices();
  }

  /** Re-run all enhancers immediately (after a settings change). */
  resweep(): void {
    for (const [doc, ctx] of this.contexts) this.sweep(doc, ctx.announcer);
  }

  /** CSS feature flags are toggled via body classes that styles.css keys off. */
  applyBodyFlags(doc: Document): void {
    const b = doc.body;
    b.classList.toggle("a11y-focus-ring", this.settings.focusRing);
    b.classList.toggle("a11y-reduced-motion", this.settings.reducedMotion);
    b.classList.toggle("a11y-contrast-boost", this.settings.contrastBoost);
  }

  private clearBodyFlags(doc: Document): void {
    doc.body.classList.remove(
      "a11y-focus-ring",
      "a11y-reduced-motion",
      "a11y-contrast-boost",
    );
  }

  /** Reflect the announcer setting across all attached documents. */
  syncAnnouncer(): void {
    for (const ctx of this.contexts.values()) {
      if (this.settings.announcer) ctx.announcer.mount();
      else ctx.announcer.unmount();
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    for (const doc of this.contexts.keys()) this.applyBodyFlags(doc);
  }
}
