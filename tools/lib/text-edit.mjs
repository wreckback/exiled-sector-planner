// The text editor's file side (serve.mjs --edit; the page side is web/editor/): reads the keys of web/text/*.js with
// their files and "// e.g." examples, and saves one key by rewriting only its own line, so comments, order and the
// rest of the file stay as the user wrote them.
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { readText, repoRoot } from './common.mjs';
import { checkText, exampleFits } from './text-check.mjs';

const TEXT_DIR = join(repoRoot, 'web', 'text');
// One key on one line: indent, "key", colon, "text", and an optional comma.
const DEF = /^(\s*)"([^"\\]+)"(\s*:\s*)"((?:[^"\\]|\\.)*)"(\s*,?\s*)$/;
const EXAMPLE = /^(\s*)\/\/ e\.g\. (.*)$/;

const textFiles = () => readdirSync(TEXT_DIR).filter((f) => f.endsWith('.js')).sort();
function evalText(src, file) {
    const sandbox = { window: {} };
    runInNewContext(src, sandbox, { filename: file });
    return sandbox.window.ESP_TEXT || {};
}

// Every key: { file, text, example, line, exampleLine } (line numbers from 0). An example belongs to the next key; a
// .other form without its own takes the one above its .one form (they're written as a pair under one example).
function scan() {
    const keys = {};
    for (const file of textFiles()) {
        const src = readText(join(TEXT_DIR, file));
        const text = evalText(src, file);
        let pending = null;
        src.split('\n').forEach((line, i) => {
            const ex = EXAMPLE.exec(line);
            if (ex) { pending = { text: ex[2].trim(), line: i }; return; }
            const def = /^\s*"([^"\\]+)"\s*:/.exec(line);
            if (!def) return;
            const key = def[1];
            keys[key] = { file, text: text[key], example: pending ? pending.text : null, line: i, exampleLine: pending ? pending.line : null };
            pending = null;
        });
    }
    for (const [key, k] of Object.entries(keys)) {
        const one = key.endsWith('.other') && keys[`${key.slice(0, -6)}.one`];
        if (k.example == null && one && one.file === k.file) { k.example = one.example; k.exampleLine = one.exampleLine; }
    }
    return keys;
}

// For the editor: key -> { file, text, example }.
export function readKeys() {
    const out = {};
    for (const [key, k] of Object.entries(scan())) out[key] = { file: k.file, text: k.text, example: k.example };
    return out;
}

// Saves one key's text. `example` is the text as the page last showed it: it replaces the key's "// e.g." line when
// that no longer fits the new text. Returns { file, exampleUpdated, example, errors, warnings } (the text check's
// errors, and its warnings about this key), or throws with a message for the editor.
export function saveKey(key, text, example) {
    if (typeof key !== 'string' || typeof text !== 'string') throw new Error('no key or text');
    const keys = scan();
    const k = keys[key];
    if (!k) throw new Error(`no text file has "${key}"`);
    const path = join(TEXT_DIR, k.file);
    const before = readText(path);
    const lines = before.split('\n');
    const m = DEF.exec(lines[k.line]);
    if (!m || m[2] !== key) throw new Error(`"${key}" in web/text/${k.file} isn't written on one line, so it can't be saved from here`);
    lines[k.line] = `${m[1]}"${key}"${m[3]}${JSON.stringify(text)}${m[5]}`;

    // The example, when the new text has left it behind.
    const base = key.replace(/\.(one|other)$/, '');
    const forms = base !== key ? [`${base}.one`, `${base}.other`].filter((f) => f in keys) : [key];
    const newTexts = forms.map((f) => (f === key ? text : keys[f].text));
    let exampleUpdated = false, newExample = k.example;
    if (k.exampleLine != null && typeof example === 'string' && example.trim() && !example.includes('\n')
        && !exampleFits(k.example, newTexts) && exampleFits(example.trim(), newTexts)) {
        const indent = EXAMPLE.exec(lines[k.exampleLine])[1];
        newExample = example.trim();
        const cr = lines[k.exampleLine].endsWith('\r') ? '\r' : ''; // the file's own line ending
        lines[k.exampleLine] = `${indent}// e.g. ${newExample}${cr}`;
        exampleUpdated = true;
    }

    // Write, then make sure the file still runs and gives exactly the new text; otherwise put it back.
    const after = lines.join('\n');
    writeFileSync(path, after);
    try {
        if (evalText(after, k.file)[key] !== text) throw new Error('the file gave a different text after saving');
    } catch (e) {
        writeFileSync(path, before);
        throw new Error(`web/text/${k.file} was left as it was (${e.message})`);
    }

    const check = checkText();
    const mentions = (w) => forms.some((f) => w.includes(`"${f}"`));
    return { file: k.file, exampleUpdated, example: newExample, errors: check.errors, warnings: check.warnings.filter(mentions) };
}
