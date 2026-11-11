// Checks the planner's text files (web/text/*.js) against the code that uses them (web/app.js, web/index.html).
// checkText() returns { errors, warnings, stats }; tools/text-check.mjs prints them and tools/release.mjs refuses to tag
// on errors.
//
// Errors: a key the code or index.html uses that no text file has; a key defined twice; a {placeholder} a call with
// inline values doesn't fill; .one and .other forms with different placeholders; a text file index.html doesn't load,
// or a script tag for a missing file.
// Warnings: a key nothing uses; a mod data id with no name line (name.requirement.*, name.gameState.*, name.subKind.*:
// looked up by id, see idName in app.js); an "// e.g." example that no longer matches its text.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { readText, repoRoot } from './common.mjs';

const WEB = join(repoRoot, 'web');
const TEXT_DIR = join(WEB, 'text');
// Keys looked up by a mod data id, so they never appear in the code (idName in app.js).
const ID_GROUPS = ['name.requirement.', 'name.gameState.', 'name.subKind.'];
// The markup the text may carry (trHtml), left out when an example is compared with its text.
const MARKUP = /<\/?(?:good|bad|hl|muted|builtIn|b|code|kbd)>/g;

// The text a file defines, as the browser gets it, plus the keys it writes more than once.
function readTextFile(path) {
    const src = readText(path);
    const sandbox = { window: {} };
    runInNewContext(src, sandbox, { filename: path });
    const seen = new Map();
    const doubled = [];
    for (const m of src.matchAll(/^\s*"([^"\\]+)"\s*:/gm)) {
        if (seen.has(m[1])) doubled.push(m[1]);
        seen.set(m[1], true);
    }
    return { text: sandbox.window.ESP_TEXT || {}, doubled, src };
}

