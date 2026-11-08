# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static web planner for the ship skill tree of the Exiled Sector Starsector mod. It's plain HTML, CSS and JS on a canvas: no framework, no build step, no package manager, no tests or linters. `README.md` is the user guide and `CHANGELOG.md` lists what has been built.

- `ExiledSector/` is the mod's own git checkout. It is the data source only: read it, never edit it. It has its own `CLAUDE.md`, which applies when working inside it. `tools/update.ps1` is the only thing that moves it, by checking out a release tag.
- The planner folder is its own git repo (branch `main`, pushed to a private GitHub repo).
  - Ignored: `ExiledSector/`, personal template files, and `web/assets/` (an old local art copy, no longer read or written).
  - The art belongs to the mod and the authors it credits, so it's never republished: not in git, not in the release zip. The page reads it from the mod folder each user chooses (see Mod art below).
  - The generated `planner-data.js` is committed, so each mod sync shows up as one diff.
  - History was rewritten once to drop the art, before the first push. Don't re-add `web/assets`.
- `tools/extract.ps1` builds `web/data/planner-data.js` from the mod. It's generated, so don't hand-edit it.
- `web/` is the whole site: `index.html`, `style.css` and `app.js`.

## Commands (Windows; no Node or Python on this machine)

```powershell
powershell -ExecutionPolicy Bypass -File tools\update.ps1    # mod -> newest release tag, extract, check, diff, record (-Tag, -NoCheckout, -NoFetch, -Commit)
powershell -ExecutionPolicy Bypass -File tools\extract.ps1   # rebuild the data from ExiledSector/ as checked out
powershell -ExecutionPolicy Bypass -File tools\serve.ps1     # http://localhost:8765/  (-Port to change)
powershell -ExecutionPolicy Bypass -File tools\release.ps1   # tag vX.Y.Z[-alpha.N|-beta.N|-rc.N]+es<mod release> (-Version, -Bump, -Pre, -RC, -Plain, -Push, -DryRun)
```

- `package.ps1 [-Tag <tag>]` builds `dist\exiled-sector-planner-<tag>.zip` from `git archive` of the tag plus a README.txt. It holds no art. `dist/` is excluded in `.git/info/exclude`.
- `release.ps1` takes the mod release from `tools/mod-sync.json` and refuses on a dirty tree or stale data. With neither `-Version` nor `-Bump`, it continues the newest open pre-release (`-Pre alpha|beta|rc`) or releases it (no `-Pre`). Stages only move forward (alpha, beta, rc). The user chose alpha for internal test builds. Only create or push real tags when the user asks.

- `extract.ps1` prints how many effects have no wording, plus any image the data refers to that the mod doesn't ship. A jump in either usually means the mod's Java or CSV layout changed and a regex in the extractor needs updating.
- `update.ps1` compares against `tools/mod-sync.json` (last synced release and commit, plus the lists of effects without wording and absent images, so only new ones are flagged). Its `$rulePattern` lists the mod files whose logic the planner reimplements. Add a class there when you port new mod logic into `app.js` or `extract.ps1`. If app.js's template versions change, update `$PlannerTemplateVersion` and `$PlannerFileVersion` at its top.
- The scripts must stay ASCII. Windows PowerShell 5.1 reads BOM-less files as ANSI, so a character like `…` gets garbled.
- The page also runs from `file://`, because data loads as a `<script>`, not via `fetch`. The Claude in Chrome extension refuses `file://`, so test through `serve.ps1`.

## Verifying changes

