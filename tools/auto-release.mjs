#!/usr/bin/env node
// Follows a mod release on its own when the update is simple: syncs the data, tags the next planner pre-release and
// builds its zip. The GitHub workflow .github/workflows/mod-sync.yml runs it every hour and does the pushing and
// publishing; this tool never pushes, so it can be run and tested locally.
//
//   node tools/auto-release.mjs              # check, and sync, tag and package when there's a simple update
//   node tools/auto-release.mjs --dry-run    # the same, then undo the commit and the tag (the zip stays in dist/)
//
// Outcomes (written to <out>/outcome.json, and to $GITHUB_OUTPUT inside GitHub Actions):
//   up-to-date     the mod's newest release is the one tools/mod-sync.json records
//   released       synced, tagged and packaged (with --dry-run: would have been, and was undone)
//   needs-you      a new mod release, but not one to release unattended; nothing is left committed, and
//                  <out>/issue.md explains why (for a GitHub issue)
// A new release needs a person when update.mjs flags anything (failed checks, new effects without wording, changed
// rule files, ...; its --verdict), when the tree's shape changed (nodes added, removed, retyped, moved or relinked,
// skill types added or removed: the verdict's structural list), or when main has commits that aren't in a planner
// release yet, which an automatic release would ship unfinished. So only number and wording changes go out unattended.
//
// The tag continues the newest planner pre-release (v0.4.0-alpha.1 -> v0.4.0-alpha.2+es<mod release>); after a final
// release it starts the next patch's alpha (v0.4.0 -> v0.4.1-alpha.1). The mod checkout is --mod-root, else
// ESP_MOD_ROOT, else ExiledSector/ in the planner folder; update.mjs moves it to the new release, as always.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, fromRepo, git, good, heading, modRootFrom, newestModTag, plannerTags, readJson, repoRoot, say, toolsDir, warn } from './lib/common.mjs';

const TOOL = 'auto-release';
const { values: opt } = parseArgs({
    options: {
        'dry-run': { type: 'boolean' },
        'no-fetch': { type: 'boolean' },
        out: { type: 'string', default: 'dist/auto-release' },
        'mod-root': { type: 'string' },
        // Testing only: treat the update as flagged with this message, to try the needs-you path.
        'test-attention': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (opt.help) {
    say('Usage: node tools/auto-release.mjs [--dry-run] [--no-fetch] [--out <dir>] [--mod-root <path>]');
    say('Syncs, tags and packages a new mod release when the update is simple; otherwise explains why not.');
    say('Never pushes. --dry-run undoes the commit and the tag at the end. Results go to <out> (default dist/auto-release).');
    process.exit(0);
}

const OutDir = fromRepo(opt.out);
rmSync(OutDir, { recursive: true, force: true });
mkdirSync(OutDir, { recursive: true });
const ModRoot = modRootFrom(opt['mod-root'], TOOL);
// Paths as the workflow sees them: relative to the planner folder, with / separators.
const rel = (p) => relative(repoRoot, p).split(sep).join('/');
const step = (title) => { say(); heading(`== ${title}`); };

function runTool(name, args) {
    const run = spawnSync(process.execPath, [join(toolsDir, name), ...args], { stdio: 'inherit' });
    if (run.status !== 0) fail(TOOL, `${name} failed (${run.status ?? run.signal ?? run.error?.message})`);
}

function finish(outcome, fields = {}) {
    const result = { outcome, ...fields };
    writeFileSync(join(OutDir, 'outcome.json'), `${JSON.stringify(result, null, 4)}\n`, 'utf8');
    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result).map(([k, v]) => `${k}=${String(v).replace(/[\r\n]+/g, ' ')}\n`).join(''), 'utf8');
    }
    step('Outcome');
    for (const [k, v] of Object.entries(result)) say(`  ${k}: ${v}`);
    process.exit(0);
}

// ---------------------------------------------------------------- 1. a clean main
step('Planner');
const dirty = git(repoRoot, ['status', '--porcelain']);
if (dirty) fail(TOOL, `the planner repo has uncommitted changes:\n  ${dirty.split(/\r?\n/).join('\n  ')}`);
const branch = git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') fail(TOOL, `on branch ${branch}; automatic releases are made from main only`);
const before = git(repoRoot, ['rev-parse', 'HEAD']);
const { latest } = plannerTags(repoRoot);
say(`  main at ${before.slice(0, 8)}, newest planner tag ${latest?.name ?? '(none)'}`);

// ---------------------------------------------------------------- 2. a new mod release?
step('Mod');
if (!opt['no-fetch']) git(ModRoot, ['fetch', '--quiet', '--tags', 'origin']);
const newest = newestModTag(ModRoot);
if (!newest) fail(TOOL, `the mod checkout at ${ModRoot} has no tags`);
const sync = readJson(join(toolsDir, 'mod-sync.json'));
say(`  newest mod release ${newest}, last synced ${sync.release}`);
if (newest === sync.release) finish('up-to-date', { release: newest });

