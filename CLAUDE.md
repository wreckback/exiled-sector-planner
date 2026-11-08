# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static web planner for the ship skill tree of the Exiled Sector Starsector mod. It's plain HTML, CSS and JS on a canvas: no framework, no build step, no package manager, no tests or linters. `README.md` is the user guide and `CHANGELOG.md` lists what has been built.

- `ExiledSector/` is the mod's own git checkout. It is the data source only: read it, never edit it. It has its own `CLAUDE.md`, which applies when working inside it. `tools/update.ps1` is the only thing that moves it, by checking out a release tag.
- The planner folder is its own git repo (branch `main`), with `ExiledSector/` and personal template files ignored. Generated data and assets are committed, so each mod sync shows up as one diff.
- `tools/extract.ps1` builds `web/data/planner-data.js` and `web/assets/` from the mod. Both are generated, so don't hand-edit them.
- `web/` is the whole site: `index.html`, `style.css` and `app.js`.

## Commands (Windows; no Node or Python on this machine)

```powershell
powershell -ExecutionPolicy Bypass -File tools\update.ps1    # mod -> newest release tag, extract, check, diff, record (-Tag, -NoCheckout, -NoFetch, -Commit)
powershell -ExecutionPolicy Bypass -File tools\extract.ps1   # rebuild data + assets from ExiledSector/ as checked out
powershell -ExecutionPolicy Bypass -File tools\serve.ps1     # http://localhost:8765/  (-Port to change)
```

- `extract.ps1` prints how many effects have no wording, plus any image the mod doesn't ship. A jump in either usually means the mod's Java or CSV layout changed and a regex in the extractor needs updating.
- `update.ps1` compares against `tools/mod-sync.json` (last synced release and commit, plus the lists of effects without wording and absent images, so only new ones are flagged). Its `$rulePattern` lists the mod files whose logic the planner reimplements. Add a class there when you port new mod logic into `app.js` or `extract.ps1`. If app.js's template versions change, update `$PlannerTemplateVersion` and `$PlannerFileVersion` at its top.
- The scripts must stay ASCII. Windows PowerShell 5.1 reads BOM-less files as ANSI, so a character like `…` gets garbled.
- The page also runs from `file://`, because data loads as a `<script>`, not via `fetch`. The Claude in Chrome extension refuses `file://`, so test through `serve.ps1`.
- `serve.ps1` is single-threaded and serves ~270 images one at a time, so art appears a few seconds after load. That's expected.

## Verifying changes

There is no test suite. Verify in the browser through the debug hook `window.planner` at the bottom of `app.js`. It exposes `state`, `byId`, `cam`, `pathTo`, `removalSet`, `allocate`, `chooseRoot`, `click(id, ctrl)`, `pick`, `load(json)`, `serialize`, `totals`, `describe`, `setWormholeOption`, `templateSteps`, `buildTemplate`, `mergeTemplate`, `importTemplate` and `currentNodeId`. `window.plannerTemplatesTest(text)` shows a template file's list without the file picker, which needs a real user click.

The user often has their own build open in the same browser, and it persists in `localStorage`. When testing in their tab:
- Save `planner.serialize()` first and `planner.load(saved)` afterwards, inside `try/finally`.
- Save and restore `localStorage['esp.lastChoice']` the same way.
- Reload the tab at the end. The undo stack is in memory, and leaving test steps in it lets Undo step into them.
- Don't click toolbar buttons by remembered coordinates. Added buttons shift the layout.

## Architecture (web/app.js, one IIFE)

The sections run top to bottom in this order:

1. **Model:** nodes, types and connectors are built from `PLANNER_DATA`.
   - Links in `connectedTo` are symmetric, and `n.adj` is the neighbour list.
   - Curves store the point the curve passes through. The quadratic control point is `2*through - midpoint`, as in the mod's `SkillTreeNodeConnectorRenderer`.
   - `hiddenConnectors` (wormhole pair links) are adjacent but not drawn.
   - `regions` holds one entry per tree (core plus each faction volume) for the zoomed-out labels. It uses the median centre because some volume nodes sit far from their tree.
2. **Build state:** `state = { root, alloc (insertion-ordered Set, root excluded), choice, links (socket→exit), hull, cap, coreWormholes, volumes }`.
   - Every mutation goes through `pushUndo()` and then `changed()`. `changed()` recomputes totals, the preview, chrome, panel and persistence, and clears the URL hash.
3. **Rules,** mirroring the mod's `AllocationCheck`:
   - `sat(id)`: allocated, or the chosen root.
   - `partnerOf(n)`: a static `pairedWith` wormhole, or a socket↔exit link.
   - `switchedOff(n)`: the wormhole toggles.
   - `pathTo(target)`: BFS from all satisfied nodes. A wormhole exit can only be entered through its partner, and taking a wormhole also takes its partner.
   - `removalSet(n)`: what removing a node takes away, i.e. everything cut off from the root.
   - `pruneSwitchedOff()`: cleanup after a toggle or a load.
   - `jumpTarget(n)` is for navigation only. It uses `pairedWith` directly, so it works even when a toggle is off, unlike `partnerOf`. `jumpTo` moves the camera and sets `flash`. In `primaryAction`, Ctrl+click jumps for wormholes, sockets and exits, and only reaches the choice-node quick pick when there's no jump target.
   - New rules belong in these functions so allocation, preview, tooltips and import all stay consistent.
4. **Templates:** `templateSteps` is a port of the mod's `TemplateCapture`. `buildTemplate` and `mergeTemplate` follow `TemplateCodec` and `SkillTreeTemplateStore`. `importTemplate` replays steps over several passes.
   - Template codes: `templateToCode` and `codeToTemplate` produce `ES1.` + base64url(deflate-raw(JSON of the file entry without `id`, plus `mod` version)). The uncompressed fallback is `ES0.`. Codes keep node ids, not indices, so renames still map on import.
