// Runs inside the planner page for tools/text-baseline.mjs. Not part of the site.
//
// TEXT_BASELINE_PRELUDE runs before the page's own scripts: it records every toast and every text the canvas draws,
// and lets synthetic pointer events through setPointerCapture. TEXT_BASELINE_RUN then drives the planner through fixed
// scenarios with the test hooks (window.planner, plannerTemplatesTest, plannerArtTest) and DOM events, and returns
// [label, text] pairs: every piece of text the page shows in each state. TEXT_BASELINE_RUN_NOFILES does the same for
// the few places that differ in a browser without file access (Firefox, Safari), on a page loaded with ?nofiles.
// The scenarios use only the page's own data, so the same commit always gives the same output.

/* eslint-disable no-undef */
window.TEXT_BASELINE_PRELUDE = () => {
    window.__tb = { label: '', toasts: [], canvas: new Set() };
    // Toasts: toast() rewrites the element and unhides it; record each time it does, not on other page changes.
    const seen = { html: null, hidden: true };
    new MutationObserver((records) => {
        const t = document.getElementById('toast');
        if (!t || !records.some((r) => r.target === t || t.contains(r.target))) return;
        const html = t.innerHTML;
        if (!t.hidden && (seen.hidden || html !== seen.html || records.some((r) => r.type === 'childList' && r.target === t))) {
            window.__tb.toasts.push({ label: window.__tb.label, html });
        }
        seen.html = html; seen.hidden = t.hidden;
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    // Canvas text (region labels, placeholder initials, node labels).
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
        window.__tb.canvas.add(String(text));
        return fillText.call(this, text, ...rest);
    };
    // Synthetic pointer events have no active pointer to capture.
    Element.prototype.setPointerCapture = function () {};
    // Browsers without file access: the second pass removes the APIs before the page runs.
    if (/[?&]nofiles\b/.test(location.search)) {
        delete Window.prototype.showOpenFilePicker; delete Window.prototype.showDirectoryPicker;
        delete window.showOpenFilePicker; delete window.showDirectoryPicker; delete window.FileSystemObserver;
    }
};

// Helpers shared by both runs.
window.TEXT_BASELINE_KIT = () => {
    const P = window.planner;
    const out = [];
    const $ = (id) => document.getElementById(id);
    const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const settle = async () => { await tick(20); await frames(); await tick(0); };
    const clean = (s) => {
        const t = String(s ?? '');
        // Floating boxes are placed by pixel, and blob URLs change each run; neither is text.
        return t.replace(/ style="(?:left|top):[^"]*"/g, '').replace(/blob:[^"')\s]+/g, 'blob:…').replace(/></g, '>\n<');
    };
    const add = (label, text) => out.push([label, clean(text)]);
    const flushToasts = () => { for (const t of window.__tb.toasts.splice(0)) add(`toast · ${t.label}`, t.html); };
    // One step: label it, run it, wait for the page, and keep the toasts it raised.
    const step = async (label, fn, wait = 0) => {
        window.__tb.label = label;
        try { await fn(); } catch (e) { add(`error · ${label}`, String((e && e.stack) || e)); }
        if (wait) await tick(wait);
        await settle();
        flushToasts();
    };
    // An element's HTML, with what's typed or picked in its form fields (which the HTML alone doesn't show).
    const html = (id) => {
        const el = $(id);
        if (!el) return `(no #${id})`;
        const fields = [...(el.matches('input, select, textarea') ? [el] : []), ...el.querySelectorAll('input, select, textarea')]
            .filter((f) => f.type !== 'checkbox' ? f.value !== '' : true)
            .map((f) => `[${f.id || f.name || f.dataset.mix || f.dataset.tri || f.tagName.toLowerCase()} = ${f.type === 'checkbox' ? (f.checked ? 'checked' : 'unchecked') : JSON.stringify(f.value)}${f.disabled ? ', disabled' : ''}]`);
        return el.outerHTML + (fields.length ? `\n${fields.join('\n')}` : '');
    };
    const shot = (label, ...ids) => { for (const id of ids) add(`${label} · #${id}`, html(id)); };
    const click = (el) => {
        if (typeof el === 'string') el = $(el);
        if (!el) throw new Error('nothing to click');
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    };
    const change = (el, value) => {
        if (typeof el === 'string') el = $(el);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const tickBox = (el, on) => { if (typeof el === 'string') el = $(el); el.checked = on; el.dispatchEvent(new Event('change', { bubbles: true })); };
    const enter = (el) => { if (typeof el === 'string') el = $(el); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); };
    const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: o.code || '', bubbles: true, cancelable: true, ctrlKey: !!o.ctrl, shiftKey: !!o.shift }));
    // A stand-in templates file handle.
    const fakeFile = (name, text, perm = 'granted') => {
        const f = { name, kind: 'file', text, modified: 1000, perm };
        f.queryPermission = async () => f.perm;
        f.requestPermission = async () => f.perm;
        f.getFile = async () => ({ name, lastModified: f.modified, size: f.text.length, text: async () => f.text });
        f.createWritable = async () => { let buf = ''; return { write: async (s) => { buf += s; }, close: async () => { f.text = buf; f.modified++; } }; };
        return f;
    };
    // A stand-in folder handle; files maps paths to contents. Missing entries can be created when asked to.
    const fakeDir = (name, files = {}) => {
        const d = { kind: 'directory', name, children: new Map(), perm: 'granted' };
        d.queryPermission = async () => d.perm;
        d.requestPermission = async () => d.perm;
        d.getDirectoryHandle = async (n, o = {}) => {
            if (!d.children.has(n) && o.create) d.children.set(n, fakeDir(n));
            const c = d.children.get(n);
            if (!c || c.kind !== 'directory') throw new DOMException('not found', 'NotFoundError');
            return c;
        };
        d.getFileHandle = async (n, o = {}) => {
            if (!d.children.has(n) && o.create) d.children.set(n, fakeFile(n, ''));
            const c = d.children.get(n);
            if (!c || c.kind !== 'file') throw new DOMException('not found', 'NotFoundError');
            return c;
        };
        d.values = async function* values() { yield* d.children.values(); };
        for (const [path, content] of Object.entries(files)) {
            const parts = path.split('/');
            let cur = d;
            for (const p of parts.slice(0, -1)) {
                if (!cur.children.has(p)) cur.children.set(p, fakeDir(p));
                cur = cur.children.get(p);
            }
            const leaf = parts.at(-1);
            cur.children.set(leaf, { kind: 'file', name: leaf, getFile: async () => new File([content], leaf) });
        }
        return d;
    };
    return { P, D: window.PLANNER_DATA, out, $, tick, frames, settle, add, flushToasts, step, html, shot, click, change, tickBox, enter, key, fakeFile, fakeDir };
};

