# Now: decide where the mod checkout lives

Inside the planner folder or beside it. Check how the other work environment has it laid out first. Then make the tools' default `--mod-root`, the README and `CLAUDE.md` match.

# Now: finish the Node port of tools/ (branch `node-tools`)

Decided 2026-11-09: one Node toolset for Windows and Linux (Node >=26, no npm dependencies); the `.ps1` files get deleted at the end. Remove this section once the port is merged.

Done and committed (`8ae1cd1` on `node-tools`, not pushed): `package.json`, `.nvmrc`, `tools/lib/common.mjs`, `tools/extract.mjs`, `tools/serve.mjs`.
- `extract.mjs` matches `extract.ps1` with 0 value differences (on Windows and on Linux); only the key order of `effects` and `strings` differs, which `app.js` doesn't depend on (it looks both up by name).
- `serve.mjs` passed the same checks as `serve.ps1`: file types, 404, path escapes, bad encoding, `version.js` = `git describe`.

To do, in this order:
1. ~~Commit the two tools~~ (done, `8ae1cd1`).
2. ~~Port `update.ps1`~~ (done, `tools/update.mjs`, `ece9990`). Same report and same `mod-sync.json` values as `update.ps1` over 8 scenarios: as is, an older sync baseline, a baseline 78 commits back (rule file list), no previous data or sync, made-up tree changes, `--tag`, newest tag with fetch, a dirty mod checkout, and `--commit` (on scratch clones). Differences on purpose, for the CHANGELOG:
   - It flags newly missing images even when the last sync had none. The PowerShell version couldn't: an `if` that returns an empty list gives `$null` there, so an empty `absentImages` (or `noWording`) counted as "no record".
   - Messages name `extract.mjs`, `getDescriptionArgs` and `--no-checkout`/`--commit`, and show the mod checkout's real path instead of `ExiledSector\`.
   - Name, tier and wording changes are compared with case (PowerShell's `-ne` ignores it), and type fields are compared with sorted keys, so the PowerShell and Node extractors' key order doesn't show up as a change.
   - `mod-sync.json` is written with 4-space `JSON.stringify` indentation (a one-time formatting diff).
3. ~~Port `package.ps1`~~ (done, `tools/package.mjs`). One `git archive` call writes the zip (git >=2.39 for `--add-virtual-file`), no zip package and no temp folder. For all 6 planner tags the unpacked zip matches the `.ps1` one byte for byte, except the `version.js` comment naming the tool. Also checked: the three refusals (no tag on HEAD, a bad tag name, a missing tag), a tag without `+es` (mod release from that tag's `mod-sync.json`, beta wording; in a scratch clone), and the zip's footer in headless Edge. Notes:
   - It archives `<tag>:web` (the four site files), which leaves the repo's `.gitattributes` behind, so it runs git with `core.autocrlf=false`: otherwise a Windows git writes the files with CRLF.
   - `--prefix` doesn't apply to `--add-virtual-file`, so `version.js` and `README.txt` are given the top folder in their path.
   - Differences on purpose: the zip also has folder entries; a tag's `mod-sync.json` is only read when the tag has no `+es` part (the `.ps1` read it always, and failed without one); messages name `--tag` and `release.mjs`.
   - Zip file dates are the build time, as before. `--mtime` (git >=2.42) could make rebuilds identical; not done.
4. Port `release.ps1` (158 lines): compare `--dry-run` tag names over the version scenarios (continue a pre-release, `--bump`, `--pre`, `--rc`, `--plain`). Never create or push real tags unless the user asks.
5. Regenerate `web/data/planner-data.js` with `extract.mjs` in a commit of its own (one-time formatting diff, values unchanged).
6. Update README (setup, run, update; the "no Node or Python needed" line), `TOOLS.md` (Commands and Extractor sections; the ASCII-only rule no longer applies), `CLAUDE.md` ("no package manager"; the `serve.ps1` and `extract.ps1` mentions) and `CHANGELOG.md`; then delete the `.ps1` files in a final commit.

Testing notes:
- Compare data by value with a script that parses both `planner-data.js` files, drops `generated` and deep-compares (the last one was in a session scratchpad; rewrite it if gone). Build the PowerShell baseline into a scratch folder with `extract.ps1 -ModRoot ... -WebRoot <scratch>`.
- PowerShell habits to port carefully: `-match`/`-like`/`-in`/`-contains` ignore case (use the `i` flag), `@($null)` is `[null]`, numbers as text use 15 significant digits.
- Test on Linux as well as Windows, from a case-sensitive copy of both repos. How to do that on a given machine (WSL, nvm) is in its `CLAUDE.local.md`.

# Later

Ideas noted for a future pass. Not built yet.

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

- **"art" vs "assets": ask the user whether to rename project-wide.** In the toolbar review the Mod art button became **Show mod assets** / **Loading assets…** / **Reconnect assets** / **Mod assets**, and its hover and the first-visit toast now say "assets" (the Mod art dialog's "Reconnect assets in the top bar" too, since it names the button). Everything else still says "art": the Mod art dialog title and text (text-review-dialogs.md), the placeholder status line, README (Mod art section, "Show mod art", "Reconnect art"), the release README.txt from `package.ps1`, CLAUDE.md and code comments. Ask before changing these.

- **Bring back "Copy link to this build"** (removed from the Templates dialog's Other ways to export on 2026-11-09). With the planner run as a local copy, a link only opens on the same computer, so it adds nothing over the saved build and Copy code. Worth adding back once the planner is hosted somewhere others can open it. `shareUrl()` and loading `#b=` links are still in `app.js`; the old button was `#btn-share` with the toasts "Link copied. It contains the whole build." / "Copy this link:" (TP97, TP102, TP103 in text-review-templates.md).

- **Template JSON in and out (removed 2026-11-09, may come back).** The Template code box used to accept a pasted single-template JSON object (anything starting with `{`, parsed in `codeToTemplate`), and "Copy template JSON" in Other ways to export copied `buildTemplate(name)` as JSON (status "Template JSON copied. Paste it into the "templates" list of the file." / toast "Copied "{name}" as template JSON.", TP100 and TP101 in text-review-templates.md). Both were removed at the user's request: codes only for now. To restore, re-add the `raw.startsWith('{')` branch and the `#tpl-copy` button.

- **Template name rule texts (low priority).** From the templates text review: TP44 (load note), TP61 (name problem) and TP63 (removed-characters note) were left as they were, to be reworded later. The user's draft said only letters, digits and spaces are allowed, but the rule (`NAME_CHAR`) also allows keyboard symbols, so ask whether to change the rule or only the wording. TP44 sits mid-sentence in the load report, so it has to start lowercase.

- **Bug: the plan status can give the wrong reason for "It may not be the fewest" (TB54).** `renderTargets` picks the reason by `targets.want.size > TARGET_EXACT_MAX`, but `computePlan` decides exact vs greedy by `T.length` (wanted units still to reach: wanted nodes already in the build are left out, and a wormhole and its partner count once). Example: 12 nodes marked wanted, 4 already allocated, and the replay had to steer around a refused node. The search was exact, but the bar says "over 10 wanted nodes the search is approximate" instead of "it had to steer around refused nodes". Fix: have `computePlan` return why the plan isn't exact (for example `approx: 'greedy' | 'steered'`) and use that in `renderTargets`. Not fixed yet, at the user's request (2026-11-09).
