// A debounced MutationObserver bound to a single Document (Obsidian can spawn
// pop-out windows, each with its own document). On any subtree/attribute change
// it schedules one sweep; the sweep re-applies all enabled enhancers. Because
// the enhancers are idempotent, re-sweeping is safe and cheap.

export type Sweep = (doc: Document) => void;

export class A11yObserver {
  private observer: MutationObserver;
  private scheduled = false;
  private rafHandle: number | null = null;
  private readonly win: Window;

  constructor(
    private readonly doc: Document,
    private readonly sweep: Sweep,
  ) {
    this.win = (doc.defaultView ?? window) as Window;
    this.observer = new MutationObserver(() => this.schedule());
  }

  start(): void {
    // body can briefly be null in a freshly opened pop-out window.
    const target = this.doc.body ?? this.doc.documentElement;
    if (!target) return;
    this.observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-label"],
    });
    this.run();
  }

  /** Coalesce bursts of mutations into a single sweep on the next frame. */
  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    this.rafHandle = this.win.requestAnimationFrame(() => {
      this.rafHandle = null;
      this.scheduled = false;
      this.run();
    });
  }

  private run(): void {
    try {
      this.sweep(this.doc);
    } catch (e) {
      console.error("[a11y-enhancer] sweep failed", e);
    }
  }

  stop(): void {
    this.observer.disconnect();
    if (this.rafHandle !== null) {
      this.win.cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.scheduled = false;
  }
}