There is no test suite. Verify in the browser through the debug hook `window.planner` at the bottom of `app.js`. It exposes `state`, `byId`, `cam`, `pathTo`, `findPath(id, opt)`, `blockOf(id, opt)`, `problems()`, `setShip(fn)`, `typesExclusive(a, b)`, `setAffinitySplit({option: count})`, `removalSet`, `allocate`, `chooseRoot`, `click(id, ctrl)`, `pick`, `load(json)`, `serialize`, `totals`, `describe`, `setWormholeOption`, `templateSteps`, `buildTemplate`, `mergeTemplate`, `importTemplate`, `currentNodeId`, for waypoints `waypoints()`, `toggleWaypoint(id)`, `clearWaypoints` and `routeTo(id, opt)`, and for target mode `targets` (`{mode, want, forbid, keep}`), `setTargetMode`, `setTargetKeep`, `cycleTarget(id)`, `plan()` and `applyPlan`. Ship rules can be set in a test build through `load` (the `ship` field of the serialized JSON). `window.plannerTemplatesTest(text)` shows a template file's list without the file picker, which needs a real user click. `plannerTemplatesTest.link(handle)` links a stand-in handle (an object with `name`, `queryPermission`, `getFile` and `createWritable`) to test the file watcher, and `.poll()` runs one watcher check.

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
2. **Build state:** `state = { root, alloc (insertion-ordered Set, root excluded), choice, links (socket→exit), hull, cap, coreWormholes, volumes, ship }`.
   - `ship` (`blankShip()`) holds both kinds of setting. Ship rules are the `SHIP_KEYS` (shield, armor, the tri-state facts, hull mods, extra logistics), where `null` means "not set, don't check". Story rules are `lockedGates` and `lockedTypes`.
   - Both serialize under `ship` in the build JSON.
   - `subs` maps socket → `{id, aff?, grants?}`, serialized as `sb`. A socket holds an anchor (`links`) or a subroutine, never both. Dropped with its socket (`dropOrphanSubs`) and on reset or template import.
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
   - **Node rules** port `NodeEligibility.check`. `blockOf(n, option, list)` returns `{kind, text}` or null for allocating `n` after the entries in `list` (built by `buildEntries`/`entryFor`, in allocation order). It checks, in the game's order: locked gates and types, hull size, `req_*` hull tags, ship hull mods, node conflicts (`typesExclusive` over `typeRules`: own hull mods versus excluded ones, from `hullModConflicts`), `EFFECT_BLOCKS` (one entry per effect with `blocks` in the data, using `currentShield(list)`), and the logistics cap.
   - **Waypoints** (Shift+click, `waypoints`, in memory only): `routeTo` is `waypointPlan` while any are set, and `findPath` otherwise. Allocation, the preview, the tooltip and the wormhole picker all go through `routeTo`. `segmentPath` searches each leg from the previous waypoint, or from the build for the first leg, and keeps every new node on it so the route really passes the waypoint. The rules are then checked over the whole route in order. `allocate` drops the waypoints it used.
   - `placement` picks a choice node's option (any allowed option will do). `findPath(target, option, remembered)` searches around nodes that `staticBlock` refuses, then checks the path node by node. It returns `{path, options}` or `{path: null, block}`, and `pathTo` wraps it.
   - `rules()` caches the build entries, per-node `staticBlock` results, and `problems` (allocated nodes breaking a rule, found by replaying the build in order). `changed()` clears the cache. Problems are flagged, never pruned.
   - Problems draw a red ring. With "Mark refused" on (`markRefused`, `localStorage['esp.markRefused']`), `isMarkedRefused` nodes also get `drawRefusedMark` (a red X), or a red dot when zoomed out.
   - Wording comes from the mod's `node.block.*` and `node.requires.*` strings.
   - **Subroutines:**
     - `subState()` is cached per change, like `rules()`. Active means the socket is allocated, in socket-id order. It works out:
       - Empty Shell's silenced nodes and count
       - nodes gated by Phoenix/P-Space (the first socket wins)
       - the doctrine (the first one only; radius and possibilities, never simulated)
       - the Root Conduit route (`conduitRoute`, computed after the grants)
       - modspec cache grants with a status (active, byPath, duplicate, volumeOff, ineligible)
     - The radius is `nodesInRadius`: straight-line distance from the socket, Exotech excluded, sizes from `nodeRadii`.
     - Granted nodes are `held()`, not `sat()`. They give effects and count in `buildEntries`, but they aren't neighbours, don't take a slot, and can't be path targets.
     - `totals()` drops silenced nodes, moves gated nodes into `gated` (live-in-combat effects × strength, from the extractor's `live` flag), moves temporary nodes (`temporaryAfterDeploymentSeconds`) into `temp` (seconds to sums), and adds the Empty Shell and Conduit affinity. Every sum keeps `by` (source name to amount, merged by name) for the stat sheet's Sources.
   - **Mod art:** `img(path)` and the HTML helper `iconImg(path, name)` use `artUrls` (mod-relative path to blob URL). Without art they give placeholders: `drawPlaceholderIcon` (a disc tinted by `OPTION_TINT`/`TIER_TINT`, with initials), `drawPlaceholderSplit` (unallocated choice nodes as a pie, affinity in the tech colours), a drawn halo, a lettered `.icon-ph` box, and no decoration images. `drawNodeLabels` writes names under nodes in screen space, only while `placeholderMode()` (no art loaded), from the zoom thresholds in `LABEL_STYLE`. It skips affinity nodes. `setArt(urls|null)` swaps the art and clears the image cache. `artPaths()` lists every image the page draws.
     - The source is the Mod art dialog (`#art`, `#btn-art`), near the end of the file. Chrome/Edge: `showDirectoryPicker`, with the handle in IndexedDB (`handles` store, key `modFolder`) and read permission re-asked through **Reconnect art**. Elsewhere: a `webkitdirectory` input (`readArtFiles`). `findModDir` accepts the mod folder, or finds it in `mods/` or a direct subfolder, by a `mod_info.json` with id `exiledSector`. Lookups fall back to case-insensitive names.
     - A failed pick keeps the current art. `artGen` drops stale reads.
     - Test without the picker: `plannerArtTest.link(dirHandle)` with a stand-in handle (`name`, `getDirectoryHandle`, `getFileHandle`, `values`, `queryPermission`), `.files(fileList)`, `.forget()` and `.status()`. `.placeholders(true)` shows the art-free look without forgetting the folder (`false` reads it again), so it's safe in the user's tab. Headless Edge with a scratch `--user-data-dir` and `--dump-dom` works when the Chrome extension isn't connected.
4. **Templates:** `templateSteps` is a port of the mod's `TemplateCapture`. `buildTemplate` and `mergeTemplate` follow `TemplateCodec` and `SkillTreeTemplateStore`. `importTemplate` replays steps over several passes.
   - Template codes: `templateToCode` and `codeToTemplate` produce `ES1.` + base64url(deflate-raw(JSON of the file entry without `id`, plus `mod` version)). The uncompressed fallback is `ES0.`. Codes keep node ids, not indices, so renames still map on import.
5. **Serialization:** the share link is `#b=` plus base64url JSON of node ids, and the same JSON is saved to `localStorage['esp.build']`.
6. **Text:** `describeRaw(effect, magnitude)` produces game markup (`<good>`, `<bad>`, `<hl>`) and `styled()` turns it into HTML. Lookup order:
   1. An `effect.NAME` string, with `.one`/`.other`/`.more`/`.less` variants and extra args evaluated from extractor expressions.
   2. A weapon family (`weapon.stat.*`).
   3. A stat plus mode (`desc.<pct|flat|mult>.<up|down>`).
   4. A humanized fallback.
7. **Canvas rendering:** draws in world space via `ctx.setTransform`, with line widths divided by zoom.
   - **Theme:** `theme` is `dark` or `light` (`themeSetting` may be `auto`, following `prefers-color-scheme`), set by `applyTheme`/`setTheme` and the `#btn-theme` button, saved to `localStorage['esp.theme']`. `<html data-theme>` switches the CSS variables in `style.css`.
   - The canvas reads colours from the palette `P` (`THEMES.dark`/`THEMES.light`). Put new canvas colours there, not as literals.
   - In light mode `rgba()` deepens bright colours (`deepen`: HSL lightness capped near 0.4). This also applies to the inline affinity colours in the panel. Use `rgbaRaw()` for colours that must stay as they are. `deepen(c, L)` takes a target lightness: the star uses 0.56 for its body and 0.7 for its centre in light mode.
   - `dimmed()` caches per theme (`rec.dimTheme`). Nebulae use `P.nebulaOp`/`P.nebulaA`. A rAF loop runs every frame for the breathing rings and the keyboard camera. A node draws as a dot when it's under 5px on screen. Region labels are drawn last, in screen space.
   - **Stat sheet** (after the Theme button wiring): `statSheet()` builds sections in `STAT_GROUPS` order from `cachedTotals` (permanent, then `temp` with `summary.forFirst`, then `gated` with `summary.gated.*` via `GATE_KEYS`). `sheetTabHtml()` is the summary panel's `sheet` tab. `#statsheet` is the Full Sheet overlay: `renderSheet()` lays sections into the shortest of `floor((width + 24) / 424)` columns, like `StatSheetLayout.build`, and `renderPanel` re-renders it while it's open. `#sheet-tip` shows a row's `by` sources (`.game` styles it like the game's tooltip).
   - **List view** (after the stat sheet): `#listview` covers the map area when `setView(true)` (button `#btn-view`, key `L`). `listMode` is `all` (`listNodes`: every node except affinity and structural ones) or `build` (root plus `state.alloc` in order, affinity nodes summed per effective option into one entry, `affRowHtml`). In target mode the `all` rows carry `[data-mark]` Want/Forbid buttons (`setTargetMark`); a row click cycles (`cycleTarget`) and right-click clears; `targetsChanged()` calls `refreshList()`. `setView` moves `#targets` into `#listview` (above the rows) and back before `#file-notice`. `listEntries()` turns either into entries `{place, rank, name, order, count, html}`; the `order` sort only applies to `build`. `renderList()` keeps the ones in `searchHits` (so the search box and Filter apply), sorted by name (`Intl.Collator` numeric) or grouped by `shortPlace` (core sides in `CORE_SIDE_ORDER`, then volumes; `TIER_RANK` inside). Group headings are `[data-group]` buttons toggling `listCollapsed` (by place name, saved to `localStorage['esp.listCollapsed']`); collapsed rows aren't rendered or in `listOrder`. `refreshList()` is called from `runFilter` and `renderPanel`. While the list shows, `runFilter` keeps the panel's Search tab hidden, and `setView` reruns `runFilter` to restore it.
