# Now: decide where the mod checkout lives

Inside the planner folder or beside it. Check how the other work environment has it laid out first. Then make the tools' default `--mod-root`, the README and `CLAUDE.md` match.

# Now: text externalization (2026-11-10)

Built on branch `text-overhaul`, merged into `main` on 2026-11-12. Steps 1 to 7 are done (2026-11-11): every text the planner writes is in `web/text/*.js` (`CLAUDE.md`, Text; `CHANGELOG.md`), checked by `tools/text-check.mjs` (also in `release.mjs`), with `tools/text-baseline.mjs` to compare the page's text before and after a change (`TOOLS.md`, Text tools). `docs/text-inventory.md` records what moved and how. Left:

1. **Text review** (step 8): the wording slips listed in `docs/text-inventory.md` ("Wording inconsistencies spotted"), and whatever else reads badly now that the text is in one place. Save a baseline first, then check the differences are the intended ones.
2. ~~**Merge `text-overhaul` into `main`**~~ (done 2026-11-12, a fast-forward to `1c4bb6c`, before the text review and before the editor test on the other machine, at the user's request; the checks in the next section's step 6 passed on this machine first).
3. **Later, not now:** `tools/text.mjs` (list, search, rename a key everywhere, find duplicates), once it's clear which commands would be used.

# Now: test the text editor on the other machine (2026-11-11)

The text editor (`node tools/serve.mjs --edit`; `TOOLS.md`, Text tools) was built on branch `text-editor` and tested on this machine only, in headless Edge. It was merged into `text-overhaul` and then into `main` on 2026-11-12, before this test, at the user's request. On the other work environment, on `main`, in a real browser:

1. Start `node tools/serve.mjs --edit` and open the page: the Text editor panel shows at the bottom left, with no errors in the browser console.
2. Pick a text from `index.html` (a toolbar button) and a built one (a panel line or a tooltip), type, and check that the page changes as you type. Then Revert.
3. Save a change, check with `git diff` that only that line (and its `// e.g.` line, if the wording left it behind) changed, then run `node tools/text-check.mjs`. Undo the change with `git checkout -- web/text`.
4. Check that the page without `--edit`, and the release zip, show no editor.
5. ~~Merge `text-editor` into `text-overhaul`.~~ (done 2026-11-12, before the test.)
6. ~~Once 1 to 4 pass, test `text-overhaul` again, and merge it into `main`.~~ (done 2026-11-12 on this machine, before 1 to 4: all of the checks below passed, the baseline compared against the old `main`, and `main` was fast-forwarded. If 1 to 4 find a problem, fix it on `main`.) The checks were:
   - `node tools/text-check.mjs`
   - `node tools/text-baseline.mjs --check` against a baseline saved from `main`
   - `extract.mjs` output byte-identical
   - `release.mjs --dry-run`
   - a test zip from `package.mjs` that opens from `file://`

# Next: merge the nested theme tags at the next mod release (2026-11-12)

The mod's `Dev` work after 0.12.6-alpha moved the theme list to `data/config/exiledSector/theme_tags.csv`, nested the tags, retagged every node (affinity nodes included) and renamed `req_fighter_bays`/`req_no_fighter_bays` to `req_strikecraft_bays`/`req_no_strikecraft_bays`. The planner's support for it was built on `theme-tags` and is on `development` (`4acfc5b`, pushed), not on `main`, at the user's choice: it waits for the mod release. `CHANGELOG.md` on `development` ("Nested theme tags") has the details.

**The mod's `Dev` work is probably not finished** (it was checked at `9be677e1`, 2026-11-12, still changing the tags that day). Keep looking out for changes until it's released: from time to time, `git -C <mod> fetch` and run `node tools/update.mjs --preview --mod-root <mod>` against `Dev`, and compare the report with the one at `9be677e1` (54 themes, "rule files changed" its only flagged item). Look especially at `theme_tags.csv`, `ThemeTags`, `SkillTags`, `NodeRequirements` and the tags in `data/skilltrees/skill_types.json`. Fix anything new on `development`.

1. The automatic release will stop on that mod release (rule files changed: `SkillTags`, `NodeRequirements`, `SkillTier` and others) and open an issue. Do that sync by hand.
2. Merge `development` into `main` before syncing, so the sync runs with the new extractor. With 0.12.6-alpha data the page is unchanged (text baseline identical), so the merge is safe on its own.
3. After the sync, remove the two old `name.requirement.req_fighter_bays` and `req_no_fighter_bays` lines in `web/text/names.js` (and their comment), and run `node tools/text-check.mjs`.
4. Check the Filter in the page: 54 themes against mod `Dev` `9be677e1`, Weapons also finding the Beam nodes, and Low Tech, Midline and High Tech finding the 155 affinity nodes.

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
   - `update.mjs --report` starts recording after the `--preview` refusals (`--commit`, `--tag`), so those two leave no report file. Start recording before them.

# Next: from the preview of the mod's `Dev` work (2026-11-09)

