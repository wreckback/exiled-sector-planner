#!/usr/bin/env node
// Tags a planner release or pre-release. The tag is the planner's own version, with the mod release the data was
// synced from (tools/mod-sync.json) as build metadata: v0.4.0-alpha.1+es0.11.1-alpha, v0.4.0+es0.11.1-alpha.
//
//   node tools/release.mjs --version 0.4.0 --pre alpha   # v0.4.0-alpha.1+es...
//   node tools/release.mjs --pre alpha                   # next: v0.4.0-alpha.2+es...
//   node tools/release.mjs --pre rc                      # move on: v0.4.0-rc.1+es...
//   node tools/release.mjs                               # release it: v0.4.0+es...
//   node tools/release.mjs --bump minor --pre alpha      # from the last release: v0.5.0-alpha.1+es...
//   --rc is short for --pre rc. Add --plain to leave out the +es part, --push to push the tag, --dry-run to only show it.
//
// Pre-release stages, in order (semantic versioning sorts them this way): alpha (internal testing, features still
// changing), beta (feature-complete, wider testing), rc (release candidate, fixes only). Without --version or --bump,
// --pre continues the newest open pre-release's version, and no --pre releases it.
//
// Which number to raise: patch for a mod sync or fixes, minor for new features, major when old share links or saved
// builds stop loading.
//
// Refuses when the working tree has changes, the version isn't newer than the last release, the tag exists, the
// data doesn't match the mod checkout, or the text files don't fit the code (tools/text-check.mjs errors; its
// warnings are shown). Tags that don't look like vX.Y.Z (such as the old 0.11.1-alpha) are ignored.
// The mod checkout is --mod-root, else ESP_MOD_ROOT, else ExiledSector/ in the planner folder; without one there,
// the data isn't checked against it.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { cmpVersion, fail, fromRepo, git, good, plannerTags, readJson, readText, repoRoot, say, stageRank, toolsDir, warn } from './lib/common.mjs';
import { checkText } from './lib/text-check.mjs';

