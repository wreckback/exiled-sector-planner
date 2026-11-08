# Exiled Sector Skill Tree Planner

A web planner for the ship skill tree of the Exiled Sector Starsector mod. It's a static site with no build step: plain HTML, CSS and JS drawing on a canvas. It reads its data from the mod checkout in `ExiledSector/`, and can import and export the game's skill tree templates. See `CHANGELOG.md` for what's been built.

## Layout

- `ExiledSector/`: the mod checkout, which is the data source. Nothing edits its files; `update.ps1` only switches it to a release tag.
- `tools/update.ps1`: moves the mod to a release, runs the extractor and reports anything that needs a look
- `tools/extract.ps1`: copies the tree, skill types, effect wording, rename tables and art from the mod into `web/`
- `tools/mod-sync.json`: the mod release the data was last built from (written by `update.ps1`)
- `tools/serve.ps1`: a small local web server (no Node or Python needed)
- `web/`: the site. `data/planner-data.js` and `assets/` are generated. `assets/` (the mod's art) isn't in git; see below.

## Set up after cloning

The repository holds the code and the extracted data, but not the art. The art belongs to the mod and the authors it credits (see the mod's `CREDITS.md`), so it isn't republished here.

1. Clone the mod into `ExiledSector\` inside this folder: `git clone https://github.com/ExiledPortals/ExiledSector.git ExiledSector`.
2. Run `powershell -ExecutionPolicy Bypass -File tools\extract.ps1`. It copies the art into `web\assets\` and rebuilds the data.
3. Run the planner as below. Without step 2, nodes draw as placeholders.

## Run it

```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1     # then open http://localhost:8765/
```

- `web\index.html` also works opened straight from disk, with the differences listed under Caveats.
- To share the planner with others, upload the `web\` folder to any static host, such as GitHub Pages.
- `serve.ps1` stops with Ctrl+C. Use `-Port` to change the port.

## Update it after the mod changes

When the mod releases a new version, run:

```powershell
powershell -ExecutionPolicy Bypass -File tools\update.ps1            # newest release tag
powershell -ExecutionPolicy Bypass -File tools\update.ps1 -Commit    # same, and commit the result
```

It fetches the mod's tags, checks out the newest release (detached HEAD), rebuilds the data and prints a report:

- **Checks:** wording placeholders the extractor couldn't fill (they'd show as "?"), effects newly without wording, newly missing art, unknown node types or tiers, broken or one-way links, wormhole pairs, the template format versions and the default node cap.
- **Tree changes:** nodes and skill types added, removed, renamed, retyped or moved, compared with the previous data.
- **Mod code changed since the last sync:** the rule files the planner reimplements (`AllocationCheck`, the template classes, `AffinitySteps`, `SkillTier` and so on). This is the only part that can mean planner code needs updating.

The last line says either "All checks passed, no rule files changed", in which case reload the page and you're done, or lists what needs a look.

- `-Tag 0.11.1-alpha` picks a specific release. `-NoCheckout` uses the mod checkout as it is (for example, unreleased work on `Dev`). `-NoFetch` skips the network.
- It refuses to switch the mod if `ExiledSector\` has uncommitted changes.
- To go back to the mod's branch, run `git switch main` inside `ExiledSector\`.
- `tools\extract.ps1` alone still just rebuilds the data from whatever is checked out.

## Use it

1. **Pick a root:** Low Tech, Midline or High Tech, near the centre. To change it later, right-click your root (or use Reset). It asks first, because changing the root clears the build. Undo brings the build back. The game itself never lets a ship drop its root; this is only a planning shortcut.
2. **Allocate:**
   - Click a glowing node next to your build, or click any node to take the shortest path to it. Hovering previews the path in green.
   - Clicking an allocated node removes it and anything cut off from the root (orange preview). Right-click removes any node.
3. **Choices:**
   - Clicking an affinity node, or one of the three other choice nodes, opens a picker.
   - Ctrl+click (Cmd+click on Mac) reuses the option you last picked for that kind of node, for the node you click and every choice node on its path.
   - **Affinity nodes** in bulk, from the block under the affinity totals in the summary panel:
     - **All to Low / Mid / High** sets every allocated affinity node to that option.
     - **Split:** type how many of each you want, for example 1 / 6 / 3 for 10 nodes, and click Apply (or press Enter). The numbers must add up to the allocated count. Nodes already on an option that keeps its count aren't touched.
     - Either is one Undo step.
4. **Wormholes:**
   - The core wormholes link the tech regions in pairs; taking one takes its pair.
   - Faction volumes open by clicking an allocated subroutine socket, expanding **Wormhole anchor** and choosing one.
   - **Jumping:** click a wormhole (or a linked exit) and choose **Jump to …** to move the view to the other end, or Ctrl+click it to jump straight there. This works from a linked socket too, and never changes the build.
   - The **Core wormholes** and **Faction volumes** checkboxes turn each kind off. Turning one off removes the nodes that depend on it, and Undo brings them back.
5. **Read the results:**
   - The summary panel (S) totals every effect for the hull size you pick. It also shows affinity totals and the threshold bonuses they unlock.
   - **Search** with `/`:
     - Matching nodes are highlighted on the map.
     - A **Search** tab in the summary panel lists every match with its location, an "allocated" tag, and the line that matched. Click a result to jump to it, or press Enter to step through them.
     - Clearing the search puts the panel back how it was.
   - When zoomed out, each tree is labelled. Click a label to zoom into that tree.
6. **Node rules:** the planner refuses nodes the game would refuse, with the game's own reason in the tooltip or a toast. See the section below.
7. **Save and share:**
   - The build is kept in your browser between visits.
   - **Copy code** in the toolbar copies the build as a template code. It's named after the last template name you used, or "<root> plan".
   - **Copy link to this build** in the Templates dialog puts the whole build in a URL, ship and story rules included.
8. **Templates:** see the section below.
9. **Waypoints** (Shift+click): force a route instead of the shortest one.
   - Shift+click nodes to make them waypoints 1, 2, 3 and so on (a gold ring with a numbered badge). Shift+click a waypoint again to drop it, or press Esc to clear them all.
   - The next click allocates a path through the waypoints in order, each leg the shortest legal way from the waypoint before. The hover preview and tooltip show that route. Clicking a waypoint itself goes through the ones before it and keeps the later ones.
   - Use it when a longer route pays off. A Root Conduit counts the nodes on the route from the root to its socket, so a detour adds affinity, as long as you don't also take the shortcut. Other uses: running through or around a subroutine's radius, or picking up particular small nodes on the way.
10. **Targets** (toolbar button, or T): pick the nodes you want, and the planner finds the fewest nodes that reach them.
   - Click a node to mark it wanted (white ring with ticks), again to forbid it (red ring with a slash), and again to clear it. Right-click clears. The nodes don't have to be connected.
   - The planned path is drawn in green as you go. The bar says how many nodes it adds, or why it isn't possible: a wanted node the rules refuse, two wanted nodes that clash, a node only reachable through forbidden or refused ones, a faction volume with no anchor linked, or the node cap.
   - **Allocate** applies the plan as one Undo step and leaves target mode. **Done** or Esc leaves without changing the build. Marks are kept in your browser for next time, and **Clear marks** drops them.
   - **Keep current build** (on by default) adds to what you have. Turned off, it plans from the root alone and removes allocated nodes the plan doesn't need.
   - The plan follows the same node rules as clicking: a node that clashes with a wanted one is routed around. With up to 10 wanted nodes it is the fewest possible; with more, the search is approximate and the bar says so. Choice nodes on the way get your root's affinity, as with a plain click.

Press **?** or click **Shortcuts** for every control:
- Arrows pan.
- Page Up and Page Down zoom.
- Home re-centres.
- X turns the refused-node marks on and off.
- T turns target mode on and off.
- Shift+click sets waypoints, and Esc clears them.
- Ctrl+Z undoes.
- Esc closes dialogs.

## Node rules, Ship rules and Story rules

The planner checks the same things the game checks before it allows a node (the mod's `NodeEligibility`).

**Always checked:**
- **Hull size:** some nodes only fit certain sizes, going by the Hull dropdown. For example, Dedicated Targeting Core needs a cruiser or capital.
- **Nodes that can't be taken together:** two nodes clash when the hull mods they add clash. Examples are Phase Anchor and Adaptive Phase Coils, Heavy Armor and Critical Point Refit, or any two of Shield Shunt and the two Shield Conversions.
- **Logistics limit:** a ship holds 2 logistics notables and keystones (cargo, fuel, sensors and the like).

Two kinds of setting cover what the planner can't see. Both are saved with the build and its share link.

**Ship rules** live on the **Ship** tab of the summary panel, so they stay in view while you build. The **Ship rules** toolbar button opens that tab. Everything starts as "Not set", which isn't checked:
- **Hull:** shield type (front, omni, none or phase cloak), base armor, civilian-grade hull, ship system charges, station modules, and whether the ship has only built-in fighter wings.
- **Hull mods on the ship:** a node can't be taken if it adds one of these or clashes with one. Pick them by their in-game name. Only hull mods some node clashes with are offered.
- **Extra logistics slots** from items.

**Story rules** (toolbar button, a dialog) cover what your campaign has reached. Everything starts ticked:
- **Story gates reached:** untick a gate you haven't reached yet.
- **Unlocked skill types:** untick nodes whose blueprint or other unlock you don't have.

Each part has its own Clear button. The toolbar buttons show how many settings are in use, for example "Ship rules (2)".

The shield type follows the build in order, as in game. A ship set to "No shield" can't take Shield Shunt, but once a Makeshift Shield Generator is allocated, nodes that need shields are allowed.

**Mark refused** (top bar checkbox, or press **X**) puts a red X on every node the rules refuse right now: clashes with your build, the wrong hull size, the logistics limit, and ship and story rules. Allocated nodes that break a rule get the X over their red ring. When zoomed out, refused nodes show as red dots. Hover a marked node to see why. The setting is remembered between visits.

**When rules are broken:**
- **Paths:** the shortest path goes around refused nodes. If every way passes one, the message says which node and why.
- **Choice nodes:** the picker greys out options that are refused and shows the reason under each.
- **Existing nodes:** if a hull, ship or story change makes allocated nodes break a rule, they get a red ring and are listed at the top of the summary and of the Ship tab. Nothing is removed for you, and Undo goes back.
- **Templates:** steps the rules refuse are skipped on import, as in game, and the load message says how many and why.

## Subroutines

Click an allocated subroutine socket. The picker shows two headers, **Subroutine** and **Wormhole anchor**, each saying what the socket holds. Click one to expand its list, and click it again to collapse it. The socketed subroutine stays in the list, highlighted, and clicking it again removes it. A socket holds one item, and a subroutine only works while its socket is allocated. The picker enforces the per-ship limits: one doctrine archive, one Root Conduit, and each unique once.

| Subroutine | What the planner does |
|---|---|
| **Root Conduit** | +5 to one affinity for every allocated node on the route from your root to its socket. The route is drawn in that affinity's colour. Its affinity is rolled per item, so pick the one yours shows. |
| **Empty Shell Axion** | Small nodes in its radius grant nothing. The socket gives +1 to every affinity for each small node in the radius, allocated or not. |
| **Phoenix Ash Archive / P-Space Lattice** | Allocated nodes in the radius only apply below 50% hull or while phased, at 3×. Only effects read live in combat survive, so affinity and similar effects are lost. The summary lists these separately under their condition. |
| **Contraband Modspec Cache** | Allocates 1 to 3 notables for free: no path, no node slot. Its notables are rolled per item, so add the ones yours shows in the socket's picker. |
| **Doctrine archives** | The radius is drawn, and tooltips list what the archive can do to each node: Augment's possible lines with their ranges, Rewrite's possible replacements. The actual result is rolled from a hidden per-item seed, so it isn't in the totals. |

- Radiuses are drawn as dashed circles. Hover a node to see how a subroutine affects it.
- **Subroutines** in the summary says what each one does right now.
- Subroutines the mod no longer drops (rarity 0 in its data, currently Phoenix Ash Archive and P-Space Lattice) are marked unobtainable in the picker, the socket tooltip and the summary. You can still socket them, for copies you already own.
- Subroutines are saved with the build and in links. Templates and codes don't hold them, as in game.
- **Not modelled:** a granted notable that touches your allocated tree doesn't count as a neighbour for further allocation, though in game it does. Corruption implicits are also not modelled.

## Templates: import and export with the game

The Templates button reads and writes the mod's shared template file, `saves\common\exiledSector_skillTreeTemplates.json.data` in your Starsector install (mod 0.11.1+). The game re-reads that file whenever the skill tree opens, so changes show up while the game is running.

**Link the file** (Chrome or Edge):
- Click "Link templates file…" and pick the file. The planner remembers it between visits; when the browser asks again, click Reconnect.
- Browsers can't open a typed path, so you pick the file instead.
- Other browsers can only open the file read-only, each visit.

**Import:**
- The dialog lists the file's templates, grouped by root, and re-reads the file each time it opens. **Load** replaces your build with a template.
- Old node and option ids from earlier mod versions are mapped to current ones, the way the game does.
- Steps that don't exist or can't be connected are skipped and reported.
- Undo goes back to your previous build.

**Names:** up to 32 characters, using English letters, digits, spaces and keyboard symbols. Anything else is removed as you type, with a note saying what was removed.
- The mod itself accepts any character, but its keyboard input and default font only reliably handle these.
- A template loaded with other characters in its name is flagged, and has to be renamed before you save it.

**Export:** type a name, then use one of these:

| Button | Where it goes |
|---|---|
| Save into linked file | Straight into the linked file. A template with the same name and root is replaced and keeps its id, so ships using it stay assigned. Other templates are kept. |
| Add to a file and download it | A merged copy in your Downloads folder. Move it into `saves\common`. |
| Download as a new file | A file holding only this template. Placing it over an existing file drops the templates already there. |
| Copy template JSON | The clipboard only. |

**Editing a template made in game:** Load it, edit it, then click Save into linked file without renaming it. The game picks up the change the next time the skill tree opens.

**Template codes (when you can't send the file):** a code holds one template as text, about 200–700 characters, for pasting into Discord, forums or chat.
- **Get a code:** **Copy code** in the toolbar, or "Copy code for this build" in the dialog, uses the template name and Hull dropdown. Each template in the file list also has its own **Code** button.
- A code holds the root, hull, steps and anchors, like a template. Ship rules, story rules, the node cap and the wormhole checkboxes travel only in a link.
- **Use a code:** paste it into the Template code box and click **Load code**, or press Ctrl+Enter. It loads exactly like a template from the file. Save it into your file afterwards to use it in game.
- Codes start with `ES1.`. Spaces and line breaks added by chat apps are ignored.
- Codes keep node ids, so they survive mod updates the same way template files do.
- The box also accepts a single template's JSON, as produced by "Copy template JSON".
- If a code was made with a different mod version, the load message says so.

**Hull size:** a template's hull decides where it's listed in game. The template list opens filtered to the current ship's hull size.
- A new template gets the Hull dropdown's size.
- Saving over an existing template whose hull matches the dropdown, or that has no hull, keeps its hull, as the game does.
- If the existing template's hull differs from the dropdown, saving stops and asks you to choose:
  - **Keep** its hull and update the steps.
  - **Change** it to the dropdown's hull.
  - **Save as a new template** under a free name, such as "Flux plan 2", which you can edit.
- The dialog's summary line warns ahead of time when this will happen.

## Caveats

- **Template saving is untested against a real file.** Writing into the real game file hasn't been tested end to end yet. Keep a copy of `exiledSector_skillTreeTemplates.json.data` the first time you save into it.
- **Changing a template's name or root makes a new template.** Templates are matched by name plus root, so the original stays in the file.
- **Ships keep the nodes they already have** when you edit their template. How the game handles nodes since removed from a template hasn't been checked.
- **Downloads may be renamed.** If the file name is already taken in Downloads, Chrome adds "(1)". The game won't read the file until it's renamed back.
- **Opened from disk** (no server):
  - Share links only work on your own computer.
  - Firefox may not keep the saved build between visits.
- **Missing effect wording:** wording is read from the mod's string files and Java source. 11 effects show their raw name and value (fighter role stats, converted hangar, unhit armor regen).
- **Not modelled:**
  - Ordnance point costs and node item costs.
  - The per-ship weapon and shield requirements shown in tooltips ("Needs a ship with: …"). The game doesn't block allocation on these either.
  - Hull mod clashes the game learns while you play (`exiledSector_learnedHullModConflicts.json`).
  - What a doctrine archive actually rolls (see Subroutines), and subroutine corruption implicits.
- **Placeholder magnitudes:** the mod marks its magnitudes as placeholders pending balance.
- **Simplified art:** stars, wormholes, sockets, roots, keystone belts and notable rings are drawn in code as simple versions of the mod's effects. The mod uses vanilla sprites and custom OpenGL for these.
- **Slow image loading:** the local server sends images one at a time, so art fills in a few seconds after the page loads.
