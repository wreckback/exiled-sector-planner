# TOOLS.md

The scripts in `tools/`: how to run them and how the extractor reads the mod. `CLAUDE.md` covers the rest of the repo; check `CLAUDE.local.md` for this machine's paths first.

## Commands

Node 26+ (`.nvmrc`) and git 2.39+, on Windows, Linux or macOS. No npm dependencies. Each tool has `--help`, and `npm run <tool>` runs it too.

```sh
node tools/update.mjs    # mod -> newest release tag, extract, check, diff, record (--tag, --no-checkout, --no-fetch, --commit, --preview, --report <file>)
node tools/extract.mjs   # rebuild the data from the mod as checked out (--web-root to write elsewhere)
node tools/serve.mjs     # http://localhost:8765/  (--port to change, --root to serve another folder)
node tools/release.mjs   # tag vX.Y.Z[-alpha.N|-beta.N|-rc.N]+es<mod release> (--version, --bump, --pre, --rc, --plain, --push, --dry-run)
node tools/package.mjs   # dist/exiled-sector-planner-<tag>.zip (--tag, default: the planner tag on HEAD)
```

- **The mod checkout** is `--mod-root <path>`, else the `ESP_MOD_ROOT` environment variable, else `ExiledSector/` in the planner folder (`modRootFrom` in `tools/lib/common.mjs`). A relative value is taken from the planner folder, wherever the command runs. `extract.mjs` and `update.mjs` need it (they stop with a hint without one); `release.mjs` only uses it to check the data against the mod, and says so when it isn't there.
- **Shared helpers** are in `tools/lib/common.mjs`: output colours, `fail`, paths (`fromRepo`, `modRootFrom`, `existsCaseless`, which matches mod paths without case like the game on Windows), `readText`/`readJson`/`readCsv` (strips a BOM; the CSV reader works like PowerShell's `Import-Csv`), and `git(dir, args, {allowFail, keepIndent})`. `git` allows up to 64 MB of output (Node's default is 1 MB), so long `diff --name-only`, `rev-list` or `log` output doesn't stop `update.mjs` between writing `planner-data.js` and `mod-sync.json`.
- `package.mjs` builds the zip with one `git archive` of `<tag>:web` (the four site files) plus `--add-virtual-file` for `version.js` and README.txt. It holds no art. It runs git with `core.autocrlf=false`, because archiving the `web/` subtree leaves the repo's `.gitattributes` behind, and `--prefix` doesn't apply to virtual files, so their paths name the top folder. `dist/` is in `.gitignore`.
- The planner version in the summary panel's footer comes from `web/version.js` (`window.PLANNER_VERSION`). The committed file says `'dev'`. `package.mjs` writes the tag into the zip's copy, and `serve.mjs` answers `/version.js` with `git describe --tags --match 'v*' --dirty` (kept for 2 seconds), but only when serving the repo's own `web/`; any other `--root` (`preview/`, an unpacked zip) serves its own `version.js`. `extract.mjs` also records where a git mod checkout stands as `modGit` (`release`: the nearest tag, `ahead`: commits since it, `commit`, `branch` unless detached, `dirty`), since `mod_info.json` keeps the last release's version on a branch like `Dev`. `app.js` (`modVersionShort`) shows `D.modVersion` on a release, and past one the nearest release with the branch and commit ("0.11.2-alpha + Dev 93ceafe2"); a mod folder that isn't a git checkout has no `modGit`. `app.js` (`plannerVersionShort`) shows the tag without `+es...`, with `+N` for commits since and "(edited)" for `-dirty`; the full string is the footer's title.
- `release.mjs` takes the mod release from `tools/mod-sync.json` and refuses on a dirty tree or stale data. With neither `--version` nor `--bump`, it continues the newest open pre-release (`--pre alpha|beta|rc`) or releases it (no `--pre`). Stages only move forward (alpha, beta, rc). The user chose alpha for internal test builds. Only create or push real tags when the user asks; test in a scratch clone whose `origin` is a scratch bare repo, since a clone's `origin` is this repo.

- `extract.mjs` prints how many effects have no wording, plus any image the data refers to that the mod doesn't ship. A jump in either usually means the mod's Java or CSV layout changed and a regex in the extractor needs updating.
- `update.mjs` compares against `tools/mod-sync.json` (last synced release and commit, plus the lists of effects without wording and absent images, so only new ones are flagged). Its `rulePattern` lists the mod files whose logic the planner reimplements. Add a class there when you port new mod logic into `app.js` or `extract.mjs`. If app.js's template versions change, update `PlannerTemplateVersion` and `PlannerFileVersion` at its top. It compares type fields with sorted keys (`canon`), so key order never shows up as a change. It compares a type's `integrated` block too, and prints how many types have one. It also flags effects whose `mode`, `stat`, `lowerIsBetter` or `live` changed from the previous data (the fields `app.js` computes with), since a field disappearing usually means the extractor no longer reads the mod's code for that effect.
- `update.mjs --preview` tries the mod checkout as it is (for example unreleased work on `Dev`) without touching the release data. It implies `--no-checkout`, refuses `--tag` and `--commit`, and builds into the git-ignored `preview/`: a fresh copy of `web/` (except `data/` and `version.js`), the extracted data, and a `version.js` saying `preview`. The report compares with the committed `web/data/planner-data.js` and lists rule files changed since the last sync, but `mod-sync.json` isn't written, so `release.mjs` never sees preview data. View it with `node tools/serve.mjs --root preview --port 8766`.
- `update.mjs --report <file>` also saves the report as plain text (colours stripped), relative to the planner folder, with or without `--preview` (`preview/report.txt` keeps it beside the preview and out of git). It wraps `process.stdout`/`stderr.write` and pipes `extract.mjs`'s output through itself, and writes the file on exit, so a run that stops early still leaves its report. `--commit` stages and commits only `web/data/planner-data.js` and `tools/mod-sync.json` (`SyncFiles`), so other edits, staged files and untracked files stay out of the sync commit. If a sync ever writes another file, add it to `SyncFiles`.

