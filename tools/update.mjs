#!/usr/bin/env node
// Brings the planner up to date with a mod release, then reports anything that needs a person to look at.
//
//   node tools/update.mjs                      # newest release tag
//   node tools/update.mjs --tag 0.11.1-alpha
//   node tools/update.mjs --no-checkout        # use the mod checkout as it is
//   node tools/update.mjs --commit             # also commit the result to the planner repo
// The mod checkout is --mod-root, else ESP_MOD_ROOT, else ExiledSector/ in the planner folder.
//
// Steps:
//   1. Fetch the mod's tags and check out the release (detached HEAD). Refuses if the mod checkout has local changes.
//   2. Run extract.mjs.
//   3. Check the new data: unfilled wording placeholders, effects without wording, missing art, unknown node types
//      and tiers, broken links, template format versions and the node cap.
//   4. Compare the tree with the previous data: nodes, skill types, renames and wording.
//   5. List the mod's rule files that changed since the last synced release. Only these mean app.js may need work.
//   6. Record the synced release in tools/mod-sync.json.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, sep } from 'node:path';
import { parseArgs, styleText } from 'node:util';
import { existsCaseless, fail, fromRepo, git, good, heading, modRootFrom, readJson, readText, repoRoot, say, toolsDir, warn } from './lib/common.mjs';

// Template format versions the planner reads and writes (app.js: buildTemplate, mergeTemplate, templateToCode).
const PlannerTemplateVersion = 1;
const PlannerFileVersion = 1;