// The text inside a balanced { … } starting at src[open], or null.
function balanced(src, open) {
    let depth = 0, quote = null;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '{' || c === '(' || c === '[') depth++;
        else if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0) return src.slice(open + 1, i); }
    }
    return null;
}
// The property names of an object literal's body (`a: 1, b, c: f(x, y)`).
function propertyNames(body) {
    const names = [];
    let depth = 0, quote = null, start = 0;
    const take = (seg) => { const m = /^\s*([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(seg); if (m) names.push(m[1]); };
    for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (c === ',' && depth === 0) { take(body.slice(start, i)); start = i + 1; }
    }
    take(body.slice(start));
    return names;
}
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function checkText() {
    const errors = [], warnings = [];
    const html = readText(join(WEB, 'index.html'));
    const app = readText(join(WEB, 'app.js'));

    // The text files, and index.html's script tags for them.
    const files = existsSync(TEXT_DIR) ? readdirSync(TEXT_DIR).filter((f) => f.endsWith('.js')).sort() : [];
    const loaded = [...html.matchAll(/<script src="text\/([^"]+)"><\/script>/g)].map((m) => m[1]);
    for (const f of files) if (!loaded.includes(f)) errors.push(`web/text/${f} isn't loaded by index.html (add a <script src="text/${f}"> before app.js).`);
    for (const f of loaded) if (!files.includes(f)) errors.push(`index.html loads text/${f}, which doesn't exist.`);

    const text = {}; // key -> text
    const where = {}; // key -> file
    const sources = {}; // file -> source
    for (const f of files) {
        let r;
        try { r = readTextFile(join(TEXT_DIR, f)); } catch (e) { errors.push(`web/text/${f} doesn't run: ${e.message}`); continue; }
        sources[f] = r.src;
        for (const k of r.doubled) errors.push(`"${k}" is written twice in web/text/${f}; only the second counts.`);
        for (const [k, v] of Object.entries(r.text)) {
            if (k in where) errors.push(`"${k}" is in both web/text/${where[k]} and web/text/${f}.`);
            text[k] = v; where[k] = f;
        }
    }
    const prefixes = new Set(Object.keys(text).map((k) => k.split('.')[0]));
    const has = (k) => k in text || (`${k}.one` in text && `${k}.other` in text);

    // Keys in use: key-shaped literals in app.js with a text file's prefix, keys built in code (as patterns), and
    // index.html's data-t attributes.
    const used = new Set();
    for (const m of app.matchAll(/(['"])([a-z][a-zA-Z]*(?:\.[\w-]+)+)\1/g)) if (prefixes.has(m[2].split('.')[0])) used.add(m[2]);
    const patterns = [];
    for (const m of app.matchAll(/(TEXT\[)?`((?:[a-zA-Z][\w-]*|\$\{\w+\})(?:\.?(?:[\w-]+|\$\{\w+\}))*)`/g)) {
        const tpl = m[2];
        if (m[1] || !tpl.includes('${')) continue; // TEXT[`…`] is idName's own lookup
        const lead = tpl.split(/[.$]/)[0];
        if (lead && !prefixes.has(lead)) continue; // the mod's keys (node.integration.…, summary.gated.…) and others
        patterns.push(new RegExp(`^${tpl.split(/\$\{\w+\}/).map(escapeRegex).join('.*')}$`));
    }
    const fromHtml = new Set([...html.matchAll(/data-t(?:-html|-title|-placeholder|-aria-label)?="([^"]+)"/g)].map((m) => m[1]));
    for (const k of fromHtml) used.add(k);

    // 1. Used but missing.
    for (const k of [...used].sort()) if (!has(k)) errors.push(`"${k}" is used ${fromHtml.has(k) ? 'in index.html' : 'in app.js'} but no text file has it.`);

    // 2. Defined but unused.
    const isUsed = (k) => used.has(k) || used.has(k.replace(/\.(one|other)$/, '')) || patterns.some((p) => p.test(k) || p.test(k.replace(/\.(one|other)$/, '')))
        || ID_GROUPS.some((g) => k.startsWith(g));
    for (const k of Object.keys(text).sort()) if (!isUsed(k)) warnings.push(`"${k}" (web/text/${where[k]}) isn't used.`);

    // 3. Placeholders a call with inline values doesn't fill: tr('key', { … }) / trHtml('key', { … }).
    let calls = 0;
    for (const m of app.matchAll(/\b(?:tr|trHtml)\(\s*'([^']+)'\s*,\s*\{/g)) {
        const body = balanced(app, m.index + m[0].length - 1);
        if (body == null) continue;
        calls++;
        const given = new Set(propertyNames(body));
        const forms = m[1] in text ? [m[1]] : [`${m[1]}.one`, `${m[1]}.other`].filter((k) => k in text);
        for (const k of forms) {
            const missing = [...new Set(placeholders(text[k]))].filter((p) => !given.has(p));
            if (missing.length) errors.push(`"${k}" has ${missing.map((p) => `{${p}}`).join(', ')}, which app.js doesn't fill (${m[1]} at line ${app.slice(0, m.index).split('\n').length}).`);
        }
    }

    // 4. .one and .other with different placeholders.
    for (const k of Object.keys(text)) {
        if (!k.endsWith('.one') || !(`${k.slice(0, -4)}.other` in text)) continue;
        const a = [...new Set(placeholders(text[k]))].sort().join(), b = [...new Set(placeholders(text[`${k.slice(0, -4)}.other`]))].sort().join();
        if (a !== b) errors.push(`"${k}" and "${k.slice(0, -4)}.other" have different placeholders ({${a}} vs {${b}}).`);
    }

    // 5. Mod data ids with no name line.
    try {
        const sandbox = { window: {} };
        runInNewContext(readText(join(WEB, 'data', 'planner-data.js')), sandbox);
        const D = sandbox.window.PLANNER_DATA;
        const ids = (prefix, list) => [...new Set(list)].sort().filter((id) => !(`${prefix}${id}` in text)).map((id) => `${prefix}${id}`);
        const missing = [
            ...ids('name.requirement.', D.types.flatMap((t) => (t.tags || []).filter((x) => x.startsWith('req_')))),
            ...ids('name.gameState.', D.nodes.flatMap((n) => (n.tags || []).filter((x) => x.startsWith('gate_')))),
            ...ids('name.subKind.', [...Object.keys(D.subroutineKinds || {}), ...(D.subroutines || []).map((s) => s.kind)]),
        ];
        for (const k of missing) warnings.push(`The mod data has an id with no name line: add "${k}" to web/text/names.js (until then it shows the id in words).`);
    } catch (e) { warnings.push(`Couldn't read web/data/planner-data.js to check the name lines: ${e.message}`); }

    // 6. "// e.g." examples: each belongs to the next key, and shows its text filled in, maybe with what's shown around
    // it (the whole line it sits in). It may match that key's other plural form instead.
    let examples = 0;
    for (const [f, src] of Object.entries(sources)) {
        let pending = null;
        for (const line of src.split('\n')) {
            const ex = /^\s*\/\/ e\.g\. (.*)$/.exec(line);
            if (ex) { pending = ex[1].trim(); continue; }
            const def = /^\s*"([^"\\]+)"\s*:/.exec(line);
            if (!def || pending == null) continue;
            const key = def[1], example = pending;
            pending = null;
            examples++;
            const base = key.replace(/\.(one|other)$/, '');
            const forms = [key, ...(key !== base ? [`${base}.one`, `${base}.other`] : [])].filter((k) => k in text);
            const fits = forms.some((k) => {
                const parts = String(text[k]).replace(MARKUP, '').split(/\{\w+\}/).map(escapeRegex);
                return new RegExp(parts.join('.+?'), 's').test(example);
            });
            if (!fits) warnings.push(`The example above "${key}" (web/text/${f}) doesn't match its text: "${example}"`);
        }
    }

    return { errors, warnings, stats: { files: files.length, keys: Object.keys(text).length, used: used.size, patterns: patterns.length, calls, examples } };
}
