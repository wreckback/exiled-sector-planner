# Changelog

Everything built so far, oldest first. All of it was done on 2026-11-08, against Exiled Sector 0.11.0 and then 0.11.1.

## Data extraction (`tools/extract.ps1`)

- Reads the mod checkout and writes `web/data/planner-data.js` (as a JS global, so the page also works from disk). It used to copy every image the tree uses into `web/assets/` as well; see Mod art from the user's folder.
- Effect wording comes from the mod's string files plus regex parsing of the Java effect enums: mode, stat key, lower-is-better, and description arguments with Java constants resolved. Generated weapon effects are matched by name pattern. Wording was found for 273 of 284 effects.
- Other tables extracted:
  - affinity threshold bonuses (`AffinitySteps`)
  - hull mod names (from the balance sheet)
  - anchor item ↔ exit node pairs (`wormhole_anchors.csv`)
  - node and type rename tables, plus retired affinity options, for importing old templates
  - the mod version (`mod_info.json`'s `{major,minor,patch}` form; this had been coming through blank)

## Mod updates (`tools/update.ps1`)

- One command to follow a mod release: fetch tags, check out the newest release (or `-Tag`), run the extractor, check the data, compare the tree, list changed mod rule files, and record the sync in `tools/mod-sync.json`.
- The checks run without a browser: unfilled wording placeholders, effects newly without wording, newly missing art, unknown node types and tiers, missing, one-way or non-mutual links, the template format versions, and the default node cap.
- The project folder is now a git repo, so each sync can be one commit (`-Commit`).
- `tools/release.ps1` tags releases and pre-releases as `vX.Y.Z[-alpha.N|-beta.N|-rc.N]+es<mod release>`. It numbers pre-releases, moves them through the stages, releases them, bumps from the last release, and refuses on a dirty tree or stale data. The tag message lists the changes. The first internal test build, tagged `v0.2.0-rc.1`, was renamed `v0.2.0-alpha.1`.
- `tools/package.ps1` builds the ready-to-use zip for a tag: the site from the tag (`git archive`) and a README.txt. It no longer includes art or the mod's CREDITS.md.

## Local server (`tools/serve.ps1`)

- A small PowerShell static server, since this machine has no Node or Python.
- It used to crash when the browser dropped a connection mid-transfer (a reload while images loaded). It now skips that request and keeps serving.

## Node tools (`tools/*.mjs`, 2026-11-09)

- The PowerShell scripts were replaced by Node scripts that run the same way on Windows, Linux and macOS: `extract.mjs`, `serve.mjs`, `update.mjs`, `release.mjs` and `package.mjs`, with shared helpers in `tools/lib/common.mjs`. They need Node 26+ (`.nvmrc`) and git 2.39+, and have no npm dependencies. Options are `--` style (`--tag`, `--no-checkout`, `--dry-run`…), each tool has `--help`, and `npm run <tool>` works too.
- The mod checkout can live anywhere: `--mod-root <path>` or the `ESP_MOD_ROOT` environment variable, else `ExiledSector/` in the planner folder as before.
- Each was checked against the script it replaces:
  - `extract.mjs` writes the same data values (on Windows and Linux). Only the key order of `effects` and `strings` and the JSON escaping differ, so the data was regenerated once in a commit of its own.
  - `update.mjs` gives the same report and `mod-sync.json` values over 8 scenarios. `mod-sync.json` is now written with plain 4-space JSON indentation.
  - `package.mjs` builds the same zip for every planner tag, byte for byte apart from the comment in `version.js`. git writes the zip in one `git archive` call, so no zip library or temp folder is needed.
  - `release.mjs` gives the same tag names, messages and refusals.
  - `serve.mjs` passed the same checks: file types, 404, path escapes, bad encoding, and `version.js` from `git describe`.
- Fixed on the way:
  - `update` now flags newly missing images even when the last sync had none. The PowerShell version treated an empty list from the last sync as no record, so it couldn't.
  - `update` reports name and wording changes that only differ in case, and ignores key order when comparing skill types.
  - `release` lowercases `--pre` and `--bump`: `-Pre Beta` would have made a `v0.2.0-Beta.1` tag. Without a mod checkout it now says it can't check the data against it, instead of skipping that check silently.
  - `package` only reads a tag's `mod-sync.json` when the tag has no `+es` part; the old script needed the file even when it didn't use it.

## Previews of unreleased mod work (2026-11-09)

- `update.mjs --preview` runs the full update against the mod checkout as it is (for example `Dev`) and builds into a git-ignored `preview/` folder, leaving the planner's data and `mod-sync.json` on the last release. The footer of a preview says "Planner preview", and the mod side shows the nearest release with the branch and commit ("Exiled Sector 0.11.2-alpha + Dev 93ceafe2"), from a new `modGit` field the extractor records for a git mod checkout. On a release the footer is as before.
- `update.mjs --report <file>` saves the report as a plain-text file, with or without `--preview`.
- `serve.mjs` only answers `version.js` from git for the repo's own `web/`. Other folders (`--root preview`, an unpacked release zip) show their own version, and `git describe` runs at most every 2 seconds instead of on every request.

## Extractor: the mod's newer description code (2026-11-09)

- Fills every wording value on the mod's `Dev` work (11 effects showed "?"): descriptions that hand over to a form taking a `DescribeContext`, values computed by small helper methods (`maxReserve(...)`, `range(...)`, `ParameterBonus.plusFlat`/`increasedBy`), values in local variables, and effects whose wording, mode and stat moved into a backing class (`DamageTakenWhile`). Damage taken near a held objective had also lost its mode, stat and lower-is-better flag on `Dev`; those are back.
- Constants are looked up in the class that uses them first. This fixes Rift Strike (and Strikecraft Rift Strike) showing 10% and 100 for the damage share and maximum instead of 50% and 500. The 0.11.2-alpha release has the same bug, so the committed `planner-data.js` is wrong there until it's regenerated.
- `update.mjs` flags effects whose mode, stat, lower-is-better or live flag changed from the previous data. Held objective's lost fields would have been caught this way; on `Dev` it flags `BALLISTIC_WEAPON_LARGE_OP_COST_FLAT`, which the mod rewrote as a plain flat stat effect.

## Integrated effects in the data (2026-11-09)

- The extractor copies each skill type's `integrated` block (the mod's integrated nodes, upgraded with story points like an s-mod; 178 types on `Dev`) into the data and extracts the wording of the effects only they use. The planner doesn't apply them yet.
- `update.mjs` compares `integrated` blocks under skill type changes and prints how many types have one.
- `.count(n)` in a description fills `{count}` (the integrated Cheap Shots wording needed it).