window.TEXT_BASELINE_RUN = async () => {
    const { P, D, out, $, tick, frames, add, flushToasts, step, shot, click, change, tickBox, enter, key, fakeFile, fakeDir } = window.TEXT_BASELINE_KIT();
    const byId = P.byId;
    const node = (id) => byId.get(id);
    const allIds = [...byId.keys()].sort();
    const tierOf = (id) => node(id).tier;
    const canvas = $('tree');

    // Pointer events as a mouse (or finger) sends them, aimed at a node by centring the camera on it.
    const at = (id, zoom = 1) => {
        const n = node(id);
        P.cam.x = n.x; P.cam.y = n.y; P.cam.zoom = zoom;
        const r = canvas.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const pointer = (type, p, o = {}) => canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: o.touch ? 7 : 1, pointerType: o.touch ? 'touch' : 'mouse', isPrimary: true,
        clientX: p.x, clientY: p.y, button: o.button ?? 0, buttons: o.button === 2 ? 2 : 1,
        ctrlKey: !!o.ctrl, shiftKey: !!o.shift, altKey: !!o.alt, metaKey: false,
    }));
    const clickNode = (id, o = {}) => { const p = at(id); pointer('pointerdown', p, o); pointer('pointerup', p, o); };
    const hoverNode = (id) => { const p = at(id); pointer('pointermove', p); };
    const inPicker = (sel) => $('picker').querySelector(sel);
    const canvasText = async (label) => {
        window.__tb.canvas.clear();
        window.dispatchEvent(new Event('resize'));
        await frames(); await frames();
        add(`${label} · canvas text`, [...window.__tb.canvas].sort().join('\n'));
    };

    // What the page shows.
    const tooltips = (label, ids = allIds) => add(`${label} · tooltips`, ids.map((id) => `--- ${id}\n${P.tooltipHtml(node(id))}`).join('\n'));
    // Every node's refusal, if any, under the current rules (the text tooltips, pickers and toasts use).
    const blocks = (label) => add(`${label} · node rules`, allIds.map((id) => {
        const n = node(id);
        const opts = n.type.options && n.type.options.length ? n.type.options : [null];
        return opts.map((o) => { const b = P.blockOf(id, o); return b ? `${id}${o ? '=' + o : ''}: ${b.text}` : ''; }).filter(Boolean).join('\n');
    }).filter(Boolean).join('\n'));
    const chrome = (label) => shot(label, 'topbar', 'help', 'banner');
    const panelTabs = async (label) => {
        for (const tab of ['stats', 'sheet', 'nodes', 'ship']) {
            await step(`${label} · tab ${tab}`, () => click(document.querySelector(`.panel-tabs [data-tab="${tab}"]`)));
            shot(`${label} · tab ${tab}`, 'panel');
        }
        await step(`${label} · back to Effects`, () => click(document.querySelector('.panel-tabs [data-tab="stats"]')));
    };
    const statSheet = async (label) => {
        await step(`${label} · full sheet`, () => P.toggleSheet(true));
        shot(`${label} · full sheet`, 'statsheet');
        const tips = [];
        for (const row of [...$('statsheet').querySelectorAll('#statsheet-body *')]) {
            row.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 }));
            if (!$('sheet-tip').hidden && $('sheet-tip').innerHTML) tips.push($('sheet-tip').innerHTML);
        }
        add(`${label} · full sheet · source tips`, [...new Set(tips)].join('\n---\n'));
        await step(`${label} · close sheet`, () => key('Escape'));
    };
    const listViews = async (label) => {
        await step(`${label} · list open`, () => click('btn-view'));
        for (const mode of ['all', 'build']) {
            await step(`${label} · list ${mode}`, () => click(document.querySelector(`#listview [data-mode="${mode}"]`)));
            for (const sort of ['name', 'order', 'tree']) {
                await step(`${label} · list ${mode} · sort ${sort}`, () => change('listview-sort', sort));
                shot(`${label} · list ${mode} · sort ${sort}`, 'listview', 'btn-view');
            }
            await step(`${label} · list ${mode} · collapse one`, () => { const g = document.querySelector('#listview [data-group]'); if (g) click(g); });
            shot(`${label} · list ${mode} · one collapsed`, 'listview');
            await step(`${label} · list ${mode} · collapse all`, () => click('lv-collapse-all'));
            shot(`${label} · list ${mode} · collapsed`, 'listview');
            await step(`${label} · list ${mode} · expand all`, () => click('lv-expand-all'));
        }
        await step(`${label} · list sort back`, () => change('listview-sort', 'name'));
        await step(`${label} · list mode back`, () => click(document.querySelector('#listview [data-mode="all"]')));
        await step(`${label} · list close`, () => click('btn-view'));
    };
    const everything = async (label) => {
        chrome(label);
        shot(label, 'panel');
        await panelTabs(label);
        tooltips(label);
        blocks(label);
        await statSheet(label);
        await listViews(label);
    };
    const reset = async (label) => step(`${label} · reset`, () => { if (P.state.root) click('btn-reset'); });

    // Data picked from the tree by fixed rules.
    const sockets = allIds.filter((id) => tierOf(id) === 'SOCKET');
    const exits = allIds.filter((id) => tierOf(id) === 'WORMHOLE_EXIT');
    const wormholes = allIds.filter((id) => tierOf(id) === 'WORMHOLE');
    const AFF = ['low_tech_affinity', 'midline_affinity', 'high_tech_affinity'];
    const isAffinity = (id) => (node(id).type.options || []).some((o) => AFF.includes(o));
    const isChoice = (id) => (node(id).type.options || []).length > 0;
    const core = (id) => node(id).volume === 'core';
    const optionalVolumes = new Set((D.optionalVolumes || []).flatMap((g) => g.volumes));
    // Nearest nodes of a kind from the current build, by path length then id.
    const reachable = (pred) => allIds.filter((id) => pred(id) && !P.state.alloc.has(id) && id !== P.state.root)
        .map((id) => ({ id, p: P.findPath(id) }))
        .filter((x) => x.p && x.p.path)
        .sort((a, b) => a.p.path.length - b.p.path.length || (a.id < b.id ? -1 : 1));
    const nearest = (pred, k) => reachable(pred).slice(0, k).map((x) => x.id);
    const farthest = (pred) => reachable(pred).at(-1)?.id;

    // ---------------------------------------------------------------- 0. fresh page, no root
    flushToasts();
    await step('fresh · load', () => {});
    add('page title', document.title);
    await everything('fresh');
    await canvasText('fresh · overview');
    await step('fresh · shortcuts open', () => key('?'));
    shot('fresh · shortcuts', 'keys');
    await step('fresh · shortcuts close', () => key('?'));
    await step('fresh · optional rules open', () => click('btn-story'));
    shot('fresh · optional rules', 'story');
    await step('fresh · optional rules close', () => click('story-close'));
    await step('fresh · templates open', () => click('btn-export'));
    shot('fresh · templates', 'export');
    await step('fresh · templates: copy code without a root', () => click('code-copy'));
    await step('fresh · templates: download without a root', () => click('tpl-new'));
    shot('fresh · templates after', 'export');
    await step('fresh · templates close', () => click('export-close'));
    await step('fresh · assets open', () => click('btn-art'));
    shot('fresh · assets', 'art', 'btn-art');
    await step('fresh · assets close', () => click('art-close'));
    for (let i = 0; i < 3; i++) {
        await step(`fresh · theme ${i}`, () => click('btn-theme'));
        shot(`fresh · theme ${i}`, 'btn-theme');
    }
    await step('fresh · copy code without a root', () => click('btn-code'));
    await step('fresh · target mode without a root', () => key('t'));
    shot('fresh · target mode', 'targets');
    await step('fresh · target mode off', () => key('t'));
    for (const q of ['armor', 'flux shunt', 'zzzz']) {
        await step(`fresh · search "${q}"`, () => change('search', q));
        shot(`fresh · search "${q}"`, 'panel', 'search-count');
    }
    await step('fresh · search tab', () => click('tab-search'));
    shot('fresh · search tab', 'panel');
    await step('fresh · filter open', () => click('btn-themes'));
    shot('fresh · filter', 'theme-filter', 'btn-themes');
    const tags = [...$('theme-filter').querySelectorAll('[data-theme-tag]')];
    await step('fresh · filter tick one', () => tickBox(tags[0], true));
    shot('fresh · filter one', 'panel', 'btn-themes');
    await step('fresh · filter tick two', () => tickBox(tags[1], true));
    shot('fresh · filter two', 'theme-filter', 'btn-themes', 'panel');
    await step('fresh · filter match all', () => change('theme-match', 'all'));
    shot('fresh · filter all', 'panel');
    await step('fresh · filter affinity', () => tickBox('filter-affinity', true));
    shot('fresh · filter affinity', 'panel', 'btn-themes');
    await step('fresh · list with search and filter', () => click('btn-view'));
    shot('fresh · list with search and filter', 'listview');
    await step('fresh · list tree sort', () => change('listview-sort', 'tree'));
    await step('fresh · list collapse all', () => click('lv-collapse-all'));
    shot('fresh · list collapsed with search', 'listview');
    await step('fresh · list expand all', () => click('lv-expand-all'));
    await step('fresh · list name sort', () => change('listview-sort', 'name'));
    await step('fresh · list close', () => click('btn-view'));
    // The search tab's heading with search text and themes: one theme, any of several, all of several.
    await step('fresh · search with one theme', () => { change('search', 'a'); click('theme-clear'); tickBox([...$('theme-filter').querySelectorAll('[data-theme-tag]')][0], true); click('tab-search'); });
    shot('fresh · search with one theme', 'panel');
    await step('fresh · search with two themes, any', () => { tickBox([...$('theme-filter').querySelectorAll('[data-theme-tag]')][1], true); change('theme-match', 'any'); });
    shot('fresh · search with two themes, any', 'panel');
    await step('fresh · search with two themes, all', () => change('theme-match', 'all'));
    shot('fresh · search with two themes, all', 'panel');
    await step('fresh · filter only, no match', () => { change('search', ''); tickBox('filter-affinity', false); for (const t of tags) tickBox(t, true); });
    shot('fresh · filter only', 'panel');
    await step('fresh · filter clear', () => click('theme-clear'));
    await step('fresh · filter affinity only', () => tickBox('filter-affinity', true));
    shot('fresh · filter affinity only', 'panel');
    await step('fresh · filter affinity off', () => tickBox('filter-affinity', false));
    await step('fresh · filter close', () => click('theme-close'));
    await step('fresh · search clear', () => change('search', ''));
    await step('fresh · click a wormhole', () => clickNode(wormholes[0]));
    shot('fresh · wormhole picker', 'picker');
    await step('fresh · close picker', () => key('Escape'));
    await step('fresh · hover a root', () => hoverNode('root_low_tech_1'));
    shot('fresh · hover a root', 'tooltip');

    // ---------------------------------------------------------------- 1. low tech root: sockets, subroutines, anchors
    await step('A · choose root', () => clickNode('root_low_tech_1'));
    await step('A · ctrl+click an affinity node before any pick', () => clickNode(nearest(isAffinity, 1)[0], { ctrl: true }));
    shot('A · first ctrl+click picker', 'picker');
    await step('A · close picker', () => key('Escape'));
    await step('A · cap 999', () => change('cap', '999'));
    for (const s of sockets.slice(0, -1)) await step(`A · allocate ${s}`, () => P.allocate(s));
    for (const w of wormholes) await step(`A · allocate ${w}`, () => P.allocate(w));
    // Anchor: the first socket links the first exit it may link, through the picker.
    await step('A · socket picker', () => clickNode(sockets[0]));
    shot('A · socket picker', 'picker');
    await step('A · socket picker: anchors', () => click(inPicker('[data-section="anchor"]')));
    shot('A · socket picker: anchors', 'picker');
    const linkable = [...$('picker').querySelectorAll('[data-exit]:not([disabled])')].map((b) => b.dataset.exit)
        .sort((a, b) => Number(optionalVolumes.has(node(b).volume)) - Number(optionalVolumes.has(node(a).volume)) || (a < b ? -1 : 1));
    const exitA = linkable[0];
    await step('A · link anchor', () => click(inPicker(`[data-exit="${exitA}"]`)));
    await step('A · socket picker again', () => clickNode(sockets[0]));
    await step('A · socket picker again: anchors', () => click(inPicker('[data-section="anchor"]')));
    shot('A · socket picker: linked', 'picker');
    await step('A · close picker', () => key('Escape'));
    for (const id of nearest((x) => node(x).volume === node(exitA).volume && tierOf(x) === 'NOTABLE', 2)) await step(`A · allocate ${id}`, () => P.allocate(id));
    // Subroutines in the other sockets, one of each kind, through the picker.
    const kinds = ['root_conduit', 'unique_empty_shell_axion', 'doctrine_archive_tritachyon', 'contraband_modspec_cache', 'unique_phoenix_ash_archive'];
    for (let i = 0; i < kinds.length && i + 1 < sockets.length; i++) {
        const s = sockets[i + 1];
        if (!P.state.alloc.has(s)) await step(`A · allocate ${s}`, () => P.allocate(s));
        await step(`A · ${s} picker`, () => clickNode(s));
        await step(`A · ${s} subroutines`, () => click(inPicker('[data-section="sub"]')));
        if (i === 0) shot(`A · ${s} subroutine list`, 'picker');
        await step(`A · socket ${kinds[i]}`, () => click(inPicker(`[data-sub="${kinds[i]}"]`)));
        shot(`A · ${s} with ${kinds[i]}`, 'picker');
        if (kinds[i] === 'root_conduit') {
            await step('A · conduit affinity', () => click(inPicker('[data-aff="HIGH_TECH_AFFINITY_FLAT"]')));
            shot('A · conduit affinity', 'picker');
        }
        if (kinds[i] === 'contraband_modspec_cache') {
            await step('A · cache: unknown notable', () => { $('grant-input').value = 'No such notable'; enter('grant-input'); });
            const opts = [...document.querySelectorAll('#grant-list option')].map((o) => o.value);
            await step(`A · cache: add ${opts[0]}`, () => { $('grant-input').value = opts[0]; enter('grant-input'); });
            shot('A · cache with a grant', 'picker');
        }
        await step(`A · ${s} close`, () => key('Escape'));
    }
    await step('A · subroutine over its limit', () => P.socketSub(sockets[sockets.length - 1], 'doctrine_archive_hegemony'));
    for (const id of nearest((x) => tierOf(x) === 'KEYSTONE' && core(x), 4)) await step(`A · allocate ${id}`, () => P.allocate(id));
    for (const id of nearest((x) => tierOf(x) === 'NOTABLE' && core(x) && !isChoice(x), 6)) await step(`A · allocate ${id}`, () => P.allocate(id));
    // Cache grants in every state: active, already allocated, in a hidden volume, and refused by a rule.
    const cacheSocket = sockets[4];
    const allocatedNotable = [...P.state.alloc].filter((id) => tierOf(id) === 'NOTABLE').sort()[0];
    const hiddenNotable = allIds.find((id) => tierOf(id) === 'NOTABLE' && optionalVolumes.has(node(id).volume) && node(id).volume !== node(exitA).volume);
    await step('A · cache grants', () => P.setGrants(cacheSocket, [P.state.subs.get(cacheSocket)?.grants?.[0], allocatedNotable, hiddenNotable].filter(Boolean)));
    await step('A · hide the grant\'s volume', () => P.setVolumeShown((D.optionalVolumes || []).find((g) => g.volumes.includes(node(hiddenNotable).volume)).id, false));
    await step('A · cache picker', () => { clickNode(cacheSocket); click(inPicker('[data-section="sub"]')); });
    shot('A · cache grant states', 'picker');
    await step('A · close picker', () => key('Escape'));
    await step('A · show the volume again', () => P.setVolumeShown((D.optionalVolumes || []).find((g) => g.volumes.includes(node(hiddenNotable).volume)).id, true));
    // A second cache granting the same notable (if the limit allows it), then the Phoenix archive back in its socket.
    const phoenixSocket = sockets[5];
    await step('A · second cache', () => { P.socketSub(phoenixSocket, 'contraband_modspec_cache'); P.setGrants(phoenixSocket, (P.state.subs.get(cacheSocket)?.grants || []).slice(0, 1)); });
    await step('A · second cache picker', () => { clickNode(phoenixSocket); click(inPicker('[data-section="sub"]')); });
    shot('A · second cache', 'picker');
    await step('A · close picker', () => key('Escape'));
    await step('A · phoenix back', () => P.socketSub(phoenixSocket, 'unique_phoenix_ash_archive'));
    // Affinity nodes with each option, then a few integrated.
    const affs = nearest(isAffinity, 3);
    for (let i = 0; i < affs.length; i++) {
        await step(`A · affinity picker ${affs[i]}`, () => clickNode(affs[i]));
        if (i === 0) shot('A · affinity picker', 'picker');
        await step(`A · affinity option ${AFF[i]}`, () => click(inPicker(`[data-opt="${AFF[i]}"]`)));
    }
    await step('A · allocated affinity picker', () => clickNode(affs[0]));
    shot('A · allocated affinity picker', 'picker');
    await step('A · close picker', () => key('Escape'));
    await step('A · ctrl+click affinity', () => clickNode(nearest(isAffinity, 1)[0], { ctrl: true }));
    await step('A · ctrl+click an allocated affinity node', () => clickNode(affs[1], { ctrl: true }));
    // Not a node the cache grants: removed from the path, the cache would still hold it.
    const grants = new Set(P.state.subs.get(cacheSocket)?.grants || []);
    const integ = [...P.state.alloc].filter((id) => ['NOTABLE', 'KEYSTONE'].includes(tierOf(id)) && !grants.has(id)).sort().slice(0, 3);
    for (const id of integ) await step(`A · integrate ${id}`, () => clickNode(id, { alt: true }));
    await step('A · integrate a node that can\'t', () => P.toggleIntegration(sockets[0]));
    await step('A · integrate an unallocated node', () => P.toggleIntegration(nearest((x) => tierOf(x) === 'NOTABLE', 1)[0]));
    await everything('A');
    await step('A · integrated view: columns', () => change('integ-view', 'columns'));
    tooltips('A · columns', [...P.state.alloc].sort());
    await step('A · integration preview', () => tickBox('integ-preview', true));
    shot('A · integration preview', 'panel');
    tooltips('A · columns · preview', [...P.state.alloc].sort());
    await statSheet('A · preview');
    await step('A · integration preview off', () => tickBox('integ-preview', false));
    await step('A · integrated view: inline', () => change('integ-view', 'inline'));
    await step('A · integrate all', () => click('integ-all'));
    shot('A · integrate all', 'integ');
    await step('A · templates summary with marks', () => click('btn-export'));
    shot('A · templates summary with marks', 'tpl-summary', 'tpl-name');
    await step('A · templates close', () => click('export-close'));
    await step('A · keep when removed', () => tickBox('integ-keep', true));
    await step('A · remove an integrated node', () => clickNode(integ[0], { button: 2 }));
    shot('A · kept integration', 'integ', 'panel');
    tooltips('A · kept integration', [integ[0]]);
    await step('A · keep when removed off', () => tickBox('integ-keep', false));
    await step('A · remove all integrations', () => click('integ-none'));
    await step('A · affinity all to mid', () => click(document.querySelector('[data-all="midline_affinity"]')));
    await step('A · affinity mix', () => { const ins = document.querySelectorAll('[data-mix]'); ins[0].value = '5'; ins[0].dispatchEvent(new Event('input', { bubbles: true })); });
    shot('A · affinity mix', 'aff-mix');
    await step('A · affinity apply', () => click('aff-apply'));
    // Pickers on the map: wormhole, exit, root, the other sockets' anchors.
    await step('A · wormhole picker', () => clickNode(wormholes[0]));
    shot('A · wormhole picker', 'picker');
    await step('A · wormhole jump', () => click(inPicker('[data-act="jump"]')));
    await step('A · exit picker', () => clickNode(exitA));
    shot('A · exit picker', 'picker');
    await step('A · close picker', () => key('Escape'));
    await step('A · other socket anchors', () => { clickNode(sockets[1]); click(inPicker('[data-section="anchor"]')); });
    shot('A · other socket anchors', 'picker');
    await step('A · close picker', () => key('Escape'));
    await step('A · root right-click', () => clickNode('root_low_tech_1', { button: 2 }));
    shot('A · root picker', 'picker');
    await step('A · root picker cancel', () => click(inPicker('[data-act="cancel"]')));
    await step('A · ctrl+click a wormhole', () => clickNode(wormholes[0], { ctrl: true }));
    await step('A · click an exit without an anchor', () => clickNode(exits.find((e) => e !== exitA)));
    await canvasText('A · close');
    P.cam.zoom = 0.05;
    await canvasText('A · overview');
    await step('A · hide the anchored volume', () => P.setVolumeShown((D.optionalVolumes || []).find((g) => g.volumes.includes(node(exitA).volume))?.id, false));
    await step('A · undo the hiding', () => key('z', { ctrl: true }));
    shot('A · undo button', 'btn-undo');
    await step('A · copy code', () => click('btn-code'));
    const buildA = P.serialize();
    // Linking an anchor at the cap.
    await step('A · unlink anchor', () => { clickNode(sockets[0]); click(inPicker('[data-section="anchor"]')); click(inPicker('[data-act="unlink"]')); });
    await step('A · cap at used', () => change('cap', String(P.state.alloc.size + 1)));
    await step('A · link at the cap', () => { clickNode(sockets[0]); click(inPicker('[data-section="anchor"]')); click(inPicker(`[data-exit="${exitA}"]`)); });
    await step('A · close picker', () => key('Escape'));
    await step('A · allocate over the cap', () => clickNode(farthest((x) => tierOf(x) === 'NOTABLE')));

    // ---------------------------------------------------------------- 2. midline: ship rules, optional rules, problems
    await reset('B');
    await step('B · choose root', () => clickNode('root_midline_1'));
    await step('B · cap 999', () => change('cap', '999'));
    for (const id of nearest((x) => tierOf(x) === 'KEYSTONE', 6)) await step(`B · allocate ${id}`, () => P.allocate(id));
    for (const id of nearest((x) => tierOf(x) === 'NOTABLE' && !isChoice(x), 12)) await step(`B · allocate ${id}`, () => P.allocate(id));
    await step('B · allocate an empty socket', () => P.allocate(nearest((x) => tierOf(x) === 'SOCKET', 1)[0]));
    await step('B · close picker', () => key('Escape'));
    tooltips('B · empty socket', [...P.state.alloc].filter((id) => tierOf(id) === 'SOCKET'));
    await step('B · ship tab', () => click('btn-ship'));
    shot('B · ship tab empty', 'panel-ship');
    for (const v of ['FRONT', 'OMNI', 'NONE', 'PHASE']) {
        await step(`B · shield ${v}`, () => change('ship-shield', v));
        shot(`B · shield ${v}`, 'panel-ship');
        blocks(`B · shield ${v}`);
    }
    await step('B · shield FRONT again', () => change('ship-shield', 'FRONT'));
    await step('B · armor 2000', () => change('ship-armor', '2000'));
    blocks('B · armor 2000');
    await step('B · armor 100', () => change('ship-armor', '100'));
    for (const sel of document.querySelectorAll('#panel-ship select[data-tri]')) {
        await step(`B · ${sel.dataset.tri} yes`, () => change(sel, '1'));
        blocks(`B · ${sel.dataset.tri} yes`);
        await step(`B · ${sel.dataset.tri} no`, () => change(sel, '0'));
        blocks(`B · ${sel.dataset.tri} no`);
    }
    await step('B · hullmod unknown', () => { $('ship-mod-input').value = 'Not a hullmod'; enter('ship-mod-input'); });
    shot('B · hullmod unknown', 'ship-mod-status');
    const mods = [...document.querySelectorAll('#ship-mod-list option')].map((o) => o.value);
    for (const m of mods.slice(0, 3)) await step(`B · hullmod ${m}`, () => { $('ship-mod-input').value = m; enter('ship-mod-input'); });
    await step('B · logistics 0', () => change('ship-logistics', '0'));
    shot('B · ship tab set', 'panel-ship', 'panel');
    for (const h of ['frigate', 'destroyer', 'capitalShip', 'cruiser']) {
        await step(`B · hull ${h}`, () => change('hull', h));
        shot(`B · hull ${h}`, 'panel-ship');
        blocks(`B · hull ${h}`);
    }
    await step('B · hull frigate', () => change('hull', 'frigate'));
    await everything('B');
    // Optional rules: untick every gate and unlock, hide each volume.
    await step('B · optional rules open', () => click('btn-story'));
    await step('B · untick gates', () => click('story-gate-none'));
    await step('B · untick unlocks', () => click('story-unlock-none'));
    for (const cb of document.querySelectorAll('#story-volumes [data-volgroup]')) await step(`B · hide ${cb.dataset.volgroup}`, () => tickBox(cb, false));
    for (const cb of document.querySelectorAll('#story-other [data-type]')) await step(`B · lock ${cb.dataset.type}`, () => tickBox(cb, false));
    for (const v of ['ADDITIVE', 'STATIC', 'EXPONENTIAL']) await step(`B · integration cost ${v}`, () => change('story-integ-cost', v));
    shot('B · optional rules set', 'story');
    await step('B · optional rules close', () => key('Escape'));
    tooltips('B · locked');
    blocks('B · locked');
    await listViews('B · locked');
    shot('B · locked', 'panel', 'topbar');
    await step('B · ship tab problems', () => click(document.querySelector('.panel-tabs [data-tab="ship"]')));
    shot('B · ship tab problems', 'panel-ship');
    await step('B · wormhole picker while locked', () => clickNode(wormholes[0]));
    shot('B · wormhole picker while locked', 'picker');
    await step('B · close picker', () => key('Escape'));
    await step('B · socket anchors while hidden', () => { const s = [...P.state.alloc].find((id) => tierOf(id) === 'SOCKET'); clickNode(s); click(inPicker('[data-section="anchor"]')); });
    shot('B · socket anchors while hidden', 'picker');
    await step('B · close picker', () => key('Escape'));
    await step('B · click a hidden node', () => clickNode(allIds.find((x) => optionalVolumes.has(node(x).volume) && tierOf(x) === 'NOTABLE')));
    await step('B · click a refused node', () => { const id = allIds.find((x) => !P.state.alloc.has(x) && P.blockOf(x) && !optionalVolumes.has(node(x).volume) && !isChoice(x)); if (id) clickNode(id); });
    await step('B · optional rules open again', () => click('btn-story'));
    await step('B · tick all', () => { click('story-gate-all'); click('story-unlock-all'); });
    for (const cb of document.querySelectorAll('#story-volumes [data-volgroup]')) await step(`B · show ${cb.dataset.volgroup}`, () => tickBox(cb, true));
    await step('B · reset optional rules', () => click('story-clear'));
    shot('B · optional rules reset', 'story');
    await step('B · optional rules close', () => click('story-close'));
    await step('B · reset ship rules', () => click('ship-clear'));
    // A hull mod no node clashes with (only through a saved build).
    await step('B · unrelated hullmod', () => { const o = JSON.parse(P.serialize()); o.ship = { ...(o.ship || {}), hm: ['no_such_hullmod'] }; P.load(JSON.stringify(o)); });
    shot('B · unrelated hullmod', 'ship-mods');
    await step('B · reset ship rules again', () => click('ship-clear'));
    const buildB = P.serialize();

    // ---------------------------------------------------------------- 3. high tech: cap, waypoints, target mode
    await reset('C');
    await step('C · choose root', () => P.chooseRoot('root_high_tech_1'));
    await step('C · cap 8', () => change('cap', '8'));
    await step('C · click over the cap', () => clickNode(farthest((x) => tierOf(x) === 'KEYSTONE')));
    tooltips('C · cap 8');
    await step('C · cap 60', () => change('cap', '60'));
    const wp = nearest((x) => tierOf(x) === 'NOTABLE', 2);
    await step('C · waypoint on the root', () => clickNode('root_high_tech_1', { shift: true }));
    for (const id of wp) await step(`C · waypoint ${id}`, () => clickNode(id, { shift: true }));
    chrome('C · waypoints');
    tooltips('C · waypoints');
    await step('C · wormhole picker with waypoints', () => clickNode(wormholes[0]));
    shot('C · wormhole picker with waypoints', 'picker');
    await step('C · close picker', () => key('Escape'));
    await step('C · waypoint behind a refusal', () => { const id = allIds.find((x) => P.blockOf(x) && !isChoice(x)); if (id) P.toggleWaypoint(id); });
    tooltips('C · waypoint behind a refusal', nearest((x) => tierOf(x) === 'KEYSTONE', 6));
    await step('C · drop a waypoint', () => clickNode(wp[0], { shift: true }));
    await step('C · clear waypoints', () => key('Escape'));
    const far = nearest((x) => tierOf(x) === 'KEYSTONE', 3);
    await step('C · allocate through the click', () => clickNode(far[0]));
    await step('C · remove a node', () => clickNode(far[0], { button: 2 }));
    // Target mode.
    await step('C · target mode', () => key('t'));
    shot('C · target mode', 'targets');
    const want = nearest((x) => tierOf(x) === 'KEYSTONE', 5);
    await step('C · target the root', () => clickNode('root_high_tech_1'));
    for (const id of want.slice(0, 3)) await step(`C · want ${id}`, () => clickNode(id));
    shot('C · targets wanted', 'targets');
    await step('C · forbid one', () => { clickNode(want[3]); clickNode(want[3]); });
    shot('C · targets forbid', 'targets');
    tooltips('C · targets', [...want, ...nearest((x) => tierOf(x) === 'NOTABLE', 10)]);
    await step('C · list in target mode', () => click('btn-view'));
    shot('C · list in target mode', 'listview');
    await step('C · list mark', () => click(document.querySelector('#listview [data-mark="want"]')));
    await step('C · list close', () => click('btn-view'));
    await step('C · keep current build off', () => tickBox('targets-keep', false));
    shot('C · targets fresh', 'targets');
    await step('C · keep current build on', () => tickBox('targets-keep', true));
    await step('C · cap 5', () => change('cap', '5'));
    shot('C · targets over cap', 'targets');
    await step('C · cap 60 again', () => change('cap', '60'));
    await step('C · want many', () => { for (const id of nearest((x) => tierOf(x) === 'NOTABLE', 12)) P.cycleTarget(id); });
    shot('C · targets many', 'targets');
    await step('C · want an exit', () => P.cycleTarget(exits[2]));
    shot('C · targets exit', 'targets');
    await step('C · clear marks', () => click('targets-clear'));
    // Plans that can't work: a refused node, two that clash, a node walled in by forbidden neighbours.
    await step('C · ship rules for refusals', () => { change('ship-shield', 'NONE'); change('hull', 'frigate'); });
    const refusedIds = allIds.filter((x) => core(x) && !isChoice(x) && P.blockOf(x));
    await step('C · want a refused node', () => P.cycleTarget(refusedIds[0]));
    shot('C · targets refused', 'targets');
    await step('C · clear marks', () => click('targets-clear'));
    const clash = (() => {
        const ids = allIds.filter((x) => core(x) && ['NOTABLE', 'KEYSTONE'].includes(tierOf(x)) && !isChoice(x));
        for (const a of ids) for (const b of ids) if (a < b && P.typesExclusive(node(a).type.id, node(b).type.id)) return [a, b];
        return null;
    })();
    if (clash) {
        await step('C · want two that clash', () => { P.cycleTarget(clash[0]); P.cycleTarget(clash[1]); });
        shot('C · targets clash', 'targets');
        await step('C · clear marks', () => click('targets-clear'));
    }
    const walled = nearest((x) => tierOf(x) === 'KEYSTONE', 1)[0];
    await step('C · want a walled-in node', () => { P.cycleTarget(walled); for (const m of node(walled).adj) { P.cycleTarget(m.id); P.cycleTarget(m.id); } });
    shot('C · targets walled in', 'targets');
    await step('C · clear marks', () => click('targets-clear'));
    await step('C · ship rules back', () => { click('ship-clear'); change('hull', 'cruiser'); });
    // Two nodes that clash, with no ship rule in the way: the replay refuses the second.
    const clash2 = (() => {
        const ids = allIds.filter((x) => core(x) && ['NOTABLE', 'KEYSTONE'].includes(tierOf(x)) && !isChoice(x) && !P.blockOf(x));
        for (const a of ids) for (const b of ids) if (a < b && P.typesExclusive(node(a).type.id, node(b).type.id)) return [a, b];
        return null;
    })();
    if (clash2) {
        await step('C · want two that clash, no ship rules', () => { P.cycleTarget(clash2[0]); P.cycleTarget(clash2[1]); });
        shot('C · targets clash in the replay', 'targets');
        await step('C · clear marks', () => click('targets-clear'));
    }
    // A wormhole whose partner is forbidden.
    await step('C · want a wormhole, forbid its partner', () => { P.cycleTarget(wormholes[0]); const p = node(wormholes[0]).pairedWith; P.cycleTarget(p); P.cycleTarget(p); });
    shot('C · targets partner forbidden', 'targets');
    await step('C · clear marks', () => click('targets-clear'));
    // A far node with every neighbour forbidden.
    const lone = farthest((x) => tierOf(x) === 'KEYSTONE' && core(x));
    await step('C · want a node with forbidden neighbours', () => { P.cycleTarget(lone); for (const m of node(lone).adj) { P.cycleTarget(m.id); P.cycleTarget(m.id); } });
    shot('C · targets no way', 'targets');
    await step('C · clear marks', () => click('targets-clear'));
    // Over the cap.
    await step('C · cap 5 then want', () => { change('cap', '5'); for (const id of want.slice(0, 3)) P.cycleTarget(id); });
    shot('C · targets over the cap', 'targets');
    await step('C · clear marks, cap back', () => { click('targets-clear'); change('cap', '60'); });
    // A plan, applied; applying again; the same plan without keeping the build (nothing to change); then one that removes.
    await step('C · reset build for plans', () => { click('btn-reset'); P.chooseRoot('root_high_tech_1'); if (!P.targets.mode) key('t'); });
    await step('C · want two', () => { for (const id of want.slice(0, 2)) P.cycleTarget(id); });
    tooltips('C · targets with a plan', ['root_high_tech_1', ...(P.plan().add || []), ...want, wormholes[0]]);
    await step('C · allocate plan', () => click('targets-apply'));
    shot('C · targets done', 'targets');
    await step('C · target mode on again', () => { if (!P.targets.mode) key('t'); });
    await step('C · allocate again', () => click('targets-apply'));
    await step('C · same plan, keep off', () => tickBox('targets-keep', false));
    await step('C · allocate the same plan', () => click('targets-apply'));
    await step('C · target mode on again', () => { if (!P.targets.mode) key('t'); });
    await step('C · an extra node, keep off', () => { P.allocate(nearest((x) => tierOf(x) === 'SMALL', 1)[0]); });
    shot('C · plan that removes', 'targets');
    await step('C · allocate the plan that removes', () => click('targets-apply'));
    await step('C · target mode on, keep on', () => { if (!P.targets.mode) key('t'); tickBox('targets-keep', true); });
    await step('C · right-click a mark', () => clickNode(want[0], { button: 2 }));
    await step('C · forbid two allocated nodes', () => { for (const id of [...P.state.alloc].sort().slice(0, 2)) { P.cycleTarget(id); P.cycleTarget(id); } });
    shot('C · forbid allocated', 'targets');
    tooltips('C · forbid allocated', [...P.state.alloc].sort().slice(0, 3));
    await step('C · a wanted and a forbidden mark off the build', () => { const [a, b] = nearest((x) => tierOf(x) === 'NOTABLE', 2); P.cycleTarget(a); P.cycleTarget(b); P.cycleTarget(b); });
    await step('C · target mode off', () => click('targets-done'));
    await step('C · list with marks', () => click('btn-view'));
    shot('C · list with marks', 'listview');
    await step('C · list close', () => click('btn-view'));
    await step('C · clear marks for good', () => { key('t'); click('targets-clear'); key('t'); });
    // Touch taps.
    await step('C · touch tap', () => { const p = at(want[2]); pointer('pointerdown', p, { touch: true }); pointer('pointerup', p, { touch: true }); });
    shot('C · touch tooltip', 'tooltip');
    await step('C · touch root twice', () => { for (let i = 0; i < 2; i++) { const p = at('root_high_tech_1'); pointer('pointerdown', p, { touch: true }); pointer('pointerup', p, { touch: true }); } });
    shot('C · touch root picker', 'picker');
    await step('C · touch reset', () => click(inPicker('[data-act="reset"]')));
    await step('C · undo reset', () => key('z', { ctrl: true }));
    await step('C · key s', () => key('s'));
    shot('C · panel hidden', 'panel', 'btn-panel');
    await step('C · key s again', () => key('s'));
    await step('C · key l', () => key('l'));
    await step('C · key l again', () => key('l'));
    await step('C · key i on hover', () => { hoverNode([...P.state.alloc].find((id) => tierOf(id) === 'KEYSTONE') || far[0]); key('i'); });
    // A lone augmenting doctrine: its radius notes.
    await reset('D');
    await step('D · choose root', () => P.chooseRoot('root_low_tech_1'));
    await step('D · cap 999', () => change('cap', '999'));
    await step('D · allocate a socket', () => P.allocate(sockets[2]));
    await step('D · augmenting doctrine', () => P.socketSub(sockets[2], 'doctrine_archive_hegemony'));
    // The first 12 nodes (by id) in the doctrine's radius, from the planner's own state, not from tooltip wording.
    tooltips('D · augment', [...(P.subState().doctrine?.nodes || [])].sort().slice(0, 12));

    // ---------------------------------------------------------------- 4. templates: a stand-in templates file
    await step('T · load build A', () => P.load(buildA));
    const tA = P.buildTemplate('Alpha plan');
    await step('T · load build B', () => P.load(buildB));
    const tB = P.buildTemplate('Bravo plan');
    const file = {
        v: 1, templates: [
            tA, tB,
            { ...tA, id: 'tpl-hull', name: 'Alpha frigate', hull: 'FRIGATE' },
            { ...tA, id: 'tpl-nohull', name: 'No hull', hull: undefined },
            { v: 1, id: 'tpl-unknown-root', name: 'Lost root', root: 'root_nowhere', hull: 'CRUISER', steps: [] },
            { v: 1, id: 'tpl-bad', name: 'Café plan', root: 'root_low_tech_1', hull: 'CRUISER', steps: ['no_such_node', 'another_missing', ...tA.steps.slice(-3)], integrate: ['no_such_node', tA.steps[0]] },
            { ...tB, id: 'tpl-ref', name: 'Refused steps', hull: 'FRIGATE' },
            { ...tA, id: 'tpl-marks', name: 'Marked', integrate: [...tA.steps.filter((s) => !s.includes('=') && ['NOTABLE', 'KEYSTONE'].includes(node(s)?.tier)).slice(0, 2), ...tA.steps.filter((s) => !s.includes('=') && node(s)?.tier === 'SMALL').slice(0, 1)] },
            { v: 1, id: 'tpl-one', name: 'One step', root: 'root_high_tech_1', hull: 'CAPITAL_SHIP', steps: [] },
        ],
    };
    const fh = fakeFile('exiledSector_skillTreeTemplates.json.data', JSON.stringify(file));
    await step('T · templates open', () => click('btn-export'));
    shot('T · templates unlinked', 'export');
    await step('T · hide a volume the templates use', () => P.setVolumeShown((D.optionalVolumes || []).find((g) => g.volumes.includes(node(exitA).volume)).id, false));
    await step('T · link', () => window.plannerTemplatesTest.link(fh), 50);
    await step('T · reopen', () => { click('export-close'); click('btn-export'); }, 50);
    shot('T · linked', 'export', 'topbar');
    const loads = [...$('tf-list').querySelectorAll('[data-load]')].map((b) => b.dataset.load);
    for (const i of loads) {
        await step(`T · load template ${i}`, () => click($('tf-list').querySelector(`[data-load="${i}"]`)));
        shot(`T · load template ${i}`, 'tpl-status', 'tpl-summary', 'tf-list', 'topbar');
        await step(`T · cap 10 for template ${i}`, () => { if (i === loads[0]) { change('cap', '10'); click($('tf-list').querySelector(`[data-load="${i}"]`)); } });
        if (i === loads[0]) { shot('T · load over the cap', 'tpl-status'); await step('T · cap back', () => change('cap', '60')); }
    }
    await step('T · copy a template code', () => click($('tf-list').querySelector('[data-code]')), 50);
    shot('T · template code', 'code-status');
    // Names: empty, too long, characters the game can't show, and the existing ones.
    for (const name of ['', 'x'.repeat(40), 'Badénameÿþýüûú', 'Alpha plan', 'Alpha frigate', 'No hull']) {
        const lbl = name.slice(0, 12);
        await step(`T · name "${lbl}"`, () => { $('tpl-name').value = name; click('tpl-save'); }, 50);
        shot(`T · save "${lbl}"`, 'tpl-summary', 'tpl-conflict', 'tpl-status', 'tf-list');
        if (!$('tpl-conflict').hidden) {
            await step(`T · "${lbl}" save as an existing name`, () => { $('tpl-newname').value = name; click('tpl-asnew'); }, 50);
            shot(`T · "${lbl}" save as an existing name`, 'tpl-status');
            await step(`T · "${lbl}" cancel`, () => click('tpl-cancel'));
            shot(`T · "${lbl}" cancel`, 'tpl-status');
        }
    }
    await step('T · typed name with bad characters', () => change('tpl-name', 'Naïve'));
    shot('T · typed name with bad characters', 'tpl-status', 'tpl-name');
    await step('T · load Alpha', () => click($('tf-list').querySelector('[data-load="0"]')));
    await step('T · hull destroyer', () => change('hull', 'destroyer'));
    await step('T · save Alpha on another hull', () => { $('tpl-name').value = 'Alpha plan'; click('tpl-save'); }, 50);
    shot('T · hull question', 'tpl-conflict', 'tpl-summary');
    await step('T · change hull', () => click('tpl-change'), 50);
    shot('T · changed hull', 'tpl-status', 'tf-list');
    await step('T · save new', () => { $('tpl-name').value = 'Fresh one'; click('tpl-save'); }, 50);
    shot('T · saved new', 'tpl-status', 'topbar');
    await step('T · save over with override', () => { $('tpl-name').value = 'Fresh one'; click('tpl-save'); }, 50);
    shot('T · override question', 'tpl-conflict');
    await step('T · override', () => click('tpl-keep'), 50);
    shot('T · overridden', 'tpl-status');
    await step('T · save again', () => click('tpl-save'), 50);
    await step('T · as new', () => { $('tpl-newname').value = 'Fresh two'; click('tpl-asnew'); }, 50);
    shot('T · as new', 'tpl-status', 'tpl-name');
    await step('T · download', () => { $('tpl-name').value = 'Download me'; click('tpl-new'); });
    shot('T · download', 'tpl-status');
    // Codes.
    await step('T · code for build', () => click('code-copy'), 50);
    shot('T · code for build', 'code-status');
    const goodCode = $('code-box').value;
    await step('T · code bad name', () => { $('tpl-name').value = ''; click('code-copy'); }, 50);
    shot('T · code bad name', 'code-status');
    const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const { id: _id, ...tOld } = tA;
    void _id;
    const oldCode = `ES0.${b64(JSON.stringify({ ...tOld, name: 'Old code', mod: '0.0.1' }))}`;
    for (const [label, code] of [['empty', ''], ['junk', 'hello'], ['too long', `ES1.${'A'.repeat(200001)}`], ['ES1 junk', 'ES1.@@@'], ['ES1 not deflate', 'ES1.aGVsbG8'], ['ES0 junk', 'ES0.e30'], ['ES0 not json', 'ES0.aGVsbG8'], ['ES0 old mod', oldCode], ['good', goodCode]]) {
        await step(`T · load code ${label}`, () => { change('code-box', code); click('code-load'); }, 50);
        shot(`T · load code ${label}`, 'code-status');
    }
    // The clipboard refused: the toast offers the code to copy by hand.
    const writeText = navigator.clipboard.writeText;
    await step('T · clipboard blocked: copy code', () => { navigator.clipboard.writeText = () => Promise.reject(new Error('blocked')); $('tpl-name').value = 'Blocked'; click('code-copy'); }, 50);
    shot('T · clipboard blocked', 'code-status');
    await step('T · clipboard blocked: top bar', () => click('btn-code'), 50);
    navigator.clipboard.writeText = writeText;
    // Link templates file… with the picker cancelled.
    await step('T · link cancelled', () => { window.showOpenFilePicker = async () => { throw new DOMException('cancelled', 'AbortError'); }; click('tf-link'); }, 50);
    // Watching and the outside-change notice.
    for (const m of ['poll', 'off', 'observe']) {
        await step(`T · watch ${m}`, () => change('tf-watch-mode', m), 50);
        shot(`T · watch ${m}`, 'tf-watch-row');
    }
    await step('T · load Alpha for notice', () => click($('tf-list').querySelector('[data-load="0"]')));
    await step('T · close templates', () => click('export-close'));
    const edit = (fn) => { const o = JSON.parse(fh.text); fn(o.templates); fh.text = JSON.stringify(o); fh.modified += 10; };
    await step('T · check file, no change', () => click('btn-checkfile'), 50);
    await step('T · rewrite same', () => { fh.text = JSON.stringify(JSON.parse(fh.text), null, 1); fh.modified += 10; click('btn-checkfile'); }, 50);
    await step('T · edit the build', () => P.allocate(nearest((x) => tierOf(x) === 'SMALL', 1)[0]));
    await step('T · outside change', () => {
        edit((ts) => {
            const a = ts.find((t) => t.name === 'Alpha plan');
            a.steps = a.steps.slice(0, -1);
            ts.push(...['A', 'B', 'C', 'D'].map((k) => ({ ...tB, id: `new-${k}`, name: `Added ${k}` })));
            ts.splice(ts.findIndex((t) => t.name === 'Bravo plan'), 1);
        });
        click('btn-checkfile');
    }, 50);
    shot('T · notice', 'file-notice');
    await step('T · notice keep', () => click('fn-dismiss'));
    await step('T · outside change again', () => { edit((ts) => { const a = ts.find((t) => t.name === 'Alpha plan'); a.steps = a.steps.slice(0, -1); }); click('btn-checkfile'); }, 50);
    shot('T · notice again', 'file-notice');
    await step('T · notice load', () => click('fn-load'));
    await step('T · outside removal', () => { edit((ts) => { ts.splice(ts.findIndex((t) => t.name === 'Alpha plan'), 1); }); click('btn-checkfile'); }, 50);
    shot('T · notice removed', 'file-notice');
    await step('T · notice open', () => click('fn-open'), 50);
    shot('T · notice open', 'export');
    await step('T · forget', () => click('tf-forget'), 50);
    shot('T · forgotten', 'export', 'topbar');
    await step('T · close templates', () => click('export-close'));
    await step('T · check file unlinked', () => click('btn-checkfile'), 50);
    // A file that needs permission: refused, then allowed.
    const ph = fakeFile('prompt.json.data', JSON.stringify(file), 'prompt');
    await step('T · link needing permission', () => window.plannerTemplatesTest.link(ph), 50);
    await step('T · templates open', () => click('btn-export'), 50);
    shot('T · needs permission', 'export', 'topbar');
    await step('T · reconnect refused', () => click('tf-reconnect'), 50);
    await step('T · save refused', () => { $('tpl-name').value = 'Nope'; click('tpl-save'); }, 50);
    shot('T · save refused', 'tpl-status');
    await step('T · check file refused', () => click('btn-checkfile'), 50);
    await step('T · allow and check', () => { ph.perm = 'granted'; click('btn-checkfile'); }, 50);
    // Saving into a file that changed in between: the conflict path re-reads it.
    await step('T · write refused mid-save', () => { $('tpl-name').value = 'Bravo plan'; click('tpl-save'); }, 50);
    await step('T · then refused', () => { ph.perm = 'denied'; click('tpl-keep'); }, 50);
    shot('T · write refused', 'tpl-status');
    await step('T · new name, write refused', () => { ph.perm = 'denied'; $('tpl-name').value = 'Brand new'; window.plannerTemplatesTest.startSave(ph.text); }, 50);
    shot('T · new name, write refused', 'tpl-status');
    await step('T · forget again', () => click('tf-forget'), 50);
    for (const [label, text] of [['not json', '{oops'], ['no list', '{"v":1}'], ['empty', '{"v":1,"templates":[]}']]) {
        await step(`T · file ${label}`, () => { try { window.plannerTemplatesTest(text); } catch (e) { add(`T · file ${label} · thrown`, e.message); } });
        shot(`T · file ${label}`, 'tf-list');
    }
    // Create templates file: the wrong folder, then the planner's folder.
    window.showDirectoryPicker = async () => fakeDir('Elsewhere', { 'readme.txt': 'hi' });
    await step('T · create in the wrong folder', () => click('tf-create'), 100);
    shot('T · create in the wrong folder', 'tpl-status');
    await step('T · create (test hook, wrong folder)', () => window.plannerTemplatesTest.create(fakeDir('Elsewhere', { 'readme.txt': 'hi' })), 50);
    shot('T · create wrong folder (hook)', 'tpl-status');
    await step('T · create in the planner folder', () => window.plannerTemplatesTest.create(fakeDir('planner', { 'web/app.js': '//' })), 100);
    shot('T · created', 'tpl-status', 'tf-status');
    await step('T · close templates', () => key('Escape'));

    // ---------------------------------------------------------------- 5. mod assets: stand-in folders
    const icon = (D.types.find((t) => t.icon) || {}).icon;
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    await step('M · assets open', () => click('btn-art'));
    await step('M · not a mod folder', () => window.plannerArtTest.link(fakeDir('Random', { 'readme.txt': 'hi' })), 50);
    shot('M · not a mod folder', 'art', 'btn-art');
    await step('M · no images', () => window.plannerArtTest.link(fakeDir('ExiledSector', { 'mod_info.json': '{"id":"exiledSector","version":"0.0.1"}' })), 50);
    shot('M · no images', 'art');
    await step('M · one image, other version', () => window.plannerArtTest.link(fakeDir('ExiledSector', { 'mod_info.json': '{"id":"exiledSector","version":"0.0.1"}', [icon]: png })), 50);
    shot('M · one image', 'art', 'btn-art');
    const same = fakeDir('mods', { 'ExiledSector/mod_info.json': `{"id":"exiledSector","version":"${D.modVersion}"}`, [`ExiledSector/${icon}`]: png });
    await step('M · same version, inside mods', () => window.plannerArtTest.link(same), 50);
    shot('M · same version', 'art');
    // The folder's permission lapses: reconnect.
    await step('M · permission lapses', async () => { same.perm = 'prompt'; await window.plannerArtTest.placeholders(false); }, 50);
    shot('M · needs permission', 'art', 'btn-art');
    await step('M · close', () => key('Escape'));
    await step('M · top bar reconnect', () => click('btn-art'), 50);
    await step('M · open again', () => click('btn-art'));
    await step('M · forget', () => click('art-forget'));
    shot('M · forgotten', 'art', 'btn-art');
    await step('M · choose cancelled', () => { window.showDirectoryPicker = async () => { throw new DOMException('cancelled', 'AbortError'); }; click('art-choose'); }, 50);
    await step('M · choose fails', () => { window.showDirectoryPicker = async () => { throw new Error('Picker failed'); }; click('art-choose'); }, 50);
    shot('M · choose fails', 'art');
    await step('M · close', () => key('Escape'));

    // ---------------------------------------------------------------- 6. odds and ends
    await step('Z · load A', () => P.load(buildA));
    await step('Z · waypoint on root', () => P.toggleWaypoint('root_low_tech_1'));
    await step('Z · reset button', () => click('btn-reset'));
    shot('Z · after reset', 'topbar', 'panel');
    flushToasts();
    return out;
};