// ---------------------------------------------------------------- 3. sync
// Run in full even when main already rules out a release, so the issue has the update report.
const reasons = [];
const unreleased = [];
if (!latest) reasons.push('The planner has no release tag yet, so there is no version to continue.');
else if (git(repoRoot, ['rev-list', '-n', '1', latest.name]) !== before) {
    unreleased.push(...git(repoRoot, ['log', '--format=- %h %s', `${latest.name}..HEAD`]).split(/\r?\n/).filter(Boolean));
    reasons.push(`main has ${unreleased.length || 'some'} commit(s) that aren't in a planner release yet (since ${latest.name}); an automatic release would ship them.`);
}
step(`Sync with ${newest}`);
const reportFile = join(OutDir, 'update-report.txt');
const verdictFile = join(OutDir, 'verdict.json');
runTool('update.mjs', ['--mod-root', ModRoot, '--tag', newest, '--no-fetch', '--commit', '--report', reportFile, '--verdict', verdictFile]);
if (!existsSync(verdictFile)) fail(TOOL, 'update.mjs left no verdict');
const verdict = readJson(verdictFile);
if (opt['test-attention']) verdict.attention.push(opt['test-attention']);
if (verdict.attention.length) reasons.push(`update.mjs flagged ${verdict.attention.length} item(s) that need a look.`);
// Only number and wording changes go out unattended: a new tree shape gets a look first (saved builds and templates
// may read differently, and new nodes may bring mechanics the planner doesn't model).
if (verdict.structural.length) reasons.push(`The tree's shape changed: ${verdict.structural.join(', ')}.`);
const report = readFileSync(reportFile, 'utf8');
// One section of the update report ("== Tree changes" up to the next "== ").
const reportSection = (title) => {
    const start = report.indexOf(`== ${title}`);
    if (start < 0) return '';
    const end = report.indexOf('\n== ', start + 3);
    return report.slice(start, end < 0 ? undefined : end).trim();
};
const modLine = `**${verdict.release}** (mod version ${verdict.modVersion}; last synced ${verdict.previous?.release ?? 'unknown'})`;

// ---------------------------------------------------------------- 4a. not one for a machine
if (reasons.length) {
    git(repoRoot, ['reset', '--quiet', '--hard', before]);
    const title = `Mod release ${newest} needs a manual sync`;
    const body = [
        `The mod released ${modLine}, and the planner didn't release it on its own:`, '',
        ...reasons.map((r) => `- ${r}`),
    ];
    if (verdict.attention.length) body.push('', '### Items update.mjs flagged', '', ...verdict.attention.map((a) => `- ${a}`));
    if (unreleased.length) body.push('', '### Commits on main not in a release', '', ...unreleased);
    body.push('', '### What to do', '',
        'Sync by hand: `node tools/update.mjs`, deal with the items above, commit, and release with `node tools/release.mjs`.',
        `The hourly check keeps reporting this release until \`tools/mod-sync.json\` records it, and then stops; close this issue then.`,
        '', '<details><summary>Full update report</summary>', '', '```text', report.length > 50000 ? `${report.slice(0, 50000)}\n... (cut)` : report, '```', '', '</details>', '');
    const issueFile = join(OutDir, 'issue.md');
    writeFileSync(issueFile, body.join('\n'), 'utf8');
    warn(`  Not releasing: ${reasons.join(' ')}`);
    finish('needs-you', { release: newest, title, body: rel(issueFile) });
}

// ---------------------------------------------------------------- 4b. tag and package
step('Release');
const releaseArgs = latest.stage ? ['--pre', latest.stage] : ['--bump', 'patch', '--pre', 'alpha'];
runTool('release.mjs', [...releaseArgs, '--mod-root', ModRoot]);
const tag = plannerTags(repoRoot).latest?.name;
if (!tag || tag === latest.name || !git(repoRoot, ['tag', '--points-at', 'HEAD']).split(/\r?\n/).includes(tag)) {
    fail(TOOL, `release.mjs didn't leave a new tag on HEAD (newest is ${tag})`);
}
step('Package');
runTool('package.mjs', ['--tag', tag]);
const zip = fromRepo(join('dist', `exiled-sector-planner-${tag}.zip`));
if (!existsSync(zip)) fail(TOOL, `package.mjs left no ${rel(zip)}`);

// Release notes: the mod's changes, then the tag message (which lists the planner commits).
const tagMessage = git(repoRoot, ['tag', '-l', '--format=%(contents)', tag]);
const notes = [
    `Automatic release for Exiled Sector ${modLine}.`, '',
    `Changes in the mod data: ${verdict.summary.length ? verdict.summary.join(', ') : 'no tree changes'}.`,
];
const tree = reportSection('Tree changes');
if (tree) notes.push('', '```text', tree, '```');
notes.push('', '---', '', tagMessage, '');
const notesFile = join(OutDir, 'notes.md');
writeFileSync(notesFile, notes.join('\n'), 'utf8');

if (opt['dry-run']) {
    git(repoRoot, ['tag', '-d', tag]);
    git(repoRoot, ['reset', '--quiet', '--hard', before]);
    good(`  Dry run: ${tag} was built and then undone (main is back at ${before.slice(0, 8)}, the tag is deleted).`);
    finish('would-release', { release: newest, tag, zip: rel(zip), notes: rel(notesFile) });
}
good(`  Tagged ${tag} and built ${rel(zip)}. Push main and the tag, then publish the release.`);
finish('released', { release: newest, tag, zip: rel(zip), notes: rel(notesFile) });
