# TOOLS.md

The scripts in `tools/`: how to run them and how the extractor reads the mod. `CLAUDE.md` covers the rest of the repo; check `CLAUDE.local.md` for this machine's paths first.

## Commands (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File tools\update.ps1    # mod -> newest release tag, extract, check, diff, record (-Tag, -NoCheckout, -NoFetch, -Commit)
powershell -ExecutionPolicy Bypass -File tools\extract.ps1   # rebuild the data from ExiledSector/ as checked out
powershell -ExecutionPolicy Bypass -File tools\serve.ps1     # http://localhost:8765/  (-Port to change)
powershell -ExecutionPolicy Bypass -File tools\release.ps1   # tag vX.Y.Z[-alpha.N|-beta.N|-rc.N]+es<mod release> (-Version, -Bump, -Pre, -RC, -Plain, -Push, -DryRun)
```

- `package.ps1 [-Tag <tag>]` builds `dist\exiled-sector-planner-<tag>.zip` from `git archive` of the tag plus a README.txt. It holds no art. `dist/` is excluded in `.git/info/exclude`.
- The planner version in the summary panel's footer comes from `web/version.js` (`window.PLANNER_VERSION`). The committed file says `'dev'`. `package.ps1` writes the tag into the zip's copy, and `serve.ps1` answers `/version.js` with `git describe --tags --match 'v*' --dirty`. `app.js` (`plannerVersionShort`) shows the tag without `+es...`, with `+N` for commits since and "(edited)" for `-dirty`; the full string is the footer's title.
- `release.ps1` takes the mod release from `tools/mod-sync.json` and refuses on a dirty tree or stale data. With neither `-Version` nor `-Bump`, it continues the newest open pre-release (`-Pre alpha|beta|rc`) or releases it (no `-Pre`). Stages only move forward (alpha, beta, rc). The user chose alpha for internal test builds. Only create or push real tags when the user asks.

- `extract.ps1` prints how many effects have no wording, plus any image the data refers to that the mod doesn't ship. A jump in either usually means the mod's Java or CSV layout changed and a regex in the extractor needs updating.
- `update.ps1` compares against `tools/mod-sync.json` (last synced release and commit, plus the lists of effects without wording and absent images, so only new ones are flagged). Its `$rulePattern` lists the mod files whose logic the planner reimplements. Add a class there when you port new mod logic into `app.js` or `extract.ps1`. If app.js's template versions change, update `$PlannerTemplateVersion` and `$PlannerFileVersion` at its top.
- The scripts must stay ASCII. Windows PowerShell 5.1 reads BOM-less files as ANSI, so a character like `…` gets garbled.

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
  - the mod settings' Optional Volumes toggles, as `optionalVolumes` (`{id, name, volumes}`): volumes from `VolumeToggles` (`<X>_VOLUMES = Set.of(...)`), key and name from `SkillTreeSettings` (`<X>_FIELD_ID` → `settings.volumes.<key>.name`)
  - the in-game stat sheet sections: `statGroups` (the `StatGroup` enum order) and a `group` on every effect, from the package of its `*SkillEffect.java` file through `StatGroup.of`'s `case "pkg" -> GROUP` lines (default `MECHANICS`; generated weapon effects are `WEAPONS`). Types keep `temporaryAfterDeploymentSeconds`.
- **Output:** a JS global (`window.PLANNER_DATA = …;`), not JSON. Spot-check it from PowerShell with `$raw.Substring(21).TrimEnd("`n",';') | ConvertFrom-Json`.