// A browser without file access (loaded with ?nofiles): the Templates and Mod assets dialogs read files instead.
window.TEXT_BASELINE_RUN_NOFILES = async () => {
    const { P, out, $, step, shot, click } = window.TEXT_BASELINE_KIT();
    await step('nofiles · load', () => {});
    await step('nofiles · choose root', () => P.chooseRoot('root_midline_1'));
    await step('nofiles · templates open', () => click('btn-export'));
    shot('nofiles · templates', 'export');
    const input = $('tpl-file');
    await step('nofiles · open a file', () => {
        click('tf-link');
        const dt = new DataTransfer();
        dt.items.add(new File([JSON.stringify({ v: 1, templates: [P.buildTemplate('Read only')] })], 'exiledSector_skillTreeTemplates.json.data'));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
    shot('nofiles · opened', 'export');
    await step('nofiles · open a broken file', () => {
        click('tf-link');
        const dt = new DataTransfer();
        dt.items.add(new File(['{oops'], 'broken.json'));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
    shot('nofiles · broken', 'tpl-status');
    await step('nofiles · forget', () => click('tf-forget'), 50);
    await step('nofiles · close', () => click('export-close'));
    await step('nofiles · assets open', () => click('btn-art'));
    shot('nofiles · assets', 'art');
    const art = $('art-files');
    await step('nofiles · pick a folder without the mod', () => {
        const dt = new DataTransfer();
        dt.items.add(new File(['hi'], 'readme.txt'));
        art.files = dt.files;
        art.dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
    shot('nofiles · no mod', 'art');
    await step('nofiles · pick the mod without images', () => {
        const dt = new DataTransfer();
        dt.items.add(new File(['{"id":"exiledSector","version":"0.0.1"}'], 'mod_info.json'));
        art.files = dt.files;
        art.dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
    shot('nofiles · no images', 'art');
    await step('nofiles · close', () => click('art-close'));
    // A browser that can't decompress codes.
    await step('nofiles · templates again', () => click('btn-export'));
    await step('nofiles · code without DecompressionStream', () => { delete window.DecompressionStream; const box = $('code-box'); box.value = 'ES1.aGVsbG8'; click('code-load'); }, 50);
    shot('nofiles · code without DecompressionStream', 'code-status');
    await step('nofiles · close', () => click('export-close'));
    return out;
};
