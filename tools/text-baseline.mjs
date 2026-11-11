#!/usr/bin/env node
// Records every piece of text the planner page shows, to check that moving the text into files changes nothing.
//   node tools/text-baseline.mjs                 # capture and save baseline/text-baseline.txt
//   node tools/text-baseline.mjs --check         # capture again and compare with the saved file
//
// It serves web/ with serve.mjs, opens it in headless Edge or Chrome (a fresh profile, never the user's browser),
// drives the page through fixed scenarios (tools/lib/text-baseline-page.js) and saves the text by label. The output
// depends only on the code, the data and the text files: the planner's version is fixed for the capture (FIXED_VERSION),
// so it doesn't change with each commit. --browser <path> (or ESP_BROWSER) picks the browser when it isn't found.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, fromRepo, good, heading, readText, repoRoot, say, warn } from './lib/common.mjs';

const TOOL = 'text-baseline';
const { values: opt } = parseArgs({
    options: {
        check: { type: 'boolean' },
        out: { type: 'string', default: 'baseline/text-baseline.txt' },
        browser: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (opt.help) {
    say('Usage: node tools/text-baseline.mjs [--check] [--out <file>] [--browser <path>]');
    say('Captures the page text into baseline/text-baseline.txt, or with --check compares a new capture with it.');
    process.exit(0);
}
const outFile = fromRepo(opt.out);
// The planner version the page gets during a capture: a local build with uncommitted changes, so the footer shows the
// "(edited)" form too (panel.version.edited).
const FIXED_VERSION = 'v0.0.0-1-gabcdef0-dirty';

// ---------------------------------------------------------------- browser
function findBrowser() {
    const given = opt.browser ?? process.env.ESP_BROWSER;
    if (given) return existsSync(given) ? given : fail(TOOL, `no browser at ${given}`);
    const pf = process.env.ProgramFiles ?? 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    const candidates = process.platform === 'win32'
        ? [`${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`]
        : process.platform === 'darwin'
            ? ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
            : ['/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
    return candidates.find((p) => existsSync(p)) ?? fail(TOOL, 'no Edge or Chrome found; pass --browser <path> or set ESP_BROWSER');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// A minimal Chrome DevTools Protocol client over Node's built-in WebSocket.
class Cdp {
    constructor(ws) {
        this.ws = ws; this.next = 1; this.pending = new Map(); this.waiters = []; this.handlers = new Map();
        ws.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`)); else resolve(msg.result);
            } else if (msg.method) {
                for (const w of this.waiters.filter((x) => x.method === msg.method)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(msg.params); }
                for (const fn of this.handlers.get(msg.method) || []) fn(msg.params);
            }
        });
    }
    static async connect(url) {
        const ws = new WebSocket(url);
        await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', () => reject(new Error(`can't connect to ${url}`)), { once: true }); });
        return new Cdp(ws);
    }
    send(method, params = {}) {
        const id = this.next++;
        this.ws.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    }
    once(method) { return new Promise((resolve) => this.waiters.push({ method, resolve })); }
    on(method, fn) { this.handlers.set(method, [...(this.handlers.get(method) || []), fn]); }
    async evaluate(expression) {
        const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
        return r.result.value;
    }
    close() { this.ws.close(); }
}

// ---------------------------------------------------------------- capture
async function capture() {
    const port = await freePort();
    const server = spawn(process.execPath, [join(repoRoot, 'tools', 'serve.mjs'), '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const profile = mkdtempSync(join(tmpdir(), 'esp-text-baseline-'));
    let browser = null, cdp = null;
    try {
        await new Promise((resolve, reject) => {
            let log = '';
            server.stdout.on('data', (d) => { log += d; if (log.includes('Serving')) resolve(); });
            server.stderr.on('data', (d) => { log += d; });
            server.on('exit', (code) => reject(new Error(`serve.mjs stopped (${code}): ${log.trim()}`)));
        });
        browser = spawn(findBrowser(), [
            '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1600,1000',
            '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--mute-audio', 'about:blank',
        ], { stdio: 'ignore', windowsHide: true });
        // The browser writes its debugging port into the profile.
        const portFile = join(profile, 'DevToolsActivePort');
        for (let i = 0; i < 200 && !existsSync(portFile); i++) await sleep(50);
        if (!existsSync(portFile)) throw new Error('the browser did not start');
        const debugPort = readFileSync(portFile, 'utf8').split('\n')[0].trim();
        let target = null;
        for (let i = 0; i < 100 && !target; i++) {
            const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
            target = list.find((t) => t.type === 'page');
            if (!target) await sleep(50);
        }
        cdp = await Cdp.connect(target.webSocketDebuggerUrl);
        const origin = `http://localhost:${port}`;
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
        await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
        // version.js is answered with FIXED_VERSION instead of the served one (git describe), which changes per commit.
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/version.js*' }] });
        cdp.on('Fetch.requestPaused', ({ requestId }) => {
            const body = Buffer.from(`window.PLANNER_VERSION = '${FIXED_VERSION}';\n`).toString('base64');
            cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript; charset=utf-8' }], body }).catch(() => {});
        });
        const pageScript = readText(join(repoRoot, 'tools', 'lib', 'text-baseline-page.js'));
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `${pageScript}\nwindow.TEXT_BASELINE_PRELUDE();` });
        // Two passes: the full one, then a page without file access (as in Firefox) for the branches only it has.
        const pairs = [];
        for (const [path, run] of [['/', 'TEXT_BASELINE_RUN'], ['/?nofiles', 'TEXT_BASELINE_RUN_NOFILES']]) {
            const loaded = cdp.once('Page.loadEventFired');
            await cdp.send('Page.navigate', { url: `${origin}${path}` });
            await loaded;
            for (let i = 0; i < 100 && !(await cdp.evaluate('!!window.planner')); i++) await sleep(50);
            await sleep(300); // the first-visit toast and the art check run after load
            pairs.push(...await cdp.evaluate(`window.${run}()`));
        }
        return { pairs };
    } finally {
        if (cdp) cdp.close();
        if (browser) browser.kill();
        server.kill();
        await sleep(300);
        try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold a file */ }
    }
}

const SEP = '\n=== ';
const toText = (pairs) => pairs.map(([label, text]) => `=== ${label}\n${text}`).join('\n') + '\n';
const sections = (text) => {
    const map = new Map();
    for (const part of ('\n' + text).split(SEP).slice(1)) {
        const nl = part.indexOf('\n');
        let label = part.slice(0, nl);
        for (let k = 2; map.has(label); k++) label = `${part.slice(0, nl)} (${k})`;
        map.set(label, part.slice(nl + 1));
    }
    return map;
};

// ---------------------------------------------------------------- compare
// What moving text into text/*.js may change without changing what's shown: index.html's data-t* attributes,
// <span data-t> holders around text next to a form field, and the order of a tag's attributes (applyText sets title
// and placeholder after the others). Both sides are compared without them.
// Also line breaks inside text that only index.html's source layout put there (a line break between text and a tag
// reads as a space, or as nothing before a closing tag), which a text file's one-line string doesn't have.
function normalize(text) {
    return text
        // The capture breaks the line between two tags; a holder's tags go with it.
        .replace(/>\n<span data-t="[^"]*">([^<]*)<\/span>\n</g, '>$1<')
        .replace(/>\n<span data-t="[^"]*">([^<]*)<\/span>/g, '>$1')
        .replace(/<span data-t="[^"]*">([^<]*)<\/span>\n</g, '$1<')
        .replace(/<span data-t="[^"]*">([^<]*)<\/span>/g, '$1')
        .replace(/ data-t(?:-[a-z-]+)?="[^"]*"/g, '')
        // The list view's tree headings: a group id now, the shown name before (text overhaul 5a).
        .replace(/ data-group="[^"]*"/g, '')
        // Source line breaks inside text (after the holders are gone, so their own breaks aren't mistaken for these).
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/([^>\s])\n(?=<\/)/g, '$1')
        .replace(/([^>\s])\n(?=<)/g, '$1 ')
        .replace(/<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)+)\s*>/g, (_, tag, attrs) => {
            const list = [...attrs.matchAll(/\s+([^\s=>/]+)(?:="([^"]*)")?/g)].map((m) => m[0].trim());
            return `<${tag} ${list.sort().join(' ')}>`;
        });
}
function compare(before, after) {
    const a = sections(normalize(before)), b = sections(normalize(after));
    let diffs = 0;
    for (const label of new Set([...a.keys(), ...b.keys()])) {
        if (a.get(label) === b.get(label)) continue;
        diffs++;
        if (diffs > 40) continue;
        heading(`~ ${label}`);
        if (!a.has(label)) { warn('  only in the new capture'); continue; }
        if (!b.has(label)) { warn('  missing from the new capture'); continue; }
        const x = a.get(label).split('\n'), y = b.get(label).split('\n');
        let s = 0;
        while (s < x.length && s < y.length && x[s] === y[s]) s++;
        let e = 0;
        while (e < x.length - s && e < y.length - s && x[x.length - 1 - e] === y[y.length - 1 - e]) e++;
        for (const l of x.slice(s, x.length - e).slice(0, 8)) say(`  - ${l}`);
        for (const l of y.slice(s, y.length - e).slice(0, 8)) say(`  + ${l}`);
    }
    if (diffs > 40) warn(`… and ${diffs - 40} more sections`);
    return diffs;
}

// ---------------------------------------------------------------- main
const { pairs } = await capture();
const text = toText(pairs);
const errors = pairs.filter(([label]) => label.startsWith('error · '));
for (const [label, err] of errors) warn(`${label}\n${err.split('\n').slice(0, 4).join('\n')}`);
if (opt.check) {
    if (!existsSync(outFile)) fail(TOOL, `no saved baseline at ${outFile}; run without --check first`);
    const diffs = compare(readText(outFile), text);
    if (diffs) { warn(`${diffs} section${diffs === 1 ? '' : 's'} differ from ${opt.out}`); process.exitCode = 1; }
    else good(`Identical to ${opt.out}: ${pairs.length} sections, ${text.length} characters.`);
} else {
    mkdirSync(join(outFile, '..'), { recursive: true });
    writeFileSync(outFile, text);
    good(`Saved ${opt.out}: ${pairs.length} sections, ${text.length} characters.`);
}
if (errors.length) process.exitCode = 1;
