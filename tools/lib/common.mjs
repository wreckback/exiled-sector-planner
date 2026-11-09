// Shared helpers for the planner's dev tools (Node 26+, no dependencies).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { styleText } from 'node:util';

export const toolsDir = dirname(dirname(fileURLToPath(import.meta.url)));
export const repoRoot = dirname(toolsDir);

// ---------------------------------------------------------------- output
export const say = (msg = '') => console.log(msg);
export const warn = (msg) => console.log(styleText('yellow', msg));
export const good = (msg) => console.log(styleText('green', msg));
export const heading = (msg) => console.log(styleText('cyan', msg));
export function fail(tool, msg) {
    console.error(styleText('red', `${tool}: ${msg}`));
    process.exit(1);
}

// ---------------------------------------------------------------- paths
// A relative path given on the command line or in ESP_MOD_ROOT is taken from the planner folder,
// so the same value works whatever folder the command runs in.
export function fromRepo(p) {
    return isAbsolute(p) ? resolve(p) : resolve(repoRoot, p);
}

// The mod checkout: --mod-root, else ESP_MOD_ROOT, else ExiledSector/ inside the planner folder.
export function modRootFrom(option, tool) {
    const given = option ?? process.env.ESP_MOD_ROOT;
    const root = fromRepo(given || 'ExiledSector');
    if (!existsSync(root) || !statSync(root).isDirectory()) {
        fail(tool, `no mod checkout at ${root}\n` +
            '  Clone it there (git clone https://github.com/ExiledPortals/ExiledSector.git ExiledSector),\n' +
            '  or point to it with --mod-root <path> or the ESP_MOD_ROOT environment variable.');
    }
    return root;
}

// Does mod-relative path `rel` (with / separators) exist? Case-insensitive on every platform, like the game on Windows.
export function existsCaseless(root, rel) {
    const exact = join(root, ...rel.split('/'));
    if (existsSync(exact)) return true;
    let dir = root;
    for (const part of rel.split('/').filter(Boolean)) {
        let names;
        try { names = readdirSync(dir); } catch { return false; }
        const hit = names.find((n) => n.toLowerCase() === part.toLowerCase());
        if (!hit) return false;
        dir = join(dir, hit);
    }
    return true;
}

// ---------------------------------------------------------------- files
export function readText(path) {
    const text = readFileSync(path, 'utf8');
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
export const readJson = (path) => JSON.parse(readText(path));

// RFC 4180 CSV with a header row, read like PowerShell's Import-Csv: one object per row, keyed by header,
// with null for columns a short row doesn't have. Blank lines are skipped.
export function readCsv(path) {
    const text = readText(path);
    const rows = [];
    let row = [], field = '', quoted = false, i = 0, any = false;
    const endField = () => { row.push(field); field = ''; };
    const endRow = () => {
        endField();
        if (any || row.length > 1 || row[0] !== '') rows.push(row);
        row = []; any = false;
    };
    while (i < text.length) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                quoted = false; i++; continue;
            }
            field += ch; i++; continue;
        }
        if (ch === '"') { quoted = true; any = true; i++; continue; }
        if (ch === ',') { endField(); any = true; i++; continue; }
        if (ch === '\r' && text[i + 1] === '\n') { endRow(); i += 2; continue; }
        if (ch === '\n' || ch === '\r') { endRow(); i++; continue; }
        field += ch; i++;
    }
    if (field !== '' || row.length || any) endRow();
    const [header, ...body] = rows;
    if (!header) return [];
    return body.map((cells) => Object.fromEntries(header.map((h, k) => [h, k < cells.length ? cells[k] : null])));
}

// ---------------------------------------------------------------- git
// Runs git in `dir` and returns its trimmed output. Throws with git's message on failure.
export function git(dir, args, { allowFail = false } = {}) {
    try {
        return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
    } catch (e) {
        if (allowFail) return null;
        const detail = `${e.stderr ?? ''}${e.stdout ?? ''}`.trim().replace(/\s+/g, ' ');
        throw new Error(`git ${args.join(' ')} failed (${e.status ?? e.code}): ${detail}`);
    }
}