8. **Targets** (the section after `primaryAction`/`secondaryAction`): target mode marks nodes wanted or forbidden (`targets`, saved to `localStorage['esp.targets']`, not in the build JSON or undo). While it's on, clicks cycle marks, the tooltip shows `targetTooltipNote`, and `updatePreview` previews the plan instead of the hovered path.
   - `computePlan` (cached in `planCache`, cleared in `changed()`) builds `planGraph`: units of a node plus its `partnerOf`, with the base (root, plus the allocation when "Keep current build" is on) contracted into unit 0. Edges are directed, since exits are entered only through their partner. Forbidden nodes, nodes refused against the base, and nodes the replay steered around are blocked.
   - `steinerExact` (node-weighted directed Dreyfus-Wagner) runs for up to `TARGET_EXACT_MAX` wanted units, and `steinerGreedy` (shortest-path heuristic) above that, followed by `pruneTree` and `planOrder` (breadth-first from the base).
   - The rules are then replayed with `placement`. A refused non-wanted node, or the non-wanted side of a clash, logistics or shield refusal, is avoided and the search reruns, up to `TARGET_RETRIES` times. Anything else is reported as not possible.
   - `applyPlan` is one undo step.
   - **Search highlight:** `drawSearchGlow` (under the nodes) and `drawSearchRings` (over them, before the labels) draw every node in `searchHits`, with minimum screen sizes, `P.searchOutline` behind the gold, and a second ring on `searchOrder[searchCursor]`. Dimming of the rest is `SEARCH_DIM_NODE` (nodes, via `nodeAlpha`) and `SEARCH_DIM_LANE` (dull lanes).
   - **Filter** (in the search section; button `#btn-themes`, labelled Filter): `nodeThemes(n)` (cached; null for structural tiers; a choice node gets the union of its options' theme tags), `themeFilter` (theme ids plus `NO_THEME`), `themeMatchAll`, and `showAffinity` (Show affinity nodes). Affinity nodes (`isAffinityNode`) never match a theme. `filterMatch(n)` is `themeMatch(n) || (showAffinity && isAffinityNode(n))`, and `filterCount()` counts ticked entries. `runFilter()` combines it with the search text into `searchHits`/`searchOrder`, so the canvas dimming and the Search tab are shared. The popover is `#theme-filter`. Its tick boxes use `data-theme-tag`, not `data-theme`, which `<html>` already uses for the colour theme, so `closest('[data-theme]')` would find `<html>`.
9. **DOM wiring:** toolbar, summary panel, tooltip, pickers, shortcuts dialog (`#keys`), Story rules dialog (`#story`, `renderStory`), Templates dialog (`#export`), Mod art dialog (`#art`, `renderArt`), and keyboard, pointer and touch input. Opening one dialog closes the others.
   - Ship rules are the summary panel's Ship tab. It's `#panel-ship`, a persistent form beside `#panel-body`, so re-renders don't lose typing. `renderPanel` shows it when `panelTab === 'ship'` and calls `renderShipPane`.
   - Every change to ship or story rules goes through `setShip(fn)`, which pushes undo and warns about new problems.

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
  - hull mod names: the in-game names in the mod's test resource `exiledsector-core/src/test/resources/i18n/hullmod_names.csv` (vanilla and other mods), then `docs/analysis/balance.csv`, then `data/hullmods/hull_mods.csv`. `app.js` falls back to the name of the skill type that grants a hull mod, then the id. `update.ps1` warns if the test resource moves. The Ship rules dialog lists hull mods by name, adding the id only when two share a name.
  - hull mod conflicts (`hullmod_conflicts.csv`, as symmetric partner lists), the logistics cap (`LogisticsNodes.DEFAULT_CAP`), and a `blocks` flag on effects that override `blockAllocationReason`
  - block reasons and gate wording (`node.block.*`, `node.requires.*`, `socketable.anchor.gate.*` strings)
  - subroutines:
    - `subroutines.csv` merged with `doctrine_archives.csv`
    - doctrine modifier ranges (`item_modifiers.csv`, scope doctrine)
    - `node_radii.json`
    - per-kind limits (`SubroutineKind`)
    - item icons
  - a `live` flag on effects read live in combat (`StatTarget.liveStat/liveBonus` in the enum constant, a helper class that only builds live targets, or a live `WeaponStatFamily`). It decides what survives gating.
  - anchor item ↔ exit node (`wormhole_anchors.csv`)
  - node and type renames (`node_replacements.csv`, `node_id_renames.csv`, `type_id_renames.csv`)
  - mod version (`mod_info.json`, `{major,minor,patch}`)
  - theme tags (`SkillTags.THEME`, in order) with names from `theme.*`, as `themes`
  - the in-game stat sheet sections: `statGroups` (the `StatGroup` enum order) and a `group` on every effect, from the package of its `*SkillEffect.java` file through `StatGroup.of`'s `case "pkg" -> GROUP` lines (default `MECHANICS`; generated weapon effects are `WEAPONS`). Types keep `temporaryAfterDeploymentSeconds`.
- **Output:** a JS global (`window.PLANNER_DATA = …;`), not JSON. Spot-check it from PowerShell with `$raw.Substring(21).TrimEnd("`n",';') | ConvertFrom-Json`.

## Mod facts the code depends on

- **Coordinates:** world y grows downward. Tier sizes are `NODE_SIZE` 64 times the tier multiplier (ROOT 2.5, WORMHOLE 1.3, SOCKET 1.2).
- **Node cap:** the mod default `exiledSector_levelMaxAllocatedNodes` is 60, and the root counts toward it. The Nodes counter is `alloc.size + 1`.
- **Template file:** `saves/common/exiledSector_skillTreeTemplates.json.data`, shaped `{"v":1,"templates":[…]}` (a bare array also reads).
  - Each template is `{v,id,name,root,hull: FRIGATE|DESTROYER|CRUISER|CAPITAL_SHIP, steps, anchors?}`.
  - Steps are `node` or `node=option`, the root is excluded, and a partner follows its wormhole or socket.
  - Names are at most 32 characters and unique per root, case-insensitive, whatever the hull. `uniqueTemplateName` ports `TemplateNames.unique`.
  - The mod accepts any non-control character (`SkillTreeTextField`). The planner deliberately limits names to printable ASCII (`NAME_CHAR`, `templateNameProblem`, `guardNameInput`), because the game's LWJGL keyboard input and default Insignia font only reliably handle those. The user chose this.
  - `state.template` (`{name, sig}`) names the loaded or last saved template in the top bar. `sig` hashes the root and steps for the "(edited)" mark.
  - `hull` filters the in-game template list, which defaults to the current ship's size (`TemplateFilter`). The game's `replaceSteps` keeps an existing template's hull. `mergeTemplate(text, name, 'keep'|'change')` does the same, and the dialog's `startSave` asks before a save would replace a template whose hull differs from the dropdown.
  - The game re-reads the file when the skill tree opens and before every template change. The planner keeps entries it can't parse, and refuses to touch a file that isn't valid JSON.
  - The planner watches the linked file. `watchMode` is `observe` (the default: a `FileSystemObserver` on `linkedHandle`, with a 300 ms settle before reading, and no fallback to the timer by the user's choice), `poll` (a timer every `watchSecs`, only when chosen) or `off`. The top bar's **Check file** (`#btn-checkfile`, `checkFileNow`) checks on demand in any mode. It asks for access (it's a user gesture, so it reconnects after a restart), shows the same notice, and toasts "No changes" or "rewritten, same templates". `renderWatchStatus` shows it whenever `linkedHandle` is set. Both are set in the Templates dialog (`#tf-watch-mode`, `#tf-watch`) through `setWatch`, and saved to `localStorage['esp.watchMode']` and `['esp.watchSecs']`. A stored `watchSecs` of 0, from before the mode setting existed, means off.
  - `scheduleWatch` starts the observer in `observe` mode when it's available and not `observerBroken` (otherwise nothing runs), and the timer in `poll` mode. It runs neither while `document.hidden`, without a link, or without access granted this visit. `visibilitychange` reschedules it, retries a broken observer, and checks at once on return. The first `readLinked` of a link starts watching.
  - An `errored` record, or `observe()` throwing, sets `observerBroken`, which stops watching until the tab is shown again or the file is relinked. `renderWatchStatus` writes what's running into `#tf-watch-note`, and `#tf-watch-limits` explains the browser limits.
  - `pollLinked` is the single check for both triggers. It compares `lastModified:size` with `linkedStamp`, reads the text only when that changes, and retries a failed read up to 3 times while the observer is in charge. To test the real observer, link an OPFS handle (`navigator.storage.getDirectory()`), and remove the test file afterwards.
  - `readLinked` calls `noticeOutsideChange`, which compares the new text with `linkedText` (the planner's last read or write). It diffs templates by id, or by root and name, and raises `#file-notice`. When the build's own template (`state.template`) changed, the notice offers to load it with `loadTemplate`.
  - `commitSave` sets `linkedWriting` and updates `linkedText`/`linkedStamp` after writing, so the planner's own saves don't count as outside changes. A new link (`linkFile`, `forgetLinked`) resets `linkedText`, so its first read isn't a change.
- **Node rules:**
  - In game, the per-ship `req_*` tags other than the hull ones (`req_shields`, `req_ballistic` and so on) don't block allocation. `NodeEligibility.Context.of` passes no ship profile, so the planner only shows them in tooltips.
  - Hull requirement tags (`req_civilian_hull`, `req_non_phase_hull`, `req_system_charges`, `req_modules`) do block.
  - Learned hull mod conflicts, item costs and the docked-only logistics rule aren't modelled.
- **Socket items:** the 6 core sockets take wormhole anchors or subroutines, one item per socket.
  - Doctrine rolls (REWRITE and AUGMENT), the Conduit's affinity and the cache's notables all come from a hidden per-item seed. The planner asks for what it can (the affinity and the notables) and only describes doctrines.
  - The Root Conduit gives +5 per route node, which is hard-coded from `RootConduits.AFFINITY_PER_NODE`.
  - BYPASS has no items.
- **When the mod changes,** compare against the mod sources named above, which are the reference: `AllocationCheck`, `NodeEligibility`, `TemplateCapture`, `TemplateCodec`, `SkillTreeTemplateStore`, `AffinitySteps`. Then rerun the extractor.

## Conventions the user asked for

- **Function over looks in CSS:** system font, solid opaque panels, no shadows, gradients, transitions, rounded corners or uppercase letter-spaced labels. Colour is only for meaning: good/bad values, notable and keystone, over-cap, focus. Every page colour is a CSS variable, with light values under `:root[data-theme="light"]`, so add new ones as variables in both sets. The canvas art (glows, nebulae) was not part of that request and stays, and neither is the Full Sheet (`#statsheet`), which copies the game's stat sheet colours in the dark theme. In the light theme it keeps the game's layout in light colours (the `:root[data-theme="light"] #statsheet` rules), as the user asked for the sheet to follow the theme.
- **Shortcuts:** the list in `#keys` in `index.html` is written by hand. Update it, and the `#help` line, whenever controls change.
- **Toggling elements:** use the `hidden` attribute. `style.css` has `[hidden]{display:none!important}` because some dialogs set `display: flex`.
