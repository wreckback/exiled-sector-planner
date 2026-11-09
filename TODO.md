# Now: decide where the mod checkout lives

Inside the planner folder or beside it. Check how the other work environment has it laid out first. Then make the tools' default `--mod-root`, the README and `CLAUDE.md` match.

# Next: follow-ups from the PR #1 review (`node-tools`)

From the code review of PR #1 (2026-11-09). Already fixed in `4fe0eaa`: `/dist/` in `.gitignore`, `update.mjs --commit` commits only `SyncFiles`, and `git()` allows 64 MB of output. The rest, with the suggested fix for each. Suggested order: 1 and 2 in one commit, then 3 and 6. After each, check that `extract.mjs` output is byte-identical apart from `generated` and that `update.mjs` gives the same report, on Windows and under WSL (item 2 is a Linux problem).

1. **Error messages can be lost on exit** (`common.mjs` `fail()`, `update.mjs` dirty mod checkout list). They print and then call `process.exit()` straight away, and Node can drop output that hasn't been written yet where stdout/stderr are asynchronous (Windows terminals, macOS pipes). Fix in `common.mjs`:
   - `fail()` throws a small `ToolExit` error with the message, and a `process.on('uncaughtException')` handler prints a `ToolExit` (no stack trace), sets `process.exitCode = 1` and returns, so Node ends on its own once output is written. Other errors still crash as now.
   - Route the dirty mod checkout list in `update.mjs` through `fail()`. Restructure the `--help` exits and `release.mjs`'s `--dry-run` exit as if/else (or a `ToolExit` with code 0).
   - Not synchronous writes: a synchronous write to a full pipe can fail on Linux and macOS.
2. **`update.mjs` searches Java files in a different order from `extract.mjs`.** Its `javaText` walk keeps the first match in raw `readdirSync` order, which isn't sorted on Linux, so with two same-named files (two `SkillTier.java` or `TemplateCodec.java` in different modules) the two tools, and the two OSes, can read different files. The folder-skip rules differ too (`.git`/`node_modules` vs dot-folders). Fix:
   - Move `extract.mjs`'s `javaFilesUnder` (sorted, files before subfolders, dot-folders skipped) into `common.mjs`, with the mod root as a parameter, and build `javaText` on it, keeping the first match per lowercased name.
   - Optionally flag a name found in two modules in the update report, instead of picking one silently.