## Integrated nodes (mod 0.12.0, 2026-11-09)

- Synced the data to Exiled Sector 0.12.0-alpha, which releases the Dev work (integrated nodes, the Rift Strike values, Flux Coil Adjunct and Flux Distributor, Shield Arc Multiplier removed).
- Alt+click or the I key integrates an allocated node or takes the integration back; the summary panel has Integrate all, Remove all, a Preview all integrated view (not saved) and Keep when removed (a browser setting; off by default, so removing a node removes its integration).
- Totals, the stat sheet and its Sources use the integrated effects. Tooltips and the list view show normal and integrated effects side by side, paired line by line like the game's IntegrationLines. Integrated nodes get a green ring on the map.
- The build saves its integrations (`ig`). Templates and codes carry them as the game's `integrate` marks, which also fixes saving over a template made in game dropping its marks.
- The extractor keeps the `node.integration.*` strings, and `styled()` understands `<builtIn>`.
- Fixed: per-hull effects worth 0 for the chosen hull showed as "0%" lines and counted as sources (Inertial Supercharging's damage taken on cruisers, which the integration comparison then marked as dropped). They're left out now, as in game. Nodes the hull rule refuses, such as Dedicated Targeting Core on a frigate, show only their normal effects instead of a comparison.
- Fixed: Surveying Equipment and the Survey Cost Reduction nodes showed their cost reductions as "+12 to heavy machinery needed" in red. The extractor now reads the mod's `describeStat` calls, so they read "Your fleet has -12 to …" in green as in game, nav rating and post-battle salvage get "Your fleet has", and eight effects take the mod's own mode.
## Integration cost modes (mod 0.12.4, 2026-11-10)

- Mod 0.12.4 added a LunaLib setting, Integration Story Point Cost, and changed the default cost. Optional rules has an **Integration cost** dropdown: Exponential (1, 2, 4, 8…, the new default), Additive (1, 2, 3…, the old cost) or Static (2 each), ported from `IntegrationCostSetting`. It's saved with the build (`ship.ic`, only when not Exponential), is one Undo step, and Reset optional rules sets it back to Exponential. It only changes the story points shown.

## Integration comparison (mod 0.12.2+, 2026-11-10)

- The normal and integrated effects are paired like the mod's rewritten `IntegrationLines`: a number keeps its `%`, and an integrated line without a counterpart takes the place of a leftover normal line ("Instead grants …") before counting as new ("In addition, grants …"). Lion's Gaze, Lion's Guard Arsenal and At Any Cost now show one replaced line instead of a dropped one plus a new one.
- Both Integrated effects layouts use the mod's wording for those lines, and the inline layout says "No longer grants …" for a dropped line while the node is integrated. Rows follow the integrated lines' order, with dropped lines last.

## Mutually exclusive lists in tooltips (2026-11-10)

- Node tooltips (and each option of a choice node) now have the game's "Mutually exclusive with nodes" and "Mutually exclusive with hullmods" lines (`SkillNode.describeExclusivity`), so a clash shows before either node is allocated. The nodes list is every type it clashes with. The hull mods list is the node's own hull mods plus the ones entered in Ship rules that it clashes with, since the planner can't know which hull mods the player knows (the game lists those since mod 0.12.4).

## The planner's text in files (2026-11-11)

On the `text-overhaul` branch. Nothing on the page reads differently; the text can now be edited by hand.

- Every text the planner writes itself moved out of `app.js` and `index.html` into `web/text/*.js`, one file per part of the page, as `"key": "text"` lines with a `// e.g.` example above each one with a placeholder or markup. `index.html` keeps only `data-t*` attributes, filled at start. The Shortcuts list's rows are keys in `text/keys.js`.
- Sentences that were built from pieces in code are whole sentences, one per variant (the tooltip's click notes, the plan status, the template load report, the change notice, the list counts), and plurals have `.one`/`.other` forms. Lists join with shared keys.
- Code no longer reads the text it shows: gate conditions and the list view's tree groups use ids, the code reader's browser error has a flag, the hull size isn't capitalised in code, a radius keeps its article in the text, and requirement tags, game states and subroutine kinds have name lines keyed by the mod's ids.
- `tools/text-check.mjs` checks the text files against the code (missing, doubled and unused keys, unfilled placeholders, outdated examples); `release.mjs` refuses to tag on its errors. `tools/text-baseline.mjs` records every text the page shows, to compare before and after a change; it showed the page's output unchanged after each step. `docs/text-inventory.md` lists what moved.
- The release zip includes `text/`.

## Text editor (2026-11-11)

On the `text-editor` branch. Without `--edit` the page is unchanged (the text baseline is identical).

- `node tools/serve.mjs --edit` adds a Text editor panel to the page for changing the planner's own text while looking at it: Pick a text on the page (text from `index.html` by its key, built text by the keys whose filled-in text it contains), the texts the page showed newest first, or search.
- Typing redraws the page (`planner.refreshText`) and a preview fills the text with the values the page last used. It checks placeholders, markup pairs and the two plural forms, and says when a text is only read at load.
- Save rewrites that one line in `web/text/*.js` through `serve.mjs`, updates the `// e.g.` example when it no longer fits, and reports the text check. Only the page served by `serve.mjs` can save.
- The editor lives in `web/editor/` (not in the release zip); `app.js` only reports which keys it uses when the editor is there.

## Automatic releases (2026-11-12)

- `.github/workflows/mod-sync.yml` checks the mod for a new release every hour. A simple update (only numbers and wording changed, nothing flagged) is synced, tagged as the next planner pre-release, pushed and published as a GitHub pre-release with the zip; anything else opens one issue with the reasons and the update report, and changes nothing. It can also be run by hand, as a dry run by default.
- The logic is `tools/auto-release.mjs`, which never pushes and can run locally (`--dry-run` undoes its commit and tag).
- `update.mjs --verdict <file>` saves its outcome as JSON. The newest-mod-release rule and the planner tag parsing moved into `tools/lib/common.mjs`, shared by `update.mjs`, `release.mjs` and `auto-release.mjs`.

## Nested theme tags (mod `Dev` after 0.12.6-alpha, 2026-11-12)

On the `theme-tags` branch, ready for the next mod release. With 0.12.6-alpha data the page is unchanged.

- The mod moved its theme list from `SkillTags.THEME` to `data/config/exiledSector/theme_tags.csv`, with names under `tag.<id>`. The tags now nest (Beam is inside Energy, which is inside Weapons), and every node was retagged. `extract.mjs` reads the CSV (the tags scoped to `ship`, in its order, with each tag's `parent`), and still reads `SkillTags.THEME` for older releases. Against `Dev` the Filter has 54 themes, where it had 24.
- The Filter matches and counts a node under its tags and all their parents, as the mod's `ThemeTags.allWithAncestors` does: Weapons finds the Beam nodes too, and Defense finds 109 nodes though no node carries `defence` itself. Tooltips and the list still show a node's own tags.
- The affinity nodes are now tagged Low Tech, Midline and High Tech (inside Affinity) instead of Flux, Hull and Armor. With that data they match those themes like any other node; with older data they still never match a theme. Show affinity nodes is unchanged.
- Names for the renamed and new requirements: Strikecraft bays and No strikecraft bays (`req_fighter_bays` and `req_no_fighter_bays` before), Front shield and Omni shield. The old two stay until the data is synced past 0.12.6-alpha.
- `update.mjs` flags an empty theme list, so an automatic release stops on it, and it watches `ThemeTags` and `theme_tags.csv`.

## Planner (`web/`)

**Tree view**
- A canvas renderer modelled on the in-game screen: the central star, ring belts, nebula images, quadratic-curve connectors, notable and keystone rings, wormholes, socket octagons, and root circles showing their affinity totals.
- Unallocated nodes are dimmed and nodes you can take next pulse.
- Pan, zoom toward the cursor, pinch on touch, culling, and dots when zoomed far out.

**Rules** (mirroring the mod's `AllocationCheck`)
- You choose a root first. A node needs an allocated neighbour.
- Taking a wormhole takes its pair. Exits are reached only through a socket linked to an anchor.
- Clicking a far node takes the shortest path. Removing a node also removes anything cut off from the root.
- Previews: green for nodes added, orange for nodes removed.

**Choices**
- A picker for affinity and the three other choice node types. Nodes picked along a path default to your root's tech.
- Ctrl/Cmd+click reuses the last option picked for that node type, for the clicked node and every choice node on its path. Each type remembers its own last pick, across reloads.

**Tooltips and summary**
- Tooltips use the mod's wording and colours, with ship requirements, story gates, flavour text and action hints.
- The summary panel shows affinity totals, effect totals grouped by category, affinity thresholds reached, granted hull mods and text-only effects. A second tab lists notables and keystones, and clicking one flies the camera to it.

**Toolbar**
- Root, node counter with an editable cap, hull size, search, Center, Undo, Reset, Copy link, Templates, Summary, Shortcuts.

**Saving**
- The build is saved in the browser. The share link holds the whole build in the URL hash.
- Undo history holds up to 200 steps.

**Wormhole options**
- The **Core wormholes** and **Faction volumes** checkboxes. Turning one off removes the nodes that depended on it, with Undo to bring them back. Both settings are saved with the build and in share links. (Later replaced by Optional Volumes in Story rules.)

**Tree labels**
- When zoomed out, each tree (core and every faction volume) is labelled, showing the count of allocated nodes.
- Clicking a label zooms into that tree. Labels sit at the median of a tree's nodes, so a few outlying nodes don't pull them off.

**Templates**
- *Export*: in the game's shared-file format (`TemplateCodec` / `TemplateCapture`).
  - Steps are in a valid order. Choice nodes are written as `node=option`. A partner follows its wormhole or socket.
  - Anchors are written as item ids, and hull as the game's names.
  - A template with the same name and root is replaced and keeps its id. Other entries, even ones the game can't read, are kept as they are.
  - A file that isn't valid JSON is refused.
- *Linking the file*: one pick via the browser's file access, remembered across visits, with Reconnect, Reload and Forget.
- *Import*: lists templates by root. Load replays them with old ids mapped, reports skipped steps, and turns on wormhole options if needed.
- *Fallbacks for other browsers*: open read-only, merge and download, download new, copy JSON.
- Paths now allocate nearest node first, so exported steps read in build order.
- *Template codes*:
  - Share one template as pasteable text (`ES1.` + compressed JSON, about 200–700 characters), from the current build or any template in the file.
  - Load codes back, tolerating line breaks added by chat apps, with clear errors for wrong, cut-off or non-template codes.
  - Raw template JSON is accepted too.
  - Typing in the code box no longer triggers page shortcuts.
- *Hull safety*:
  - Saving over an existing template keeps its hull, as the game does, instead of taking the Hull dropdown's.
  - When the hulls differ, saving asks first: keep the existing hull, change it, or save as a new template under a free name.
  - Saving over any existing template (same name and root) asks first too: "Do you want to override the template "{name}"?", with Override, save as a new template, or Cancel.
  - The summary line warns ahead of time.
  - **Add to a file and download it** was removed (2026-11-09). Saving into an existing file now needs the linked file; other browsers keep Download as a new file and Copy template JSON.
  - **Create templates file…** next to Link templates file (Chrome/Edge): makes an empty templates file in `<planner>/savedTemplates/` (named like the game's file, numbered when taken) and links it. The planner folder is picked once and remembered; `savedTemplates/` is git-ignored.
  - **Copy template JSON** was removed (2026-11-09), and the Template code box now takes codes only (it used to accept a pasted template JSON too).

**Planner version in the footer**
- The top bar's **Core wormholes** and **Faction volumes** checkboxes are gone, since the game has neither setting. In their place, Story rules has an **Optional Volumes** section with the mod settings' four toggles, named as the mod names them and read by the extractor from `VolumeToggles` and `SkillTreeSettings` (`optionalVolumes`). Hiding one removes the build's nodes in those volumes and disables their anchors, and their tree labels say "hidden". Builds save it as `ov`. Older links with Faction volumes off load with all four hidden; the old Core wormholes setting is ignored, as the Story rules Wormhole gate covers that case. Story rules was then renamed **Optional rules** (button, dialog, Clear button and every message that points to it). Story gates whose nodes all sit in one optional volume moved under that volume's toggle, greyed out while it's hidden; Story gates reached keeps the vanilla ones, and Tick all / Untick all still cover every gate.
- Map text cleanup (from a review of every planner-written map text): shorter tooltip lines for sockets, wormhole exits, gates, choice nodes, the node cap, waypoints and the Empty Shell radius; a shorter waypoint banner and help line; "Unobtainable." for unobtainable subroutines; the reset prompt lost its explanation line, and the Jump buttons lost their "Ctrl+click jumps straight there" line.
- Toolbar text cleanup (from a review of the toolbar texts): **Mark refused** is gone and the red X on refused nodes is always on (no checkbox, no X key); **Targets** is now **Target Mode** and **Hull** is **Hull Size**; the Mod art button says "assets"; Undo's hover shows how many steps are stored; Center, Ship rules, Optional rules, Theme and Shortcuts lost their hover text, and several others were shortened; the Filter popover lost its note; the plan messages say "Choose a root." and "{total} nodes needed, {over} over the cap of {cap}."; the Allocate toast lost "Undo takes it back."; the templates file notice was reworded.
- Templates dialog text cleanup (from a review of the Templates dialog texts): shorter intro, watch options Instantly / Every few seconds / Manually with shorter status and limit notes, the replace-vs-add and Downloads paragraphs removed, the override question names the root ("A template named ... already exists for the ... root. Override it?"), the save-question hovers removed, the hull question says "Hull size dropdown", code errors are "Invalid template code." (except when the browser can't read codes), and the load report lost "Undo goes back.".
- Dialogs and list view text cleanup (from a review of their texts): Optional rules loses its intro and the Story gates explanation, "Story gates reached" is **Game state reached**, and the Optional Volumes note points to the mod or its LunaLib option; the Mod art dialog is **Mod assets**, with a one-line intro, shorter status lines and a one-line not-the-mod error, and no note for browsers that can't remember folders; the Shortcuts list drops the Enter and left-click-remove rows and shortens several others; the list view's hints are just "Click a node to see it on the map.", the collapse buttons have no hovers, and target marks are a green **O** and a red **X**. The Skill tree sort shows the core as one tree, "Core". The Search tab also says just "Core", and jump texts name a core destination by its id instead of "the {root} side of the core", e.g. "Jump to Core (midline_wormhole_1)".
- Hovering one of the core's six wormholes draws a moving dashed line, in the pair's colour, to the wormhole it's paired with, and rings that end, so the pairs are easy to tell apart.
- The All nodes list now also shows the three roots, the core's six wormholes (named with their id, e.g. "Wormhole (hightech_wormhole_1)", and "Paired with …") and the wormhole exits in the other trees ("Linked to …" when anchored). So do the six core sockets, also named with their id (e.g. "Subroutine Socket (subroutine_socket_16)"). Only affinity nodes are left out.
- A hidden optional volume (unticked in Optional rules) now disappears from the map, the search results and the list view: no nodes, lanes, stars or nebulae, label or marks, instead of being drawn faded.
- The summary panel's footer shows the planner version next to the mod's: "Exiled Sector 0.11.2 · Planner v0.2.0-alpha.3". It comes from `web/version.js`, which is "dev" in git. `package.ps1` writes the tag into each zip's copy, and `serve.ps1` answers it with `git describe`, so a local copy shows the latest tag with "+N" commits since and "(edited)" for uncommitted changes. The footer's hover title has the full version.

**List view**
- A **List** button (or `L`) switches the map area to a list of every non-affinity, non-structural node (479 in mod 0.11.1) with icon, tier, tree, themes, an "allocated" tag and effects. Unallocated choice nodes list each option's effects.
- The top bar's search box and Filter drive it, so search matches exactly as on the map. Enter steps through it. While it's showing, the panel's Search tab stays away, since the list already shows the matches.
- Sort by name (natural order) or by skill tree (core sides in Low Tech, Midline, High Tech order, then volumes; keystones and notables first), remembered in `localStorage['esp.listSort']`.
- Clicking a node returns to the map and jumps to it.
- In the Skill tree sort, each tree's heading collapses or expands it, with Collapse all / Expand all. Collapsed trees are remembered in `localStorage['esp.listCollapsed']`, Enter skips them, and the count notes matches hidden in collapsed trees.
- **Build** list (All nodes / Build switch, remembered in `localStorage['esp.listMode']`): the root and every allocated node, including wormholes, exits and sockets (with their subroutine or anchor), with affinity nodes summed into one row per tech ("High Tech Affinity ×20" and the total effect). Adds an **Order taken** sort, and an "Affinity nodes" group first in the Skill tree sort. Search and Filter apply.
- Target mode in the All nodes list: Want / Forbid buttons on each row, row click cycles the mark and right-click clears it, like the map. Marked rows get a green or red edge, or a "wanted"/"forbidden" tag outside target mode. The Targets bar docks inside the list while it shows, so Allocate stays reachable.
- Fix: the Full Sheet now also refreshes on build changes while the panel shows its Ship tab.

**Stats tab and Full Sheet (the in-game stat sheet)**
- A **Stats** tab in the summary panel lists the build's effects in the game's stat sheet sections, in its order and with its names (`StatGroup`), each effect in the section of its effect class's package, as `StatGroup.of` does. Temporary and gated effects keep the game's "For the first ... seconds after deployment" and "While phased" style wording.
- **Full Sheet** opens an overlay in the game's layout (`StatSheetLayout`): centred section headings over a thin rule, gold values, square bullets, sections placed into the shortest of as many 400 px columns as fit. **Side Panel** returns to the tab. It uses the game's colours in the dark theme and follows the light theme with light colours (deep blue headings and bullets, deepened gold and green), as does its Sources box.
- Hovering a line shows its **Sources**: each node, socket item or affinity step and its share, merged by name like the game's breakdown.
- Temporary nodes (`temporaryAfterDeploymentSeconds`) are now kept out of the permanent totals and shown as their own group on the Effects tab too. Before, they counted as permanent.
- The extractor writes each effect's `group`, the section order (`statGroups`), the temporary seconds on types, and the sheet's strings. `update.ps1` watches `StatGroup`, `ShipStatSheets` and `SkillTreeBonusSummary`.

**Stronger search highlight**
- Search and theme-filter matches get a pulsing gold glow under the node and an outlined gold ring with a ripple over it, each with a minimum size on screen so they show even fully zoomed out (where hit dots also turn gold). The result Enter stepped to gets a second, wider ring. The outline is dark in the dark theme and white in the light theme.
- Less dimming while searching: lanes stay at 75% (were 35%) and other nodes at 45% (were 30%).

**Theme filter**
- A **Filter** button beside the search box (first named Themes) lists the mod's theme tags (`SkillTags.THEME`, with names from `theme.*`), each with its node count, plus "No theme".
- Ticked themes highlight their nodes and list them in the Search tab, matching any or all ticked, and combined with any search text. Choice nodes take the themes of all their options, and structural nodes never match.
- **Show affinity nodes** is its own Filter entry and highlights all 155 affinity nodes, alongside any themes. Affinity nodes never match a theme, because the mod tags the affinity options with Flux, Hull and Armor. (It started as an "Include affinity nodes" switch on the theme matching.)
- Tooltips show a "Themes:" line. The extractor writes the theme list to the data (`themes`), and `update.ps1` watches `SkillTags`.

**Search results list**
- While a search is active, a **Search (N)** tab in the summary panel lists every match. Each row shows tier, location (faction volume, or side of the core), an "allocated" tag, and the effect or flavour line that matched when the name doesn't.
- Clicking a row jumps to the node with the gold flash.
- Enter steps through results in the same order and marks the current row.
- The map highlight is unchanged. The panel opens for the search if it was closed, and returns to its previous tab and state when the search is cleared.

**Wormhole jumps**
- Clicking a core wormhole, or a linked wormhole exit, opens a small menu: **Jump to** the other end (named by faction volume, or by which root's side of the core it's on), plus allocate or remove.
- Ctrl/Cmd+click jumps straight there, as Ctrl+click travels in the mod. A linked socket's picker has a Jump button too.
- Jumping only moves the camera, and gold rings flash on the destination.

**Template names**
- Names are kept to printable ASCII (English letters, digits, spaces, keyboard symbols), on top of the mod's 32-character, non-empty and unique-per-root rules. Other characters are removed as you type or paste, and named in the status line.
- Loaded templates with other characters are flagged for renaming.
- The top bar shows the loaded or last saved template's name, with "(edited)" once the build differs.

**Subroutines**
- Sockets take subroutines as well as anchors, one item per socket, with the per-ship limits.
- Fully modelled:
  - Root Conduit: route affinity, with the route drawn
  - Empty Shell Axion: silenced small nodes, and affinity per small node
  - Phoenix Ash Archive and P-Space Lattice: gated nodes at 3×, live-in-combat effects only, listed per condition
  - Contraband Modspec Cache: picked notables, allocated for free
- Doctrine archives show their radius and, per node, the lines or replacements they can roll. The roll itself comes from a hidden per-item seed, so it stays out of the totals.
- The extractor exports subroutines, doctrine pools and modifier ranges, radius sizes and per-kind limits, plus which effects are read live in combat.
- Subroutines with rarity 0 (no drop pool picks them, as of 0.11.1: Phoenix Ash Archive and P-Space Lattice) are flagged `unobtainable` by the extractor and marked so in the picker, the socket tooltip and the summary. They can still be socketed.

**Targets**
- Target mode (toolbar or T): clicking cycles a node through wanted, forbidden and unmarked, then **Allocate** adds the fewest nodes that reach every wanted node without passing a forbidden one. The plan is previewed in green, and the bar explains when it isn't possible.
- The search treats a node and its partner (wormhole pair, linked socket and exit) as one unit, with directed edges because an exit is entered only through its socket. It's an exact Steiner tree search (Dreyfus-Wagner) for up to 10 wanted nodes, about 120 ms at 10, and a shortest-path heuristic above that.
- The node rules are replayed on the plan in allocation order. A node that clashes with a wanted one is routed around, and a wanted node that can't be had is reported.
- "Keep current build" off plans from the root alone and removes what the plan doesn't need.

**Templates file watching**
- While the templates file is linked, the planner watches it. A setting in the Templates dialog chooses how:
  - **Instantly** (the default) uses the browser's File System Observer. It notices a change in about 0.3 s, with no work in between, and never falls back to checking on its own.
  - **By checking** looks at the file every N seconds (default 2), only when chosen.
  - **Off** doesn't watch.
  The dialog shows which method is running and explains the browser limits.
- **Check file** in the top bar checks the linked file on demand, in any mode, with the same notice. It also reconnects the file after a browser restart. When the game or anything else changes it, a notice lists the templates added, changed or removed, and the Templates list refreshes.
- If the template the build came from changed, the notice offers to load the new version, warning about unsaved edits (Undo brings the build back). A removed template keeps the build.
- The planner's own saves, and rewrites with the same templates, are ignored. Checking pauses while the tab is hidden and runs at once when it's shown again.

**Light and dark themes**
- A **Theme** button cycles Dark (the default), Light and Auto, which follows the system and updates when it changes. Saved in `localStorage['esp.theme']`.
- The page's colours are CSS variables with a light set under `[data-theme="light"]`. The canvas uses a matching palette for the background, connectors, placeholders, labels, sockets, roots and region labels.
- In light mode, bright line and text colours are deepened automatically. With the mod's art, unallocated icons wash toward white, and nebulae draw at low opacity instead of additively. Each tree's star is toned down to a deeper colour with a soft centre and a weaker glow, so it doesn't glare.

**Mod art from the user's folder**
- To avoid redistributing the mod's art, the planner no longer ships any. The **Mod art** dialog (top bar: **Show mod art**) reads it from the Exiled Sector folder the user chooses, finding the mod by its `mod_info.json` in that folder, its `mods` folder or a folder inside. Chrome and Edge remember the folder (**Reconnect art** after a browser restart). Other browsers use a folder input each visit.
- Without a folder, the tree draws placeholders: lettered icons on the canvas and in lists, tooltips and pickers, and a drawn notable halo. Nebula, planet and ring belt images are skipped. A one-time hint on the first visit points to the button.
- The art-free tree was then made easier to read:
  - Discs are tinted by tier (notables pink, keystones violet) with an outline.
  - Affinity nodes are a three-colour Low / Mid / High pie, filled with the chosen tech once allocated.
  - Names are drawn under nodes when zoomed in (notables and keystones from about 14 px on screen, small nodes from 22 px).
- `extract.ps1` no longer copies art into `web/assets`. It only reports images the mod doesn't ship. `update.ps1` checks those against the mod folder.

**Waypoints**
- Shift+click marks numbered waypoints, and the next allocation runs through them in order, each leg the shortest legal path from the waypoint before. This forces longer routes, for example to raise a Root Conduit's route count. The preview, tooltip and wormhole picker follow the waypoint route, a banner shows the count, and Esc clears them.
- Clicking a waypoint itself uses only the ones before it. The rules are checked on the whole route, as with a plain click.

**Affinity nodes in bulk**
- A block under the affinity totals sets every allocated affinity node to one option, or to a typed Low / Mid / High split that changes as few nodes as possible. Each is one Undo step.

**Node rules and Ship rules**
- The planner refuses what the game's `NodeEligibility` refuses, with the game's own wording:
  - hull size (via the Hull dropdown)
  - 13 pairs of nodes whose hull mods clash
  - the limit of 2 logistics notables and keystones
- Settings for what the planner can't see, saved with the build and its share link:
  - **Ship rules,** on the summary panel's Ship tab (the toolbar button opens it): shield type, base armor, civilian hull, system charges, station modules, built-in wings, hull mods on the ship (picked by in-game name) and extra logistics slots. Anything left unset isn't checked.
  - **Story rules,** a separate dialog: story gates reached and blueprint unlocks. Everything starts ticked.
  - Later: the Wormhole unlock (`$playerCanUseGates`, the only one that isn't a blueprint) moved into its own **Wormholes** section at the top. Story gates got **Tick all** / **Untick all**. "Unlocked skill types" became **Unlocked hullmods**, listing names only (the blueprint is in the hover title), and its buttons only change that list.
- How refusals show up:
  - Paths avoid refused nodes, or name the node that blocks the way.
  - The picker greys out refused options and gives the reason.
  - Allocated nodes that break a rule after a hull or ship change get a red ring and are listed in the summary.
  - **Mark refused** (checkbox or X key, remembered) draws a red X on every refused node, and a red dot when zoomed out.
  - Template import skips refused steps and reports them.
- `update.ps1` watches the new rule sources and flags any blocking effect the planner doesn't check.

**Controls**
- Arrow keys pan and Page Up / Page Down zoom; holding a key keeps the view moving.
- Home re-centres, S toggles the summary, / focuses search, ? opens the shortcuts list, Ctrl+Z undoes, Esc closes things.
- The shortcuts dialog lists every keyboard, mouse and touch control.
- Right-clicking the starting root (a double tap on touch) opens a warning that the build will be reset, with Reset build and Cancel buttons. The game never removes a root, so this is only a shortcut to Reset.

**Styling**
- At your request, the CSS was cut down for function over looks: system font (dropping the Google font), solid panels, no shadows, gradients, transitions or rounded corners, and plain-case labels.
- Colour is kept only where it carries meaning.

**Fixes along the way**
- "?" placeholders in 12 effect texts, including Borrowed Grace, Escort, Rift Strike/Series, Furor, Dynamic Grid, affinity-scaled effects and the low-base-armor bonus. The extractor now:
  - follows description helper methods into other classes
  - reads `HullSizeTable` constants for per-hull values
  - takes `{step}` from `AffinityScaling` declarations
  - reads `LowBaseArmorBonus`'s per-hull scale, using the hull-specific wording for the Hull dropdown's size
  No effect text has unfilled placeholders now.
- The picker didn't close, because its CSS overrode the `hidden` attribute.
- Ring belts were redrawn by wrapping the band texture around the circle.
- Duplicate "Grants …" lines are gone, and wormhole travel text no longer appears in the summary.
- The share link wasn't written when the clipboard call stalled.
- The toolbar's **Copy link** became **Copy code** (a template code for the build). The link moved to the Templates dialog as "Copy link to this build".
