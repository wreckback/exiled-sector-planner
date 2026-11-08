# Later

Ideas noted for a future pass. Not built yet.

- **Ship tab: hover explanations for each setting.** Add a tooltip (`title` or a small hover box) per row in `#panel-ship` saying what the setting means and which nodes it affects. For example:
  - **Only built-in fighter wings:** the hull has at least one built-in wing and every fighter bay is taken by built-in wings (`ShipFacts.onlyBuiltInWings`: `builtInWings > 0 && fighterBays <= builtInWings`, e.g. a Tempest). It only affects Converted Fighter Bay (`REMOVE_ALL_FIGHTER_BAYS`), which needs "Yes".
  - Do the same for shield, base armor, civilian-grade hull, system charges and station modules.

- **Split `web/app.js` into smaller files** (about 3,500 lines now). Do it at a quiet moment, ideally before the next big feature (a public build, another mod sync):
  - **Files:** about 7, along the existing section boundaries: model, rules, subroutines, templates, render, ui, plus a small start file.
  - **No ES modules:** Chrome blocks `import`/`export` on `file://`, and the page and the release zip must keep working from a double-clicked `index.html`. Use classic `<script>` tags in load order, sharing one namespace object.
  - **Scope:** no behaviour change. Re-test every feature in the browser (rules, subroutines, templates, codes, panels, dialogs), then commit the split on its own so it's easy to revert. Update the `index.html` script tags, CLAUDE.md's architecture section and the release zip steps.
