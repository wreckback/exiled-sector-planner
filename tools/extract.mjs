#!/usr/bin/env node
// Extracts the Exiled Sector skill tree into the web planner.
//
// Reads the mod checkout and writes:
//   web/data/planner-data.js   tree, skill types, effect wording (as a JS global, so the page also works from file://)
//
// The art isn't copied: the page reads it from the mod folder each user chooses (the Mod art dialog). This only
// reports which images the data refers to that the mod doesn't ship (vanilla art, drawn as placeholders).
//
// Run again whenever the mod's tree or skill types change:
//   node tools/extract.mjs [--mod-root <path>] [--web-root <path>]
// The mod checkout is --mod-root, else ESP_MOD_ROOT, else ExiledSector/ in the planner folder.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { existsCaseless, fromRepo, git, modRootFrom, readCsv, readJson, readText, say, warn } from './lib/common.mjs';

const { values: opt } = parseArgs({
    options: {
        'mod-root': { type: 'string' },
        'web-root': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (opt.help) {
    say('Usage: node tools/extract.mjs [--mod-root <path>] [--web-root <path>]');
    say('Rebuilds web/data/planner-data.js from the mod checkout (default: ESP_MOD_ROOT, else ./ExiledSector).');
    process.exit(0);
}

const ModRoot = modRootFrom(opt['mod-root'], 'extract');
const WebRoot = fromRepo(opt['web-root'] ?? 'web');
const modPath = (...parts) => join(ModRoot, ...parts);
const exists = (p) => { try { statSync(p); return true; } catch { return false; } };

say(`Mod:  ${ModRoot}`);
say(`Web:  ${WebRoot}`);

// ---------------------------------------------------------------- small helpers
// Numbers as text the way the PowerShell extractor wrote them (15 significant digits), so expressions stay the same.
const numText = (v) => (v === null || v === undefined ? '' : String(Number(Number(v).toPrecision(15))));
const toDouble = (s) => Number(String(s).trim());
// Whole numbers from CSV text: round half to even, as PowerShell's [int] cast does.
function toInt(s) {
    const n = toDouble(s);
    const f = Math.floor(n), d = n - f;
    if (d > 0.5 || (d === 0.5 && f % 2 !== 0)) return f + 1;
    return f;
}
const truthy = (v) => v !== null && v !== undefined && v !== '' && v !== false && v !== 0;
// A value as a list: null/missing gives [null] and a single value gives [value], like PowerShell's @(...).
const asList = (v) => (Array.isArray(v) ? v : [v ?? null]);
const lower = (s) => String(s).toLowerCase();
const startsCaseless = (s, prefix) => lower(s).startsWith(lower(prefix));
const inCaseless = (s, list) => list.some((x) => lower(x) === lower(s));
const collator = new Intl.Collator('en');
const sorted = (items) => [...items].sort(collator.compare);
const allMatches = (text, re) => [...text.matchAll(re)];
const splitList = (s) => String(s ?? '').split(';').map((x) => x.trim()).filter(Boolean);

// ---------------------------------------------------------------- mod data
const tree = readJson(modPath('data', 'skilltrees', 'ship_skill_tree.json'));
const types = readJson(modPath('data', 'skilltrees', 'skill_types.json')).skillTypes;
const strings = new Map();
for (const part of ['core', 'skillTree']) {
    const s = readJson(modPath('data', 'strings', 'exiledSector', part, 'en.json'));
    for (const [k, v] of Object.entries(s)) strings.set(k, v);
}

// ---------------------------------------------------------------- effects
// Effect wording lives in Java enums. Each constant is either a plain stat effect
// (mode + stat name key, worded by desc.<mode>.up/down) or a templated one
// (effect.<NAME> string with {value} and extra args taken from Java constants).

// Every .java file under a src/main/java folder. Each folder's files come before its subfolders, both sorted by name,
// so the first class to declare a shared constant name is the same on every platform.
function javaFilesUnder(dir, out = []) {
    const entries = readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith('.'))
        .sort((a, b) => (a.name.toUpperCase() < b.name.toUpperCase() ? -1 : a.name.toUpperCase() > b.name.toUpperCase() ? 1 : 0));
    for (const e of entries) {
        if (e.isFile() && lower(e.name).endsWith('.java')) {
            const full = join(dir, e.name);
            const rel = '/' + relative(ModRoot, full).split(sep).join('/');
            if (/\/src\/main\/java\//i.test(rel)) out.push({ full, name: e.name, base: e.name.slice(0, -5), pkg: basename(dir) });
        }
    }
    for (const e of entries) if (e.isDirectory()) javaFilesUnder(join(dir, e.name), out);
    return out;
}
const javaFiles = javaFilesUnder(ModRoot);
const javaFile = (test) => javaFiles.find(test);
const javaByName = (name) => javaFile((f) => lower(f.name) === lower(name));
const javaByBase = (base) => javaFile((f) => lower(f.base) === lower(base));

// Numeric constants: NAME = 12.5f;  keyed both as NAME and Class.NAME
const constants = new Map();
const stringConstants = new Map();
const classText = new Map();   // class name -> source, for following description helpers into other classes
const hullTables = new Map();  // HullSizeTable constants: NAME and Class.NAME -> [fighter, frigate, destroyer, cruiser, capital, otherwise]
for (const f of javaFiles) {
    const text = readText(f.full);
    const cls = f.base;
    if (!classText.has(cls)) classText.set(cls, text.replace(/\r/g, ''));
    for (const m of allMatches(text, /\bHullSizeTable\s+([A-Z][A-Z0-9_]*)\s*=\s*new\s+HullSizeTable\(([^)]*)\)/g)) {
        const vals = m[2].split(',').map((v) => toDouble(v.trim().replace(/[fFdD]$/, '')));
        if (vals.length === 6) { hullTables.set(`${cls}.${m[1]}`, vals); hullTables.set(m[1], vals); }
    }
    for (const m of allMatches(text, /\b(?:static\s+)?final\s+(?:int|float|double|long)\s+([A-Z][A-Z0-9_]*)\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)[fFdDlL]?\s*;/gm)) {
        const v = toDouble(m[2]);
        constants.set(`${cls}.${m[1]}`, v);
        if (!constants.has(m[1])) constants.set(m[1], v);
    }
    for (const m of allMatches(text, /\bstatic\s+final\s+String\s+([A-Z][A-Z0-9_]*)\s*=\s*"((?:stat|subject)\.[A-Za-z0-9_.]+)"\s*;/gm)) {
        stringConstants.set(`${cls}.${m[1]}`, m[2]);
        stringConstants.set(m[1], m[2]);
    }
}

// Calls to small numeric helpers, Owner.method(args) whose body is just `return <expr>;` (e.g.
// AbsorbReserveListener.maxReserve(0) -> ParameterBonus.increasedBy(MAX_RESERVE, 0)), are inlined with their
// parameters replaced by the resolved arguments. Returns the text with every such call replaced, or null.
// A DescribeContext argument (the game's DescribeContext.NONE when wording an effect on its own) is passed through as
// this marker; context.magnitudeOf(X), what a related effect adds, is 0 then.
const NoContext = '__context__';
const magnitudeOfRe = /(?:\(\s*\w+\s*\)|\b\w+)\.magnitudeOf\(\s*(?:\w+\.)?[A-Z][A-Z0-9_]*\s*\)/g;
const mathCalls = ['round', 'abs', 'max', 'min'];
function inlineHelperCalls(text, cls, depth) {
    let e = text;
    for (let guard = 0; guard < 20; guard++) {
        // The first call that isn't Math.* or round/abs/max/min: Owner.method( or, in the same class, method(.
        const m = allMatches(e, /(?:\b([A-Z]\w*)\.)?\b([a-z]\w*)\s*\(/g)
            .find((x) => x[1] !== 'Math' && !(x[1] === undefined && mathCalls.includes(x[2])));
        if (!m) return e;
        const owner = m[1] ?? cls;
        const open = m.index + m[0].length - 1;
        const close = findClose(e, open);
        const src = classText.get(owner);
        if (close < 0 || !src || depth >= 4) return null;
        const args = splitTopLevel(e.slice(open + 1, close))
            .map((a) => (/^\(?\s*(context|__context__)\s*\)?$/.test(a) ? NoContext : resolveExpression(a, cls, depth + 1)));
        if (args.includes(null)) return null;
        // The overload with matching parameters (numbers, or a DescribeContext for the marker) and one return statement.
        const defRe = new RegExp(String.raw`\bstatic\s+(?:float|int|double|long)\s+${m[2]}\s*\(([^)]*)\)\s*\{\s*return\s+([^;]+);\s*\}`, 'g');
        let inlined = null;
        for (const def of allMatches(src, defRe)) {
            const params = splitTopLevel(def[1]);
            const fits = params.length === args.length && params.every((p, k) => (args[k] === NoContext
                ? /^(?:final\s+)?DescribeContext\s+\w+$/.test(p) : /^(?:final\s+)?(?:float|int|double|long)\s+\w+$/.test(p)));
            if (!fits) continue;
            let body = def[2];
            params.forEach((p, k) => { body = body.replace(wordRe(p.split(/\s+/).at(-1)), () => (args[k] === NoContext ? NoContext : `(${args[k]})`)); });
            inlined = resolveExpression(body, owner, depth + 1);
            if (inlined) break;
        }
        if (!inlined) return null;
        e = `${e.slice(0, m.index)}(${inlined})${e.slice(close + 1)}`;
    }
    return null;
}

// Returns a JS-evaluable expression over `magnitude`, or null if it uses anything unknown.
function resolveExpression(expr, cls, depth = 0) {
    const start = expr.trim().replace(magnitudeOfRe, '0');
    let e = inlineHelperCalls(start, cls, depth);
    if (e === null) return null;
    const inlined = e !== start;
    e = e.replace(/\(\s*(?:int|float|double)\s*\)/g, '');
    e = e.replace(/Math\.round/gi, 'round').replace(/Math\.abs/gi, 'abs').replace(/Math\.max/gi, 'max').replace(/Math\.min/gi, 'min');
    e = e.replace(/(\d+(?:\.\d+)?)[fFdD]\b/g, '$1');
    let failed = false;
    e = e.replace(/\b([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Z][A-Z0-9_]*)?)\b/g, (_, id) => {
        if (['magnitude', 'round', 'abs', 'max', 'min'].includes(lower(id))) return id;
        // The class's own constant first: a bare name like RANGE is defined in many classes.
        if (constants.has(`${cls}.${id}`)) return numText(constants.get(`${cls}.${id}`));
        if (constants.has(id)) return numText(constants.get(id));
        failed = true;
        return id;
    });
    if (failed) return null;
    if (!/^[0-9a-z+\-*/()., ]+$/i.test(e)) return null;
    // An inlined helper without `magnitude` is a constant: fold it to its number (round is Java's Math.round,
    // which JavaScript's matches). Only the characters checked above can be in it.
    if (inlined && depth === 0 && !/magnitude/i.test(e)) {
        const v = new Function('round', 'abs', 'max', 'min', `return (${e});`)(Math.round, Math.abs, Math.max, Math.min);
        if (Number.isFinite(v)) return numText(v);
    }
    return e;
}

// Index of the bracket that closes the one at `open` (works for ( and {).
function findClose(s, open) {
    const o = s[open], c = o === '(' ? ')' : '}';
    let depth = 0;
    for (let i = open; i < s.length; i++) {
        if (s[i] === o) depth++;
        else if (s[i] === c) { depth--; if (depth === 0) return i; }
    }
    return -1;
}
function splitTopLevel(s) {
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '(' || ch === '{' || ch === '<') depth++;
        else if (ch === ')' || ch === '}' || ch === '>') depth--;
        else if (ch === ',' && depth === 0) { parts.push(s.slice(start, i).trim()); start = i + 1; }
    }
    const last = s.slice(start).trim();
    if (last) parts.push(last);
    return parts;
}
const wordRe = (word) => new RegExp(`\\b${word}\\b`, 'g');
const substituteParams = (text, params) => {
    let e = text;
    for (const [p, v] of params) e = e.replace(wordRe(p), () => `(${v})`);
    return e;
};