3. **The planner tag pattern is written twice and differs:** `package.mjs` is case-sensitive and wants `+es…`, while `release.mjs` uses `/i` and accepts any `+…`. All tags so far are lowercase `+es…`, so nothing breaks today. Fix: export one `PlannerTag` pattern and a `parseTag(name)` from `common.mjs` (case-insensitive, stage lowercased, returning `{major, minor, patch, stage, n, build}`), and let `package.mjs` check `build?.startsWith('es')` itself.
4. ~~**`serve.mjs` and `version.js`**~~ (done with `update.mjs --preview`: only the repo's own `web/` gets its version from git, and `git describe` is kept for 2 seconds).
5. ~~**Stale `.ps1` references here in TODO.md**~~ (done: the finished Node port section is removed, and the "art" vs "assets" item names `package.mjs`).
6. **Cleanups:**
   - Copied helpers: move `lines` (`release.mjs`, `update.mjs`), `collator`/`sorted` (`extract.mjs`, `update.mjs`) and the `pad`/`now` timestamp (both) into `common.mjs`.
   - `extract.mjs`'s own `exists` duplicates `existsSync`; delete it.
   - The effect wording loop in `extract.mjs` scans every string for every used effect, lowercasing both each time. Index the strings once (lowercased effect name to its `effect.NAME…` keys, in string-table order) so each effect is one lookup. Key order stays the same, so the output should stay byte-identical; check it.
   - Also from the review, not covered above: `release.mjs` works out the mod root itself instead of using `modRootFrom` (give it a non-failing option such as `{ required: false }`), and `update.mjs` reports a killed `extract.mjs` as "failed (undefined)" (add `run.signal` to the message).

# Later

Ideas noted for a future pass. Not built yet.

- **Integrated nodes (mod `Dev`, after 0.11.2-alpha; the mod's s-mod equivalent).** A player spends story points to integrate an allocated node on one ship; it then uses its type's `integrated` effects (a full replacement of `effects`/`hullSizeEffects`, sometimes `effectText`) instead of its normal ones. The nth integration on a ship costs n story points; a node stays integrated when unallocated (reallocating is free); the Deintegration Schematic resets them. 178 of 273 types have integrated effects on `Dev`. The extractor already copies the `integrated` block into the data; the planner ignores it. To build: a way to mark nodes integrated (and serialize it in the build JSON and share link; templates don't carry it, the mod keeps it per ship in `ShipSkillData.integratedNodeIds`), totals and the stat sheet using the integrated effects, tooltips like the game's (changed lines in story point green, "No longer:" for dropped ones), and the story point total. Mod references: `docs/plans/completed/integrated_nodes.md` and `integrated_bonuses.md`, `IntegratedEffects`, `IntegratedNodes`, `IntegrationLines`, `NodeIntegration`. Decide the UI first.
- **Wormhole travel is right-click in the mod now** (mod `Dev` `1e0a37d4`): right-click jumps through a wormhole or boards the exoship, and Ctrl+click on a wormhole allocates it (on a socket with an open anchor, it opens Socket Items). The planner jumps with Ctrl+click and removes nodes with right-click. Decide whether to match.
- **Fighter role-stat effects have no wording** (`FIGHTER_TOP_SPEED_PERCENT`, `FIGHTER_WEAPON_RANGE_PERCENT` and others in `mod-sync.json`'s `noWording`; integrated effects on `Dev` add `FIGHTER_DAMAGE_TAKEN_MULT` and `FIGHTER_WEAPON_RANGE_FLAT`). They're built from `RoleStat` in `FighterSkillEffect`, worded somewhere the extractor doesn't read yet.

- **Ship tab: hover explanations for each setting.** Add a tooltip (`title` or a small hover box) per row in `#panel-ship` saying what the setting means and which nodes it affects. For example:
  - **Only built-in fighter wings:** the hull has at least one built-in wing and every fighter bay is taken by built-in wings (`ShipFacts.onlyBuiltInWings`: `builtInWings > 0 && fighterBays <= builtInWings`, e.g. a Tempest). It only affects Converted Fighter Bay (`REMOVE_ALL_FIGHTER_BAYS`), which needs "Yes".
  - Do the same for shield, base armor, civilian-grade hull, system charges and station modules.

- **Split `web/app.js` into smaller files** (about 3,500 lines now). Do it at a quiet moment, ideally before the next big feature (a public build, another mod sync):
  - **Files:** about 7, along the existing section boundaries: model, rules, subroutines, templates, render, ui, plus a small start file.
  - **No ES modules:** Chrome blocks `import`/`export` on `file://`, and the page and the release zip must keep working from a double-clicked `index.html`. Use classic `<script>` tags in load order, sharing one namespace object.
  - **Scope:** no behaviour change. Re-test every feature in the browser (rules, subroutines, templates, codes, panels, dialogs), then commit the split on its own so it's easy to revert. Update the `index.html` script tags, CLAUDE.md's architecture section and the release zip steps.

- **Wormhole pairs: check the layout and the jump wording.** The core has 3 pairs (6 wormholes), named here by nearest root: `hightech_wormhole_1` (High Tech) <-> `midline_wormhole_1` (Midline), `hightech_wormhole_2` (High Tech) <-> `lowtech_wormhole_2` (Low Tech), `lowtech_wormhole_1` (Low Tech) <-> `wormhole_6` (High Tech, or between regions). By nearest root there's no Low Tech <-> Midline pair, so check where `wormhole_6` really sits. Related:
  - Jump texts now name a core destination by its id, "Core (midline_wormhole_1)" (`placeName`; the user's choice 2026-11-09), and lists say just "Core". The mod names no sides: it says "Ctrl-click to travel through it" and calls the core the "Core volume".
  - Consider "travel" instead of "jump", and showing the mod's own `effectText`/`flavour` for `wormhole` and `wormhole_exit` in place of T06/T07 (see text-review-map.md).

- **Rewrite map texts T34 to T42** (see text-review-map.md): the subroutine radius notes (T34 gated node, T35 the gating "when" values, T36 to T38 doctrine rewrite/augment notes, T39 Root Conduit route) and the target mode tooltip notes (T40 to T42).

- **Rewrite all of sections 7 and 8 of text-review-map.md:** section 7, the socket click picker (P12 to P31: socket heading, subroutine and anchor sections, cache notables, subroutine list, kind descriptions, limits, anchor rows), and section 8, what a socketed subroutine is doing (S01 to S08).

- **Map text review: tighter wording to consider** (from the review of text-review-map.md). Only T04 has been changed so far ("Install a subroutine, or an anchor."); the rest are still being considered:
  - **T05** "Linked to {volume}." reads as "Linked to Hegemony."; "Linked to the {volume} volume." would match T07.
  - **T07** "{volume} volume's Wormhole exit." has a capital W mid-sentence; maybe "Wormhole exit into the {volume} volume. Opens when an anchor is linked in a subroutine socket."
  - **T33** (and T32) need "the": "Inside the Empty Shell Axion's radius".

- **Panel text review: deferred** (from the review of text-review-panel.md):
  - **SP69**: the Ship tab's "Not checked" section was removed. Check again what the planner doesn't model and whether it should be said somewhere: item costs, ordnance points, hullmod clashes the game learns during play, and the weapon/shield `req_*` requirements shown in tooltips (the game doesn't block on those either).

- **"hullmod" everywhere, after all text review files are done.** The mod writes "hullmods"; the user wants the planner to match. Sweep the code's "hull mod(s)" (tooltips, block messages, toasts, dialogs, README) once every review file is reviewed.

- **"art" vs "assets": ask the user whether to rename project-wide.** In the toolbar review the Mod art button became **Show mod assets** / **Loading assets…** / **Reconnect assets** / **Mod assets**, and its hover and the first-visit toast now say "assets" (the Mod art dialog's "Reconnect assets in the top bar" too, since it names the button). Everything else still says "art": the Mod art dialog title and text (text-review-dialogs.md), the placeholder status line, README (Mod art section, "Show mod art", "Reconnect art"), the release README.txt from `package.mjs`, CLAUDE.md and code comments. Ask before changing these.

- **Bring back "Copy link to this build"** (removed from the Templates dialog's Other ways to export on 2026-11-09). With the planner run as a local copy, a link only opens on the same computer, so it adds nothing over the saved build and Copy code. Worth adding back once the planner is hosted somewhere others can open it. `shareUrl()` and loading `#b=` links are still in `app.js`; the old button was `#btn-share` with the toasts "Link copied. It contains the whole build." / "Copy this link:" (TP97, TP102, TP103 in text-review-templates.md).

- **Template JSON in and out (removed 2026-11-09, may come back).** The Template code box used to accept a pasted single-template JSON object (anything starting with `{`, parsed in `codeToTemplate`), and "Copy template JSON" in Other ways to export copied `buildTemplate(name)` as JSON (status "Template JSON copied. Paste it into the "templates" list of the file." / toast "Copied "{name}" as template JSON.", TP100 and TP101 in text-review-templates.md). Both were removed at the user's request: codes only for now. To restore, re-add the `raw.startsWith('{')` branch and the `#tpl-copy` button.

- **Template name rule texts (low priority).** From the templates text review: TP44 (load note), TP61 (name problem) and TP63 (removed-characters note) were left as they were, to be reworded later. The user's draft said only letters, digits and spaces are allowed, but the rule (`NAME_CHAR`) also allows keyboard symbols, so ask whether to change the rule or only the wording. TP44 sits mid-sentence in the load report, so it has to start lowercase.

- **Bug: the plan status can give the wrong reason for "It may not be the fewest" (TB54).** `renderTargets` picks the reason by `targets.want.size > TARGET_EXACT_MAX`, but `computePlan` decides exact vs greedy by `T.length` (wanted units still to reach: wanted nodes already in the build are left out, and a wormhole and its partner count once). Example: 12 nodes marked wanted, 4 already allocated, and the replay had to steer around a refused node. The search was exact, but the bar says "over 10 wanted nodes the search is approximate" instead of "it had to steer around refused nodes". Fix: have `computePlan` return why the plan isn't exact (for example `approx: 'greedy' | 'steered'`) and use that in `renderTargets`. Not fixed yet, at the user's request (2026-11-09).
