#!/usr/bin/env node
// Builds the ready-to-use zip for a planner tag: the site and its data, with a README.txt, in one folder that runs from
// a double-clicked index.html.
//
//   node tools/package.mjs                                  # the planner tag on HEAD, if any
//   node tools/package.mjs --tag v0.2.0+es0.11.1-alpha
//
// Writes dist/exiled-sector-planner-<tag>.zip (dist/ is git-ignored). The site and its data come from the tag itself
// (git archive), so any tag can be packaged whatever is checked out. git writes the zip, so this needs git 2.39 or
// newer (--add-virtual-file) and no zip library.
//
// The zip also holds the planner's LICENSE (GPL-3.0, the same as the mod), as the GPL asks for a copy of it with each copy.
//
// The zip holds none of the mod's art: it belongs to Exiled Sector and the authors its CREDITS.md names. The page reads
// it from the mod folder each user chooses (the Mod art dialog), and draws placeholders without one.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, git, good, repoRoot, say } from './lib/common.mjs';

const { values: opt } = parseArgs({
    options: {
        tag: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (opt.help) {
    say('Usage: node tools/package.mjs [--tag <tag>]');
    say('Builds dist/exiled-sector-planner-<tag>.zip from a planner tag (default: the planner tag on HEAD).');
    process.exit(0);
}

const pattern = /^v(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?(?:\+es(.+))?$/;
let tag = opt.tag;
if (!tag) {
    tag = git(repoRoot, ['tag', '--points-at', 'HEAD']).split(/\r?\n/).filter((t) => pattern.test(t)).at(-1);
    if (!tag) fail('package', 'HEAD has no planner tag. Pass --tag, or tag HEAD with tools/release.mjs.');
}
const m = pattern.exec(tag);
if (!m) fail('package', `'${tag}' doesn't look like a planner tag (vX.Y.Z[-alpha.N|-beta.N|-rc.N][+es<mod release>]).`);
if (git(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { allowFail: true }) === null) {
    fail('package', `there is no tag '${tag}'.`);
}

// The tag's mod release: from the tag name, else from the tag's own mod-sync.json.
let modRelease = m[6];
if (!modRelease) {
    const sync = git(repoRoot, ['show', `refs/tags/${tag}:tools/mod-sync.json`], { allowFail: true });
    modRelease = sync ? JSON.parse(sync.replace(/^﻿/, '')).release : null;
    if (!modRelease) fail('package', `'${tag}' names no mod release (+es...) and has no tools/mod-sync.json to take it from.`);
}
const preStage = m[4];

// The planner's version for the footer: the tag itself (the repository's web/version.js says "dev").
const versionJs = [
    '// The planner version this zip was built from (tools/package.mjs).',
    `window.PLANNER_VERSION = '${tag}';`,
].join('\n') + '\n';

const title = `Exiled Sector Skill Tree Planner ${tag}`;
const stageText = {
    alpha: 'an alpha build, for internal testing. Features may still change.',
    beta: 'a beta build, for testing before the release.',
    rc: 'a release candidate: expected to become the release unless testing finds problems.',
};
const readme = [
    title,
    '='.repeat(title.length),
    '',
    'A planner for the ship skill tree of the Exiled Sector Starsector mod,',
    `matching mod release ${modRelease}.`,
    ...(preStage ? ['', `This is ${stageText[preStage]}`] : []),
    '',
    'How to use',
    '----------',
    'Unzip this folder anywhere, then double-click index.html. It runs in your',
    'browser with no install and no internet connection needed. Chrome or Edge is',
    'recommended (Firefox may not remember your build between visits).',
    '',
    'Press ? in the planner for every control.',
    '',
    'Mod art',
    '-------',
    'The planner doesn\'t include Exiled Sector\'s art. Click "Show mod art" in',
    'the top bar and choose the mod\'s folder (usually mods\\ExiledSector in your',
    'Starsector folder) to see the mod\'s icons, nebulae and planets. Without',
    'it, the tree draws placeholders. The planner only reads the images; nothing',
    'is uploaded or changed. Chrome and Edge remember the folder.',
    '',
    'Templates',
    '---------',
    'The Templates button imports and exports the game\'s skill tree templates',
    '(saves/common/exiledSector_skillTreeTemplates.json.data in your Starsector',
    'folder). Template codes (ES1....) can be pasted to share a build in chat.',
    '',
    'Credits',
    '-------',
    'Exiled Sector is by Portals. Its art belongs to the mod and to the authors',
    'of the other mods and games its art comes from; the CREDITS.md in the mod',
    'folder lists who made what and under which terms. This planner contains',
    'none of that art: it only shows the images from your own installed copy of',
    'the mod. Its tree data (node layout, names and effect wording) is',
    'extracted from the mod\'s data files. Starsector is by Fractal Softworks.',
    'The planner is a free, non-commercial fan tool for Exiled Sector players.',
    '',
    'Exiled Sector forum thread: https://fractalsoftworks.com/forum/index.php?topic=36072.0',
    'Exiled Sector on GitHub:    https://github.com/ExiledPortals/ExiledSector',
].join('\r\n') + '\r\n';

// One git archive call: the site files from the tag under one top folder, plus the two generated files.
// - Archiving the web/ subtree leaves the repo's .gitattributes (eol=lf) behind, so core.autocrlf is turned off
//   for this call: otherwise a Windows git would write the files with CRLF. They go in as stored, with LF.
// - --prefix doesn't apply to --add-virtual-file, so those paths name the top folder themselves.
// - LICENSE is too long for --add-virtual-file on a Windows command line, so it goes in with --add-file, which takes a
//   file from disk under the --prefix: the tag's own LICENSE, or the current one for tags made before it was added.
const name = `exiled-sector-planner-${tag}`;
const dist = join(repoRoot, 'dist');
mkdirSync(dist, { recursive: true });
const zipPath = join(dist, `${name}.zip`);
rmSync(zipPath, { force: true });
const licenseDir = join(dist, `.license-${name}`);
const tagLicense = git(repoRoot, ['show', `refs/tags/${tag}:LICENSE`], { allowFail: true, keepIndent: true });
const licenseText = tagLicense !== null ? tagLicense + '\n' : existsSync(join(repoRoot, 'LICENSE')) ? readFileSync(join(repoRoot, 'LICENSE'), 'utf8') : null;
if (licenseText === null) fail('package', 'no LICENSE in the tag or the planner folder.');
mkdirSync(licenseDir, { recursive: true });
writeFileSync(join(licenseDir, 'LICENSE'), licenseText);
try {
    git(repoRoot, [
        '-c', 'core.autocrlf=false',
        'archive', '--format=zip', '-o', zipPath, `--prefix=${name}/`,
        `--add-virtual-file=${name}/version.js:${versionJs}`,
        `--add-virtual-file=${name}/README.txt:${readme}`,
        `--add-file=${join(licenseDir, 'LICENSE')}`,
        `refs/tags/${tag}:web`, 'index.html', 'style.css', 'app.js', 'data/planner-data.js',
    ]);
} finally {
    rmSync(licenseDir, { recursive: true, force: true });
}

good(`Wrote dist/${name}.zip (${(statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB).`);
