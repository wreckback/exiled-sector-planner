# Changelog

Everything built so far, oldest first. All of it was done on 2026-11-08, against Exiled Sector 0.11.0 and then 0.11.1.

## Data extraction (`tools/extract.ps1`)

- Reads the mod checkout and writes `web/data/planner-data.js` (as a JS global, so the page also works from disk) plus every image the tree uses into `web/assets/`.
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

## Local server (`tools/serve.ps1`)

- A small PowerShell static server, since this machine has no Node or Python.
- It used to crash when the browser dropped a connection mid-transfer (a reload while images loaded). It now skips that request and keeps serving.

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
- The **Core wormholes** and **Faction volumes** checkboxes. Turning one off removes the nodes that depended on it, with Undo to bring them back. Both settings are saved with the build and in share links.

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
  - The summary line warns ahead of time.

**Search results list**
- While a search is active, a **Search (N)** tab in the summary panel lists every match. Each row shows tier, location (faction volume, or side of the core), an "allocated" tag, and the effect or flavour line that matched when the name doesn't.
- Clicking a row jumps to the node with the gold flash.
- Enter steps through results in the same order and marks the current row.
- The map highlight is unchanged. The panel opens for the search if it was closed, and returns to its previous tab and state when the search is cleared.

**Wormhole jumps**
- Clicking a core wormhole, or a linked wormhole exit, opens a small menu: **Jump to** the other end (named by faction volume, or by which root's side of the core it's on), plus allocate or remove.
- Ctrl/Cmd+click jumps straight there, as Ctrl+click travels in the mod. A linked socket's picker has a Jump button too.
- Jumping only moves the camera, and gold rings flash on the destination.

**Controls**
- Arrow keys pan and Page Up / Page Down zoom; holding a key keeps the view moving.
- Home re-centres, S toggles the summary, / focuses search, ? opens the shortcuts list, Ctrl+Z undoes, Esc closes things.
- The shortcuts dialog lists every keyboard, mouse and touch control.

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