5. **Serialization:** the share link is `#b=` plus base64url JSON of node ids, and the same JSON is saved to `localStorage['esp.build']`.
6. **Text:** `describeRaw(effect, magnitude)` produces game markup (`<good>`, `<bad>`, `<hl>`) and `styled()` turns it into HTML. Lookup order:
   1. An `effect.NAME` string, with `.one`/`.other`/`.more`/`.less` variants and extra args evaluated from extractor expressions.
   2. A weapon family (`weapon.stat.*`).
   3. A stat plus mode (`desc.<pct|flat|mult>.<up|down>`).
   4. A humanized fallback.
7. **Canvas rendering:** draws in world space via `ctx.setTransform`, with line widths divided by zoom. A rAF loop runs every frame for the breathing rings and the keyboard camera. A node draws as a dot when it's under 5px on screen. Region labels are drawn last, in screen space.
8. **DOM wiring:** toolbar, summary panel, tooltip, pickers, shortcuts dialog (`#keys`), Templates dialog (`#export`), and keyboard, pointer and touch input.

## Extractor (tools/extract.ps1)

`extract.ps1` reads mod data without running Java, so much of it parses Java source with regexes:

- **Effect wording:** each `*SkillEffect.java` enum constant gives a mode (`statEffect(PERCENT|FLAT|MULT, …)`), a stat key (a `"stat.x"` literal or a `static final String` constant) and `lowerIsBetter`. Custom `description()` overrides give `.arg(name, expr)` expressions, with numeric constants resolved across all main sources.
- **Description helpers:** `Get-DescriptionArgs` follows calls in a description body into helper methods (for example `BorrowedGraceListener.describe(this, magnitude, X)` or `RiftStrike.describe(msg)`), replacing the helper's parameters with the call's arguments. It also handles `<Table>.withShipSizeArgs` (`HullSizeTable` constants, giving frigate/destroyer/cruiser/capital) and `AffinityScaling` step constants (`{step}`). `LowBaseArmorBonus` is special-cased: `join(...)` builds "a/b/c/d" lists, and `hullArgs` drives the `effect.NAME.hullSize` wording.
  - To find regressions, scan in the browser for any `describe(name, 3)` output that still contains "?".
  - Don't pipe `extract.ps1` into `Select-Object -First N`. That stops the script before it writes the data file, so the next check reads stale output.
- **Weapon effects:** these are generated names (`ScopedWeaponEffect`: `<SCOPE_>WEAPON_<FAMILY>_<MODE>`), so they're matched by pattern.
- **Other tables:**
  - affinity step bonuses (`AffinitySteps`)
  - retired affinity options (`AffinityOptions`)
  - unqualified weapon families (`WeaponStatFamily`)
  - hull mod names (`docs/analysis/balance.csv`)
  - anchor item ↔ exit node (`wormhole_anchors.csv`)
  - node and type renames (`node_replacements.csv`, `node_id_renames.csv`, `type_id_renames.csv`)
  - mod version (`mod_info.json`, `{major,minor,patch}`)
- **Output:** a JS global (`window.PLANNER_DATA = …;`), not JSON. Spot-check it from PowerShell with `$raw.Substring(21).TrimEnd("`n",';') | ConvertFrom-Json`.

## Mod facts the code depends on

- **Coordinates:** world y grows downward. Tier sizes are `NODE_SIZE` 64 times the tier multiplier (ROOT 2.5, WORMHOLE 1.3, SOCKET 1.2).
- **Node cap:** the mod default `exiledSector_levelMaxAllocatedNodes` is 60, and the root counts toward it. The Nodes counter is `alloc.size + 1`.
- **Template file:** `saves/common/exiledSector_skillTreeTemplates.json.data`, shaped `{"v":1,"templates":[…]}` (a bare array also reads).
  - Each template is `{v,id,name,root,hull: FRIGATE|DESTROYER|CRUISER|CAPITAL_SHIP, steps, anchors?}`.
  - Steps are `node` or `node=option`, the root is excluded, and a partner follows its wormhole or socket.
  - Names are at most 32 characters and unique per root, case-insensitive, whatever the hull. `uniqueTemplateName` ports `TemplateNames.unique`.
  - `hull` filters the in-game template list, which defaults to the current ship's size (`TemplateFilter`). The game's `replaceSteps` keeps an existing template's hull. `mergeTemplate(text, name, 'keep'|'change')` does the same, and the dialog's `startSave` asks before a save would replace a template whose hull differs from the dropdown.
  - The game re-reads the file when the skill tree opens and before every template change. The planner keeps entries it can't parse, and refuses to touch a file that isn't valid JSON.
- **When the mod changes,** compare against the mod sources named above, which are the reference: `AllocationCheck`, `TemplateCapture`, `TemplateCodec`, `SkillTreeTemplateStore`, `AffinitySteps`. Then rerun the extractor.

## Conventions the user asked for

- **Function over looks in CSS:** system font, solid opaque panels, no shadows, gradients, transitions, rounded corners or uppercase letter-spaced labels. Colour is only for meaning: good/bad values, notable and keystone, over-cap, focus. The canvas art (glows, nebulae) was not part of that request and stays.
- **Shortcuts:** the list in `#keys` in `index.html` is written by hand. Update it, and the `#help` line, whenever controls change.
- **Toggling elements:** use the `hidden` attribute. `style.css` has `[hidden]{display:none!important}` because some dialogs set `display: flex`.
