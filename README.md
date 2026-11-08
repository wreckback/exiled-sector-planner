# Exiled Sector Skill Tree Planner

A web planner for the ship skill tree of the Exiled Sector Starsector mod. It's a static site with no build step: plain HTML, CSS and JS drawing on a canvas. It reads its data from the mod checkout in `ExiledSector/`, and can import and export the game's skill tree templates. See `CHANGELOG.md` for what's been built.

## Layout

- `ExiledSector/`: the mod checkout, which is the data source. Nothing edits its files; `update.ps1` only switches it to a release tag.
- `tools/update.ps1`: moves the mod to a release, runs the extractor and reports anything that needs a look
- `tools/extract.ps1`: copies the tree, skill types, effect wording, rename tables and art from the mod into `web/`
- `tools/mod-sync.json`: the mod release the data was last built from (written by `update.ps1`)
- `tools/serve.ps1`: a small local web server (no Node or Python needed)
- `web/`: the site. `data/planner-data.js` and `assets/` are generated.

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

1. **Pick a root:** Low Tech, Midline or High Tech, near the centre.
2. **Allocate:**
   - Click a glowing node next to your build, or click any node to take the shortest path to it. Hovering previews the path in green.
   - Clicking an allocated node removes it and anything cut off from the root (orange preview). Right-click removes any node.
3. **Choices:**
   - Clicking an affinity node, or one of the three other choice nodes, opens a picker.
   - Ctrl+click (Cmd+click on Mac) reuses the option you last picked for that kind of node, for the node you click and every choice node on its path.
4. **Wormholes:**
   - The core wormholes link the tech regions in pairs; taking one takes its pair.
   - Faction volumes open by clicking an allocated subroutine socket and choosing an anchor.
   - **Jumping:** click a wormhole (or a linked exit) and choose **Jump to …** to move the view to the other end, or Ctrl+click it to jump straight there. This works from a linked socket too, and never changes the build.
   - The **Core wormholes** and **Faction volumes** checkboxes turn each kind off. Turning one off removes the nodes that depend on it, and Undo brings them back.
5. **Read the results:**
   - The summary panel (S) totals every effect for the hull size you pick. It also shows affinity totals and the threshold bonuses they unlock.
   - **Search** with `/`:
     - Matching nodes are highlighted on the map.
     - A **Search** tab in the summary panel lists every match with its location, an "allocated" tag, and the line that matched. Click a result to jump to it, or press Enter to step through them.
     - Clearing the search puts the panel back how it was.
   - When zoomed out, each tree is labelled. Click a label to zoom into that tree.
6. **Save and share:** the build is kept in your browser between visits. **Copy link** puts the whole build in a URL.
7. **Templates:** see the section below.

Press **?** or click **Shortcuts** for every control:
- Arrows pan.
- Page Up and Page Down zoom.
- Home re-centres.
- Ctrl+Z undoes.
- Esc closes dialogs.

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

**Export:** type a name, then use one of these:

| Button | Where it goes |
|---|---|
| Save into linked file | Straight into the linked file. A template with the same name and root is replaced and keeps its id, so ships using it stay assigned. Other templates are kept. |
| Add to a file and download it | A merged copy in your Downloads folder. Move it into `saves\common`. |
| Download as a new file | A file holding only this template. Placing it over an existing file drops the templates already there. |
| Copy template JSON | The clipboard only. |

**Editing a template made in game:** Load it, edit it, then click Save into linked file without renaming it. The game picks up the change the next time the skill tree opens.

**Template codes (when you can't send the file):** a code holds one template as text, about 200–700 characters, for pasting into Discord, forums or chat.
- **Get a code:** "Copy code for this build" uses the template name and Hull dropdown. Each template in the file list also has its own **Code** button.
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
  - Story gates and ship requirements (`gate_*`, `req_*` tags) show in tooltips but don't block allocation.
  - Ordnance point costs.
  - Socket items other than anchors.
- **Placeholder magnitudes:** the mod marks its magnitudes as placeholders pending balance.
- **Simplified art:** stars, wormholes, sockets, roots, keystone belts and notable rings are drawn in code as simple versions of the mod's effects. The mod uses vanilla sprites and custom OpenGL for these.
- **Slow image loading:** the local server sends images one at a time, so art fills in a few seconds after the page loads.