const { values: opt } = parseArgs({
    options: {
        tag: { type: 'string' },
        'no-checkout': { type: 'boolean' },
        'no-fetch': { type: 'boolean' },
        commit: { type: 'boolean' },
        'mod-root': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (opt.help) {
    say('Usage: node tools/update.mjs [--tag <tag>] [--no-checkout] [--no-fetch] [--commit] [--mod-root <path>]');
    say('Checks out a mod release (default: the newest tag), extracts the data, checks it, compares it with the');
    say('previous data, lists changed mod rule files and records the sync in tools/mod-sync.json.');
    process.exit(0);
}

const ModRoot = modRootFrom(opt['mod-root'], 'update');
const Web = fromRepo('web');
const DataFile = join(Web, 'data', 'planner-data.js');
const StateFile = join(toolsDir, 'mod-sync.json');

const attention = [];
const flag = (msg) => { attention.push(msg); warn(`  ! ${msg}`); };
const ok = (msg) => good(`  ok ${msg}`);
const section = (title) => { say(); heading(`== ${title}`); };

const collator = new Intl.Collator('en');
const sorted = (items) => [...items].sort(collator.compare);
const unique = (items) => [...new Set(items)];
const lines = (text) => (text ? text.split(/\r?\n/) : []);
const firstLine = (text) => lines(text)[0] ?? '';
// A value as a list: null/missing gives [], a single value gives [value].
const list = (v) => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]);
const entries = (obj) => (obj && typeof obj === 'object' ? Object.entries(obj) : []);
// JSON with sorted object keys, so two extractor runs that order keys differently still compare equal.
// A missing field and an empty list count as the same.
const canon = (v) => JSON.stringify(Array.isArray(v) && !v.length ? null : v ?? null, (_, x) =>
    (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

function readPlannerData(path) {
    if (!existsSync(path)) return null;
    const raw = readText(path).trim();
    return JSON.parse(raw.slice(raw.indexOf('=') + 1).replace(/;+$/, ''));
}

// The first <name>.java under a src/main/java folder of the mod (file names compared without case, as on Windows).
let javaFiles = null;
function javaText(name) {
    if (!javaFiles) {
        javaFiles = new Map();
        const walk = (dir) => {
            let items;
            try { items = readdirSync(dir, { withFileTypes: true }); } catch { return; }
            for (const d of items) {
                const p = join(dir, d.name);
                if (d.isDirectory()) { if (d.name !== '.git' && d.name !== 'node_modules') walk(p); }
                else if (d.name.toLowerCase().endsWith('.java') && `${sep}${p}`.includes(`${sep}src${sep}main${sep}java${sep}`)) {
                    const key = d.name.toLowerCase();
                    if (!javaFiles.has(key)) javaFiles.set(key, p);
                }
            }
        };
        walk(ModRoot);
    }
    const f = javaFiles.get(`${name}.java`.toLowerCase());
    return f ? readText(f) : null;
}

function images(d) {
    const set = new Set();
    for (const t of list(d.types)) if (t.icon) set.add(t.icon);
    for (const n of list(d.nodes)) if (n.ringBeltPath) set.add(n.ringBeltPath);
    for (const x of list(d.decorations)) for (const k of ['imagePath', 'ringArtPath', 'overlayPath']) if (x?.[k]) set.add(x[k]);
    return set;
}

function joinShort(items, max = 12) {
    const a = [...items];
    if (a.length <= max) return a.join(', ');
    return `${a.slice(0, max).join(', ')}, ... (+${a.length - max} more)`;
}

const state = existsSync(StateFile) ? readJson(StateFile) : null;

// ---------------------------------------------------------------- 1. mod release
section('Mod release');
const before = git(ModRoot, ['rev-parse', 'HEAD']);
let tag = opt.tag;
if (opt['no-checkout']) {
    say(`  Using the checkout as it is (${firstLine(git(ModRoot, ['describe', '--tags', '--always']))}).`);
} else {
    const dirty = lines(git(ModRoot, ['status', '--porcelain', '--untracked-files=no'], { keepIndent: true }));
    if (dirty.length) {
        console.log(styleText('red', '  The mod checkout has local changes, so it was left alone:'));
        for (const d of dirty) say(`    ${d}`);
        say(`  Commit or stash them in ${ModRoot}, or rerun with --no-checkout.`);
        process.exit(1);
    }
    if (!opt['no-fetch']) {
        say('  Fetching tags...');
        git(ModRoot, ['fetch', '--quiet', '--tags', 'origin']);
    }
    if (!tag) {
        tag = firstLine(git(ModRoot, ['tag', '--sort=-creatordate']));
        if (!tag) fail('update', 'the mod has no tags. Pass --tag or use --no-checkout.');
    }
    git(ModRoot, ['checkout', '--quiet', '--detach', `refs/tags/${tag}`]);
    say(`  Checked out ${tag} (detached HEAD; 'git switch main' in the mod checkout goes back).`);
}
const after = git(ModRoot, ['rev-parse', 'HEAD']);
const release = firstLine(git(ModRoot, ['describe', '--tags', '--always']));
const baseline = state?.commit || before;
const baselineName = state?.release || `previous checkout (${before.slice(0, 8)})`;

// ---------------------------------------------------------------- 2. extract
section('Extract');
const old = readPlannerData(DataFile);
const run = spawnSync(process.execPath, [join(toolsDir, 'extract.mjs'), '--mod-root', ModRoot, '--web-root', Web], { stdio: 'inherit' });
if (run.status !== 0) fail('update', `extract.mjs failed (${run.status ?? run.error?.message})`);
const neu = readPlannerData(DataFile);

// ---------------------------------------------------------------- 3. checks
section('Checks');
const S = neu.strings ?? {};
const appJs = readText(join(Web, 'app.js'));

// Wording placeholders the planner can't fill show as "?" in tooltips (describeRaw / fill in app.js).
const variants = ['', '.one', '.other', '.more', '.less', '.increases', '.reduces', '.hullSize'];
const unfilled = [], noWording = [];
for (const [name, info] of entries(neu.effects)) {
    const known = ['value', ...Object.keys(info.args ?? {})];
    const firstHull = Object.values(info.hullArgs ?? {})[0];
    const hullKnown = Object.keys(firstHull ?? {});
    let hasText = false;
    for (const v of variants) {
        const tpl = S[`effect.${name}${v}`];
        if (tpl === null || tpl === undefined) continue;
        hasText = true;
        const okNames = v === '.hullSize' ? [...known, ...hullKnown] : known;
        const bad = unique([...String(tpl).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((p) => !okNames.includes(p)));
        if (bad.length) unfilled.push(`${name}${v} {${bad.join('}, {')}}`);
    }
    if (!hasText && !info.stat && !info.weaponFamily && !/_AFFINITY_FLAT$/i.test(name)) noWording.push(name);
}
if (unfilled.length) flag(`${unfilled.length} effect texts have placeholders the extractor couldn't fill (shown as '?'): ${joinShort(unfilled, 6)}. Extend getDescriptionArgs in extract.mjs.`);
else ok('every wording placeholder is filled');
const prevNoWording = Array.isArray(state?.noWording) ? state.noWording : null;
const newNoWording = prevNoWording ? noWording.filter((n) => !prevNoWording.includes(n)) : [];
if (newNoWording.length) flag(`newly without wording (shown by name): ${joinShort(newNoWording)}`);
else ok(`effects without wording: ${noWording.length}${prevNoWording ? ', none new' : ''}`);

// Art: anything referenced but not in the mod is vanilla art the mod doesn't ship. Only new ones are worth a look.
const absent = sorted([...images(neu)].filter((p) => !existsCaseless(ModRoot, p.replace(/\\/g, '/'))));
const prevAbsent = Array.isArray(state?.absentImages) ? state.absentImages : null;
const newAbsent = prevAbsent ? absent.filter((p) => !prevAbsent.includes(p)) : [];
if (newAbsent.length) flag(`newly missing images (drawn as placeholders): ${joinShort(newAbsent)}`);
else ok(`images: ${absent.length} not shipped by the mod (vanilla art)${prevAbsent ? ', none new' : ''}`);

// Node types and tiers.
const typeIds = new Map(list(neu.types).map((t) => [t.id, t]));
const tierBlock = /const TIER_SIZE\s*=\s*\{([^}]*)\}/.exec(appJs)?.[1] ?? '';
const plannerTiers = [...tierBlock.matchAll(/([A-Z_]+)\s*:/g)].map((m) => m[1]);
const badType = list(neu.nodes).filter((n) => !typeIds.has(n.type)).map((n) => `${n.id} (${n.type})`);
if (badType.length) flag(`nodes with an unknown skill type: ${joinShort(badType)}`); else ok("every node's skill type exists");
const badTier = list(neu.types).filter((t) => !plannerTiers.includes(t.tier)).map((t) => `${t.id} (${t.tier})`);
if (badTier.length) flag(`skill types with a tier app.js doesn't know (TIER_SIZE, TIER_LABEL): ${joinShort(badTier)}`); else ok('every tier is known to app.js');
const skillTier = javaText('SkillTier');
if (skillTier) {
    const enumBody = /enum\s+SkillTier\s*\{(.*?);/s.exec(skillTier)?.[1] ?? '';
    const modTiers = [...enumBody.matchAll(/^\s*([A-Z][A-Z0-9_]*)\b/gm)].map((m) => m[1]);
    const extra = modTiers.filter((t) => !plannerTiers.includes(t));
    if (extra.length) flag(`SkillTier has tiers app.js doesn't size: ${extra.join(', ')}`);
}

// Links: targets must exist; wormhole pairs must point at each other.
const nodeIds = new Map(list(neu.nodes).map((n) => [n.id, n]));
const dangling = [], badPair = [], oneWay = [];
for (const n of nodeIds.values()) {
    for (const c of list(n.c)) {
        if (!c) continue;
        if (!nodeIds.has(c)) dangling.push(`${n.id}->${c}`);
        else if (!list(nodeIds.get(c).c).includes(n.id)) oneWay.push(`${n.id}->${c}`);
    }
    if (n.pairedWith) {
        const p = nodeIds.get(n.pairedWith);
        if (!p || p.pairedWith !== n.id) badPair.push(`${n.id}->${n.pairedWith}`);
    }
}
for (const h of list(neu.hiddenConnectors)) {
    for (const k of ['a', 'b']) if (h?.[k] && !nodeIds.has(h[k])) dangling.push(`hidden ${h[k]}`);
}
if (dangling.length) flag(`links to nodes that don't exist: ${joinShort(dangling)}`); else ok('every link points at a real node');
// The mod lists every link from both ends; app.js makes links symmetric anyway, so a one-way link hints at a format change.
if (oneWay.length) flag(`links listed from one end only: ${joinShort(oneWay)}`); else ok('every link is listed from both ends');
if (badPair.length) flag(`wormhole pairs that don't point back: ${joinShort(badPair)}`); else ok('wormhole pairs are mutual');
const badExit = list(neu.wormholeAnchors).filter((a) => !nodeIds.has(a.exit)).map((a) => `${a.id}->${a.exit}`);
if (badExit.length) flag(`wormhole anchors whose exit node doesn't exist: ${joinShort(badExit)}`);

// Effects that refuse some ships: app.js words each one in EFFECT_BLOCKS (node rules). A new one needs a line there.
const blockBlock = /const EFFECT_BLOCKS\s*=\s*\{(.*?)\n  \};/s.exec(appJs)?.[1] ?? '';
const knownBlocks = [...blockBlock.matchAll(/^\s{4}([A-Z][A-Z0-9_]+)\s*:/gm)].map((m) => m[1]);
const newBlocks = entries(neu.effects).filter(([name, e]) => e.blocks && !knownBlocks.includes(name)).map(([name]) => name);
if (!knownBlocks.length) flag("couldn't read EFFECT_BLOCKS from app.js");
else if (newBlocks.length) flag(`effects that refuse some ships but app.js doesn't check (add them to EFFECT_BLOCKS): ${newBlocks.join(', ')}`);
else ok(`every effect that refuses some ships is checked (${knownBlocks.length} known)`);

// In-game hull mod names come from a mod test resource; without it, other mods' hull mods show by id.
if (!existsCaseless(ModRoot, 'exiledsector-core/src/test/resources/i18n/hullmod_names.csv')) {
    flag('hullmod_names.csv is gone from exiledsector-core/src/test/resources/i18n; find where it moved and update extract.mjs');
} else ok('in-game hull mod names found');

// Template format and node cap, which app.js hard-codes.
const codec = javaText('TemplateCodec'), store = javaText('SkillTreeTemplateStore'), levels = javaText('ShipLevelConfig');
const tv = codec ? /\bVERSION\s*=\s*(\d+)/.exec(codec) : null;
const fv = store ? /\bFILE_VERSION\s*=\s*(\d+)/.exec(store) : null;
if (!tv || !fv) flag("couldn't find TemplateCodec.VERSION or SkillTreeTemplateStore.FILE_VERSION; the classes may have moved");
else if (Number(tv[1]) !== PlannerTemplateVersion || Number(fv[1]) !== PlannerFileVersion) {
    flag(`template format changed: template v${tv[1]}, file v${fv[1]}; the planner writes v${PlannerTemplateVersion} / v${PlannerFileVersion}. Update app.js and the versions at the top of update.mjs.`);
} else ok(`template format v${PlannerTemplateVersion}, file v${PlannerFileVersion}`);
const capMod = levels ? /DEFAULT_MAX_ALLOCATED_NODES\s*=\s*(\d+)/.exec(levels) : null;
const capApp = /\bcap:\s*(\d+)/.exec(appJs)?.[1] ?? '';
if (!capMod) flag("couldn't find ShipLevelConfig.DEFAULT_MAX_ALLOCATED_NODES");
else if (capMod[1] !== capApp) flag(`default node cap is now ${capMod[1]}; app.js starts at ${capApp} (state.cap)`);
else ok(`default node cap ${capApp}`);

// ---------------------------------------------------------------- 4. tree changes
section('Tree changes');
const summary = [];
if (!old) say('  No previous data to compare with.');
else {
    const oldNodes = new Map(list(old.nodes).map((n) => [n.id, n]));
    const oldTypes = new Map(list(old.types).map((t) => [t.id, t]));
    const addedN = sorted([...nodeIds.keys()].filter((id) => !oldNodes.has(id)));
    const removedN = sorted([...oldNodes.keys()].filter((id) => !nodeIds.has(id)));
    const retyped = [];
    let moved = 0, relinked = 0;
    for (const [id, n] of nodeIds) {
        const o = oldNodes.get(id);
        if (!o) continue;
        if (o.type !== n.type) retyped.push(`${id} (${o.type} -> ${n.type})`);
        if (o.x !== n.x || o.y !== n.y) moved++;
        if (sorted(list(o.c)).join(',') !== sorted(list(n.c)).join(',')) relinked++;
    }
    const addedT = sorted([...typeIds.keys()].filter((id) => !oldTypes.has(id)));
    const removedT = sorted([...oldTypes.keys()].filter((id) => !typeIds.has(id)));
    const changedT = [];
    for (const id of sorted(typeIds.keys())) {
        const o = oldTypes.get(id);
        if (!o) continue;
        const n = typeIds.get(id);
        const what = [];
        if (o.name !== n.name) what.push(`renamed '${o.name}' -> '${n.name}'`);
        if (o.tier !== n.tier) what.push(`tier ${o.tier} -> ${n.tier}`);
        for (const k of ['effects', 'hullSizeEffects', 'options', 'effectText', 'phantomHullMods', 'requiredHullSizes']) {
            if (canon(o[k]) !== canon(n[k])) what.push(k);
        }
        if (what.length) changedT.push(`${id} (${what.join(', ')})`);
    }
    const oldRenames = old.nodeRenames ?? {};
    const renamesNew = entries(neu.nodeRenames).filter(([k]) => oldRenames[k] === null || oldRenames[k] === undefined).map(([k, v]) => `${k} -> ${v}`);
    const oldStrings = old.strings ?? {};
    const wording = entries(neu.strings).filter(([k, v]) => oldStrings[k] !== v).length;

    if (old.modVersion !== neu.modVersion) say(`  Mod version: ${old.modVersion} -> ${neu.modVersion}`);
    if (addedN.length) { say(`  Nodes added (${addedN.length}): ${joinShort(addedN)}`); summary.push(`${addedN.length} nodes added`); }
    if (removedN.length) { say(`  Nodes removed (${removedN.length}): ${joinShort(removedN)}`); summary.push(`${removedN.length} removed`); }
    if (renamesNew.length) { say(`  New node renames (${renamesNew.length}): ${joinShort(renamesNew)}`); summary.push(`${renamesNew.length} renamed`); }
    if (retyped.length) { say(`  Nodes with a new skill type (${retyped.length}): ${joinShort(retyped, 8)}`); summary.push(`${retyped.length} retyped`); }
    if (moved) { say(`  Nodes moved: ${moved}`); summary.push(`${moved} moved`); }
    if (relinked) say(`  Nodes with changed links: ${relinked}`);
    if (addedT.length) { say(`  Skill types added (${addedT.length}): ${joinShort(addedT)}`); summary.push(`${addedT.length} skill types added`); }
    if (removedT.length) say(`  Skill types removed (${removedT.length}): ${joinShort(removedT)}`);
    if (changedT.length) {
        say(`  Skill types changed (${changedT.length}):`);
        for (const c of changedT.slice(0, 25)) say(`    ${c}`);
        if (changedT.length > 25) say(`    ... (+${changedT.length - 25} more)`);
        summary.push(`${changedT.length} skill types changed`);
    }
    if (wording) say(`  Wording strings changed or added: ${wording}`);
    if (!summary.length && !wording) say('  No changes to the tree.');
    if (removedN.length && !renamesNew.length) {
        flag('nodes were removed without a rename entry; saved builds and templates that use them will drop those nodes');
    }
}

// ---------------------------------------------------------------- 5. rule files
section(`Mod code changed since ${baselineName}`);
// Files whose logic app.js or extract.mjs reimplements. A change here is the only reason to open planner code.
const rulePattern = new RegExp('/src/main/java/.*/(AllocationCheck|TemplateCapture|TemplateCodec|TemplateNames|TemplateFilter|SkillTreeTemplateStore|' +
    'AffinitySteps|AffinityOptions|AffinityScaling|SkillTier|NodeReplacements|ShipLevelConfig|SkillTreeNodeConnectorRenderer|' +
    'WormholeAnchorLinks|WormholeAnchorDefinitions|ScopedWeaponEffect|WeaponStatFamily|HullSizeTable|StatMode|' +
    'NodeEligibility|VolumeToggles|TreeVolumeFilter|SkillTreeSettings|AllocatedNode|SkillType|HullModConflicts|LogisticsNodes|NodeRequirements|LowBaseArmorBonus|' +
    'SkillTypeUnlockStatus|NodeGates|ShieldSkillEffect|SkillTags|StatGroup|ShipStatSheets|SkillTreeBonusSummary|' +
    'Subroutine|SubroutineKind|SubroutineDefinitions|SubroutineRadius|SubroutineSocketLimits|NodeRadii|NodeRadiusCache|ExoshipNodes|' +
    'RootConduits|EmptyShells|GatedSubroutines|SkillTreeEffectSource|ModspecCaches|NodeAllocator|DoctrineOverrides|DoctrineArchive|StatTarget)\\.java$', 'i');
const wordingPattern = /\/src\/main\/java\/.*SkillEffect\.java$/i;
const inputPattern = new RegExp('^(data/skilltrees/|data/strings/exiledSector/(core|skillTree)/|' +
    'data/config/exiledSector/(wormhole_anchors|node_replacements|node_id_renames|type_id_renames|hullmod_conflicts)\\.csv|' +
    'data/config/exiledSector/node_gates\\.json|data/config/exiledSector/(subroutines|doctrine_archives|item_modifiers)\\.csv|' +
    'data/config/exiledSector/node_radii\\.json|data/hullmods/hull_mods\\.csv|' +
    'exiledsector-core/src/test/resources/i18n/hullmod_names\\.csv|docs/analysis/balance\\.csv|mod_info\\.json)', 'i');
if (baseline === after) say('  None: the mod is at the same commit as last time.');
else if (git(ModRoot, ['cat-file', '-e', `${baseline}^{commit}`], { allowFail: true }) === null) {
    flag(`the last synced commit ${baseline} isn't in the mod checkout; can't list changed files`);
} else {
    const files = lines(git(ModRoot, ['diff', '--name-only', baseline, after]));
    const commits = lines(git(ModRoot, ['rev-list', `${baseline}..${after}`])).length;
    const changedRules = files.filter((f) => rulePattern.test(f));
    const changedWording = files.filter((f) => wordingPattern.test(f));
    const changedInputs = files.filter((f) => inputPattern.test(f));
    say(`  ${commits} commits, ${files.length} files. Tree and wording data files: ${changedInputs.length} (handled by the extractor).`);
    if (changedWording.length) say(`  Effect enums: ${changedWording.length} (only matters if a wording check above flagged something)`);
    if (changedRules.length) {
        flag(`rule files changed, compare with app.js / extract.mjs: ${changedRules.map((f) => basename(f, extname(f))).join(', ')}`);
        for (const f of changedRules) say(`      ${f}`);
        say(`    See a change with: git -C "${ModRoot}" diff ${baseline.slice(0, 8)} ${after.slice(0, 8)} -- <file>`);
    } else ok('no rule files changed');
}

// ---------------------------------------------------------------- 6. record
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const record = {
    release,
    commit: after,
    modVersion: neu.modVersion,
    synced: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    noWording: sorted(noWording),
    absentImages: absent,
};
writeFileSync(StateFile, `${JSON.stringify(record, null, 4)}\n`, 'utf8');

section('Result');
const changes = summary.length ? summary.join(', ') : 'no tree changes';
if (attention.length) {
    warn(`  ${release} (${neu.modVersion}): ${changes}. ${attention.length} item(s) need a look:`);
    for (const a of attention) warn(`    - ${a}`);
} else {
    good(`  ${release} (${neu.modVersion}): ${changes}. All checks passed, no rule files changed.`);
}
say('  Reload the planner to see the new data.');

if (existsSync(join(repoRoot, '.git'))) {
    const pending = lines(git(repoRoot, ['status', '--porcelain']));
    if (!pending.length) say('  Planner repo: nothing to commit.');
    else if (opt.commit) {
        git(repoRoot, ['add', '-A']);
        git(repoRoot, ['commit', '--quiet', '-m', `Sync with Exiled Sector ${release}`]);
        say(`  Committed: Sync with Exiled Sector ${release}`);
    } else {
        say(`  Planner repo: ${pending.length} changed paths. Review with 'git status', or rerun with --commit.`);
    }
}
