# Text inventory

Step 1 of the text overhaul (see `TODO.md`, "Now: text externalization"): every piece of user-facing text in `web/app.js` and `web/index.html`, grouped by area. Made on 2026-11-11 from `text-overhaul` at `d481d1a`; line numbers are from that commit and will drift as areas are migrated.

What isn't here: text that comes from the mod through `planner-data.js` (node and type names, effect wording, the mod's `node.block.*`, `summary.*` and `ui.stats.*` strings). That stays where it is.

## Progress

Tick an area when its migration step is committed and its output matches the baseline.

- [x] Names and labels (step 4a, `text/names.js`; also the socket picker's "Allocates 1 to 3 notables for free" (3106), which is one of the subroutine kinds). The gate conditions are ids now (`GATE_OF`), not text. Left in code: the missing-data message (line 10), shown before any text could load.
- [x] Map tooltips (step 4b, `text/tooltip.js`; also the Effects tab's "Grants …" line, which is the same text, and the story point count, now `label.storyPoints` in `names.js`). New helper `trHtml()` for text with markup. Also moved, missed by the scan: the inline view's "normal"/"integrated" in brackets and the " and " joining a doctrine modifier's effects.
- [ ] Rule refusals and node rules
- [ ] Toasts
- [ ] Top bar, summary panel and stat sheet
- [ ] Search, filter and list view
- [ ] Pickers
- [ ] Target mode
- [x] Ship rules and Optional rules (step 3, with their `index.html` parts: the Ship tab and the Optional rules dialog; `text/ship.js`, `text/optional.js`, shared words in `text/common.js`)
- [ ] Templates
- [ ] Mod assets
- [ ] `index.html` (the other sections)

Already keyed for later areas: the shield names (`ship.shield.*`, also `SHIELDS` in `app.js`, Names step) and `common.*` (Close, Not set, Yes, No, Tick all, Untick all).

## Counts

| Area | Strings |
|---|---:|
| Names and labels | 72 |
| Map tooltips | 69 |
| Rule refusals and node rules | 30 |
| Toasts | 32 |
| Top bar, summary panel and stat sheet | 57 |
| Search, filter and list view | 47 |
| Pickers | 44 |
| Target mode | 26 |
| Ship rules and Optional rules | 15 |
| Templates | 96 |
| Mod assets | 17 |
| **`app.js` total** | **505** |
| `index.html` | about 200 (text, `title`, `placeholder`, `aria-label`) |

`app.js` was scanned with a script: every string literal, including the ones nested inside a template's `${…}`, kept when it reads as text (words with spaces, a sentence, or a capitalised word), then short ones checked by hand. A nested string is listed both on its own and inside the template that holds it, so the pieces of a built sentence are visible. A few may still be missing; the baseline's coverage report (step 2) and the key check (step 6) catch the rest.

Corrected on 2026-11-11 during step 2: the first scan skipped strings nested in `${…}` and some sentences with a number or a colon, about 45 in all (for example "Not reachable from your allocated nodes.", the list view's mark buttons, the cache notes in the socket picker).

## Keys

- Dotted, grouped by area, as decided. One file per area in `web/text/`, named after the first part of the key: `name.*` in `names.js`, `tooltip.*` in `tooltip.js` and so on.
- Second part is the place or subject, last part what it says: `tooltip.socket.click`, `toast.template.copied`, `templates.watch.observing`.
- Whole sentences, never fragments joined in code (see "Needs reshaping" below).
- Plurals as `.one`/`.other`: `panel.nodesCount.one: '{count} node'`.
- A sentence holding counts that change separately is a sentence key with counted-phrase keys filled in: `optional.summary.both: 'Unticked: {gates} and {volumes}.'` with `optional.count.gates.one: '{count} gate or unlock'`, not one sentence per singular/plural combination.
- Repeated text gets one key, used from every place (see "Repeated text").
- `index.html` keys go in the same files as the matching `app.js` area: the Templates dialog in `templates.js`, the Ship tab in `rules.js`.
- The exact key for each string is set in that area's migration step, reviewed with the diff.
- Keys in each file follow the order they appear on screen, with a short comment per section.
- A key with a `{placeholder}` or markup gets a `// e.g.` comment showing the sentence filled with real names from the current mod data, one per variant key. Where a placeholder holds mod text, the comment says where it comes from:
  ```js
  // e.g. The way to Heavy Ballistics Integration passes Converted Fighter Bay: Requires built-in strikecraft wings only.
  //      ({target} and {node} are skill names; {reason} is the mod's own refusal text, node.block.builtInWingsOnly)
  'rule.wayBlocked': 'The way to {target} passes {node}: {reason}',
  ```

## Needs reshaping before it can move

These can't move one-to-one; each needs a small code change in its area's step, with the same output.

1. **Text used as a code key.** `GATE_LINES` (line 776) maps effects to "While phased", "Below 50% hull" and "While the ship system is active". `totals()` groups gated effects by that text, and `GATE_KEYS` (line 4081) maps the text back to ids. Switch both to the ids (`PHASED`, `LOW_HULL`, `SYSTEM_ACTIVE`) first, and look the text up only for display.
2. **Sentences built from fragments.**
   - `refusalText` (378): "The way to X passes Y: " plus the rule's reason.
   - Tooltip click notes (2879, 2884, 2893–2897, 2912): optional parts like ", remove", " (3 nodes through 2 waypoints)", " and pick an option".
   - `renderTargets` (3582–3583), `computePlan` (3514–3515): plan status built in pieces.
   - `loadTemplate` (5183–5194): notes joined with "; " after "Loaded "name" (n nodes)".
   - `renderFileNotice` (4785–4792), `searchResultsHtml` (3851–3858), `renderList` (4349–4357), `refreshExport` (5077–5081), `renderStory` (4559–4561), `problemSummary` (4493, appended to other sentences).
   - `blockOf` (700) lowercases the first letter of a gate's text to fit it mid-sentence.

   Each becomes a few whole-sentence keys (one per variant), or a list built from items with a key for the list's sentence.
3. **HTML inside strings.** Many strings carry their HTML (`<div class="tt-note">…</div>`, buttons, `<span class="builtin">`). The HTML structure stays in code; strings keep only text plus the game markup that `styled()` already turns into HTML (`<hl>`, `<good>`, `<bad>`, `<builtIn>`). A few need bold (`<b>`: 5017, 5614, 5615, 5657) or an input (3787, the "Copy this code" toast); decide per case whether `styled()` gets a `<b>` tag or the HTML stays in code.
4. **Plurals.** About 60 places use `n === 1 ? '' : 's'`, and a few pick other words (`is`/`are`, `stays`/`stay` at 3471; `is`/`s are` at 2720). All become `.one`/`.other` keys.
5. **Fallbacks for mod strings.** `blockText('node.block.*', fallback)` (658–725) and `gameString('ui.stats.*', fallback)` (4088, 4105, 4113, 4119) use the mod's text and fall back to English written in the planner. Suggestion: keep looking up the mod's key first, and move the fallback into the text files under the same key.
6. **Text the code generates:** `humanize()` turns ids into words ("Armor damage taken mult per dmod") when there's no wording. It stays in code, since it isn't written text.
7. **Missing data message** (line 10): shown when `planner-data.js` didn't load. The text files load before `app.js`, so it can move too, but it needs a fallback if they're missing as well.

## Repeated text

One key each, after the migration:

- **In both files:** shield names (`app.js` 590, `index.html` 121–124); hull size names (913, 1409, 5096, `index.html` 37–40); List/Map button titles (4373, `index.html` 51); "Undo, 0 steps stored (Ctrl+Z)" (2553, `index.html` 53); "Theme: Dark" (4057, `index.html` 63); "Show mod assets" (5608, `index.html` 61); "Save into linked file" (5085, `index.html` 248); "Link templates file…" (5019, `index.html` 220); "Choose mod folder…" (5624, `index.html` 298); "Filter" (3968, `index.html` 47); "Ship rules", "Optional rules" (2555–2556, `index.html` 57–58); "Choose a root" (2545, 2563, `index.html` 20).
- **Within `app.js`:** "Invalid template code." (5 times, 1089–1106); "Choose a root." (3461, 3778, 5069); "Choose a root first." (5223, 5263); "Build cleared. Undo brings it back." (3196, 3775); "The browser was not allowed to write to that file." (5323, 5366); "Pick one of the three roots near the center to start." (2597, 4152); "Ctrl+click to jump to …" (2876, 2877); "Click a node to see it on the map." (4311, 4314); "Wanted", "Forbidden" (3640, 3641); "Nothing to change." (3554, 3581); "… plan" (3781, 5247); the gate texts (776, 4081).

## Wording inconsistencies spotted

Not changed in this work: the migration must give identical output. Listed for a text review afterwards.

- "Desired" (`renderList` 4313; `index.html` 393) vs "Wanted" everywhere else.
- "Themes:" with no space after the colon (2860).
- "Only" capitalised mid-sentence: "…needed; Only 3 left (over cap)." (2896).
- "Shift+click delete waypoint." (2905): missing "to".
- "Hull Size" (`index.html` 35) vs "Hull size" (`index.html` 112).
- "Change search term or Filters." (4357) vs the button's "Filter".

## `app.js`

### Names and labels (72)

Key prefix: `name.*, label.*`

| Line | Function | Text |
|---:|---|---|
| 10 |  | `` '<p style="padding:24px;color:#fc6300">Missing data/planner-data.js. Run node tools/extract.mjs first.</p>' `` |
| 19 |  | `` 'Node' `` |
| 19 |  | `` 'Notable' `` |
| 19 |  | `` 'Keystone' `` |
| 19 |  | `` 'Wormhole' `` |
| 20 |  | `` 'Wormhole exit' `` |
| 20 |  | `` 'Root' `` |
| 20 |  | `` 'Subroutine socket' `` |
| 24 |  | `` 'Low Tech' `` |
| 24 |  | `` 'Midline' `` |
| 24 |  | `` 'High Tech' `` |
| 40 |  | `` 'Core' `` |
| 40 |  | `` 'Luddic' `` |
| 40 |  | `` 'Pirate' `` |
| 40 |  | `` 'Hegemony' `` |
| 40 |  | `` 'Persean League' `` |
| 41 |  | `` 'Tri-Tachyon' `` |
| 41 |  | `` 'Sindrian Diktat' `` |
| 41 |  | `` 'Navarchy of Tania' `` |
| 41 |  | `` '[REDACTED]' `` |
| 42 |  | `` 'Stargazer' `` |
| 42 |  | `` 'Omega' `` |
| 42 |  | `` 'Abyss' `` |
| 42 |  | `` 'Shrouded' `` |
| 42 |  | `` 'Nightcross' `` |
| 43 |  | `` 'Kesteven' `` |
| 43 |  | `` 'Exotech' `` |
| 43 |  | `` 'Enigma' `` |
| 43 |  | `` 'Threat' `` |
| 590 |  | `` 'Front shield' `` |
| 590 |  | `` 'Omni shield' `` |
| 590 |  | `` 'No shield' `` |
| 590 |  | `` 'Phase cloak' `` |
| 688 |  | `` 'frigates' `` |
| 688 |  | `` 'destroyers' `` |
| 688 |  | `` 'cruisers' `` |
| 688 |  | `` 'capitals' `` |
| 774 |  | `` 'Unobtainable.' `` |
| 776 |  | `` 'While phased' `` |
| 776 |  | `` 'Below 50% hull' `` |
| 776 |  | `` 'While the ship system is active' `` |
| 913 |  | `` 'Frigate' `` |
| 913 |  | `` 'Destroyer' `` |
| 913 |  | `` 'Cruiser' `` |
| 913 |  | `` 'Capital' `` |
| 1409 | `hullLabel` | `` 'frigate' `` |
| 1409 | `hullLabel` | `` 'destroyer' `` |
| 1409 | `hullLabel` | `` 'cruiser' `` |
| 1409 | `hullLabel` | `` 'capital' `` |
| 1476 |  | `` 'Affinity' `` |
| 1477 |  | `` 'Strike craft' `` |
| 1478 |  | `` 'Weapons' `` |
| 1479 |  | `` 'Flux' `` |
| 1480 |  | `` 'Defense' `` |
| 1481 |  | `` 'Mobility' `` |
| 1482 |  | `` 'Phase' `` |
| 1483 |  | `` 'Ship system' `` |
| 1484 |  | `` 'Combat readiness' `` |
| 1485 |  | `` 'Logistics' `` |
| 1487 |  | `` 'Other' `` |
| 3104 |  | `` `Doctrine (${s.behaviour === 'REWRITE' ? 'rewrites' : 'augments'} nodes in a ${s.radius.replace('_', ' ')} radius)` `` |
| 3105 |  | `` 'Affinity for each node between the root and its socket' `` |
| 3107 |  | `` `Gates nodes in a ${s.radius} radius: ${GATE_LINES[s.lines.find(l => GATE_LINES[l.effect]).effect].toLowerCase()}, ×${s.lines[0].max}` `` |
| 3108 |  | `` `Silences small nodes in an ${s.radius.replace('_', ' ')} radius for affinity` `` |
| 3893 |  | `` 'No theme' `` |
| 4081 |  | `` 'While phased' `` |
| 4081 |  | `` 'Below 50% hull' `` |
| 4081 |  | `` 'While the ship system is active' `` |
| 5096 | `hullLabelFor` | `` 'frigate' `` |
| 5096 | `hullLabelFor` | `` 'destroyer' `` |
| 5096 | `hullLabelFor` | `` 'cruiser' `` |
| 5096 | `hullLabelFor` | `` 'capital' `` |

### Toasts (32)

Key prefix: `toast.*`

| Line | Function | Text |
|---:|---|---|
| 298 | `toggleWaypoint` | `` 'Every path starts from the root, so it can\'t be a waypoint.' `` |
| 363 | `allocate` | `` `That needs ${path.length} nodes; only ${Math.max(0, state.cap - used())} left under the cap.` `` |
| 454 | `linkSocket` | `` 'Linking an anchor takes one more node; you are at the cap.' `` |
| 506 | `setVolumeShown` | `` `${g.name}: shown.` `` |
| 506 | `setVolumeShown` | `` ` Removed ${removed} node${removed > 1 ? 's' : ''}; Undo brings them back.` `` |
| 506 | `setVolumeShown` | `` `${g.name}: hidden.${removed ? ` Removed ${removed} node${removed > 1 ? 's' : ''}; Undo brings them back.` : ''}` `` |
| 553 | `toggleIntegration` | `` `${t.name} can't be integrated.` `` |
| 554 | `toggleIntegration` | `` `Allocate ${t.name} first to integrate it.` `` |
| 2727 | `applyAffinity` | `` `Changed ${moved} affinity node${moved === 1 ? '' : 's'}. Undo goes back.` `` |
| 2768 |  | `` `Integrated ${c} node${c === 1 ? '' : 's'}.` `` |
| 2769 |  | `` `Removed ${c} integration${c === 1 ? '' : 's'}.` `` |
| 2777 | `warnNewProblems` | `` `${now} illegal allocated node${now === 1 ? '' : 's'}.` `` |
| 3164 | `addGrantFromInput` | `` 'Pick a notable from the list.' `` |
| 3196 |  | `` 'Build cleared. Undo brings it back.' `` |
| 3215 | `primaryAction` | `` 'Pick an option once; Ctrl+click then reuses it.' `` |
| 3232 | `primaryAction` | `` 'Wormhole exits open by linking an anchor in a subroutine socket.' `` |
| 3285 | `cycleTarget` | `` 'The starting root is always in the build.' `` |
| 3554 | `applyPlan` | `` 'Nothing to change.' `` |
| 3568 | `applyPlan` | `` ` and removed ${p.remove.length}` `` |
| 3568 | `applyPlan` | `` `Allocated ${gained} node${gained === 1 ? '' : 's'}${p.remove.length ? ` and removed ${p.remove.length}` : ''}.` `` |
| 3775 |  | `` 'Build cleared. Undo brings it back.' `` |
| 3778 |  | `` 'Choose a root.' `` |
| 3785 |  | `` `Code for "${name}" copied. Load it with Templates → Load code.` `` |
| 3787 |  | `` `Copy this code:<br><input style="width:min(560px,80vw);margin-top:6px" readonly value="${esc(code)}" onfocus="this.select()">` `` |
| 4873 | `checkFileNow` | `` 'Link the templates file in Templates first.' `` |
| 4875 | `checkFileNow` | `` 'The browser wasn\'t allowed to read the templates file.' `` |
| 4881 | `checkFileNow` | `` `Connected to ${linkedHandle.name}: ${n} template${n === 1 ? '' : 's'}. Changes from now on are noticed.` `` |
| 4882 | `checkFileNow` | `` 'No changes in the templates file since the last check.' `` |
| 4883 | `checkFileNow` | `` 'The templates file was rewritten, but its templates are the same.' `` |
| 5220 | `showCode` | `` `${label} copied.` `` |
| 5220 | `showCode` | `` 'The browser blocked the clipboard; the code is in the box to copy by hand.' `` |
| 5657 |  | `` 'The mod assets are not included with the planner. Click <b>Show mod assets</b> in the top bar to read them from your Exiled Sector folder.' `` |

### Rule refusals and node rules (30)

Key prefix: `rule.*`

| Line | Function | Text |
|---:|---|---|
| 150 |  | `` `The ${volumeName(n.volume)} volume is hidden. Enable the Optional Volumes in Optional rules.` `` |
| 210 | `findPath` | `` `Already allocated by the ${g.def.name}. Change its notables in the socket to free it.` `` |
| 279 | `name` | `` `${name(t)} opens only through an anchor linked in a subroutine socket.` `` |
| 281 | `name` | `` `No legal way from ${name(from)} to ${name(t)}.` `` |
| 281 | `name` | `` `No legal way to reach ${name(t)}.` `` |
| 378 | `refusalText` | `` `The way to ${effectiveType(target).name} passes ${effectiveType(block.node).name}: ` `` |
| 542 |  | `` `${k} story point${k === 1 ? '' : 's'}` `` |
| 658 |  | `` "Can't be allocated on phase ships." `` |
| 662 | `nonPhaseText` | `` 'Ship has no shields.' `` |
| 666 | `nonPhaseText` | `` 'Ship already has front shields.' `` |
| 667 | `nonPhaseText` | `` 'Ship already has omni-directional shields.' `` |
| 668 | `nonPhaseText` | `` 'Requires a phase hull.' `` |
| 673 | `nonPhaseText` | `` 'Requires a non-phase hull with low base armor.' `` |
| 675 | `nonPhaseText` | `` `${why} (${fmt(cutoff)} or less on a ${hullLabel()}; this ship has ${fmt(state.ship.armor)})` `` |
| 678 | `nonPhaseText` | `` 'Requires built-in strikecraft wings only.' `` |
| 686 | `hullRequirementUnmet` | `` ' required.' `` |
| 697 | `blockOf` | `` `Not unlocked yet: needs ${unlockText(t)} (Optional rules).` `` |
| 700 | `blockOf` | `` `Locked until ${gateText(gate).replace(/^./, c => c.toLowerCase())} (Optional rules).` `` |
| 704 | `blockOf` | `` `Not on ${HULL_SIZE_NAMES[hull]}: only on ${listWords(sizes.map(x => HULL_SIZE_NAMES[x] \|\| x))}.` `` |
| 710 | `blockOf` | `` 'Ship already has {hullmod} installed.' `` |
| 715 | `blockOf` | `` 'Already have {node} allocated.' `` |
| 725 | `blockOf` | `` 'This ship is at its logistics node limit.' `` |
| 725 | `blockOf` | `` `${blockText('node.block.logisticsCap', 'This ship is at its logistics node limit.')} (${logisticsCap()} per ship)` `` |
| 876 | `subLimitProblem` | `` `Only ${kindCap} ${humanize(def.kind).toLowerCase()} per ship.` `` |
| 877 | `subLimitProblem` | `` `Only ${def.socketLimit} per ship.` `` |
| 893 | `unlockText` | `` `the ${hullModName(c.id \|\| c.key)} blueprint` `` |
| 894 | `unlockText` | `` 'a character stat' `` |
| 895 | `unlockText` | `` 'a campaign flag' `` |
| 896 | `unlockText` | `` `ship level ${c.minLevel}` `` |
| 899 | `unlockText` | `` 'an unlock' `` |

### Map tooltips (69)

Key prefix: `tooltip.*`

| Line | Function | Text |
|---:|---|---|
| 1294 | `typeLines` | `` `Grants <span class="hl">${esc(hullModName(hm))}</span>.` `` |
| 1330 |  | `` 'Instead grants {line}' `` |
| 1330 |  | `` 'In addition, grants {line}' `` |
| 1330 |  | `` 'No longer grants {line}' `` |
| 1332 | `grantsLine` | `` 'Sentence' `` |
| 1356 | `integrationColumnsHtml` | `` 'Normal' `` |
| 1356 | `integrationColumnsHtml` | `` 'Integrated' `` |
| 1358 | `integrationColumnsHtml` | `` `<div class="ic${active ? ` ic-on-${active}` : ''}"><div class="ic-row ic-head"><div>Normal${tag('normal')}</div><div><span class="builtin">Integrated</span>${cost}${tag('integ')}</div></div>${rows}</div>` `` |
| 1368 | `integrationInlineHtml` | `` '<div class="ic-inl-head"><span class="builtin">Integrated</span> <span class="ic-active">active</span> <span class="muted">· normal values in brackets</span></div>' `` |
| 1369 | `integrationInlineHtml` | `` `<div class="ic-inl-head"><span class="muted">Integrated values in brackets</span>${cost}</div>` `` |
| 1385 | `integrationInlineHtml` | `` `<div class="ic-off"><span class="builtin">▲ When integrated:</span> ${html}</div>` `` |
| 1391 | `integrationInlineHtml` | `` `<div>${r.normal} <span class="ic-alt">(removed when integrated)</span></div>` `` |
| 2831 | `tooltipHtml` | `` ' · <span class="builtin">Integrated (preview)</span>' `` |
| 2846 | `tooltipHtml` | `` `Linked to <span class="hl">${esc(volumeName(byId.get(e).volume))}</span>.` `` |
| 2846 | `tooltipHtml` | `` 'Install a subroutine, or an anchor.' `` |
| 2849 | `tooltipHtml` | `` 'another wormhole' `` |
| 2849 | `tooltipHtml` | `` `<div class="tt-effects"><div>Leads to ${p ? `<span class="hl">${esc(effectiveType(p).name)}</span>` : 'another wormhole'}. Allocating it also allocates the other end.</div></div>` `` |
| 2851 | `tooltipHtml` | `` `<div class="tt-effects"><div><span class="hl">${esc(volumeName(n.volume))}</span> volume's Wormhole exit. Reached by linking an anchor in a subroutine socket.</div></div>` `` |
| 2860 | `tooltipHtml` | `` `<div class="tt-note">Themes:${esc([...nodeTheme].map(themeName).join(', '))}</div>` `` |
| 2862 | `tooltipHtml` | `` `<div class="tt-note">Needs a ship with: ${esc(reqs.join(', '))}</div>` `` |
| 2863 | `tooltipHtml` | `` `<div class="tt-note">Unlocked by: ${esc(n.gates.map(g => humanize(g.slice(5))).join(', '))}</div>` `` |
| 2866 | `tooltipHtml` | `` `<div class="tt-warn">Breaks a node rule: ${esc(problem.text)}</div>` `` |
| 2870 | `tooltipHtml` | `` `<div class="tt-note">Allocated for free by the ${esc(grant.def.name)} (no path, no node slot). Change the cache's notables in its socket to free it.</div>` `` |
| 2876 | `tooltipHtml` | `` `<div class="tt-note">Ctrl+click to jump to ${esc(placeName(jt))}.</div>` `` |
| 2877 | `tooltipHtml` | `` `<div class="tt-note">Ctrl+click to jump to ${esc(placeName(jt))}.</div>` `` |
| 2879 | `tooltipHtml` | `` `<div class="tt-note">Click for options (jump${state.root && n.id !== state.root ? (allocated ? ', remove' : ', allocate') : ''}). Ctrl+click to jump to ${esc(placeName(jt))}.</div>` `` |
| 2880 | `tooltipHtml` | `` '<div class="tt-note">Click to start from this root.</div>' `` |
| 2881 | `tooltipHtml` | `` '<div class="tt-note">Starting root. Right-click to reset the build.</div>' `` |
| 2884 | `tooltipHtml` | `` 'change what it holds' `` |
| 2884 | `tooltipHtml` | `` 'socket a subroutine or link an anchor' `` |
| 2884 | `tooltipHtml` | `` `<div class="tt-note">Click to ${state.links.get(n.id) \|\| state.subs.get(n.id) ? 'change what it holds' : 'socket a subroutine or link an anchor'}. Right-click to remove.</div>` `` |
| 2885 | `tooltipHtml` | `` '<div class="tt-note">Click for options. Right-click to remove.</div>' `` |
| 2886 | `tooltipHtml` | `` `<div class="tt-warn">Click to remove${gone.length > 1 ? ` (${gone.length} nodes)` : ''}.</div>` `` |
| 2893 | `tooltipHtml` | `` ` through ${via} waypoint${via > 1 ? 's' : ''}` `` |
| 2894 | `tooltipHtml` | `` `<div class="tt-warn">Can't be allocated${viaText}. ${esc(refusalText(n, found.block))}</div>` `` |
| 2895 | `tooltipHtml` | `` 'Link an anchor in a subroutine socket to reach this node.' `` |
| 2895 | `tooltipHtml` | `` 'Not reachable from your allocated nodes.' `` |
| 2896 | `tooltipHtml` | `` `<div class="tt-warn">${path.length} node${path.length > 1 ? 's' : ''}${viaText} needed; Only ${Math.max(0, state.cap - used())} left (over cap).</div>` `` |
| 2897 | `tooltipHtml` | `` ' and pick an option' `` |
| 2897 | `tooltipHtml` | `` `<div class="tt-note">Click to allocate${path.length > 1 ? ` (${path.length} nodes${viaText})` : viaText}${isChoice(n) ? ' and pick an option' : ''}.</div>` `` |
| 2900 | `tooltipHtml` | `` 'Integrated, kept while unallocated. ' `` |
| 2900 | `tooltipHtml` | `` `<div class="tt-note">${allocated ? '' : 'Integrated, kept while unallocated. '}Alt+click or I to remove integration.</div>` `` |
| 2901 | `tooltipHtml` | `` `<div class="tt-note">Alt+click or I to integrate (+${esc(pointsText(nextIntegrationCost()))}).</div>` `` |
| 2905 | `tooltipHtml` | `` `<div class="tt-note">Waypoint ${wi + 1}. Shift+click delete waypoint.</div>` `` |
| 2906 | `tooltipHtml` | `` `<div class="tt-note">Shift+click waypoint ${waypoints.length + 1}.</div>` `` |
| 2912 | `tooltipHtml` | `` 'switch to' `` |
| 2912 | `tooltipHtml` | `` 'allocate as' `` |
| 2912 | `tooltipHtml` | `` ', path included' `` |
| 2912 | `tooltipHtml` | `` `<div class="tt-note">Ctrl+click to ${sat(n.id) ? 'switch to' : 'allocate as'} ${esc(last.name)}${many ? ', path included' : ''}.</div>` `` |
| 2921 | `radiusNotesHtml` | `` '<div class="tt-warn">Grants nothing: inside Empty Shell Axion\'s radius.</div>' `` |
| 2923 | `radiusNotesHtml` | `` '<div class="tt-note">Inside Empty Shell Axion\'s radius: no effects granted if allocated.</div>' `` |
| 2926 | `radiusNotesHtml` | `` `<div class="tt-note">${esc(g.def.name)}: applies only ${esc(g.when.toLowerCase())}, at ×${g.strength}. Effects not read live in combat are lost.</div>` `` |
| 2931 | `radiusNotesHtml` | `` `<div class="tt-note">${esc(d.def.name)} rewrites it into one of: ${esc(pool.map(id => types.get(id)?.name \|\| id).join(', '))}. Which one is rolled per item; the planner shows the original.</div>` `` |
| 2932 | `radiusNotesHtml` | `` `<div class="tt-note">In the ${esc(d.def.name)}'s radius, but it has no ${n.tier.toLowerCase()} replacements, so it stays as it is.</div>` `` |
| 2935 | `radiusNotesHtml` | `` `<div class="tt-note">${esc(d.def.name)} adds ${d.def.minLines === d.def.maxLines ? d.def.minLines : `${d.def.minLines}–${d.def.maxLines}`} of these lines (rolled per item, not in the totals):</div>` `` |
| 2939 | `radiusNotesHtml` | `` `<div class="tt-note">On the Root Conduit's route: +5 ${esc(affinityName(sc.conduit.aff))} affinity.</div>` `` |
| 2999 | `placeName` | `` `the ${volumeName(n.volume)} volume` `` |
| 3639 | `targetTooltipNote` | `` '<div class="tt-note">Starting root: always in the build.</div>' `` |
| 3640 | `targetTooltipNote` | `` 'Wanted' `` |
| 3640 | `targetTooltipNote` | `` 'Forbidden' `` |
| 3641 | `targetTooltipNote` | `` 'Wanted' `` |
| 3641 | `targetTooltipNote` | `` 'forbid it' `` |
| 3641 | `targetTooltipNote` | `` 'Forbidden' `` |
| 3641 | `targetTooltipNote` | `` 'clear it' `` |
| 3641 | `targetTooltipNote` | `` 'mark it wanted' `` |
| 3644 | `targetTooltipNote` | `` 'Wanted' `` |
| 3644 | `targetTooltipNote` | `` ' Right-click to clear.' `` |
| 3644 | `targetTooltipNote` | `` `<div class="tt-note">${st ? `<b>${st}.</b> ` : ''}Click to ${next}.${st === 'Wanted' ? ' Right-click to clear.' : ''}</div>` `` |
| 3645 | `targetTooltipNote` | `` '<div class="tt-note">On the planned path.</div>' `` |

### Pickers (choice, wormhole, socket) (44)

Key prefix: `picker.*`

| Line | Function | Text |
|---:|---|---|
| 3020 | `openPicker` | `` '<h4>Reset the build?</h4>' `` |
| 3021 | `openPicker` | `` '<button data-act="reset" class="danger">Reset build</button>' `` |
| 3022 | `openPicker` | `` '<button data-act="cancel">Cancel</button>' `` |
| 3025 | `openPicker` | `` `<h4>${esc(n.type.name)}: choose an option</h4>` `` |
| 3034 | `openPicker` | `` `<button data-act="remove" class="danger">Remove node</button>` `` |
| 3038 | `openPicker` | `` `<button data-act="jump" class="current"><span><div>Jump to ${esc(placeName(target))}</div></span></button>` `` |
| 3042 | `openPicker` | `` 'Unlink anchor' `` |
| 3042 | `openPicker` | `` 'Remove' `` |
| 3047 | `openPicker` | `` ', through the waypoints' `` |
| 3048 | `openPicker` | `` '<div class="sub" style="padding:2px 0">Not reachable from current build.</div>' `` |
| 3055 | `openPicker` | `` `<h4>Subroutine socket</h4>` `` |
| 3056 | `openPicker` | `` 'None socketed' `` |
| 3056 | `openPicker` | `` `<button data-section="sub" class="section${socketSection === 'sub' ? ' open' : ''}" aria-expanded="${socketSection === 'sub'}"><span><div>${socketSection === 'sub' ? '▾' : '▸'} Subroutine</div><div class="sub">${esc(sd ? sd.name : 'None socketed')}</div></span></button>` `` |
| 3058 | `openPicker` | `` `Linked to ${volumeName(byId.get(cur).volume)}` `` |
| 3058 | `openPicker` | `` 'None linked' `` |
| 3058 | `openPicker` | `` `<button data-section="anchor" class="section${socketSection === 'anchor' ? ' open' : ''}" aria-expanded="${socketSection === 'anchor'}"><span><div>${socketSection === 'anchor' ? '▾' : '▸'} Wormhole anchor</div><div class="sub">${esc(cur ? `Linked to ${volumeName(byId.get(cur).volume)}` : 'None linked')}</div></span></button>` `` |
| 3060 | `openPicker` | `` '<button data-act="remove" class="danger">Remove socket</button>' `` |
| 3074 | `subroutinePickerHtml` | `` `<h4>Socketed subroutine</h4><div class="sub-current">${iconImg(def.icon, def.name)}<div><div>${esc(def.name)}</div><div class="sub">${esc(subSummary(def, e, n))}</div>${def.unobtainable ? `<div class="sub bad">${UNOBTAINABLE_TEXT}</div>` : ''}</div></div>` `` |
| 3076 | `subroutinePickerHtml` | `` '<div class="sub">Affinity (rolled per item; pick the one yours shows):</div><div class="pick-row">' `` |
| 3082 | `subroutinePickerHtml` | `` `<div class="sub">Notables it allocates (${grants.length} of up to ${cacheMax(def)}; rolled per item, pick the ones yours shows):</div>` `` |
| 3085 | `subroutinePickerHtml` | `` ' (idle: already allocated)' `` |
| 3085 | `subroutinePickerHtml` | `` ' (idle: another cache allocates it)' `` |
| 3085 | `subroutinePickerHtml` | `` ' (inert while its volume is hidden)' `` |
| 3085 | `subroutinePickerHtml` | `` 'refused' `` |
| 3093 | `subroutinePickerHtml` | `` '<button data-act="unsub" class="danger">Remove subroutine</button>' `` |
| 3095 | `subroutinePickerHtml` | `` 'Subroutines (click the socketed one again to remove it)' `` |
| 3095 | `subroutinePickerHtml` | `` 'Socket a subroutine' `` |
| 3099 | `subroutinePickerHtml` | `` 'Socketed. Click to remove.' `` |
| 3100 | `subroutinePickerHtml` | `` 'Remove from this socket' `` |
| 3100 | `subroutinePickerHtml` | `` 'Socket into this socket' `` |
| 3106 |  | `` 'Allocates 1 to 3 notables for free' `` |
| 3113 | `subSummary` | `` 'Inactive: the socket isn\'t allocated.' `` |
| 3116 | `subSummary` | `` `+${5 * c.count} ${affinityName(c.aff)} affinity (${c.count} node${c.count === 1 ? '' : 's'} between the root and this socket).` `` |
| 3116 | `subSummary` | `` 'Grants nothing: no allocated route from the root reaches this socket.' `` |
| 3120 | `subSummary` | `` `+${k} to every affinity (${k} small nodes in its radius). ${silent} allocated small node${silent === 1 ? '' : 's'} in it grant nothing.` `` |
| 3126 | `subSummary` | `` `${GATE_LINES[gate.effect]}: ${allocatedIn} allocated node${allocatedIn === 1 ? '' : 's'} of ${mine.length} in its radius apply ×${gate.max}, live-in-combat effects only.` `` |
| 3130 | `subSummary` | `` 'Inactive: only one doctrine archive works per ship.' `` |
| 3131 | `subSummary` | `` `${d.nodes.size} nodes in its radius are ${def.behaviour === 'REWRITE' ? 'rewritten' : 'augmented'}. What each gets is rolled per item, so the totals leave it out.` `` |
| 3135 | `subSummary` | `` `${act} notable${act === 1 ? '' : 's'} allocated for free (no path, no node slot).` `` |
| 3143 | `anchorPickerHtml` | `` `<button data-act="jump"><span><div>Jump to ${esc(placeName(byId.get(cur)))}</div></span></button>` `` |
| 3150 | `anchorPickerHtml` | `` 'Hidden under Optional Volumes in Optional rules' `` |
| 3150 | `anchorPickerHtml` | `` 'Linked to another socket' `` |
| 3150 | `anchorPickerHtml` | `` 'In game: ' `` |
| 3153 | `anchorPickerHtml` | `` '<button data-act="unlink">Unlink anchor</button>' `` |

### Target mode (26)

Key prefix: `target.*`

| Line | Function | Text |
|---:|---|---|
| 3461 | `computePlan` | `` 'Choose a root.' `` |
| 3471 | `isGranted` | `` 's are' `` |
| 3471 | `isGranted` | `` `${bad.length} forbidden node${bad.length > 1 ? 's are' : ' is'} already in the build and stay${bad.length > 1 ? '' : 's'}. Untick "Keep current build" to plan without ${bad.length > 1 ? 'them' : 'it'}.` `` |
| 3473 | `computePlan` | `` 'Click nodes to mark them wanted.' `` |
| 3477 | `computePlan` | `` `${targetLabel(n)} opens only through an anchor linked in a subroutine socket. Link one first.` `` |
| 3494 | `computePlan` | `` 'you forbade it' `` |
| 3495 | `computePlan` | `` `${targetLabel(n)} can't be allocated: ${why}` `` |
| 3495 | `computePlan` | `` `${targetLabel(n)} takes ${targetLabel(m)} with it, and ${why.replace(/\.$/, '')}.` `` |
| 3497 | `computePlan` | `` 'Every wanted node is already in the build.' `` |
| 3510 | `computePlan` | `` `${targetLabel(lost)} is in a faction volume with no anchor linked to it. Link one to its exit in a subroutine socket first.` `` |
| 3511 | `computePlan` | `` `${targetLabel(lost)} can't be reached from the root.` `` |
| 3514 | `computePlan` | `` `No legal way to reach ${targetLabel(lost)}: every way there passes a forbidden node or one the rules refuse` `` |
| 3515 | `computePlan` | `` ` and ${steered.length - 2} more` `` |
| 3515 | `computePlan` | `` `, here ${steered.slice(0, 2).join(' and ')}${steered.length > 2 ? ` and ${steered.length - 2} more` : ''}.` `` |
| 3531 | `mine` | `` `it can't be taken with ${targetLabel(n)}` `` |
| 3532 | `computePlan` | `` `${targetLabel(n)} can't be allocated with the rest: ${p.block.text}` `` |
| 3544 | `computePlan` | `` `${total} nodes needed, ${total - state.cap} over the cap of ${state.cap}.` `` |
| 3547 | `computePlan` | `` `No legal plan found after steering around ${TARGET_RETRIES} refused nodes.` `` |
| 3576 | `renderTargets` | `` `${targets.want.size} wanted · ${targets.forbid.size} forbidden.` `` |
| 3580 | `renderTargets` | `` `Not possible. ${p.text}` `` |
| 3581 | `renderTargets` | `` 'Nothing to change.' `` |
| 3582 | `renderTargets` | `` `Plan: ${gained} more node${gained === 1 ? '' : 's'}${p.remove.length ? `, ${p.remove.length} removed` : ''}, ${p.total} of ${state.cap} in all. ` `` |
| 3583 | `renderTargets` | `` 'That is the fewest possible.' `` |
| 3583 | `renderTargets` | `` ` (over ${TARGET_EXACT_MAX} wanted nodes the search is approximate)` `` |
| 3583 | `renderTargets` | `` ' (it had to steer around refused nodes)' `` |
| 3583 | `renderTargets` | `` `It may not be the fewest${targets.want.size > TARGET_EXACT_MAX ? ` (over ${TARGET_EXACT_MAX} wanted nodes the search is approximate)` : ' (it had to steer around refused nodes)'}.` `` |

### Top bar, summary panel and stat sheet (57)

Key prefix: `bar.*, panel.*, sheet.*`

| Line | Function | Text |
|---:|---|---|
| 1462 | `totals` | `` 'Root Conduit' `` |
| 1498 | `previewDiffHtml` | `` '<div class="ic-was"><span class="builtin">▲ new when integrated</span></div>' `` |
| 1500 | `previewDiffHtml` | `` `<div class="ic-was"><span class="builtin">▲</span> <span class="muted">without integration:</span> ${describe(s.effect, b.magnitude)}</div>` `` |
| 1811 | `drawRegionLabels` | `` 'Core tree' `` |
| 2545 | `renderChrome` | `` 'Choose a root' `` |
| 2553 | `renderChrome` | `` `Undo, ${undoStack.length} step${undoStack.length === 1 ? '' : 's'} stored (Ctrl+Z)` `` |
| 2555 | `renderChrome` | `` `Ship rules (${shipN})` `` |
| 2555 | `renderChrome` | `` 'Ship rules' `` |
| 2556 | `renderChrome` | `` `Optional rules (${storyN})` `` |
| 2556 | `renderChrome` | `` 'Optional rules' `` |
| 2557 | `renderChrome` | `` 'Ship' `` |
| 2563 | `renderChrome` | `` 'Choose a root' `` |
| 2564 | `renderChrome` | `` `${waypoints.length} waypoint${waypoints.length === 1 ? '' : 's'}: click a node to start pathing. Shift+click an existing waypoint to drop it, Esc to clear.` `` |
| 2570 | `renderPanel` | `` `${used()} of ${state.cap} nodes` `` |
| 2597 | `renderPanel` | `` '<div class="empty">Pick one of the three roots near the center to start.</div>' `` |
| 2614 | `renderPanel` | `` 'Other' `` |
| 2637 | `renderPanel` | `` `Grants <span class="hl">${esc(hullModName(hm))}</span>.` `` |
| 2640 | `renderPanel` | `` `<div class="stat-group"><h3>Other effects</h3>${[...extras].map(e => `<div class="stat-line">${e}</div>`).join('')}</div>` `` |
| 2645 | `renderPanel` | `` `<div class="stat-group"><h3>For the first ${esc(secs)} seconds after deployment</h3>` `` |
| 2652 | `renderPanel` | `` '<div class="stat-line muted">Nothing: none of their effects are read live in combat.</div>' `` |
| 2653 | `renderPanel` | `` `<div class="stat-line muted">${g.nodes} allocated node${g.nodes === 1 ? '' : 's'} in its radius give these instead of their usual effects.</div></div>` `` |
| 2656 | `renderPanel` | `` `<div class="stat-group"><h3>Subroutines</h3>${subLines.join('')}</div>` `` |
| 2659 | `renderPanel` | `` '<div class="stat-group"><h3>Affinity thresholds reached</h3>' `` |
| 2663 | `renderPanel` | `` '<div class="empty">No effects yet. Click a glowing node next to your root.</div>' `` |
| 2676 | `renderPanel` | `` ' <span class="builtin">Integrated</span>' `` |
| 2676 | `renderPanel` | `` ' <span class="builtin">Integrated (preview)</span>' `` |
| 2677 | `renderPanel` | `` 'Alt+click to integrate or remove' `` |
| 2678 | `renderPanel` | `` '<div class="empty">No notables or keystones allocated yet.</div>' `` |
| 2691 | `problemsHtml` | `` `<div class="rule-problems"><h3>${problems.size} illegal node${problems.size === 1 ? '' : 's'}</h3>` `` |
| 2692 | `problemsHtml` | `` `<p class="muted">Illegal build</p>${rows}</div>` `` |
| 2720 | `updateAffNote` | `` 's are' `` |
| 2720 | `updateAffNote` | `` `These add up to ${sum}; ${n} affinity node${n === 1 ? ' is' : 's are'} allocated.` `` |
| 2757 | `renderInteg` | `` `<span class="muted">Integrated:</span> <b class="builtin">${k}</b> of ${able.length + kept} · <b>${storyPointCost(k)}</b> story point${storyPointCost(k) === 1 ? '' : 's'}` `` |
| 2764 | `renderInteg` | `` `${kept} kept on removed node${kept === 1 ? '' : 's'}.` `` |
| 2765 | `renderInteg` | `` `Preview: all ${able.length} integrated, ${pointsText(storyPointCost(able.length))}. Totals and the stat sheet show changes; build unchanged.` `` |
| 2800 |  | `` `${MOD_GIT.ahead} commit${MOD_GIT.ahead === 1 ? '' : 's'} after release ${MOD_GIT.release}` `` |
| 2800 |  | `` 'no release tag' `` |
| 2800 |  | `` `branch ${MOD_GIT.branch} at` `` |
| 2800 |  | `` ', with uncommitted changes' `` |
| 2800 |  | `` `Exiled Sector ${D.modVersion \|\| 'unknown'} (mod_info.json), ${MOD_GIT.release ? `${MOD_GIT.ahead} commit${MOD_GIT.ahead === 1 ? '' : 's'} after release ${MOD_GIT.release}` : 'no release tag'}, ${MOD_GIT.branch ? `branch ${MOD_GIT.branch} at` : 'commit'} ${MOD_GIT.commit}${MOD_GIT.dirty ? ', with uncommitted changes' : ''}` `` |
| 2801 |  | `` `Exiled Sector ${D.modVersion \|\| 'unknown'}` `` |
| 2802 |  | `` `Exiled Sector ${modVersionShort} · Planner ${plannerVersionShort}` `` |
| 2823 | `exclusivityHtml` | `` 'Mutually exclusive with hullmods' `` |
| 2824 | `exclusivityHtml` | `` 'Mutually exclusive with nodes' `` |
| 4056 | `renderThemeButton` | `` 'Dark' `` |
| 4056 | `renderThemeButton` | `` 'Light' `` |
| 4057 | `renderThemeButton` | `` `Theme: Auto (${name[theme]})` `` |
| 4057 | `renderThemeButton` | `` `Theme: ${name[theme]}` `` |
| 4088 | `statSheet` | `` 'Nodes' `` |
| 4105 | `statSheet` | `` 'For the first {seconds} seconds after deployment: {text}' `` |
| 4135 | `sheetTabHtml` | `` `<div class="gs-tabhead"><span class="muted">The in-game stat sheet. Hover over the effects to see source(s).</span>` `` |
| 4136 | `sheetTabHtml` | `` 'Full Sheet' `` |
| 4152 | `renderSheet` | `` '<div class="gs-col"><p class="gs-empty">Pick one of the three roots near the center to start.</p></div>' `` |
| 4168 | `renderSheet` | `` `${root ? root.type.name : ''} \u00b7 ${hull.charAt(0).toUpperCase() + hull.slice(1)} \u00b7 ${state.alloc.size + 1}/${state.cap} nodes` `` |
| 4194 | `showSheetTip` | `` 'Sources' `` |
| 4195 | `showSheetTip` | `` ' class="builtin" title="Integrated"' `` |
| 5731 |  | `` `Mod data: ${modVersionLong}. Planner: ${PLANNER_VERSION}.` `` |

### Search, filter and list view (47)

Key prefix: `search.*, filter.*, list.*`

| Line | Function | Text |
|---:|---|---|
| 3829 |  | `` 'Core' `` |
| 3851 | `searchResultsHtml` | `` 'that search and filter' `` |
| 3851 | `searchResultsHtml` | `` 'that filter' `` |
| 3851 | `searchResultsHtml` | `` 'that search' `` |
| 3851 | `searchResultsHtml` | `` `<div class="empty">No nodes match ${filterCount() && searchTerms.length ? 'that search and filter' : filterCount() ? 'that filter' : 'that search'}.</div>` `` |
| 3854 | `searchResultsHtml` | `` 'all of the themes' `` |
| 3854 | `searchResultsHtml` | `` 'any of the themes' `` |
| 3854 | `searchResultsHtml` | `` 'the theme' `` |
| 3855 | `searchResultsHtml` | `` 'affinity nodes' `` |
| 3858 | `searchResultsHtml` | `` `${state.root ? `, ${have} allocated` : ''}. Click one to jump to it.</div>` `` |
| 3968 | `renderFilterButton` | `` 'Filter' `` |
| 3979 | `renderThemeFilter` | `` `<div class="theme-head"><b>Filter</b></div>` `` |
| 3980 | `renderThemeFilter` | `` `<p class="filter-affinity"><label title="Highlight every affinity node (the Low / Mid / High choice nodes)"><input type="checkbox" id="filter-affinity"${showAffinity ? ' checked' : ''}> Show affinity nodes <span class="muted">${affinityNodeCount}</span></label></p>` `` |
| 3981 | `renderThemeFilter` | `` `<div class="theme-head"><b>Themes</b><label>Match <select id="theme-match">` `` |
| 3982 | `renderThemeFilter` | `` `<option value="any"${themeMatchAll ? '' : ' selected'}>any ticked</option><option value="all"${themeMatchAll ? ' selected' : ''}>all ticked</option></select></label></div>` `` |
| 3984 | `renderThemeFilter` | `` `<div class="export-actions"><button id="theme-clear"${filterCount() ? '' : ' disabled'}>Clear</button><button id="theme-close">Close</button></div>` `` |
| 4241 | `listRowHtml` | `` `Holds ${d.name}` `` |
| 4241 | `listRowHtml` | `` `Anchor to the ${volumeName(byId.get(exit).volume)} volume` `` |
| 4241 | `listRowHtml` | `` 'Empty' `` |
| 4243 | `listRowHtml` | `` `Paired with ${n.pairedWith}` `` |
| 4244 | `listRowHtml` | `` `Linked to ${s}` `` |
| 4245 | `listRowHtml` | `` `Themes: ${[...themes].map(themeName).join(', ')}` `` |
| 4255 | `listRowHtml` | `` 'Clear the mark' `` |
| 4255 | `listRowHtml` | `` 'Mark wanted: the plan reaches it' `` |
| 4256 | `listRowHtml` | `` 'Clear the mark' `` |
| 4256 | `listRowHtml` | `` 'Mark forbidden: the plan avoids it' `` |
| 4257 | `listRowHtml` | `` 'Wanted' `` |
| 4257 | `listRowHtml` | `` 'Forbidden' `` |
| 4267 |  | `` 'Affinity nodes' `` |
| 4278 | `affRowHtml` | `` `<div class="tr">${k} affinity node${k === 1 ? '' : 's'}</div>` `` |
| 4311 | `renderList` | `` 'Click a node to see it on the map.' `` |
| 4313 | `renderList` | `` 'Target mode: mark nodes Desired or Forbidden (clicking a node cycles its mark, as on the map), then Allocate.' `` |
| 4314 | `renderList` | `` 'Click a node to see it on the map.' `` |
| 4336 | `groupRank` | `` 'Show' `` |
| 4336 | `groupRank` | `` 'Hide' `` |
| 4347 | `renderList` | `` ' matching the search and Filter' `` |
| 4349 | `renderList` | `` `, ${inCollapsed} in collapsed trees` `` |
| 4352 | `renderList` | `` 'No build yet.' `` |
| 4353 | `renderList` | `` `${total} of ${buildSize} allocated nodes${filtered} (${affCount} affinity)${collapsedNote}` `` |
| 4354 | `renderList` | `` `${total} of ${listNodes.filter(n => !switchedOff(n)).length} nodes${filtered}${collapsedNote}` `` |
| 4356 | `renderList` | `` 'Pick a root on the map to start a build.' `` |
| 4357 | `renderList` | `` 'Nothing allocated yet besides the root.' `` |
| 4357 | `renderList` | `` 'No nodes match. Change search term or Filters.' `` |
| 4371 | `setView` | `` 'Map' `` |
| 4371 | `setView` | `` 'List' `` |
| 4373 | `setView` | `` 'Skill tree map (L)' `` |
| 4373 | `setView` | `` 'List view of every non-affinity node (L)' `` |

### Ship rules and Optional rules (15)

Key prefix: `ship.*, optional.*`

| Line | Function | Text |
|---:|---|---|
| 4493 | `problemSummary` | `` ` ${problems} illegal allocated node${problems === 1 ? '' : 's'}.` `` |
| 4505 | `renderShipPane` | `` `Low-armor nodes need ${fmt(evalExpr(cut.cutoff, 1))} or less on a ${hullLabel()} (only Critical Point Refit for now).` `` |
| 4509 | `renderShipPane` | `` 'Refuses ' `` |
| 4509 | `renderShipPane` | `` 'No node clashes with this hullmod' `` |
| 4510 | `renderShipPane` | `` '<span class="muted">None listed.</span>' `` |
| 4512 | `renderShipPane` | `` `Limit: ${logisticsCap()} logistics notables and keystones. Some items add slots in game.` `` |
| 4514 | `renderShipPane` | `` `${n} ship rule${n === 1 ? '' : 's'} set.${problemSummary()}` `` |
| 4535 | `gateRow` | `` `<div class="vol-gates" data-for="${esc(t.id)}"><span class="muted">Game state reached:</span>${gates.map(gateRow).join('')}</div>` `` |
| 4536 | `renderStory` | `` '<span class="muted">None in this mod version.</span>' `` |
| 4559 | `renderStory` | `` ' or unlock' `` |
| 4559 | `renderStory` | `` 's or unlocks' `` |
| 4560 | `renderStory` | `` `${hv} optional volume toggle${hv === 1 ? '' : 's'}` `` |
| 4561 | `renderStory` | `` `Unticked: ${parts.join(' and ')}.` `` |
| 4561 | `renderStory` | `` 'Everything is ticked.' `` |
| 4608 | `addHullMod` | `` `No node clashes with "${raw}", so it doesn't change anything. Pick one from the list.` `` |

### Templates (file, codes, save, load) (96)

Key prefix: `templates.*`

| Line | Function | Text |
|---:|---|---|
| 981 | `templateNameProblem` | `` 'Give the template a name.' `` |
| 983 | `templateNameProblem` | `` `Names can only use English letters, digits, spaces and keyboard symbols, so the game can type and show them. Remove ${bad.slice(0, 5).map(charLabel).join(', ')}${bad.length > 5 ? ', …' : ''}.` `` |
| 984 | `templateNameProblem` | `` `Names can be at most ${TEMPLATE_NAME_MAX} characters.` `` |
| 998 | `clean` | `` `Removed ${bad.slice(0, 5).map(charLabel).join(', ')}${bad.length > 5 ? ', …' : ''}: names can only use English letters, digits, spaces and keyboard symbols.` `` |
| 1010 | `parseTemplateFile` | `` 'That file is not valid JSON. No changes written.' `` |
| 1012 | `parseTemplateFile` | `` 'That file has no "templates" list. No changes written.' `` |
| 1084 | `codeToTemplate` | `` 'Please paste a template code.' `` |
| 1089 | `codeToTemplate` | `` 'Invalid template code.' `` |
| 1090 | `codeToTemplate` | `` 'Invalid template code.' `` |
| 1094 | `codeToTemplate` | `` 'This browser can\'t read codes. Try Chrome, Edge or Firefox.' `` |
| 1100 | `codeToTemplate` | `` 'Invalid template code.' `` |
| 1104 | `codeToTemplate` | `` 'Invalid template code.' `` |
| 1106 | `codeToTemplate` | `` 'Invalid template code.' `` |
| 4785 | `renderFileNotice` | `` ` and ${names.length - 3} more` `` |
| 4786 | `renderFileNotice` | `` `Templates file ${linkedHandle ? linkedHandle.name : ''} change detected (most likely by Starsector).` `` |
| 4787 | `renderFileNotice` | `` 'Changed' `` |
| 4787 | `renderFileNotice` | `` 'Added' `` |
| 4787 | `renderFileNotice` | `` 'Removed' `` |
| 4787 | `renderFileNotice` | `` ' The Templates list is now up to date.' `` |
| 4789 | `renderFileNotice` | `` ` "${cur.name}" was removed from the template file. Current build still loaded in the planner. Don't forget to save to preserve the build.` `` |
| 4792 | `list` | `` ', including the edits you made since loading or saving it' `` |
| 4792 | `list` | `` ` Your build from "${cur.name}" was updated (most likely by Starsector). Load the new version? It will replace your current build${edited ? ', including the edits you made since loading or saving it' : ''}. Undo brings it back.` `` |
| 4796 | `renderFileNotice` | `` 'Keep my build' `` |
| 4796 | `renderFileNotice` | `` 'Dismiss' `` |
| 4859 | `renderWatchStatus` | `` 'Manually. Use Check file in the top bar to check for changes.' `` |
| 4860 | `renderWatchStatus` | `` 'Starts once the file is linked and the browser allows access (after a browser restart, click Reconnect or Check file).' `` |
| 4861 | `renderWatchStatus` | `` 'The browser reports each change to the file as it happens.' `` |
| 4862 | `renderWatchStatus` | `` 'No file observer detected (unsupported browser). File is not being watched.' `` |
| 4863 | `renderWatchStatus` | `` 'Instant watching failed. File is not being watched. Relink to try again.' `` |
| 4864 | `renderWatchStatus` | `` 'Starting instant watching…' `` |
| 4865 | `renderWatchStatus` | `` `Checking every ${watchSecs} s.` `` |
| 4900 |  | `` 'If the system stops reporting changes, reload, or relink.' `` |
| 4901 |  | `` 'This browser does not support File System Observer. Unable to use instant watching.' `` |
| 4902 |  | `` ' Watching only happens while this tab is visible.' `` |
| 4929 | `linkFile` | `` 'Exiled Sector templates' `` |
| 4957 | `plannerDir` | `` `"${dir.name}" isn't the planner's folder. Pick the folder that holds the planner's web folder and README.` `` |
| 4974 | `createTemplatesFile` | `` `"${root.name}" isn't the planner's folder.` `` |
| 4982 | `createTemplatesFile` | `` `Created ${SAVED_TEMPLATES_DIR}\\${name} in the planner's folder and linked it.` `` |
| 5017 | `renderTemplatesFile` | `` ' <span class="muted">(click Reconnect to allow access)</span>' `` |
| 5017 | `renderTemplatesFile` | `` `Linked: <b>${esc(linkedHandle.name)}</b>${linkedAccess === 'prompt' ? ' <span class="muted">(click Reconnect to allow access)</span>' : ''}` `` |
| 5018 | `renderTemplatesFile` | `` 'No file linked yet.' `` |
| 5019 | `renderTemplatesFile` | `` 'Link a different file…' `` |
| 5019 | `renderTemplatesFile` | `` 'Link templates file…' `` |
| 5025 | `renderTemplatesFile` | `` `Pick ${TEMPLATE_FILE} in your Starsector saves/common folder. The planner remembers it for next time. If the file doesn't exist yet, save any template in game first, or use "Download as a new file" below.` `` |
| 5027 | `renderTemplatesFile` | `` `Opened (read-only): <b>${esc(openedFile.name)}</b>` `` |
| 5027 | `renderTemplatesFile` | `` 'No file opened.' `` |
| 5028 | `renderTemplatesFile` | `` 'Open a different file…' `` |
| 5028 | `renderTemplatesFile` | `` 'Open templates file…' `` |
| 5033 | `renderTemplatesFile` | `` 'This browser can read files but not write to them.' `` |
| 5040 | `renderTemplateList` | `` 'Reconnect to see the templates in the file.' `` |
| 5040 | `renderTemplateList` | `` 'Link the file to see its templates.' `` |
| 5044 | `renderTemplateList` | `` '<p class="muted">The file has no templates yet.</p>' `` |
| 5061 | `renderTemplateList` | `` `<td><button data-code="${i}" title="Copy this template as a code">Code</button> ` `` |
| 5062 | `renderTemplateList` | `` `<button data-load="${i}" title="Replace the current build with this template">Load</button></td></tr>` `` |
| 5069 | `refreshExport` | `` 'Choose a root.' `` |
| 5077 | `refreshExport` | `` ' (you\'ll be asked about the hull)' `` |
| 5077 | `refreshExport` | `` ` · replaces the ${HULL_ENUM_LABEL[h]} template of this name${h !== HULL_ENUM[state.hull] ? ' (you\'ll be asked about the hull)' : ''}` `` |
| 5078 | `refreshExport` | `` ' · replaces the template of this name' `` |
| 5081 | `refreshExport` | `` ` · ${marks} marked for integration` `` |
| 5085 | `refreshExport` | `` `Save into ${linkedHandle.name}` `` |
| 5085 | `refreshExport` | `` 'Save into linked file' `` |
| 5086 | `refreshExport` | `` 'Link the templates file above to save straight into it.' `` |
| 5087 | `refreshExport` | `` 'Reconnect above to save into the file.' `` |
| 5120 | `importTemplate` | `` `"${t.name}" starts from an unknown root (${t.root}).` `` |
| 5183 | `loadTemplate` | `` 'its name has characters outside English letters, digits and keyboard symbols, so rename it before saving' `` |
| 5184 | `loadTemplate` | `` `${r.unknown.length} step${r.unknown.length > 1 ? 's' : ''} not in this version of the tree` `` |
| 5187 | `loadTemplate` | `` `${r.refused.length} step${r.refused.length > 1 ? 's' : ''} refused by the node rules (${effectiveType(f.node).name}: ${f.block.text.replace(/\.$/, '')}${r.refused.length > 1 ? ', …' : ''})` `` |
| 5189 | `loadTemplate` | `` `${r.unplaced.length} step${r.unplaced.length > 1 ? 's' : ''} couldn't be connected` `` |
| 5190 | `loadTemplate` | `` `showed ${r.turnedOn.join(' and ')} (Optional Volumes, Optional rules)` `` |
| 5191 | `loadTemplate` | `` `${r.integrated} node${r.integrated === 1 ? '' : 's'} integrated from the template's marks` `` |
| 5192 | `loadTemplate` | `` `${r.marks - r.integrated} integration mark${r.marks - r.integrated === 1 ? '' : 's'} on nodes that didn't land or can't be integrated` `` |
| 5193 | `loadTemplate` | `` `${used()} nodes is over the ${state.cap} cap` `` |
| 5194 | `loadTemplate` | `` `Loaded "${r.name}" (${r.taken} nodes)${notes.length ? '; ' + notes.join('; ') : ''}.` `` |
| 5206 |  | `` `Code for "${t.name}"` `` |
| 5219 | `showCode` | `` 'copied to the clipboard and shown above' `` |
| 5219 | `showCode` | `` 'is in the box above; copy it from there' `` |
| 5219 | `showCode` | `` `${label} (${code.length} characters) ${copied ? 'copied to the clipboard and shown above' : 'is in the box above; copy it from there'}.` `` |
| 5223 |  | `` 'Choose a root first.' `` |
| 5225 |  | `` `${problem} (The code uses the template name below.)` `` |
| 5226 |  | `` `Code for "${tpl.name.value.trim()}"` `` |
| 5231 |  | `` `made with mod ${t.mod}, this planner is based on ${D.modVersion}` `` |
| 5247 | `toggleExport` | `` 'My plan' `` |
| 5263 | `readyToExport` | `` 'Choose a root first.' `` |
| 5271 | `reportMerge` | `` 'Replaced' `` |
| 5271 | `reportMerge` | `` 'Added' `` |
| 5271 | `reportMerge` | `` `${result.replaced ? 'Replaced' : 'Added'} "${result.template.name}" (${result.template.steps.length} steps) ${where}. The file now has ${result.count} template${result.count === 1 ? '' : 's'}.` `` |
| 5304 | `startSave` | `` `"${plan.existing.name}" is already in the templates file as a ${from} template, but the Hull size dropdown is set to ${to}.` `` |
| 5305 | `startSave` | `` `Keep ${from}` `` |
| 5306 | `startSave` | `` `Change to ${to}` `` |
| 5310 | `startSave` | `` `A template named "${plan.existing.name}" already exists for the ${byId.get(state.root).type.name} root. Override it?` `` |
| 5311 | `startSave` | `` 'Override' `` |
| 5323 | `commitSave` | `` 'The browser was not allowed to write to that file.' `` |
| 5329 | `commitSave` | `` `"${saveName.trim()}" is already used by a template on this root. Pick another name.` `` |
| 5361 |  | `` 'Nothing was saved.' `` |
| 5366 | `saveIntoLinked` | `` 'The browser was not allowed to write to that file.' `` |
| 5403 |  | `` `Downloaded a new ${TEMPLATE_FILE} holding only "${name}".` `` |

### Mod assets (17)

Key prefix: `assets.*`

| Line | Function | Text |
|---:|---|---|
| 5505 |  | `` 'No Exiled Sector mod_info.json detected.' `` |
| 5553 | `showArt` | `` `Found Exiled Sector in "${result.info.folder}", but none of the images the planner uses are in it.` `` |
| 5608 | `renderArt` | `` 'Mod assets' `` |
| 5608 | `renderArt` | `` 'Loading assets…' `` |
| 5608 | `renderArt` | `` 'Reconnect assets' `` |
| 5608 | `renderArt` | `` 'Show mod assets' `` |
| 5610 | `renderArt` | `` `Allow the planner to read the mod folder "${artHandle ? artHandle.name : ''}" again, to show the mod's assets` `` |
| 5611 | `renderArt` | `` 'Show the mod\'s assets, read from your own Exiled Sector folder' `` |
| 5613 | `renderArt` | `` 'Reading the assets…' `` |
| 5614 | `renderArt` | `` ` (Exiled Sector ${esc(artInfo.version)})` `` |
| 5614 | `renderArt` | `` `Showing the assets from <b>${esc(artInfo.folder)}</b>${artInfo.version ? ` (Exiled Sector ${esc(artInfo.version)})` : ''}, ${artInfo.count} images.` `` |
| 5615 | `renderArt` | `` `Permission to read <b>${esc(artHandle.name)}</b> must be regranted. Click Reconnect.` `` |
| 5616 | `renderArt` | `` 'No mod folder chosen. Showing placeholders.' `` |
| 5621 | `renderArt` | `` `This folder has Exiled Sector ${esc(artInfo.version)}, and the planner's tree is from ${esc(D.modVersion)}. Icons of node types that changed between updates may be missing or different.` `` |
| 5624 | `renderArt` | `` 'Choose another folder…' `` |
| 5624 | `renderArt` | `` 'Choose mod folder…' `` |
| 5629 | `renderArt` | `` 'After a browser restart, permission must be regranted (Reconnect assets in the top bar).' `` |

## `index.html`

After migration `index.html` keeps only `data-t`, `data-t-title`, `data-t-placeholder` (and `data-t-aria-label`) keys, filled by `applyText()`. Text that `app.js` replaces at once (for example `#root-name`, `#btn-undo`'s title) can keep an empty element.

### Page and top bar → `bar.*`

| Line | Element | Text |
|---:|---|---|
| 6 | `<title>` | Exiled Sector Planner |
| 14–15 | `.brand` | Exiled Sector · Skill Tree Planner |
| 19–20 | `#root-group` | Root · Choose a root |
| 23–26 | `#tpl-group` | title: Click to open Templates. · Template · (edited) |
| 30–31 | Nodes | Nodes · `#cap` title: Node cap (mod default is 60) |
| 35–40 | `#hull` | Hull Size · Frigate · Destroyer · Cruiser · Capital |
| 45 | `#search` | placeholder: Search nodes… |
| 47 | `#btn-themes` | Filter · title: Filter nodes by the theme tags |
| 51 | `#btn-view` | List · title: List view of every non-affinity node (L) |
| 52 | `#btn-fit` | Center |
| 53 | `#btn-undo` | Undo · title: Undo, 0 steps stored (Ctrl+Z) |
| 54 | `#btn-reset` | Reset · title: Reset build |
| 55 | `#btn-targets` | Target Mode · title: Mark nodes wanted or forbidden, then calculate the most efficient path (T) |
| 56 | `#btn-code` | Copy code · title: Copy the current template into clipboard. Load with Templates → Load code |
| 57 | `#btn-ship` | Ship rules |
| 58 | `#btn-story` | Optional rules |
| 59 | `#btn-export` | Templates · title: Import and export templates |
| 60 | `#btn-checkfile` | Check file · title: Check the linked templates file for changes the game made (also reconnects it after a browser restart) |
| 61 | `#btn-art` | Show mod assets |
| 62 | `#btn-panel` | Summary · title: Show or hide summary (S) |
| 63 | `#btn-theme` | Theme: Dark |
| 64 | `#btn-keys` | Shortcuts |
| 410–412 | `#help` | Click allocate · Shift+click set waypoint · Right-click remove · Alt+click/I integrate · T target mode · L list view · Drag/arrows pan · Wheel/PgUp/PgDn zoom · ? all shortcuts |

### Summary panel → `panel.*`

| Line | Element | Text |
|---:|---|---|
| 70 | `.panel-head` | Build summary |
| 76–78 | `#aff-mix` | Affinity nodes: · All to · Low / Mid / High, titles: Set every allocated affinity node to Low Tech / Midline / High Tech |
| 81–84 | `#aff-mix` | Low · Mid · High · Apply, title: Change affinity nodes to this split (Enter) |
| 92 | `#integ` | Integrate all nodes · Remove all integrations |
| 95 | `#integ-preview` | Preview all integrated · title: See stats as if every allocated node were integrated. No changes to the build |
| 96 | `#integ-keep` | Keep when removed · title: On: a removed node stays integrated (SP increase). Off: removing a node removes its integration |
| 99 | `#integ-view` | Integrated effects · Inline · Side by side · title: How tooltips and the list view show a node's integrated effects next to its normal ones |
| 104–108 | `.panel-tabs` | Effects · Stats (title: The effects in the in-game stat sheet's sections, with a Full Sheet view) · Notables & keystones · Ship · Search |

### Ship tab → `ship.*`

| Line | Element | Text |
|---:|---|---|
| 112 | intro | Set ship-specific limitations here. Anything left as "Not set" isn't checked. Set hull size in the Hull size dropdown in the main header. |
| 116 | heading | Ship Options |
| 118–124 | `#ship-shield` | Shield · Not set · Front shield · Omni shield · No shield · Phase cloak |
| 126–127 | `#ship-armor` | Base armor · (before hullmods and skills) · placeholder: Not set |
| 129–136 | yes/no rows | Civilian-grade hull · System uses charges · Has station modules · Only built-in fighter wings · Not set · Yes · No |
| 139–142 | hullmods | Installed Hullmods · Add a hullmod · placeholder: Type the hullmod's name |
| 146–147 | logistics | Logistics · Extra logistics slots |
| 150 | `#ship-clear` | Reset ship rules |

### Target mode bar → `target.*`

| Line | Element | Text |
|---:|---|---|
| 156 | `#targets` | aria-label: Target Mode |
| 157 | intro | Targets · Clicking cycles a node between three modes: wanted - forbidden - normal. Right-click sets it to normal. |
| 160 | `#targets-keep` | Keep current build · title: On: add to the nodes you have. Off: reallocate from root. |
| 161–163 | buttons | Allocate · Clear marks · Done (title: Leave target mode (Esc or T). The marks are kept.) |

### Templates file notice → `templates.notice.*`

| Line | Element | Text |
|---:|---|---|
| 169–171 | buttons | Load the new version · Show templates · Dismiss |

### List view → `list.*`

| Line | Element | Text |
|---:|---|---|
| 174, 176 | aria-labels | Node list · Which list |
| 177–178 | modes | All nodes (title: Every node except affinity nodes) · Build (title: The nodes allocated in the current build, with affinity nodes counted per tech) |
| 182–185 | `#listview-sort` | Sort · Name (A to Z) · Skill tree · Order taken |
| 188–189 | groups | Collapse all · Expand all |

### Filter and stat sheet → `filter.*`, `sheet.*`

| Line | Element | Text |
|---:|---|---|
| 194 | `#theme-filter` | aria-label: Filter |
| 197 | `#statsheet-title` | Stats |
| 199 | `#statsheet-side` | Side Panel · title: Back to the Stats tab in the summary panel |
| 200 | `#statsheet-close` | Close · title: Close (Esc) |

### Templates dialog → `templates.*`

| Line | Element | Text |
|---:|---|---|
| 211–212 | head | Templates · Close (title: Close (Esc)) |
| 215 | intro | The game keeps skill tree templates for every save in one file, `exiledSector_skillTreeTemplates.json.data`, in the `saves/common` folder of your Starsector directory. It re-reads that file whenever the skill tree opens, so changes show up while the game is running. |
| 217 | heading | Templates file |
| 220–224 | buttons | Link templates file… · Create templates file… (title: Make an empty templates file in the planner's savedTemplates folder and link it) · Reconnect · Reload · Forget |
| 228–232 | `#tf-watch-mode` | Detect changes from the game: · Instantly (file observer) · Every few seconds · Manually |
| 234 | `#tf-watch-secs` | Check every · seconds |
| 239–240 | Import | Import · Link the file to see its templates. |
| 242–243 | Export | Export this build · Template name |
| 248 | `#tpl-save` | Save into linked file |
| 258–262 | `#tpl-conflict` | Or save as a new template named · Save as new template · Cancel |
| 266–267 | codes | Share as code · A code holds one template as text. Loading a code works like loading a template from a file; save it into the templates file afterwards to use it in game. |
| 269 | `#code-copy` | Copy code for current build |
| 271–272 | `#code-box` | Template code · placeholder: Paste code here (starts with ES1.) |
| 274 | `#code-load` | Load code |
| 278–280 | other | Other ways to export · Download as a new file |

### Mod assets dialog → `assets.*`

| Line | Element | Text |
|---:|---|---|
| 289–290 | head | Mod assets · Close |
| 293 | intro | None of Exiled Sector's assets are included in this planner. To view the assets in the planner, set the mod folder's path. |
| 295 | heading | Mod folder |
| 298–300 | buttons | Choose mod folder… · Reconnect · Forget |

### Optional rules dialog → `optional.*`

| Line | Element | Text |
|---:|---|---|
| 310–311 | head | Optional rules · Close |
| 316 | heading | Wormholes |
| 319–320 | Optional Volumes | Optional Volumes · Volumes built around other mods. Install the corresponding mod or turn on its LunaLib option. |
| 323–326 | gates | Game state reached · Tick all · Untick all |
| 330–333 | unlocks | Unlocked hullmods · Tick all · Untick all |
| 337–338 | integration cost | Integration cost · The mod's LunaLib setting Integration Story Point Cost. Only changes the story points shown. |
| 339–343 | `#story-integ-cost` | Story points per integration · Exponential: 1, 2, 4, 8… (default) · Additive: 1, 2, 3, 4… · Static: 2 each |
| 348 | `#story-clear` | Reset optional rules |

### Shortcuts dialog → `keys.*`

The whole list moves into `keys.js` as rows (keys plus description), so it's edited in one place; `CLAUDE.md`'s "update `#keys` whenever controls change" then points there.

| Line | Element | Text |
|---:|---|---|
| 355–356 | head | Shortcuts · Close |
| 359–372 | Keyboard | 12 rows: Pan (hold to keep moving) · Zoom in (hold to keep zooming) · Zoom out (hold to keep zooming) · Undo the last change · Re-center on the core tree · Show or hide the summary panel · Toggle target mode on/off · Switch between the map and the list view · Integrate / Remove Integration · Jump to the search box · Show or hide this list · Close this list, the Filter list, the full stat sheet or the option/anchor picker, clear waypoints, or leave target mode |
| 374 | note | Keys don't work while you're typing in the search, cap or hull fields. |
| 376–378 | search box | In the search box · Clear the search and exit |
| 381–396 | Mouse | 14 rows, from "Left-click a node / Allocate it, mapping the shortest path" to "Scroll wheel / Zoom toward the cursor" |
| 399–405 | Touch | 5 rows: Tap a node · Tap the same node again · Tap your starting root twice · Drag · Pinch |
| 364, 385, 387, 391 | Mac notes | (Cmd+Z on Mac) · (Cmd+click on Mac) · (Option+click on Mac) |
