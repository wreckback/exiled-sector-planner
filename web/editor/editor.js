// Text editor, part 2: a panel for changing the planner's own text (web/text/*.js) while looking at the page. Only
// loaded with `node tools/serve.mjs --edit`, after app.js; never part of the release zip (tools/package.mjs).
//
// - Choose a key: Pick, then click text on the page (text from index.html carries its key in data-t…; for text the
//   code builds, the keys whose text is in what was clicked are listed); the keys the page showed, newest first
//   (recorded by record.js); or the search over every key and text.
// - Typing changes the text in memory and draws the page again (planner.refreshText), so the change shows at once.
//   The preview shows the text with the values the page last used, also for text that's gone (a toast, a tooltip).
// - Save sends the text to serve.mjs (POST /_edit/save), which rewrites that one line of the text file, updates the
//   "// e.g." example when it no longer fits, and runs the text check. Revert goes back to the saved text.
(() => {
    'use strict';
    const EDIT = window.ESP_EDIT, P = window.planner, TEXT = window.ESP_TEXT, OWN = window.ESP_EDIT_TEXT || {};
    if (!EDIT || !P || !TEXT) return;

    // ---- the editor's own text (text.js)
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    function t(key, args = {}) {
        let s = OWN[key];
        if (s === undefined && 'count' in args) s = OWN[`${key}.${args.count === 1 ? 'one' : 'other'}`];
        if (s === undefined) return key;
        return s.replace(/\{(\w+)\}/g, (m, k) => (k in args ? String(args[k]) : m));
    }

    // ---- the text as saved in the files: key -> { file, text, example } (from serve.mjs)
    let saved = {};
    const startupKeys = new Set(EDIT.uses.keys()); // used while the page loaded: maybe only then (names in constants)
    const MARKUP_TAGS = ['good', 'bad', 'hl', 'muted', 'builtIn', 'b', 'code', 'kbd'];
    const placeholders = (s) => new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    const baseOf = (k) => k.replace(/\.(one|other)$/, '');
    // A key and its other plural form, edited together.
    function formsOf(k) {
        const b = baseOf(k);
        return b !== k && `${b}.one` in TEXT && `${b}.other` in TEXT ? [`${b}.one`, `${b}.other`] : [k];
    }
    const isEdited = (k) => k in saved && TEXT[k] !== saved[k].text;
    const unsavedCount = () => Object.keys(saved).filter(isEdited).length;

    // The text filled in with the values the page last used, as HTML (the page's own trHtml), without counting as a use.
    function previewHtml(k) {
        const use = EDIT.uses.get(k);
        EDIT.paused = true;
        try { return P.trHtml(k, use ? use.args : {}); } finally { EDIT.paused = false; }
    }
    const scratch = document.createElement('div');
    const plain = (html) => { scratch.innerHTML = html; return scratch.textContent; };

    // ---- the panel
    const box = document.createElement('div');
    box.id = 'esp-editor';
    box.innerHTML = `
      <div class="ee-head">
        <b>${esc(t('editor.title'))}</b>
        <span class="ee-unsaved"></span>
        <button type="button" class="ee-pick" title="${esc(t('editor.pickTitle'))}" aria-pressed="false">${esc(t('editor.pick'))}</button>
        <button type="button" class="ee-hide">${esc(t('editor.hide'))}</button>
      </div>
      <input type="search" class="ee-search" placeholder="${esc(t('editor.search.placeholder'))}" spellcheck="false">
      <div class="ee-listhead"></div>
      <div class="ee-list"></div>
      <div class="ee-detail"></div>`;
    const showBtn = document.createElement('button');
    showBtn.id = 'esp-editor-show';
    showBtn.type = 'button';
    showBtn.hidden = true;
    showBtn.textContent = t('editor.show');
    document.body.append(box, showBtn);
    const $ = (sel) => box.querySelector(sel);
    const ui = { unsaved: $('.ee-unsaved'), pick: $('.ee-pick'), hide: $('.ee-hide'), search: $('.ee-search'),
        listHead: $('.ee-listhead'), list: $('.ee-list'), detail: $('.ee-detail') };

    ui.hide.addEventListener('click', () => { box.hidden = true; showBtn.hidden = false; });
    showBtn.addEventListener('click', () => { box.hidden = false; showBtn.hidden = true; });

    // ---- the key list: search results, the keys a Pick found, or the keys the page showed
    let pickFound = null; // keys from the last Pick on built text, until the search or a selection replaces them
    let selected = null;
    let listedBurst = -1;

    function renderList() {
        const q = ui.search.value.trim().toLowerCase();
        let keys, head;
        if (q) {
            keys = Object.keys(TEXT).filter((k) => k.toLowerCase().includes(q) || String(TEXT[k]).toLowerCase().includes(q));
            head = t('editor.list.found', { count: keys.length });
        } else if (pickFound) {
            keys = pickFound;
            head = keys.length ? t('editor.pick.found', { count: keys.length }) : t('editor.pick.none');
        } else {
            keys = [...EDIT.uses.keys()].reverse().filter((k) => k in TEXT);
            head = t('editor.list.recent');
        }
        listedBurst = EDIT.burst;
        ui.listHead.textContent = head;
        if (!keys.length) { ui.list.innerHTML = q ? `<div class="ee-empty">${esc(t('editor.list.empty'))}</div>` : ''; return; }
        ui.list.innerHTML = keys.slice(0, 300).map((k) => {
            const use = EDIT.uses.get(k);
            const now = use && use.burst === EDIT.burst;
            const tags = (now ? `<span class="ee-tag ee-now" title="${esc(t('editor.list.nowTitle'))}">${esc(t('editor.list.now'))}</span>` : '')
                + (isEdited(k) ? `<span class="ee-tag ee-edited">${esc(t('editor.list.edited'))}</span>` : '');
            return `<button type="button" class="ee-row${formsOf(selected || '').includes(k) ? ' ee-sel' : ''}" data-key="${esc(k)}">`
                + `<span class="ee-key">${esc(k)}${tags}</span><span class="ee-text">${esc(String(TEXT[k]).slice(0, 120))}</span></button>`;
        }).join('');
    }
    ui.search.addEventListener('input', () => { pickFound = null; renderList(); });
    ui.list.addEventListener('click', (e) => {
        const row = e.target.closest('[data-key]');
        if (row) select(row.dataset.key);
    });
    // The page's text changes with every click and hover, so the list of shown keys follows it.
    setInterval(() => {
        if (!box.hidden && !ui.search.value.trim() && !pickFound && EDIT.burst !== listedBurst) renderList();
    }, 600);

    // ---- one key (with its other plural form): its text, checks, preview, Save and Revert
    function select(k) {
        selected = k;
        const forms = formsOf(k);
        const info = saved[forms[0]] || saved[k] || {};
        const ph = [...new Set(forms.flatMap((f) => [...placeholders(saved[f] ? saved[f].text : TEXT[f])]))];
        const example = forms.map((f) => saved[f] && saved[f].example).find((x) => x);
        ui.detail.innerHTML = `
          <div class="ee-dkey">${esc(forms.length > 1 ? baseOf(k) + '.one / .other' : k)}</div>
          <div class="ee-muted">${esc(info.file ? t('editor.detail.file', { file: info.file }) : '')}</div>
          <div class="ee-muted ee-example">${esc(example ? t('editor.detail.example', { example }) : t('editor.detail.noExample'))}</div>
          ${ph.length ? `<div class="ee-muted">${esc(t('editor.detail.placeholders', { list: ph.map((p) => `{${p}}`).join(', ') }))}</div>` : ''}
          ${forms.map((f) => `<label class="ee-form">${forms.length > 1 ? `<span class="ee-muted">.${esc(f.split('.').pop())}</span>` : ''}
            <textarea data-form="${esc(f)}" rows="3" spellcheck="true">${esc(TEXT[f])}</textarea></label>`).join('')}
          <div class="ee-checks"></div>
          <div class="ee-status ee-muted"></div>
          <div class="ee-plabel">${esc(t('editor.detail.preview'))} <span class="ee-muted ee-pnote"></span></div>
          ${forms.map((f) => `<div class="ee-preview" data-preview="${esc(f)}"></div>`).join('')}
          <div class="ee-buttons">
            <button type="button" class="ee-save">${esc(t('editor.save'))}</button>
            <button type="button" class="ee-revert">${esc(t('editor.revert'))}</button>
            <button type="button" class="ee-reload" hidden>${esc(t('editor.reload'))}</button>
          </div>
          <div class="ee-result"></div>`;
        for (const ta of ui.detail.querySelectorAll('textarea')) ta.addEventListener('input', onType);
        ui.detail.querySelector('.ee-save').addEventListener('click', () => save(forms));
        ui.detail.querySelector('.ee-revert').addEventListener('click', () => revert(forms));
        ui.detail.querySelector('.ee-reload').addEventListener('click', () => location.reload());
        updateDetail(true);
        renderList();
    }

    function onType(e) {
        TEXT[e.target.dataset.form] = e.target.value;
        renderUnsaved();
        updateDetail(false);
        scheduleRefresh();
    }

    // Checks and preview straight away; whether the page shows the key after drawing it again (refresh).
    function updateDetail(refreshNow) {
        if (!selected) return;
        const forms = formsOf(selected);
        const problems = [];
        for (const f of forms) {
            const was = placeholders(saved[f] ? saved[f].text : TEXT[f]), now = placeholders(TEXT[f]);
            const missing = [...was].filter((p) => !now.has(p)), extra = [...now].filter((p) => !was.has(p));
            if (missing.length) problems.push(t('editor.check.missing', { list: missing.map((p) => `{${p}}`).join(', ') }));
            if (extra.length) problems.push(t('editor.check.extra', { list: extra.map((p) => `{${p}}`).join(', ') }));
            const unpaired = MARKUP_TAGS.filter((tag) => String(TEXT[f]).split(`<${tag}>`).length !== String(TEXT[f]).split(`</${tag}>`).length);
            if (unpaired.length) problems.push(t('editor.check.markup', { list: unpaired.map((tag) => `<${tag}>`).join(', ') }));
        }
        if (forms.length > 1 && [...placeholders(TEXT[forms[0]])].sort().join() !== [...placeholders(TEXT[forms[1]])].sort().join()) {
            problems.push(t('editor.check.forms'));
        }
        ui.detail.querySelector('.ee-checks').innerHTML = [...new Set(problems)].map((p) => `<div class="bad">${esc(p)}</div>`).join('');
        for (const f of forms) ui.detail.querySelector(`[data-preview="${CSS.escape(f)}"]`).innerHTML = previewHtml(f);
        ui.detail.querySelector('.ee-pnote').textContent = forms.some((f) => EDIT.uses.has(f))
            ? t('editor.detail.previewValues') : t('editor.detail.previewNoValues');
        ui.detail.querySelector('.ee-revert').disabled = !forms.some(isEdited);
        if (refreshNow) refresh();
    }

    let refreshTimer = 0;
    function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 150); }
    // Draws the page again and tells whether it showed the selected key.
    function refresh() {
        if (!selected) return;
        const forms = formsOf(selected);
        const mark = EDIT.burst;
        EDIT.last = 0; // the redraw starts a new burst
        P.refreshText();
        const live = forms.some((f) => { const u = EDIT.uses.get(f); return u && u.burst > mark; });
        const loadTime = !live && forms.some((f) => startupKeys.has(f));
        const status = ui.detail.querySelector('.ee-status');
        if (status) status.textContent = t(live ? 'editor.status.live' : loadTime ? 'editor.status.loadTime' : 'editor.status.offScreen');
        const reload = ui.detail.querySelector('.ee-reload');
        if (reload) reload.dataset.loadTime = loadTime ? '1' : '';
    }

    function renderUnsaved() {
        const n = unsavedCount();
        ui.unsaved.textContent = n ? t('editor.unsaved', { count: n }) : '';
    }

    function revert(forms) {
        for (const f of forms) if (saved[f]) TEXT[f] = saved[f].text;
        renderUnsaved();
        select(selected);
    }

    async function save(forms) {
        const btn = ui.detail.querySelector('.ee-save');
        const out = [];
        btn.disabled = true;
        btn.textContent = t('editor.saving');
        // The example: the text as the page last showed it, from the form it used last.
        const lastUsed = forms.filter((f) => EDIT.uses.has(f)).sort((a, b) => EDIT.uses.get(b).at - EDIT.uses.get(a).at)[0];
        const example = lastUsed ? plain(previewHtml(lastUsed)).replace(/\s+/g, ' ').trim() : null;
        try {
            for (const f of forms) {
                if (!isEdited(f)) continue;
                const res = await fetch('/_edit/save', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: f, text: TEXT[f], example }),
                });
                const r = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                if (!res.ok || r.error) { out.push(`<div class="bad">${esc(t('editor.saveFailed', { error: r.error || `HTTP ${res.status}` }))}</div>`); break; }
                saved[f] = { ...saved[f], text: TEXT[f] };
                if (r.example != null) for (const g of forms) if (saved[g]) saved[g].example = r.example;
                out.push(`<div class="good">${esc(t(r.exampleUpdated ? 'editor.savedExample' : 'editor.saved', { file: r.file }))}</div>`);
                if (r.errors && r.errors.length) out.push(`<div class="bad">${esc(t('editor.checkErrors'))}</div>` + r.errors.map((x) => `<div class="bad ee-li">${esc(x)}</div>`).join(''));
                if (r.warnings && r.warnings.length) out.push(`<div>${esc(t('editor.checkWarnings'))}</div>` + r.warnings.map((x) => `<div class="ee-li">${esc(x)}</div>`).join(''));
            }
        } catch (e) {
            out.push(`<div class="bad">${esc(t('editor.saveFailed', { error: e.message }))}</div>`);
        }
        const loadTime = ui.detail.querySelector('.ee-reload').dataset.loadTime === '1';
        select(selected); // shows the saved state (example, Revert)
        ui.detail.querySelector('.ee-result').innerHTML = out.join('');
        ui.detail.querySelector('.ee-reload').hidden = !loadTime;
        renderUnsaved();
    }

    // ---- Pick: the next click on the page chooses its text instead of doing what it normally does
    let picking = false, hoverEl = null;
    const KEY_ATTRS = ['t', 'tHtml', 'tTitle', 'tPlaceholder', 'tAriaLabel']; // dataset names of data-t, data-t-html, …
    const KEY_SELECTOR = '[data-t],[data-t-html],[data-t-title],[data-t-placeholder],[data-t-aria-label]';
    function setPicking(on) {
        picking = on;
        ui.pick.setAttribute('aria-pressed', String(on));
        document.body.classList.toggle('ee-picking', on);
        if (!on && hoverEl) { hoverEl.classList.remove('ee-hover'); hoverEl = null; }
        if (on) ui.listHead.textContent = t('editor.pickOn');
    }
    ui.pick.addEventListener('click', () => setPicking(!picking));
    const outside = (e) => picking && !box.contains(e.target);
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'dblclick', 'contextmenu']) {
        window.addEventListener(type, (e) => { if (outside(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    }
    window.addEventListener('click', (e) => {
        if (!outside(e)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setPicking(false);
        pickAt(e.target);
    }, true);
    window.addEventListener('mouseover', (e) => {
        if (!outside(e)) return;
        if (hoverEl) hoverEl.classList.remove('ee-hover');
        hoverEl = e.target instanceof HTMLElement && e.target !== document.body && e.target.id !== 'tree' ? e.target : null;
        if (hoverEl) hoverEl.classList.add('ee-hover');
    }, true);
    window.addEventListener('keydown', (e) => {
        if (picking && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setPicking(false); renderList(); }
    }, true);

    function pickAt(target) {
        ui.search.value = '';
        // Text from index.html carries its keys.
        const el = target.closest && target.closest(KEY_SELECTOR);
        if (el) {
            const keys = [...new Set(KEY_ATTRS.map((a) => el.dataset[a]).filter((k) => k && k in TEXT))];
            if (keys.length === 1) { pickFound = null; select(keys[0]); return; }
            if (keys.length) { pickFound = keys; renderList(); return; }
        }
        // Text the code builds: the keys (shown so far) whose text, filled in, is in what was clicked or its title.
        const holder = target.closest ? target.closest('div,li,p,td,th,button,label,span,h2,h3') || target : target;
        const here = ((holder.textContent || '') + ' ' + (holder.getAttribute && holder.getAttribute('title') || '')).replace(/\s+/g, ' ');
        const found = [];
        for (const k of EDIT.uses.keys()) {
            if (!(k in TEXT)) continue;
            const s = plain(previewHtml(k)).replace(/\s+/g, ' ').trim();
            if (s.length >= 3 && here.includes(s)) found.push([k, s.length]);
        }
        found.sort((a, b) => b[1] - a[1]);
        pickFound = found.slice(0, 30).map(([k]) => k);
        if (pickFound.length === 1) { const k = pickFound[0]; pickFound = null; select(k); return; }
        renderList();
    }

    // Unsaved changes are lost on a reload, so the browser asks first.
    window.addEventListener('beforeunload', (e) => { if (unsavedCount()) { e.preventDefault(); e.returnValue = ''; } });

    // ---- start: the saved text from serve.mjs
    fetch('/_edit/keys').then((r) => r.json()).then((data) => {
        saved = data;
        renderList();
        ui.detail.innerHTML = `<div class="ee-muted">${esc(t('editor.detail.none'))}</div>`;
    }).catch((e) => {
        ui.detail.innerHTML = `<div class="bad">${esc(t('editor.saveFailed', { error: e.message }))}</div>`;
    });
    renderList();
})();