1. ~~**Regenerate `web/data/planner-data.js` for the Rift Strike fix.**~~ (done by the 0.12.0 sync, `9968e3d`: 50% and 500 now.) The extractor used to take a bare constant from whichever class defined it first, so Rift Strike and Strikecraft Rift Strike show a 10% damage share and a 100 maximum instead of the mod's 50% and 500 (wrong since the first data commit, `460d7d0`). The fixed extractor gives the right values. Regenerate from the 0.11.2-alpha source without moving the mod checkout: export it with `git -C <mod> archive 3fe80956 | tar -x -C <scratch>` and run `extract.mjs --mod-root <scratch>`. Only those two effects change (plus two extra values the page doesn't show). `mod-sync.json` stays as it is.
2. **The mod released the `Dev` work as 0.12.0, synced 2026-11-09 (`9968e3d`).** Still to check:
   - ~~`BALLISTIC_WEAPON_LARGE_OP_COST_FLAT` became a plain flat stat effect~~ (checked after the 0.12.0 sync: the planner already guessed `flat` from the name, so Heavy Ballistics Integration reads the same, "−5 to ordnance point cost of large ballistic weapons" in green).
   - The rule files the report lists were reviewed on 2026-11-09 (mod `93ceafe2`): `AffinityScaling`/`AffinitySteps` now allow a tolerance on "all affinities equal" from a new `AFFINITY_EQUALITY_TOLERANCE_FLAT` effect (the planner doesn't compute those scaled bonuses, and no node grants the effect yet); `ShipStatSheets` adds refining effects to a line's Sources (the Full Sheet's Sources may show less than the game's); `SkillType` is integrated nodes (see Later); `SkillTreeEffectSource`, `SkillTreeSettings` and `NodeAllocator` don't affect the planner. Look again at anything changed after `93ceafe2`.
   - The two fighter effects newly without wording (see Later).

# Later

Ideas noted for a future pass. Not built yet.

- **Integrated nodes: check the design** (built 2026-11-09). The tooltip and list view compare normal and integrated effects either side by side or inline with values in brackets (the panel's Integrated effects setting; inline is the default since 2026-11-09, measured over 156 types as about a third shorter). If either reads badly in use, change it. A third view copying the game (green changed lines, "No longer:", a muted "When integrated" list) was offered and not built. Other ideas from the design talk: only the lines that differ, or a key to flip the tooltip to the other set. Also check `STORY_GREEN`/`--builtin` against the game's real story point colour (`Misc.getStoryOptionColor()`), which isn't in the mod's sources.

- **Wormhole travel is right-click in the mod now** (released in 0.12.0; mod `Dev` `1e0a37d4`): right-click jumps through a wormhole or boards the exoship, and Ctrl+click on a wormhole allocates it (on a socket with an open anchor, it opens Socket Items). The planner jumps with Ctrl+click and removes nodes with right-click. Decide whether to match.

- **Fighter role-stat effects have no wording** (`FIGHTER_TOP_SPEED_PERCENT`, `FIGHTER_WEAPON_RANGE_PERCENT` and others in `mod-sync.json`'s `noWording`; integrated effects on `Dev` add `FIGHTER_DAMAGE_TAKEN_MULT` and `FIGHTER_WEAPON_RANGE_FLAT`). They're built from `RoleStat` in `FighterSkillEffect`, worded somewhere the extractor doesn't read yet.

- **Load a template onto any root** (mod 0.12.1, `b737648f`; estimated 2026-11-09 as medium, about 150–250 lines of `app.js`). In game a template from another root now reaches its nodes from the ship's own root: `TemplateBridge.nextStep` → `AllocationPath.towardNearest` repeatedly finds the template step the build reaches in the fewest nodes (ties: the earlier step), allocates only the first node on that path (a filler node if it isn't in the template), and picks choice options in this order: a set preference, an option already picked this run, the options of allocated nodes of the same choice type, the template's most chosen option (`templateFavourite`), the root's affinity (`rootAffinityOption`), then a random usable one. Refused steps, hidden volumes and item costs are closed (`TemplateBridge.open`). It stops when nothing is reachable (or at the node cap).
  - To build: port that loop on top of `findPath`/`searchPath`, `placement` and `importTemplate`; add "load onto my current root" to the Templates list and code loading (a button per template, or a "Keep my root" checkbox: decide); report filler nodes, unreached steps and the cap in the load message. Loading normally still switches to the template's root.
  - Optional: saving an edit of a template from another root moves it to the current root in game (`replaceSteps` takes the root); the planner keys templates by name plus root, so it would save a new one instead.
  - Limits: the game's random last-resort pick and tie order can make the planner's route differ; bridging from a far root can hit the 60-node cap.
  - Mod sources: `TemplateBridge`, `AllocationPath`, `TemplateLevelUp`, `AutoAllocateRun`, `TemplatePlanner`, `TypeAffinity`; mod docs: `docs/docs.md` (templates).

- **Per-d-mod effects show their raw names** (found 2026-11-09). `ARMOR_DAMAGE_TAKEN_MULT_PER_DMOD` and `HULL_DAMAGE_TAKEN_MULT_PER_DMOD` (Restriction Breeds Creativity) and `WEAPON_DAMAGE_MULT_PER_DMOD`, `WEAPON_FLUX_COST_PERCENT_PER_DMOD` and `WEAPON_RATE_OF_FIRE_PERCENT_PER_DMOD` (Perseverance Through Faith) read like "Armor damage taken mult per dmod: 5". The mod builds them with `new PerDModMultEffect(...)` / `new PerDModPercentEffect(...)`, whose classes set the mode (MULT / PERCENT) and word them with `describeStat(magnitude, statKey)`. The extractor's mode regex doesn't know those classes, so the effects get a `stat` but no `mode`, and `describeRaw` falls back to the humanized name. Fix: take the mode from the class name (or follow `backingOf`-style into the class) in `extract.mjs`, then check the wording against the game's. Also: `update.mjs` only counts effects with neither a template nor a `stat` as "without wording", so effects with a stat but no mode slip past the report; make the check catch them too.

- **Ship tab: hover explanations for each setting.** Add a tooltip (`title` or a small hover box) per row in `#panel-ship` saying what the setting means and which nodes it affects. For example:
  - **Only built-in fighter wings:** the hull has at least one built-in wing and every fighter bay is taken by built-in wings (`ShipFacts.onlyBuiltInWings`: `builtInWings > 0 && fighterBays <= builtInWings`, e.g. a Tempest). It only affects Converted Fighter Bay (`REMOVE_ALL_FIGHTER_BAYS`), which needs "Yes".
  - Do the same for shield, base armor, civilian-grade hull, system charges and station modules.

- **Split `web/app.js` into smaller files** (about 5,400 lines now). Do it at a quiet moment, ideally before the next big feature (a public build, another mod sync):
  - **Files:** split by responsibility, keeping logic (rules, paths, target planner, totals, wording) apart from canvas and DOM code, with dependencies one way (core, rules, render/ui, start). For example: `core/` (constants, model, state), `rules/` (eligibility, paths, subroutines, targets), `data/` (templates, codes, serialize), `text/` (describe, totals, statsheet), `render/` (camera, draw, theme, images), `ui/` (dom, tooltip, picker, panel, listview, input, dialogs), `main`. Name ported files after the mod class they mirror (`eligibility` for `NodeEligibility`), and give each a header saying what it holds.
  - **No ES modules in what users get:** Chrome blocks `import`/`export` on `file://`, and the page and the release zip must keep working from a double-clicked `index.html`. Either bundle real modules into one classic `web/app.js` (see "Consider a bundler" below; preferred), or use classic `<script>` tags in load order sharing one namespace object (no tooling, but order and shared names are managed by hand).
  - **Tools:** `extract.mjs` can split without a build (Node modules): the Java source reading (constants, `resolveExpression`, helper inlining, `backingOf`) into `tools/lib/java.mjs`, the rest by what it extracts; `update.mjs`'s checks into `tools/lib/checks.mjs`.
  - **Scope:** no behaviour change. Re-test every feature in the browser through `window.planner` (rules, subroutines, templates, codes, panels, dialogs), check `extract.mjs` output is byte-identical, then commit the split on its own so it's easy to revert. Update CLAUDE.md's architecture section (it could become a file map) and the release steps.

- **Consider a bundler (esbuild) for `web/`.** Write real modules in `src/`, and bundle them into one classic script (`--format=iife`) at `web/app.js`, so users get exactly what they get now: one file, working from `file://`, the same size (scope hoisting adds almost nothing).
  - Settings: target modern browsers (`--target=es2022` or so) so no helpers or rewritten syntax get added, add no runtime libraries, and don't minify (the zip runs locally, the data file is the larger half anyway, and readable shipped code helps debugging).
  - Commit the built `web/app.js` so `package.mjs` keeps zipping the tag as now. Release flow: build, commit source and build together, `release.mjs`, `package.mjs`, upload the zip to a GitHub Release. Have `release.mjs` run the build and refuse to tag if it changes `web/app.js`. (The alternative, building only in `package.mjs`, can't be forgotten but means a fresh clone needs a build before the page runs.)
  - Cost is developer-side only: `esbuild` (about 10 MB) as the first npm devDependency, and a build step (well under a second, can watch). `CLAUDE.md`'s "no build step, no npm dependencies" wording changes; it stays true for users.

- **Consider TypeScript.** Users must still get plain JavaScript; the choice is where it gets converted:
  - **Tools:** Node 26 runs `.ts` directly (type stripping), so `tools/*.mjs` could become `.ts` with no build. Only erasable syntax (no `enum`, `namespace` or constructor parameter properties). Check types with `tsc --noEmit`. Needs Node 26 everywhere (`.nvmrc` already asks for it).
  - **Site, no build:** keep JavaScript, add `// @ts-check` and JSDoc types plus a `.d.ts` for `PLANNER_DATA`, and check with `tsc --noEmit`. Most of the safety, nothing to build.
  - **Site, with the bundler:** write `src/*.ts`; esbuild strips the types while bundling (no size cost). Pairs with the split and the bundler above; convert files one at a time after the split.
  - Not in-browser compiling (a large download in the zip, slow start).
  - Cost: `typescript` (20 MB+) as a devDependency, developer-side only.

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