## Extractor (tools/extract.mjs)

`extract.mjs` reads mod data without running Java, so much of it parses Java source with regexes:

- **Effect wording:** each `*SkillEffect.java` enum constant gives a mode (`statEffect(PERCENT|FLAT|MULT, …)`), a stat key (a `"stat.x"` literal or a `static final String` constant) and `lowerIsBetter`. Custom `description()` overrides give `.arg(name, expr)` expressions, with numeric constants resolved across all main sources.
- **Description helpers:** `getDescriptionArgs` follows calls in a description body into helper methods (for example `BorrowedGraceListener.describe(this, magnitude, X)` or `RiftStrike.describe(msg)`), replacing the helper's parameters with the call's arguments. It also handles `<Table>.withShipSizeArgs` (`HullSizeTable` constants, giving frigate/destroyer/cruiser/capital) and `AffinityScaling` step constants (`{step}`). `LowBaseArmorBonus` is special-cased: `join(...)` builds "a/b/c/d" lists, and `hullArgs` drives the `effect.NAME.hullSize` wording.
- **Integrated effects:** a skill type's `integrated` block (mod `Dev` after 0.11.2-alpha: the effects an integrated node uses instead of its normal ones, bought with story points like an s-mod) is copied into the type as is, and its effects count as used, so their wording is extracted. `app.js` doesn't read it yet.
- **Description forms and value helpers** (added for mod 0.11.2-alpha+ `Dev`):
  - Both `description(float magnitude)` and `description(float magnitude, DescribeContext context)` are read, since the one-argument form may just hand over to the other (`description` is in `skipCalls`, so that hand-over isn't followed as a helper). `context.magnitudeOf(X)` (what a related, `refines()` effect adds) is 0, as with the game's `DescribeContext.NONE`, so the planner shows base values.
  - `resolveExpression` inlines small numeric helpers, `Owner.method(args)` or a same-class `method(args)` whose body is one `return <expr>;` (for example `AbsorbReserveListener.maxReserve(0)` -> `ParameterBonus.increasedBy(MAX_RESERVE, 0)`), choosing the overload whose parameters fit (numbers, or a `DescribeContext` for a passed-on `context`). A value that ends up constant is folded to its number.
  - A bare constant name is looked up in the current class first, then in any class: names like `RANGE` or `MAX_DAMAGE` exist in many classes. (Before, the first class seen won, which gave Rift Strike the Resonator Payload's `share`/`max`.)
  - Local numbers in a description body (`int riftsPerSeries = ...;`) are resolved and substituted into its `.arg(...)` values, and `.count(n)` fills `{count}`.
  - `backingOf`: an effect built by a factory on a class implementing `EffectBacking` (`DamageTakenWhile.within(condition, describedRange)`, `AffinityScaling.whileAllEqual(...)`) takes its mode, stat, lower-is-better flag and wording from that class when its own body has none. The factory's function arguments (a method reference `Owner::method` or a lambda `x -> expr`) are filled in where the class applies them (`describedRange.applyAsDouble(context)`).
  - `StatMode.describeStat(±magnitude, [subject,] "stat.x")` in a description sets the effect's mode and stat to the call's, `negate` when it passes `-magnitude` (the survey cost reductions are stored as positive amounts and worded as negative), and `subject` from a `"subject.x"` literal or a `static final String` constant (`subject.*` constants are kept with the `stat.*` ones). The `subject.*` strings are extracted.
  - To find regressions, scan in the browser for any `describe(name, 3)` output that still contains "?".
  - Let it run to the end: piping it into `head` can stop it before it writes the data file, so the next check reads stale output.
- **Kept from the PowerShell extractor it replaced,** so the data stays the same: numbers as text use 15 significant digits (`numText`), CSV whole numbers round half to even (`toInt`), name matching ignores case where PowerShell's `-match`/`-in` did (`inCaseless`, `startsCaseless`, the `i` flag), and `asList` turns a missing value into `[null]` like `@(...)`.
- **Weapon effects:** these are generated names (`ScopedWeaponEffect`: `<SCOPE_>WEAPON_<FAMILY>_<MODE>`), so they're matched by pattern.
- **Other tables:**
  - affinity step bonuses (`AffinitySteps`)
  - retired affinity options (`AffinityOptions`)
  - unqualified weapon families (`WeaponStatFamily`)
  - hull mod names: the in-game names in the mod's test resource `exiledsector-core/src/test/resources/i18n/hullmod_names.csv` (vanilla and other mods), then `docs/analysis/balance.csv`, then `data/hullmods/hull_mods.csv`. `app.js` falls back to the name of the skill type that grants a hull mod, then the id. `update.mjs` warns if the test resource moves. The Ship rules dialog lists hull mods by name, adding the id only when two share a name.
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
- **Output:** a JS global (`window.PLANNER_DATA = …;`), not JSON. Spot-check it with `node -e "const t=require('fs').readFileSync('web/data/planner-data.js','utf8'); const d=JSON.parse(t.slice(t.indexOf('=')+1).trim().replace(/;$/,'')); console.log(d.modVersion, d.nodes.length)"`.