// Message args added by a description body: .arg("k", expr), HullSizeTable.withShipSizeArgs(...), and calls into
// helper methods (followed into their class, with the helper's parameters replaced by the call's arguments).
// description: the hand-over between the two description forms, which are both read already (not a helper to follow).
const skipCalls = /^(msg|arg|styled|templated|signed|text|format|of|valueOf|get|round|abs|max|min|withShipSizeArgs|affinityScaling|stepSize|count|plain|list|description)$/i;
const skipOwners = ['EffectText', 'Translation', 'Math', 'String', 'List', 'Map', 'NumberText'];
function getDescriptionArgs(body, cls, params, depth) {
    const out = new Map();
    // Local numbers the args use (int riftsPerSeries = Listener.riftsPerSeries(...); ... .arg("count", riftsPerSeries)).
    const locals = new Map(params);
    for (const v of allMatches(body, /\b(?:final\s+)?(?:int|float|double|long)\s+(\w+)\s*=\s*([^;]+);/g)) {
        const r = resolveExpression(substituteParams(v[2], locals), cls);
        if (r) locals.set(v[1], r);
    }
    for (const a of allMatches(body, /\.arg\(\s*"(\w+)"\s*,\s*((?:[^()]|\((?:[^()]|\([^()]*\))*\))+)\)/g)) {
        const r = resolveExpression(substituteParams(a[2], locals), cls);
        if (r && !out.has(a[1])) out.set(a[1], r);
    }
    // .count(n) fills {count} (and picks the message's .one/.other form in game).
    for (const c of allMatches(body, /\.count\(\s*((?:[^()]|\((?:[^()]|\([^()]*\))*\))+)\)/g)) {
        const r = resolveExpression(substituteParams(c[1], locals), cls);
        if (r && !out.has('count')) out.set('count', r);
    }
    for (const m of allMatches(body, /\b(?:(\w+)\.)?(\w+)\.withShipSizeArgs\(/g)) {
        const key = m[1] !== undefined ? `${m[1]}.${m[2]}` : m[2];
        const t = hullTables.has(key) ? hullTables.get(key) : hullTables.get(m[2]);
        if (t) {
            out.set('frigate', numText(t[1])); out.set('destroyer', numText(t[2]));
            out.set('cruiser', numText(t[3])); out.set('capital', numText(t[4]));
        }
    }
    if (depth >= 3) return out;
    for (const m of allMatches(body, /\b(?:([A-Z]\w*)\.)?([a-z]\w*)\s*\(/g)) {
        const method = m[2];
        if (skipCalls.test(method)) continue;
        const owner = m[1] !== undefined ? m[1] : cls;
        if (inCaseless(owner, skipOwners)) continue;
        const src = classText.get(owner);
        if (!src) continue;
        const open = m.index + m[0].length - 1;
        const close = findClose(body, open);
        if (close < 0) continue;
        const callArgs = splitTopLevel(body.slice(open + 1, close));
        const def = new RegExp(String.raw`^\s*(?:(?:public|private|protected|static|final)\s+)*[\w<>\[\]]+\s+${method}\s*\(([^)]*)\)\s*\{`, 'm').exec(src);
        if (!def) continue;
        const bodyOpen = def.index + def[0].length - 1;
        const bodyClose = findClose(src, bodyOpen);
        if (bodyClose < 0) continue;
        const helperParams = new Map();
        const declared = splitTopLevel(def[1]);
        for (let k = 0; k < declared.length && k < callArgs.length; k++) {
            const pname = declared[k].split(/\s+/).at(-1);
            const arg = substituteParams(callArgs[k], params);
            if (/^[\w.()+\-*/ ]+$/i.test(arg) && !/\bthis\b/i.test(arg)) helperParams.set(pname, arg);
        }
        const inner = getDescriptionArgs(src.slice(bodyOpen + 1, bodyClose), owner, helperParams, depth + 1);
        for (const [k2, v2] of inner) if (!out.has(k2)) out.set(k2, v2);
    }
    return out;
}

// LowBaseArmorBonus keeps its per-hull scale in a map; its description helpers return "a/b/c/d" strings.
const lowArmorScales = new Map();
if (classText.get('LowBaseArmorBonus')) {
    for (const m of allMatches(classText.get('LowBaseArmorBonus'), /SCALES\.put\(\s*HullSize\.(\w+)\s*,\s*new\s+Scale\(([^)]*)\)/g)) {
        lowArmorScales.set(m[1], m[2].split(',').map((v) => toDouble(v.trim().replace(/[fFdD]$/, ''))));
    }
}

// The in-game stat sheet (StatGroup): its sections in order, and which section each effect package goes to
// (StatGroup.of: by the effect class's package; generated weapon effects go to WEAPONS).
let statGroups = [];
const packageGroups = new Map();
let defaultGroup = 'MECHANICS';
const sgf = javaByBase('StatGroup');
if (sgf) {
    const sgText = readText(sgf.full);
    const enumBody = /enum\s+StatGroup\s*\{([^;]*);/s.exec(sgText);
    if (enumBody) statGroups = allMatches(enumBody[1], /\b([A-Z][A-Z0-9_]*)\b/g).map((m) => m[1]);
    for (const m of allMatches(sgText, /case\s+((?:"[^"]+"\s*,?\s*)+)->\s*([A-Z][A-Z0-9_]*)\s*;/g)) {
        for (const p of allMatches(m[1], /"([^"]+)"/g)) packageGroups.set(p[1], m[2]);
    }
    const dm = /default\s*->\s*([A-Z][A-Z0-9_]*)\s*;/.exec(sgText);
    if (dm) defaultGroup = dm[1];
}
if (statGroups.length) say(`Stat sheet: ${statGroups.length} sections, ${packageGroups.size} effect packages mapped`);
else warn("  ! StatGroup.java not found or not parsed; the Stats tab will put everything under one section");

// Effects built on a backing class (a record or class implementing EffectBacking, made by a factory such as
// DamageTakenWhile.within(condition, describedRange)) keep their mode, stat and wording in that class. Returns its
// name, source and description bodies (with the factory's function arguments filled in), or null.
function backingOf(body) {
    for (const m of allMatches(body, /\b([A-Z]\w*)\.(\w+)\s*\(/g)) {
        const src = classText.get(m[1]);
        if (!src || !/\b(?:record|class)\s+\w+[^{]*\bimplements\b[^{]*\bEffectBacking\b/.test(src)) continue;
        const open = m.index + m[0].length - 1;
        const close = findClose(body, open);
        const callArgs = close < 0 ? [] : splitTopLevel(body.slice(open + 1, close));
        const def = new RegExp(String.raw`\bstatic\s+\w+\s+${m[2]}\s*\(([^)]*)\)`).exec(src);
        // Function arguments, applied to the context: a method reference Owner::method, or a lambda x -> expr.
        const fns = new Map();
        if (def) {
            splitTopLevel(def[1]).forEach((p, k) => {
                const a = callArgs[k] ?? '';
                const name = p.split(/\s+/).at(-1);
                const ref = /^([A-Z]\w*)::(\w+)$/.exec(a);
                const lambda = /^\(?\s*\w+\s*\)?\s*->\s*(.+)$/s.exec(a);
                if (ref) fns.set(name, `${ref[1]}.${ref[2]}(context)`);
                else if (lambda) fns.set(name, `(${lambda[1]})`);
            });
        }
        const describe = [];
        for (const d of allMatches(src, /\b(?:description|describe)\s*\(\s*SkillEffect\s+\w+\s*,\s*float\s+magnitude\s*(?:,\s*DescribeContext\s+\w+\s*)?\)\s*\{/g)) {
            const bOpen = d.index + d[0].length - 1;
            const bClose = findClose(src, bOpen);
            if (bClose < 0) continue;
            let b = src.slice(bOpen + 1, bClose);
            for (const [name, call] of fns) b = b.replace(new RegExp(String.raw`\b${name}\.apply\w*\(\s*\w+\s*\)`, 'g'), () => call);
            describe.push(b);
        }
        return { cls: m[1], src, describe };
    }
    return null;
}

const effects = new Map();
for (const f of javaFiles.filter((x) => lower(x.name).endsWith('skilleffect.java'))) {
    const text = readText(f.full).replace(/\r/g, '');
    if (!/\benum\s+\w+/i.test(text)) continue;
    const cls = f.base;
    // Constants start at 4-space indent with an UPPER_CASE name.
    const starts = allMatches(text, /^ {4}([A-Z][A-Z0-9_]+)\s*(?=[\(,;{])/gm);
    for (let i = 0; i < starts.length; i++) {
        const name = starts[i][1];
        const from = starts[i].index;
        const to = i + 1 < starts.length ? starts[i + 1].index : text.length;
        const body = text.slice(from, to);
        const info = {};
        info.group = packageGroups.has(f.pkg) ? packageGroups.get(f.pkg) : defaultGroup;

        const backing = backingOf(body);
        const modeRe = /(?:statEffect|ConditionalStatEffect|DerivedStatEffect|ScaledBonus|statEffectFor\w*)\s*\(\s*(?:StatMode\.)?(PERCENT|FLAT|MULT)\b/;
        let mode = modeRe.exec(body);
        if (!mode) mode = /\b(PERCENT|FLAT|MULT)\s*,/.exec(body);
        if (!mode && backing) mode = modeRe.exec(backing.src);
        if (mode) info.mode = lower(mode[1]);

        const stat = /"(stat\.[A-Za-z0-9_.]+)"/.exec(body) ?? (backing ? /"(stat\.[A-Za-z0-9_.]+)"/.exec(backing.src) : null);
        if (stat) info.stat = stat[1];
        else {
            const sc = /\b(?:([A-Z][A-Za-z]+)\.)?([A-Z][A-Z0-9_]+)\s*,\s*(?:true|false)\s*\)/.exec(body);
            if (sc) {
                const key = sc[1] !== undefined ? `${sc[1]}.${sc[2]}` : sc[2];
                if (stringConstants.has(key)) info.stat = stringConstants.get(key);
                else if (stringConstants.has(sc[2])) info.stat = stringConstants.get(sc[2]);
            }
        }
        if (/,\s*true\s*\)\s*\)/i.test(body) || /lowerIsBetter\(\)\s*\{\s*return\s+true/i.test(body)
            || (backing && /lowerIsBetter\(\)\s*\{\s*return\s+true/i.test(backing.src))) info.lowerIsBetter = true;

        const args = new Map();
        // Affinity-scaled effects (AffinityScaling backing) word themselves with {step} = the scaling's step size.
        const scaling = /new\s+AffinityScaling\(\s*AffinityScaling\.Filter\.\w+\s*,\s*(?:AffinityScaling\.)?([A-Z_][A-Z0-9_]*|\d+)/.exec(body);
        let step = null;
        if (scaling) {
            const sv = scaling[1];
            step = /^\d+$/.test(sv) ? sv : constants.has(`AffinityScaling.${sv}`) ? numText(constants.get(`AffinityScaling.${sv}`)) : null;
            if (step) args.set('step', step);
        }
        // The wording method: description(float magnitude), and/or description(float magnitude, DescribeContext context),
        // which the one-argument form may just hand over to. Both bodies are read (resolveExpression treats
        // context.magnitudeOf(X) as 0). An effect built on a backing class (backingOf) is worded there instead.
        let descBodies = allMatches(body, /description\s*\(\s*float\s+magnitude\s*(?:,\s*DescribeContext\s+\w+\s*)?\)\s*\{(.*?)\n {8}\}/gs).map((d) => d[1]);
        let descCls = cls;
        if (!descBodies.length && backing?.describe.length) { descBodies = backing.describe; descCls = backing.cls; }
        if (descBodies.length) {
            info.custom = true;
            let dbody = descBodies.join('\n');
            if (step) dbody = dbody.replace(/affinityScaling\(\)\.stepSize\(\)/gi, () => step);
            const found = getDescriptionArgs(dbody, descCls, new Map(), 0);
            for (const [k, v] of found) if (!args.has(k)) args.set(k, v);
            // LowBaseArmorBonus.*ByHullSize(magnitude): one value per hull size joined with "/", plus per-hull values
            // for the hull-specific wording (effect.NAME.hullSize).
            if (/LowBaseArmorBonus\.(most|least|cutoff)ByHullSize/i.test(dbody) && lowArmorScales.size) {
                for (const [field, idx] of [['most', 0], ['least', 1], ['cutoff', 2]]) {
                    const parts = [...lowArmorScales.values()].map((s) => (field === 'cutoff' ? numText(s[idx]) : `round(${numText(s[idx])}*magnitude)`));
                    args.set(field, `join(${parts.join(',')})`);
                }
                const hullArgs = {};
                for (const [h, s3] of lowArmorScales) {
                    hullArgs[h] = { most: `round(${numText(s3[0])}*magnitude)`, least: `round(${numText(s3[1])}*magnitude)`, cutoff: numText(s3[2]) };
                }
                info.hullArgs = hullArgs;
            }
            if (/EffectText\.(signed)\(/.test(dbody)) info.signed = true;
            // StatMode.describeStat(±magnitude, [subject,] "stat.x"): the game words the effect with that mode and stat,
            // with the magnitude's sign flipped when it's passed as -magnitude (the survey cost reductions, stored as
            // positive amounts), and with a subject first ("Your fleet has", desc.<mode>.<up|down>.subject).
            const ds = /\b(PERCENT|FLAT|MULT)\.describeStat\(\s*(-)?\s*magnitude\s*,\s*(?:("subject\.[\w.]+"|[A-Z][A-Z0-9_]*)\s*,\s*)?"(stat\.[\w.]+)"\s*\)/.exec(dbody);
            if (ds) {
                info.mode = lower(ds[1]);
                info.stat = ds[4];
                if (ds[2]) info.negate = true;
                if (ds[3]) {
                    const subj = ds[3].startsWith('"') ? ds[3].slice(1, -1) : stringConstants.get(`${descCls}.${ds[3]}`) ?? stringConstants.get(ds[3]);
                    if (subj && subj.startsWith('subject.')) info.subject = subj;
                    else warn(`  ! ${name}: describeStat subject ${ds[3]} not resolved; worded without it`);
                }
            }
        }
        // Effects that refuse allocation on some ships (shield type, phase hull, base armor, wings). app.js words each one.
        if (/\bblockAllocationReason\s*\(\s*ShipFacts/i.test(body)) info.blocks = true;
        // Read live in combat (StatTarget.liveStat/liveBonus): only these survive a gating subroutine (supportsTemporaryGating).
        if (!/\b(ConditionalStatEffect|DerivedStatEffect|listener|flag)\s*\(/i.test(body)) {
            if (/\blive(Stat|Bonus)\(/i.test(body)) info.live = true;
            else {
                // A helper as the target (statEffect(MODE, Maneuverability.target(), ...)): live if that class only builds live targets.
                const helper = /statEffect\(\s*(?:StatMode\.)?\w+\s*,\s*([A-Z]\w+)\.\w+/.exec(body);
                const src = helper ? classText.get(helper[1]) : null;
                if (src && /\blive(Stat|Bonus)\(/i.test(src) && !/\b(stat|bonus|dynamicStat|dynamicMod)\(/i.test(src)) info.live = true;
            }
        }
        if (args.size) info.args = Object.fromEntries(args);
        effects.set(name, info);
    }
}

// Weapon stat families declared with qualifiedByScope = false don't prefix the scope.
const weaponUnqualified = [];
const weaponLive = [];
const wsf = javaByName('WeaponStatFamily.java');
if (wsf) {
    const wtext = readText(wsf.full).replace(/\r/g, '');
    for (const m of allMatches(wtext, /^ {4}([A-Z_]+)\(\s*false\b/gm)) weaponUnqualified.push(m[1]);
    const wstarts = allMatches(wtext, /^ {4}([A-Z][A-Z0-9_]+)\(/gm);
    for (let i = 0; i < wstarts.length; i++) {
        const to = i + 1 < wstarts.length ? wstarts[i + 1].index : wtext.length;
        if (/\blive(Stat|Bonus)\(/i.test(wtext.slice(wstarts[i].index, to))) weaponLive.push(wstarts[i][1]);
    }
}

// Effects actually used by skill types, plus the string templates they need. A type's `integrated` block (the effects
// an integrated node uses instead, like an s-mod) counts too, so its effects get their wording.
const usedEffects = new Set();
for (const t of types) {
    for (const e of [...asList(t.effects), ...asList(t.hullSizeEffects), ...asList(t.integrated?.effects),
        ...asList(t.integrated?.hullSizeEffects)]) if (e && e.effect) usedEffects.add(e.effect);
}

// ---------------------------------------------------------------- subroutines (socket items besides anchors)
// subroutines.csv (+ doctrine_archives.csv for doctrines), the doctrine modifier ranges (item_modifiers.csv), radius sizes
// (node_radii.json) and per-ship limits per kind (SubroutineKind).
function readLines(s) {
    // "EFFECT:min:max; EFFECT:min:max" -> list of { effect, min, max }
    return splitList(s).map((x) => x.split(':')).filter((p) => p.length >= 3)
        .map((p) => ({ effect: p[0].trim(), min: toDouble(p[1]), max: toDouble(p[2]) }));
}
const configPath = (file) => modPath('data', 'config', 'exiledSector', file);
const subroutines = [];
const subroutineModifiers = new Map();
if (exists(configPath('subroutines.csv'))) {
    const doctrines = new Map();
    if (exists(configPath('doctrine_archives.csv'))) for (const row of readCsv(configPath('doctrine_archives.csv'))) doctrines.set(row.id, row);
    const modRows = new Map();
    if (exists(configPath('item_modifiers.csv'))) for (const row of readCsv(configPath('item_modifiers.csv'))) modRows.set(row.id, row);
    for (const row of readCsv(configPath('subroutines.csv'))) {
        if (!row.id) continue;
        const o = { id: row.id, name: row.name ?? null, icon: row.icon ?? null, kind: row.kind ?? null, description: row.description ?? null };
        const lines = readLines(row.lines);
        if (lines.length) { o.lines = lines; for (const l of lines) usedEffects.add(l.effect); }
        if (row.radius) o.radius = row.radius;
        // Rarity 0 keeps an item out of every drop pool (ItemDrops.isDroppable), so it can't be found in game.
        if (row.rarity !== null && row.rarity !== undefined && row.rarity !== '' && toDouble(row.rarity) <= 0) o.unobtainable = true;
        if (row.socket_limit && toInt(row.socket_limit) > 0) o.socketLimit = toInt(row.socket_limit);
        if (row.node_count_chances) o.nodeCountChances = splitList(row.node_count_chances).map(toDouble);
        const doc = doctrines.get(row.id);
        if (doc) {
            o.behaviour = doc.behaviour ?? null;
            if (doc.radius) o.radius = doc.radius;
            for (const k of ['notables', 'keystones', 'small_nodes']) { const v = splitList(doc[k]); if (v.length) o[k] = v; }
            const mods = splitList(doc.modifiers).map((m) => m.replace(/^@+/, ''));
            if (mods.length) {
                o.modifiers = mods;
                for (const m of mods) {
                    if (modRows.get(m)) {
                        const ml = readLines(modRows.get(m).lines);
                        subroutineModifiers.set(m, ml);
                        for (const l of ml) usedEffects.add(l.effect);
                    }
                }
            }
            if (doc.min_lines) { o.minLines = toInt(doc.min_lines); o.maxLines = toInt(doc.max_lines ?? ''); }
        }
        subroutines.push(o);
    }
}
const nodeRadii = {};
if (exists(configPath('node_radii.json'))) for (const [k, v] of Object.entries(readJson(configPath('node_radii.json')))) nodeRadii[k] = Number(v);
const subroutineKinds = {};
const skf = javaByName('SubroutineKind.java');
if (skf) {
    for (const m of allMatches(readText(skf.full), /^\s+([A-Z_]+)\(\s*(true|false)\s*,\s*(true|false)\s*,\s*([A-Za-z0-9_.]+)\s*,/gm)) {
        subroutineKinds[m[1]] = { perShip: /^\d+$/.test(m[4]) ? toInt(m[4]) : null };
    }
}
say(`Subroutines: ${subroutines.length} items, ${subroutineModifiers.size} doctrine modifiers, ${Object.keys(subroutineKinds).length} kinds`);

const effectOut = new Map();
const neededStrings = new Map();
for (const [k, v] of strings) if (startsCaseless(k, 'desc.') || startsCaseless(k, 'stat.') || startsCaseless(k, 'weapon.') || startsCaseless(k, 'subject.')) neededStrings.set(k, v);
const missing = [];
for (const name of sorted(usedEffects)) {
    let info = effects.has(name) ? effects.get(name) : {};
    // Weapon effects are generated (ScopedWeaponEffect): <SCOPE_>WEAPON_<FAMILY>_<MODE>, worded by weapon.stat.<FAMILY>.
    const w = /^(BALLISTIC_|MISSILE_|NON_BEAM_ENERGY_|ENERGY_|BEAM_)?WEAPON_([A-Z_]+)_(PERCENT|FLAT|MULT)$/.exec(name);
    if (!info.stat && w && strings.has(`weapon.stat.${w[2]}`)) {
        const family = w[2];
        info = { mode: lower(w[3]), weaponFamily: family, group: 'WEAPONS' };
        if (w[1] !== undefined) info.weaponScope = w[1].replace(/_+$/, '');
        if (inCaseless(family, weaponUnqualified)) info.unqualified = true;
        if (inCaseless(family, weaponLive)) info.live = true;
        if (inCaseless(family, ['FLUX_COST', 'RECOIL'])) info.lowerIsBetter = true;
    }
    let hasTemplate = false;
    for (const [k, v] of strings) {
        if (lower(k) === lower(`effect.${name}`) || startsCaseless(k, `effect.${name}.`)) { neededStrings.set(k, v); hasTemplate = true; }
    }
    if (!hasTemplate && !info.stat && !info.weaponFamily) missing.push(name);
    effectOut.set(name, info);
}
say(`Effects: ${usedEffects.size} used, ${missing.length} without wording (shown by name)`);
if (missing.length) say('  ' + missing.join(', '));

// Affinity step bonuses (AffinitySteps.stepsByAffinity): every <size> affinity grants <bonus> of <effect>.
const affinitySteps = {};
const asf = javaByName('AffinitySteps.java');
if (asf) {
    const txt = readText(asf.full);
    for (const m of allMatches(txt, /steps\.put\(\s*\w+\.(\w+)\s*,\s*List\.of\((.*?)\)\);/gs)) {
        const list = [];
        for (const s of allMatches(m[2], /new Step\(\s*(\w+)\s*,\s*\w+\.(\w+)\s*,\s*([0-9.]+)f?\s*\)/g)) {
            const size = constants.get(`AffinitySteps.${s[1]}`) ?? constants.get(s[1]) ?? null;
            list.push({ size, effect: s[2], bonus: toDouble(s[3]) });
            usedEffects.add(s[2]);
        }
        affinitySteps[m[1]] = list;
    }
}

// Hull mod display names. First the in-game names the mod's tests render text with (vanilla and other mods' hull mods),
// then the balance sheet. The first file is a test resource, so tools/update warns if it moves.
const hullModNames = new Map();
const gameNames = modPath('exiledsector-core', 'src', 'test', 'resources', 'i18n', 'hullmod_names.csv');
if (exists(gameNames)) {
    for (const row of readCsv(gameNames)) if (row.id && row.name) hullModNames.set(row.id, row.name);
} else say('  hullmod_names.csv not found; hull mods from other mods will show by id');
const balance = modPath('docs', 'analysis', 'balance.csv');
if (exists(balance)) {
    for (const row of readCsv(balance)) if (row.hullmod_id && row.hullmod_name && !hullModNames.has(row.hullmod_id)) hullModNames.set(row.hullmod_id, row.hullmod_name);
}
for (const name of usedEffects) if (!effectOut.has(name) && effects.has(name)) effectOut.set(name, effects.get(name));
// The mod's own hull mods (phantoms and markers), for names balance.csv doesn't give.
const modHullMods = modPath('data', 'hullmods', 'hull_mods.csv');
if (exists(modHullMods)) {
    for (const row of readCsv(modHullMods)) if (row.id && row.name && !hullModNames.has(row.id)) hullModNames.set(row.id, row.name);
}

// Hull mods that can't share a ship (HullModConflicts): symmetric partner lists. SkillType turns these into node conflicts.
const hullModConflicts = {};
if (exists(configPath('hullmod_conflicts.csv'))) {
    const pairs = new Map();
    for (const row of readCsv(configPath('hullmod_conflicts.csv'))) {
        if (!row.hullmod) continue;
        for (const c of splitList(row.conflicts).filter((x) => lower(x) !== lower(row.hullmod))) {
            for (const [a, b] of [[row.hullmod, c], [c, row.hullmod]]) {
                if (!pairs.has(a)) pairs.set(a, []);
                if (!pairs.get(a).includes(b)) pairs.get(a).push(b);
            }
        }
    }
    for (const k of sorted(pairs.keys())) hullModConflicts[k] = pairs.get(k);
}

// Logistics node limit per ship (LogisticsNodes.DEFAULT_CAP; items can add slots in game).
const logisticsCap = constants.get('LogisticsNodes.DEFAULT_CAP') ?? 2;

// Wormhole anchor items: templates store socket -> anchor item id, the planner links socket -> exit node.
const wormholeAnchors = [];
if (exists(configPath('wormhole_anchors.csv'))) {
    for (const row of readCsv(configPath('wormhole_anchors.csv'))) {
        if (row.id && row.exit_node) wormholeAnchors.push({ id: row.id, exit: row.exit_node, name: row.name ?? null });
    }
}

// Retired / renamed ids, so templates written by older mod versions import like the game reads them (NodeReplacements, AffinityOptions).
function readRenames(path, map = {}) {
    if (exists(path)) for (const row of readCsv(path)) if (row.old && row.new) map[row.old.trim()] = row.new.trim();
    return map;
}
const nodeRenames = readRenames(configPath('node_id_renames.csv'), readRenames(configPath('node_replacements.csv')));
const typeRenames = readRenames(configPath('type_id_renames.csv'));
const retiredOptions = {};
const aof = javaByName('AffinityOptions.java');
if (aof) {
    const block = /RETIRED_OPTIONS\s*=\s*Map\.of\((.*?)\);/s.exec(readText(aof.full));
    if (block) for (const m of allMatches(block[1], /"([^"]+)"\s*,\s*"([^"]+)"/g)) retiredOptions[m[1]] = m[2];
}

// Theme tags (SkillTags.THEME, in the mod's order) with their display names (theme.<id>), for the theme filter.
const themes = [];
const stf = javaByBase('SkillTags');
if (stf) {
    const block = /THEME\s*=\s*List\.of\((.*?)\);/s.exec(readText(stf.full));
    for (const m of allMatches(block ? block[1] : '', /"([^"]+)"/g)) {
        const id = m[1];
        themes.push({ id, name: strings.has(`theme.${id}`) ? strings.get(`theme.${id}`) : id });
    }
}
if (themes.length) say(`Themes: ${themes.length}`);
else warn('  ! no theme list found (SkillTags.THEME); the theme filter will be empty');

// Optional volumes (the mod settings' Optional Volumes toggles): each toggle's volumes come from VolumeToggles
// (<X>_VOLUMES = Set.of(...)), its key and name from SkillTreeSettings (<X>_FIELD_ID -> settings.volumes.<key>.name).
const optionalVolumes = [];
const vtf = javaByBase('VolumeToggles');
const stsf = javaByBase('SkillTreeSettings');
if (vtf && stsf) {
    const groupVolumes = new Map();
    for (const m of allMatches(readText(vtf.full), /static\s+final\s+Set<String>\s+(\w+)_VOLUMES\s*=\s*Set\.of\(([^)]*)\)/g)) {
        groupVolumes.set(m[1], allMatches(m[2], /"([^"]+)"/g).map((x) => x[1]));
    }
    for (const m of allMatches(readText(stsf.full), /VolumeToggles\.(\w+)_FIELD_ID\s*,\s*Translation\.text\("settings\.volumes\.(\w+)\.name"\)/g)) {
        const [, constName, key] = m;
        if (!groupVolumes.has(constName)) continue;
        const name = strings.has(`settings.volumes.${key}.name`) ? strings.get(`settings.volumes.${key}.name`) : key;
        optionalVolumes.push({ id: key, name, volumes: groupVolumes.get(constName) });
    }
}
if (optionalVolumes.length) say(`Optional volume toggles: ${optionalVolumes.length}`);
else warn('  ! no optional volume toggles found (VolumeToggles / SkillTreeSettings); the Optional volumes list will be empty');

// UI strings the planner reuses.
const uiPrefixes = ['ui.node.', 'tier.', 'node.block.', 'node.requires.', 'socketable.anchor.gate.', 'socketable.doctrine.', 'socketable.radius',
    'socketable.rootConduit.', 'subroutine.grant.', 'ui.stats.group.', 'summary.gated.', 'node.integration.'];
const uiKeys = ['settings.volumes.header', 'settings.volumes.about', 'summary.forFirst', 'ui.stats.expand', 'ui.stats.collapse', 'ui.stats.nodes', 'ui.stats.breakdown.heading'];
for (const [k, v] of strings) {
    if (uiPrefixes.some((p) => startsCaseless(k, p)) || inCaseless(k, uiKeys)) neededStrings.set(k, v);
}

// ---------------------------------------------------------------- tree + types
const present = (v) => v !== null && v !== undefined;
const typeOut = types.map((t) => {
    const o = { id: t.id ?? null, name: t.name ?? null, icon: t.icon ?? null, tier: truthy(t.tier) ? t.tier : 'SMALL' };
    // integrated: the effects (and effectText) an integrated node uses instead of its normal ones (app.js integratedOn).
    for (const k of ['effects', 'hullSizeEffects', 'options', 'tags', 'flavour', 'effectText', 'phantomHullMods', 'exclusiveHullMods',
        'exclusiveSkillTypes', 'vanillaHullMod', 'requiredHullSizes', 'itemCost', 'unlockConditions', 'todo', 'temporaryAfterDeploymentSeconds',
        'integrated']) {
        if (present(t[k])) o[k] = t[k];
    }
    return o;
});

const nodeOut = tree.nodes.map((n) => {
    const o = { id: n.id ?? null, type: n.type ?? null, x: n.x ?? null, y: n.y ?? null, c: asList(n.connectedTo) };
    for (const k of ['tags', 'pairedWith', 'ringBeltPath', 'ringBeltColor', 'ringBeltWidth', 'wormholeColor', 'orbitAnchorId', 'orbitAngle']) {
        if (present(n[k])) o[k] = n[k];
    }
    return o;
});

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const data = {
    generated: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    modVersion: null,
    modGit: undefined,   // set below when the mod checkout is a git repo
    nodes: nodeOut,
    curves: asList(tree.connectorCurves),
    hiddenConnectors: asList(tree.hiddenConnectors),
    anchors: asList(tree.orbitAnchors),
    decorations: asList(tree.decorations),
    types: typeOut,
    effects: Object.fromEntries(effectOut),
    affinitySteps,
    hullModNames: Object.fromEntries(hullModNames),
    hullModConflicts,
    logisticsCap,
    subroutines,
    subroutineModifiers: Object.fromEntries(subroutineModifiers),
    subroutineKinds,
    nodeRadii,
    wormholeAnchors,
    nodeRenames,
    typeRenames,
    retiredOptions,
    themes,
    optionalVolumes,
    statGroups,
    // Sorted, so a mod sync's diff only shows strings that really changed.
    strings: Object.fromEntries(sorted(neededStrings.keys()).map((k) => [k, neededStrings.get(k)])),
};
const modInfo = modPath('mod_info.json');
if (exists(modInfo)) {
    const infoText = readText(modInfo);
    const mv = /"version"\s*:\s*"([^"]+)"/.exec(infoText);
    const mo = /"version"\s*:\s*\{\s*"major"\s*:\s*(\d+)\s*,\s*"minor"\s*:\s*(\d+)\s*,\s*"patch"\s*:\s*(\d+)/.exec(infoText);
    if (mv) data.modVersion = mv[1];
    else if (mo) data.modVersion = `${mo[1]}.${mo[2]}.${mo[3]}`;
}
// Where the mod checkout stands in git, for the planner's footer: the nearest release tag and how many commits past it,
// the commit, the branch (none when detached, as update.mjs leaves a release) and uncommitted changes. mod_info.json
// keeps the last release's version on a branch like Dev, so this is what tells unreleased data apart.
if (existsSync(join(ModRoot, '.git'))) {
    const desc = git(ModRoot, ['describe', '--tags', '--long', '--dirty', '--always'], { allowFail: true });
    if (desc) {
        const dirty = desc.endsWith('-dirty');
        const d = dirty ? desc.slice(0, -'-dirty'.length) : desc;
        const m = /^(.+)-(\d+)-g([0-9a-f]+)$/.exec(d);
        const modGit = m ? { release: m[1], ahead: Number(m[2]), commit: m[3] } : { commit: d };
        const branch = git(ModRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
        if (branch && branch !== 'HEAD') modGit.branch = branch;
        if (dirty) modGit.dirty = true;
        data.modGit = modGit;
    }
}

const outFile = join(WebRoot, 'data', 'planner-data.js');
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `window.PLANNER_DATA = ${JSON.stringify(data)};\n`, 'utf8');
say(`Wrote data/planner-data.js (${Math.round(statSync(outFile).size / 1024).toLocaleString('en-US')} KB)`);

// ---------------------------------------------------------------- images
const images = new Set();
for (const t of types) if (truthy(t.icon)) images.add(t.icon);
for (const s of subroutines) if (truthy(s.icon)) images.add(s.icon);
for (const n of tree.nodes) if (truthy(n.ringBeltPath)) images.add(n.ringBeltPath);
for (const d of asList(tree.decorations)) {
    if (!d) continue;
    for (const k of ['imagePath', 'ringArtPath', 'overlayPath']) if (truthy(d[k])) images.add(d[k]);
}
for (const p of ['graphics/fx/star_halo.png', 'graphics/planets/aurorae.png']) images.add(p);

let found = 0;
const absent = [];
for (const rel of images) {
    if (existsCaseless(ModRoot, rel.replace(/\\/g, '/'))) found++;
    else absent.push(rel);
}
say(`Images: ${found} in the mod, ${absent.length} not in the mod (vanilla art; drawn as placeholders)`);
for (const a of sorted(absent)) say(`  ${a}`);
