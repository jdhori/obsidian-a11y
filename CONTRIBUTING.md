# Contributing

Thanks for helping make Obsidian usable for everyone.

## Ground rules for enhancers

Obsidian re-renders aggressively, so every fix must follow these rules:

1. **Idempotent.** Your enhancer runs on *every* DOM mutation. Setting an
   attribute to the value it already has must be a no-op. Use the helpers in
   `src/dom.ts` (`setAttr`, `setRoleIfAbsent`, `once`).
2. **Defensive.** Selectors break between Obsidian versions. Guard every
   `querySelector` result; never throw out of a sweep.
3. **Attach handlers once.** Use `once(el, "Key")` before `addEventListener`,
   because the same node may be visited many times (and nodes get recycled).
4. **Don't fight native semantics.** If Obsidian already provides keyboard
   handling (e.g. the file-tree scope), add ARIA only — don't add a competing
   key handler.
5. **Respect SC 2.5.2.** Activate on `keyup` for Space so users can cancel by
   moving focus before release. `makeActivatable` already does this.

## Adding a new fix

1. Write or extend an audit note in `docs/audit/`.
2. Add or update a module in `src/enhancers/` and wire it into `sweep()` in
   `src/main.ts`.
3. Add a settings toggle in `src/settings.ts` and the `A11ySettings` type.
4. `npm run build` must pass with no type errors.
5. Manually verify with **keyboard only** and a screen reader (NVDA / VoiceOver /
   Orca) in the dev vault. Note what you tested in the PR.

## Distinguish feasibility

Tag findings in your audit note as `[PLUGIN-NOW]`, `[PLUGIN-OBSERVER]`, or
`[CORE-ONLY]`. Core-only items belong in an upstream Obsidian issue, not a
workaround that could break.