const { values: opt } = parseArgs({
    options: {
        version: { type: 'string' },
        bump: { type: 'string' },
        pre: { type: 'string' },
        rc: { type: 'boolean' },
        plain: { type: 'boolean' },
        push: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        'mod-root': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (opt.help) {
    say('Usage: node tools/release.mjs [--version X.Y.Z | --bump major|minor|patch] [--pre alpha|beta|rc | --rc]');
    say('                              [--plain] [--push] [--dry-run] [--mod-root <path>]');
    say('Tags HEAD as vX.Y.Z[-alpha.N|-beta.N|-rc.N]+es<mod release>. Without --version or --bump, --pre continues the');
    say('newest open pre-release and no --pre releases it.');
    process.exit(0);
}
const choice = (value, allowed, flag) => {
    if (value === undefined) return '';
    const v = value.toLowerCase();
    if (!allowed.includes(v)) fail('release', `--${flag} must be one of ${allowed.join(', ')} (got '${value}').`);
    return v;
};
const bump = choice(opt.bump, ['major', 'minor', 'patch'], 'bump');
let pre = choice(opt.pre, ['alpha', 'beta', 'rc'], 'pre');

const lines = (text) => (text ? text.split(/\r?\n/) : []);

// 1. A clean tree, so the tag holds exactly what was tested.
const dirty = lines(git(repoRoot, ['status', '--porcelain'], { keepIndent: true }));
if (dirty.length && dirty[0]) fail('release', `commit or stash these first:\n  ${dirty.join('\n  ')}`);
const branch = git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') warn(`  note: on branch ${branch}, not main`);

// 2. The data matches the synced mod release.
const syncFile = join(toolsDir, 'mod-sync.json');
if (!existsSync(syncFile)) fail('release', 'tools/mod-sync.json is missing. Run tools/update.mjs first.');
const sync = readJson(syncFile);
if (!sync.release) fail('release', 'tools/mod-sync.json has no release. Run tools/update.mjs first.');
const modRoot = fromRepo(opt['mod-root'] ?? (process.env.ESP_MOD_ROOT || 'ExiledSector'));
if (existsSync(join(modRoot, '.git'))) {
    const modHead = git(modRoot, ['rev-parse', 'HEAD']);
    if (sync.commit && modHead !== sync.commit) {
        fail('release', `the mod checkout is at ${modHead.slice(0, 8)}, but the data was synced from ${sync.release} (${sync.commit.slice(0, 8)}). Run tools/update.mjs, or check out that release.`);
    }
} else {
    warn(`  note: no mod checkout at ${modRoot}, so the data isn't checked against it (--mod-root or ESP_MOD_ROOT)`);
}
const dataVersion = /"modVersion":"([^"]*)"/.exec(readText(join(repoRoot, 'web', 'data', 'planner-data.js')))?.[1] ?? '';
if (sync.modVersion && dataVersion !== sync.modVersion) {
    fail('release', `planner-data.js is for mod ${dataVersion}, but mod-sync.json says ${sync.modVersion}. Run tools/update.mjs.`);
}

// 2b. The text files fit the code (the same check as tools/text-check.mjs): errors refuse, warnings are shown.
const textCheck = checkText();
for (const w of textCheck.warnings) warn(`  text: ${w}`);
if (textCheck.errors.length) {
    fail('release', `the text files don't fit the code (node tools/text-check.mjs):\n  ${textCheck.errors.join('\n  ')}`);
}

// 3. Existing planner tags.
if (opt.rc) {
    if (pre && pre !== 'rc') fail('release', `--rc and --pre ${pre} don't go together.`);
    pre = 'rc';
}
const cmp = cmpVersion;
const { tags, latest, lastRelease } = plannerTags(repoRoot);

// 4. The version to tag.
let base;
if (opt.version !== undefined) {
    if (!/^\d+\.\d+\.\d+$/.test(opt.version)) fail('release', `--version must look like 1.2.3 (got '${opt.version}').`);
    base = opt.version.split('.').map(Number);
} else if (bump) {
    const from = lastRelease ? lastRelease.key : [0, 0, 0];
    base = bump === 'major' ? [from[0] + 1, 0, 0] : bump === 'minor' ? [from[0], from[1] + 1, 0] : [from[0], from[1], from[2] + 1];
} else if (latest && latest.stage) {
    base = latest.key; // continue the open pre-release, or release it
} else {
    fail('release', 'Say which version: --version X.Y.Z, or --bump major|minor|patch.');
}
const baseText = base.join('.');
if (lastRelease && cmp(base, lastRelease.key) <= 0) fail('release', `v${baseText} isn't newer than the last release, ${lastRelease.name}.`);

let name = `v${baseText}`;
if (pre) {
    // Stages only move forward: an alpha after this version's rc would sort before it.
    const later = tags.filter((t) => cmp(t.key, base) === 0 && t.stage && t.rank > stageRank[pre]);
    if (later.length) fail('release', `v${baseText} already has ${later[0].name}, and ${pre} comes before ${later[0].stage}, so it would sort before it. Use --pre ${later[0].stage} or a later stage.`);
    const nums = tags.filter((t) => cmp(t.key, base) === 0 && t.stage === pre).map((t) => t.num);
    name += `-${pre}.${nums.length ? Math.max(...nums) + 1 : 1}`;
}
if (!opt.plain) name += `+es${sync.release}`;
if (git(repoRoot, ['check-ref-format', `refs/tags/${name}`], { allowFail: true }) === null) fail('release', `'${name}' isn't a valid tag name.`);
if (tags.some((t) => t.name === name)) fail('release', `${name} already exists.`);

// 5. The message: what it's for, and the commits since the previous planner tag.
const head = git(repoRoot, ['rev-parse', '--short', 'HEAD']);
const modShort = sync.commit ? sync.commit.slice(0, 8) : 'unknown';
const message = [`Exiled Sector Planner ${name}`, '', `For Exiled Sector ${sync.release} (mod version ${sync.modVersion}, commit ${modShort}).`];
// Since the previous planner tag, or with none yet, since the most recent tag of any kind.
const since = latest ? latest.name : git(repoRoot, ['describe', '--tags', '--abbrev=0', 'HEAD'], { allowFail: true }) || null;
const log = lines(git(repoRoot, ['log', '--format=- %s', since ? `${since}..HEAD` : 'HEAD']));
if (log.length && log[0]) message.push('', since ? `Changes since ${since}:` : 'Changes:', ...log);
const messageText = `${message.join('\n')}\n`;

say(`Tag:    ${name}`);
say(`Commit: ${head} (${branch})`);
say();
say(messageText);
if (opt['dry-run']) { warn('(dry run: nothing tagged)'); process.exit(0); }

const tmp = mkdtempSync(join(tmpdir(), 'esp-release-'));
try {
    const msgFile = join(tmp, 'message.txt');
    writeFileSync(msgFile, messageText, 'utf8');
    git(repoRoot, ['tag', '-a', name, '-F', msgFile]);
} finally {
    rmSync(tmp, { recursive: true, force: true });
}
good(`Tagged ${name}.`);
if (opt.push) {
    git(repoRoot, ['push', 'origin', `refs/tags/${name}`]);
    good(`Pushed ${name} to origin.`);
} else {
    say(`Push it with: git push origin "refs/tags/${name}"`);
}
