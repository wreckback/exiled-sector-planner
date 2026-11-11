/* Exiled Sector skill tree planner.
 * Data comes from data/planner-data.js (tools/extract.mjs builds it from the mod).
 * Rules follow the mod's AllocationCheck: a node needs an allocated (or starting root) neighbour,
 * wormhole exits are only reached through their partner, and allocating a wormhole takes its partner too. */
(() => {
  'use strict';

  const D = window.PLANNER_DATA;
  if (!D) {
    document.body.innerHTML = '<p style="padding:24px;color:#fc6300">Missing data/planner-data.js. Run node tools/extract.mjs first.</p>';
    return;
  }

  // ------------------------------------------------------------------ text lookup
  // The planner's own text is in text/*.js (loaded before this file), one "key": "text" per line.
  // tr(key, args) fills {name} placeholders from args. With args.count and no plain key, it takes key.one for a count
  // of 1 and key.other otherwise. A missing key shows as the key itself (and a console warning), so it stands out.
  // (Named tr, not t: t is the usual name for a node type in this file.)
  const TEXT = window.ESP_TEXT || {};
  // The text editor (only with `node tools/serve.mjs --edit`, see web/editor/) records each key the page uses, with its
  // values. Without it this is null and nothing is recorded.
  const EDIT = window.ESP_EDIT || null;
  const missingText = new Set();
  function textTemplate(key, args) {
    let k = key, s = TEXT[k];
    if (s === undefined && 'count' in args) { k = `${key}.${args.count === 1 ? 'one' : 'other'}`; s = TEXT[k]; }
    if (s === undefined) {
      if (!missingText.has(key)) { missingText.add(key); console.warn(`Missing text: ${key}`); }
      return key;
    }
    if (EDIT) EDIT.used(k, args);
    return s;
  }
  function tr(key, args = {}) {
    return textTemplate(key, args).replace(/\{(\w+)\}/g, (m, k) => (k in args ? String(args[k]) : m));
  }
  // A name kept in the text files under a mod data id (name.requirement.req_shields, name.gameState.gate_omega_found,
  // name.subKind.DOCTRINE). An id without a line yet (one a mod update added) shows as `fallback()`, without a warning.
  const idName = (group, id, fallback) => {
    // Joined with +, not a template literal: text-check reads `name.${…}` as a key pattern and would count every
    // name.* key as used.
    const k = 'name.' + group + '.' + id, s = TEXT[k];
    if (s == null) return fallback();
    if (EDIT) EDIT.used(k, {});
    return s;
  };
  // A node's req_* tag and gate_* tag in words. (humanize is a function declaration further down, so it's ready here.)
  const requirementName = tag => idName('requirement', tag, () => humanize(tag.slice(4)));
  const gameStateName = gate => idName('gameState', gate, () => humanize(gate.replace(/^gate_/, '')));
  // The same as HTML: the text's game markup (<hl>, <good>, <bad>, <muted>, <builtIn>) and <b>, <code>, <kbd> become
  // HTML, everything else is escaped, values too, except a value whose name ends in Html, which is put in as it is.
  function trHtml(key, args = {}) {
    const html = textTemplate(key, args).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;(good|bad|hl|muted|builtIn)&gt;/g, (_, c) => `<span class="${c.toLowerCase()}">`)
      .replace(/&lt;\/(good|bad|hl|muted|builtIn)&gt;/g, '</span>')
      .replace(/&lt;(\/?)(b|code|kbd)&gt;/g, '<$1$2>');
    return html.replace(/\{(\w+)\}/g, (m, k) => (!(k in args) ? m : k.endsWith('Html') ? String(args[k])
      : String(args[k]).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')));
  }
  // index.html names its text by key: data-t (the element's text), data-t-html (text with markup, as trHtml),
  // data-t-title, data-t-placeholder, data-t-aria-label.
  function applyText(root = document) {
    for (const el of root.querySelectorAll('[data-t]')) el.textContent = tr(el.dataset.t);
    for (const el of root.querySelectorAll('[data-t-html]')) el.innerHTML = trHtml(el.dataset.tHtml);
    for (const attr of ['title', 'placeholder', 'aria-label']) {
      for (const el of root.querySelectorAll(`[data-t-${attr}]`)) el.setAttribute(attr, tr(el.getAttribute(`data-t-${attr}`)));
    }
  }
  applyText();

  // ------------------------------------------------------------------ constants
  const NODE_SIZE = 64;
  const ICON_INSET = 0.9;
  const TIER_SIZE = { SMALL: 1, NOTABLE: 1, KEYSTONE: 1, WORMHOLE: 1.3, WORMHOLE_EXIT: 1.3, ROOT: 2.5, SOCKET: 1.2 };
  const TIER_LABEL = {
    SMALL: tr('name.tier.small'), NOTABLE: tr('name.tier.notable'), KEYSTONE: tr('name.tier.keystone'), WORMHOLE: tr('name.tier.wormhole'),
    WORMHOLE_EXIT: tr('name.tier.wormholeExit'), ROOT: tr('name.tier.root'), SOCKET: tr('name.tier.socket'),
  };
  const ROOT_COLOURS = { root_low_tech: [255, 125, 62], root_midline: [255, 212, 112], root_high_tech: [89, 157, 255] };
  const AFFINITY_COLOURS = { LOW_TECH_AFFINITY_FLAT: [226, 154, 72], MIDLINE_AFFINITY_FLAT: [156, 207, 150], HIGH_TECH_AFFINITY_FLAT: [140, 228, 255] };
  const AFFINITY_NAMES = { LOW_TECH_AFFINITY_FLAT: tr('name.affinity.lowTech'), MIDLINE_AFFINITY_FLAT: tr('name.affinity.midline'), HIGH_TECH_AFFINITY_FLAT: tr('name.affinity.highTech') };
  const AFFINITY_STATS = { LOW_TECH_AFFINITY_FLAT: tr('name.affinity.lowTech.stat'), MIDLINE_AFFINITY_FLAT: tr('name.affinity.midline.stat'), HIGH_TECH_AFFINITY_FLAT: tr('name.affinity.highTech.stat') };
  const ROOT_AFFINITY = { root_low_tech: 'low_tech', root_midline: 'midline', root_high_tech: 'high_tech' };
  const GLOW = [120, 200, 255];
  const DULL = [150, 150, 150];
  const PREVIEW_ADD = [152, 251, 0];
  const PREVIEW_REMOVE = [252, 99, 0];
  const NOTABLE_PINK = [255, 60, 220];
  const NOTABLE_GLOW = [255, 170, 255];
  const DEFAULT_AURORA = [140, 120, 255];
  const SEARCH_GOLD = [255, 211, 77];
  const RULE_PROBLEM = [255, 40, 40];
  // The story point colour (the game's Misc.getStoryOptionColor, which the mod uses for integrated nodes). The exact
  // value isn't in the mod's sources; this is a close green, deepened in the light theme like the other colours.
  const STORY_GREEN = [140, 255, 150];
  const UNALLOCATED_ALPHA = 0.45;
  const VOLUME_NAMES = {
    core: tr('name.volume.core'), luddic: tr('name.volume.luddic'), pirate: tr('name.volume.pirate'), hegemony: tr('name.volume.hegemony'),
    persean_league: tr('name.volume.persean_league'), tritachyon: tr('name.volume.tritachyon'), sindrian_dictat: tr('name.volume.sindrian_dictat'),
    REDACTED: tr('name.volume.REDACTED'), tania: tr('name.volume.tania'), stargazer: tr('name.volume.stargazer'), omega: tr('name.volume.omega'),
    abyss: tr('name.volume.abyss'), shrouded: tr('name.volume.shrouded'), nightcross: tr('name.volume.nightcross'), kesteven: tr('name.volume.kesteven'),
    exotech: tr('name.volume.exotech'), enigma: tr('name.volume.enigma'), threat: tr('name.volume.threat'),
  };
  const STAR_COLOURS = {
    star_yellow: '#fff2b8', star_orange: '#ffc27a', star_red: '#ff7a5c', star_blue: '#9cc4ff', star_white: '#f4f8ff',
    star_neutron: '#d8e8ff', star_browndwarf: '#b0704a', black_hole: '#000000',
  };
  const HULL_KEYS = ['frigate', 'destroyer', 'cruiser', 'capitalShip'];
  const FONT = 'system-ui, "Segoe UI", sans-serif';

  // ------------------------------------------------------------------ model
  const S = D.strings || {};
  const types = new Map(D.types.map(t => [t.id, t]));
  const nodes = D.nodes.map((n, idx) => {
    const type = types.get(n.type) || { id: n.type, name: n.type, icon: null, tier: 'SMALL' };
    const tags = n.tags || [];
    return {
      id: n.id, idx, x: n.x, y: n.y, type, tier: type.tier || 'SMALL',
      links: n.c || [], adj: [], tags,
      volume: tags.find(t => !t.startsWith('gate_')) || 'core',
      gates: tags.filter(t => t.startsWith('gate_')),
      pairedWith: n.pairedWith || null,
      ringBeltColor: n.ringBeltColor ? hexRgb(n.ringBeltColor) : null,
      wormholeColor: n.wormholeColor ? hexRgb(n.wormholeColor) : null,
    };
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const n of nodes) n.adj = n.links.map(id => byId.get(id)).filter(Boolean);
  for (const n of nodes) n.fp = NODE_SIZE * (TIER_SIZE[n.tier] || 1);

  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const hidden = new Set((D.hiddenConnectors || []).map(h => pairKey(h.a, h.b)));
  const curves = new Map((D.curves || []).map(c => [pairKey(c.a, c.b), c]));
  const connectors = [];
  {
    const seen = new Set();
    for (const n of nodes) {
      for (const m of n.adj) {
        const k = pairKey(n.id, m.id);
        if (seen.has(k) || hidden.has(k)) continue;
        seen.add(k);
        const c = curves.get(k);
        let cx = null, cy = null;
        if (c) { // stored point is where the curve passes; convert to the quadratic control point
          cx = 2 * c.controlX - (n.x + m.x) / 2;
          cy = 2 * c.controlY - (n.y + m.y) / 2;
        }
        const xs = [n.x, m.x, cx ?? n.x], ys = [n.y, m.y, cy ?? n.y];
        connectors.push({ a: n, b: m, cx, cy, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
      }
    }
  }
  // One region per tree (the core tree and each faction volume): centre and radius from its nodes.
  const regions = [];
  {
    const byVolume = new Map();
    for (const n of nodes) {
      if (!byVolume.has(n.volume)) byVolume.set(n.volume, []);
      byVolume.get(n.volume).push(n);
    }
    // Median centre and 85th-percentile radius, so a few nodes placed far from their tree don't drag the label off it.
    const median = a => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
    for (const [volume, list] of byVolume) {
      const x = median(list.map(n => n.x)), y = median(list.map(n => n.y));
      const dists = list.map(n => Math.hypot(n.x - x, n.y - y)).sort((p, q) => p - q);
      const radius = Math.max(400, dists[Math.floor((dists.length - 1) * 0.85)]) + 150;
      regions.push({ volume, x, y, radius, ids: list.map(n => n.id) });
    }
  }
  const roots = nodes.filter(n => n.tier === 'ROOT');
  const exits = nodes.filter(n => n.tier === 'WORMHOLE_EXIT');
  const sockets = nodes.filter(n => n.tier === 'SOCKET');

  // ------------------------------------------------------------------ build state
  const state = {
    root: null,                 // node id
    alloc: new Set(),           // allocated node ids, root excluded
    choice: new Map(),          // nodeId -> option type id
    links: new Map(),           // socketId -> exitId
    hull: 'cruiser',
    cap: 60,
    hiddenVolumes: new Set(),   // Optional Volumes toggles (OPTIONAL_VOLUMES ids) turned off, as in the mod settings
    subs: new Map(),            // socketId -> { id: subroutine id, aff?: conduit affinity effect, grants?: [node ids] }
    template: null,             // { name, sig } of the template the build was loaded from or saved as (top bar)
    integrated: new Set(),      // integrated node ids (ShipSkillData.integratedNodeIds), see "integrated nodes" below
  };
  const undoStack = [];

  // Last option picked from the picker, per choice type (e.g. affinity -> midline_affinity). Ctrl+click reuses it.
  const lastChoice = new Map();
  try { for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem('esp.lastChoice') || '{}'))) if (types.has(v)) lastChoice.set(k, v); } catch { /* storage unavailable */ }
  function rememberChoice(n, option) {
    lastChoice.set(n.type.id, option);
    try { localStorage.setItem('esp.lastChoice', JSON.stringify(Object.fromEntries(lastChoice))); } catch { /* storage unavailable */ }
  }

  const sat = id => id === state.root || state.alloc.has(id);
  const used = () => state.alloc.size + (state.root ? 1 : 0);

  function linkedSocketOf(exitId) {
    for (const [s, e] of state.links) if (e === exitId) return s;
    return null;
  }
  // The mod settings' Optional Volumes (VolumeToggles): volumes built around other mods, each toggle covering one or two.
  // In game a hidden volume is left out of the tree (TreeVolumeFilter) and its anchor is inert.
  const OPTIONAL_VOLUMES = D.optionalVolumes || [];
  const volumeToggleOf = new Map(OPTIONAL_VOLUMES.flatMap(g => g.volumes.map(v => [v, g])));
  const volumeHidden = v => { const g = volumeToggleOf.get(v); return !!g && state.hiddenVolumes.has(g.id); };
  const hiddenText = n => tr('rule.volumeHidden', { volume: volumeName(n.volume) });
  // Nodes in a hidden volume: they can't be allocated or travelled through.
  function switchedOff(n) {
    return volumeHidden(n.volume);
  }
  function partnerOf(n) {
    if (switchedOff(n)) return null;
    if (n.pairedWith) return byId.get(n.pairedWith) || null;
    if (n.tier === 'SOCKET') { const e = state.links.get(n.id), x = e && byId.get(e); return x && !switchedOff(x) ? x : null; }
    if (n.tier === 'WORMHOLE_EXIT') { const s = linkedSocketOf(n.id); return s ? byId.get(s) : null; }
    return null;
  }
  function effectiveType(n) {
    const opt = state.choice.get(n.id);
    return opt && types.get(opt) ? types.get(opt) : n.type;
  }
  function isChoice(n) { return Array.isArray(n.type.options) && n.type.options.length > 0; }
  function defaultOption(n) {
    const opts = n.type.options;
    const tech = state.root ? ROOT_AFFINITY[byId.get(state.root).type.id] : null;
    if (tech) { const match = opts.find(o => o.startsWith(tech)); if (match) return match; }
    return opts[0];
  }

  // Shortest path (fewest nodes) from the allocated set to `target`. Returns the ids to add, or null.
  const pathTo = target => findPath(target).path;
  // Breadth-first search; with `useRules`, nodes the rules refuse can't be passed through (the target itself can).
  function searchPath(target, useRules) {
    const prev = new Map();
    const queue = [];
    for (const n of nodes) if (sat(n.id)) { prev.set(n.id, null); queue.push(n); }
    let found = false;
    for (let qi = 0; qi < queue.length && !found; qi++) {
      const cur = queue[qi];
      const steps = [];
      for (const m of cur.adj) if (m.tier !== 'WORMHOLE_EXIT') steps.push(m);
      if (sat(cur.id)) { const p = partnerOf(cur); if (p) steps.push(p); }
      else if (cur.tier === 'WORMHOLE' || cur.tier === 'SOCKET') { const p = partnerOf(cur); if (p) steps.push(p); }
      for (const m of steps) {
        if (prev.has(m.id) || switchedOff(m)) continue;
        if (useRules && m.id !== target.id && staticBlock(m)) continue;
        prev.set(m.id, cur.id);
        if (m.id === target.id) { found = true; break; }
        queue.push(m);
      }
    }
    if (!found) return null;
    const path = [];
    for (let id = target.id; id && !sat(id); id = prev.get(id)) path.push(id);
    // Taking a wormhole always takes its partner.
    const add = new Set(path);
    for (const id of path) { const p = partnerOf(byId.get(id)); if (p && !sat(p.id)) add.add(p.id); }
    return [...add];
  }
  // The path to `target` checked against the rules node by node, in the order allocate() adds them.
  // Returns { path, options } (the option each choice node on it gets), or { path: null, block } saying what refused it.
  // option: the option asked for on the target; remembered: choice nodes on the way use the last picked option.
  function findPath(target, option = null, remembered = false) {
    if (!state.root || sat(target.id) || switchedOff(target)) return { path: null, block: null };
    const g = subState().granted.get(target.id);
    if (g && g.status === 'active') return { path: null, block: { kind: 'granted', node: target, text: tr('rule.granted', { item: g.def.name }) } };
    if (target.tier === 'WORMHOLE_EXIT' && !partnerOf(target)) return { path: null, block: null };
    let path = searchPath(target, true);
    if (!path) {
      // Unreachable either way, or only through refused nodes: name the first refused one on the way.
      const raw = searchPath(target, false);
      if (!raw) return { path: null, block: null };
      path = raw;
    }
    const list = rules().list.slice();
    const options = new Map();
    for (const id of [...path].reverse()) {
      const n = byId.get(id);
      let p;
      if (id === target.id && option) p = { option, block: blockOf(n, option, list) };
      else p = placement(n, list, isChoice(n) ? (remembered && lastChoice.get(n.type.id)) || defaultOption(n) : null);
      if (p.block) return { path: null, block: { ...p.block, node: n } };
      options.set(id, p.option);
      list.push(entryFor(n, p.option));
    }
    return { path, options };
  }

  // Waypoints (Shift+click): the next allocation goes through them in order, each leg the shortest legal way from the
  // previous one, so a longer route can be forced. Cleared after it's used, on Esc, and when the root changes.
  let waypoints = [];
  const routeTo = (target, option = null, remembered = false) => (waypoints.length ? waypointPlan(target, option, remembered) : findPath(target, option, remembered));
  // Shortest way from `from` (with no `from`, from any node in `have`) to `target`, passing nodes in `have` for free. Same
  // steps and rules as searchPath. Returns the ids to add in allocation order (partners right after their node), or null.
  // Every new node on the way is kept, even past a node in `have`, so the route really runs through `from`.
  function segmentPath(from, target, have) {
    const prev = new Map(), queue = [];
    for (const n of from ? [from] : [...have].map(id => byId.get(id))) { prev.set(n.id, null); queue.push(n); }
    let found = false;
    for (let qi = 0; qi < queue.length && !found; qi++) {
      const cur = queue[qi];
      const steps = cur.adj.filter(m => m.tier !== 'WORMHOLE_EXIT');
      if (have.has(cur.id) || cur.tier === 'WORMHOLE' || cur.tier === 'SOCKET') { const p = partnerOf(cur); if (p) steps.push(p); }
      for (const m of steps) {
        if (prev.has(m.id) || switchedOff(m)) continue;
        if (m.id !== target.id && !have.has(m.id) && staticBlock(m)) continue;
        prev.set(m.id, cur.id);
        if (m.id === target.id) { found = true; break; }
        queue.push(m);
      }
    }
    if (!found) return null;
    const back = [];
    for (let id = target.id; id != null; id = prev.get(id)) if (!have.has(id)) back.push(id);
    const out = [];
    for (const id of back.reverse()) {
      if (!out.includes(id)) out.push(id);
      const p = partnerOf(byId.get(id));
      if (p && !have.has(p.id) && !out.includes(p.id) && !back.includes(p.id)) out.push(p.id);
    }
    return out;
  }
  // findPath through the waypoints: same result shape ({ path (target first), options } or { path: null, block }).
  function waypointPlan(target, option = null, remembered = false) {
    if (!state.root || sat(target.id) || switchedOff(target)) return { path: null, block: null };
    const name = n => effectiveType(n).name;
    const have = new Set([state.root, ...state.alloc]);
    const order = [];
    let from = null;
    // Clicking a waypoint itself goes through the ones before it; the later ones stay for the next click.
    const at = waypoints.indexOf(target);
    for (const t of [...(at >= 0 ? waypoints.slice(0, at) : waypoints), target]) {
      if (!have.has(t.id)) {
        if (switchedOff(t)) return { path: null, block: { text: tr('rule.waypointHidden', { node: name(t), reason: hiddenText(t) }) } };
        if (t.tier === 'WORMHOLE_EXIT' && !partnerOf(t)) return { path: null, block: { text: tr('rule.exitNeedsAnchor', { node: name(t) }) } };
        const seg = segmentPath(from, t, have);
        if (!seg) return { path: null, block: { text: from ? tr('rule.noWayFrom', { from: name(from), node: name(t) }) : tr('rule.noWay', { node: name(t) }) } };
        for (const id of seg) { have.add(id); order.push(id); }
      }
      from = t;
    }
    const list = rules().list.slice(), options = new Map();
    for (const id of order) {
      const n = byId.get(id);
      const p = id === target.id && option ? { option, block: blockOf(n, option, list) }
        : placement(n, list, isChoice(n) ? (remembered && lastChoice.get(n.type.id)) || defaultOption(n) : null);
      if (p.block) return { path: null, block: { ...p.block, node: n } };
      options.set(id, p.option);
      list.push(entryFor(n, p.option));
    }
    return { path: order.reverse(), options };
  }
  function toggleWaypoint(n) {
    if (n.id === state.root) { toast(tr('toast.waypointRoot')); return; }
    const i = waypoints.indexOf(n);
    if (i >= 0) waypoints.splice(i, 1); else waypoints.push(n);
    waypointsChanged();
  }
  function clearWaypoints() { if (waypoints.length) { waypoints = []; waypointsChanged(); } }
  function waypointsChanged() {
    updatePreview();
    renderChrome();
    if (hover) showTooltip(hover, lastMouse.x, lastMouse.y);
    requestDraw();
  }

  // Ids that removing `n` takes away: itself, its wormhole partner, and everything no longer joined to the root.
  function removalSet(n) {
    if (!state.alloc.has(n.id)) return null;
    const gone = new Set([n.id]);
    // A static wormhole pair goes together; a socket takes its linked exit. Removing an exit only unlinks it.
    const p = n.tier === 'WORMHOLE_EXIT' ? null : partnerOf(n);
    if (p && state.alloc.has(p.id)) gone.add(p.id);
    const keep = new Set([state.root]);
    const queue = [byId.get(state.root)];
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      const next = cur.adj.slice();
      const cp = partnerOf(cur);
      if (cp) next.push(cp);
      for (const m of next) {
        if (keep.has(m.id) || gone.has(m.id) || !state.alloc.has(m.id)) continue;
        if (cp === m && (gone.has(cur.id))) continue;
        keep.add(m.id);
        queue.push(m);
      }
    }
    const removed = [];
    for (const id of state.alloc) if (!keep.has(id)) removed.push(id);
    return removed;
  }

  function snapshot() { return serialize(); }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 200) undoStack.shift();
    els.undo.disabled = false;
  }
  function undo() {
    const s = undoStack.pop();
    if (s == null) return;
    deserialize(s);
    els.undo.disabled = undoStack.length === 0;
    changed();
  }

  function chooseRoot(n) {
    pushUndo();
    state.root = n.id;
    state.alloc.clear(); state.choice.clear(); state.links.clear(); state.subs.clear(); state.integrated.clear(); state.template = null;
    waypoints = [];
    changed();
  }
  // remembered: true picks each choice node on the path from lastChoice (falling back to the root default).
  function allocate(target, option, remembered = false) {
    const found = routeTo(target, option || null, remembered);
    const path = found.path;
    if (!path) { if (found.block) toast(refusalText(target, found.block)); return false; }
    if (used() + path.length > state.cap) { toast(tr('toast.overCap', { needed: path.length, left: Math.max(0, state.cap - used()) })); return false; }
    pushUndo();
    const at = waypoints.indexOf(target);
    waypoints = at >= 0 ? waypoints.slice(at + 1) : [];
    // Add in build order (nearest the build first) so allocation order, and exported template steps, read naturally.
    for (const id of [...path].reverse()) {
      state.alloc.add(id);
      const n = byId.get(id);
      if (isChoice(n) && !state.choice.has(id)) state.choice.set(id, found.options.get(id) || defaultOption(n));
    }
    changed();
    return true;
  }
  // "Can't allocate X: reason", or, when the refusal is on the way there, which node and why.
  function refusalText(target, block) {
    if (!block.node || block.node === target) return block.text;
    return tr('rule.wayPasses', { target: effectiveType(target).name, node: effectiveType(block.node).name, reason: block.text });
  }
  function deallocate(n) {
    if (n.tier === 'WORMHOLE_EXIT') { const s = linkedSocketOf(n.id); if (s) { unlinkSocket(byId.get(s)); return; } }
    const gone = removalSet(n);
    if (!gone) return;
    pushUndo();
    for (const id of gone) { state.alloc.delete(id); state.choice.delete(id); }
    for (const [s, e] of [...state.links]) if (!state.alloc.has(s) || !state.alloc.has(e)) { state.links.delete(s); state.alloc.delete(e); }
    dropOrphanSubs();
    changed();
  }
  // Unallocating a socket unsockets its subroutine (ShipSkillData.release).
  function dropOrphanSubs() { for (const s of [...state.subs.keys()]) if (!state.alloc.has(s)) state.subs.delete(s); }
  function socketSub(socket, id, extra = {}) {
    const def = SUBS.get(id);
    if (!def || !state.alloc.has(socket.id)) return;
    const problem = subLimitProblem(def, socket.id);
    if (problem) { toast(problem); return; }
    pushUndo();
    if (state.links.has(socket.id)) unlinkInner(socket);
    const prev = state.subs.get(socket.id);
    const entry = { id, ...extra };
    if (def.kind === 'MODSPEC_CACHE') entry.grants = prev && prev.id === id ? prev.grants || [] : [];
    if (def.kind === 'ROOT_CONDUIT' && !entry.aff) entry.aff = AFFINITY_KEYS[0];
    state.subs.set(socket.id, entry);
    changed();
  }
  function removeSub(socket) { if (!state.subs.has(socket.id)) return; pushUndo(); state.subs.delete(socket.id); changed(); }
  // A modspec cache holds 1 to 3 notables (ModspecCaches: node_count_chances).
  const cacheMax = def => (def.nodeCountChances || [1, 1, 1]).length;
  function setGrants(socket, grants) {
    const e = state.subs.get(socket.id);
    if (!e) return;
    pushUndo();
    e.grants = [...new Set(grants)].slice(0, cacheMax(SUBS.get(e.id)));
    changed();
  }
  function setChoice(n, option) {
    if (state.choice.get(n.id) === option) return;
    // AllocationCheck.computeOptionSwitch: checked against the build without this node.
    const b = blockOf(n, option, buildEntries(n.id));
    if (b) { toast(b.text); return; }
    pushUndo();
    state.choice.set(n.id, option);
    changed();
  }
  // Sets the allocated affinity nodes to a split ({optionId: count}, adding up to how many are allocated), changing as
  // few as possible: in allocation order a node keeps its option while that option still has room, and the rest take
  // whatever is left. Returns how many nodes changed (one undo step).
  const affinityNodes = () => [...state.alloc].map(id => byId.get(id)).filter(n => n.type.id === 'affinity');
  function setAffinitySplit(targets) {
    const list = affinityNodes();
    const left = new Map(Object.entries(targets).filter(([opt]) => types.has(opt)));
    if ([...left.values()].reduce((a, b) => a + b, 0) !== list.length) return 0;
    const moving = [];
    for (const n of list) {
      const cur = state.choice.get(n.id);
      if ((left.get(cur) || 0) > 0) left.set(cur, left.get(cur) - 1); else moving.push(n);
    }
    if (!moving.length) return 0;
    pushUndo();
    for (const n of moving) {
      const opt = [...left].find(([, c]) => c > 0)[0];
      left.set(opt, left.get(opt) - 1);
      state.choice.set(n.id, opt);
    }
    changed();
    return moving.length;
  }
  function linkSocket(socket, exit) {
    if (!state.alloc.has(socket.id)) return;
    if (switchedOff(exit)) { toast(hiddenText(exit)); return; }
    const current = state.links.get(socket.id);
    if (current === exit.id) return;
    if (!current && used() + 1 > state.cap) { toast(tr('toast.linkAtCap')); return; }
    const b = blockOf(exit, null, buildEntries());
    if (b) { toast(b.text); return; }
    pushUndo();
    if (current) unlinkInner(socket);
    state.subs.delete(socket.id); // one item per socket
    state.links.set(socket.id, exit.id);
    state.alloc.add(exit.id);
    changed();
  }
  function unlinkInner(socket) {
    const exitId = state.links.get(socket.id);
    if (!exitId) return;
    const exit = byId.get(exitId);
    const gone = removalSet(exit) || [];
    for (const id of gone) { state.alloc.delete(id); state.choice.delete(id); }
    state.links.delete(socket.id);
    state.alloc.delete(exitId);
  }
  function unlinkSocket(socket) { pushUndo(); unlinkInner(socket); changed(); }
  // Drop nodes in hidden volumes (and anchor links into them), then everything no longer joined to the root.
  // Returns how many nodes were removed.
  function pruneSwitchedOff() {
    const before = state.alloc.size;
    for (const [s, e] of [...state.links]) if (switchedOff(byId.get(e))) { state.links.delete(s); state.alloc.delete(e); }
    for (const id of [...state.alloc]) if (switchedOff(byId.get(id))) state.alloc.delete(id);
    if (state.root) {
      const keep = new Set([state.root]);
      const queue = [byId.get(state.root)];
      for (let qi = 0; qi < queue.length; qi++) {
        const cur = queue[qi];
        const p = partnerOf(cur);
        for (const m of p ? [...cur.adj, p] : cur.adj) {
          if (keep.has(m.id) || !state.alloc.has(m.id)) continue;
          keep.add(m.id);
          queue.push(m);
        }
      }
      for (const id of [...state.alloc]) if (!keep.has(id)) state.alloc.delete(id);
    }
    for (const id of [...state.choice.keys()]) if (!state.alloc.has(id)) state.choice.delete(id);
    for (const [s, e] of [...state.links]) if (!state.alloc.has(s) || !state.alloc.has(e)) { state.links.delete(s); state.alloc.delete(e); }
    dropOrphanSubs();
    return before - state.alloc.size;
  }
  // Show or hide one Optional Volumes toggle. Hiding removes the build's nodes there (Undo brings them back).
  function setVolumeShown(id, on) {
    const g = OPTIONAL_VOLUMES.find(x => x.id === id);
    if (!g || state.hiddenVolumes.has(id) !== on) return;
    pushUndo();
    if (on) state.hiddenVolumes.delete(id); else state.hiddenVolumes.add(id);
    const removed = on ? 0 : pruneSwitchedOff();
    toast(tr(on ? 'toast.volumeShown' : removed ? 'toast.volumeHiddenRemoved' : 'toast.volumeHidden', removed && !on ? { volume: g.name, count: removed } : { volume: g.name }));
    changed();
  }
  function resetBuild() {
    pushUndo();
    state.root = null; state.alloc.clear(); state.choice.clear(); state.links.clear(); state.subs.clear(); state.integrated.clear(); state.template = null;
    waypoints = [];
    changed();
  }

  // ------------------------------------------------------------------ integrated nodes (the mod's IntegratedNodes)
  // In game a player spends story points to integrate an allocated node on one ship, like building in an s-mod: it then
  // uses its type's `integrated` block (a full replacement of effects, hullSizeEffects and, when given, effectText).
  // The nth integration on a ship costs n story points. The planner lets integrations be added and taken back freely and
  // only shows what they would cost. In game a node stays integrated when unallocated; here that's the "Keep integration
  // when a node is removed" setting (off: removing a node drops its integration). The preview (integPreview, in memory
  // only) counts every allocated integrable node as integrated in the totals, tooltips and map, without changing the build.
  let keepIntegration = false;
  try { keepIntegration = localStorage.getItem('esp.keepIntegration') === '1'; } catch { /* storage unavailable */ }
  let integPreview = false;
  const integrable = t => !!(t && t.integrated);
  const canIntegrate = n => state.alloc.has(n.id) && integrable(effectiveType(n));
  // Integrated in the build: allocated, marked, and its current type (a choice node's option) has integrated effects.
  const isIntegrated = n => state.integrated.has(n.id) && state.alloc.has(n.id) && integrable(effectiveType(n));
  // What totals, tooltips and the map use: the build's integrations, or every integrable allocated node in the preview.
  const integratedOn = n => (integPreview ? canIntegrate(n) : isIntegrated(n));
  // The i-th integration's cost under the mod's LunaLib setting (IntegrationCostSetting.Mode.costOf), an optional rule
  // (state.ship.integCost); k integrations cost the sum of the first k (IntegratedNodes.nextCost).
  const INTEG_COST = {
    EXPONENTIAL: i => 2 ** Math.min(i - 1, 30),
    ADDITIVE: i => i,
    STATIC: () => 2,
  };
  const integCostOf = i => INTEG_COST[state.ship.integCost](i);
  const storyPointCost = k => { let sum = 0; for (let i = 1; i <= k; i++) sum += integCostOf(i); return sum; };
  const nextIntegrationCost = () => integCostOf(state.integrated.size + 1);
  const pointsText = k => tr('label.storyPoints', { count: k });
  const integrableAllocated = () => [...state.alloc].map(id => byId.get(id)).filter(n => integrable(effectiveType(n)));
  function toggleIntegration(n) {
    if (!n) return;
    const t = effectiveType(n);
    if (state.integrated.has(n.id)) {
      pushUndo();
      state.integrated.delete(n.id);
      changed();
      return;
    }
    if (!integrable(t)) { toast(tr('toast.cantIntegrate', { node: t.name })); return; }
    if (!state.alloc.has(n.id)) { toast(tr('toast.allocateToIntegrate', { node: t.name })); return; }
    pushUndo();
    state.integrated.add(n.id);
    changed();
  }
  // Integrate every allocated integrable node (on) or remove every integration (off). One undo step. Returns the count.
  function setAllIntegrated(on) {
    const ids = on ? integrableAllocated().map(n => n.id).filter(id => !state.integrated.has(id)) : [...state.integrated];
    if (!ids.length) return 0;
    pushUndo();
    for (const id of ids) if (on) state.integrated.add(id); else state.integrated.delete(id);
    changed();
    return ids.length;
  }
  // Without "keep", an integration goes with its node. Run by changed(), so every way of removing nodes is covered.
  function dropLostIntegrations() {
    if (keepIntegration) return;
    for (const id of [...state.integrated]) if (!state.alloc.has(id)) state.integrated.delete(id);
  }
  function setKeepIntegration(on) {
    keepIntegration = !!on;
    try { localStorage.setItem('esp.keepIntegration', on ? '1' : '0'); } catch { /* storage unavailable */ }
    // Turning it off drops integrations kept on unallocated nodes, as one undo step.
    if (!on && [...state.integrated].some(id => !state.alloc.has(id))) pushUndo();
    changed();
  }
  function setIntegPreview(on) {
    if (integPreview === !!on) return;
    integPreview = !!on;
    changed();
  }

  // ------------------------------------------------------------------ node rules (the mod's NodeEligibility.check)
  // Always checked: hull size (the Hull dropdown), node conflicts (SkillType.isExclusiveWith: a node's hull mods against
  // another's, via hullmod_conflicts.csv) and the logistics limit (LogisticsNodes). Facts about the actual ship and the
  // campaign come from the Ship rules dialog; anything left unset there isn't checked.
  const SHIELDS = { FRONT: tr('ship.shield.front'), OMNI: tr('ship.shield.omni'), NONE: tr('ship.shield.none'), PHASE: tr('ship.shield.phase') };
  const TRI_FACTS = ['civilian', 'charges', 'modules', 'builtInWings'];
  function blankShip() {
    return { shield: null, armor: null, civilian: null, charges: null, modules: null, builtInWings: null,
      hullMods: new Set(), extraLogistics: 0, lockedGates: new Set(), lockedTypes: new Set(), integCost: 'EXPONENTIAL' };
  }
  state.ship = blankShip();
  // Ship rules describe the hull; optional rules (locked gates and types) the campaign.
  const SHIP_KEYS = ['shield', 'armor', ...TRI_FACTS, 'hullMods', 'extraLogistics'];
  function shipRuleCount(sh = state.ship) {
    return (sh.shield ? 1 : 0) + (sh.armor != null ? 1 : 0) + TRI_FACTS.filter(k => sh[k] != null).length + sh.hullMods.size + (sh.extraLogistics ? 1 : 0);
  }
  const storyRuleCount = (sh = state.ship) => sh.lockedGates.size + sh.lockedTypes.size;
  const hasShields = s => s === 'FRONT' || s === 'OMNI';
  const shipHasHullMod = id => state.ship.hullMods.has(id) || (id === 'civgrade' && state.ship.civilian === true);

  // A type's own hull mods (vanilla + phantoms) and the ones it excludes (SkillType's constructor).
  const typeRuleCache = new Map();
  function typeRules(t) {
    let r = typeRuleCache.get(t.id);
    if (!r) {
      const own = [...new Set([t.vanillaHullMod, ...(t.phantomHullMods || [])].filter(Boolean))];
      const excl = t.exclusiveHullMods || [];
      const basis = own.length ? own : excl;
      const partners = basis.flatMap(h => (D.hullModConflicts && D.hullModConflicts[h]) || []).filter(h => !basis.includes(h));
      const excluded = [...new Set([...excl, ...partners])];
      r = { own, excluded, exclusiveAndOwn: [...new Set([...excluded, ...own])], exclusiveTypes: t.exclusiveSkillTypes || [] };
      typeRuleCache.set(t.id, r);
    }
    return r;
  }
  function typesExclusive(a, b) {
    const ra = typeRules(a), rb = typeRules(b);
    if (ra.exclusiveTypes.includes(b.id) || rb.exclusiveTypes.includes(a.id)) return true;
    if (a.id === b.id) return false;
    return ra.excluded.some(h => rb.own.includes(h)) || rb.excluded.some(h => ra.own.includes(h));
  }
  // AllocatedNode.isExclusiveWith: declared and effective types of both sides.
  const entriesExclusive = (p, q) => [p.declared, p.effective].some(a => [q.declared, q.effective].some(b => typesExclusive(a, b)));
  const isLogistics = t => (t.tier === 'NOTABLE' || t.tier === 'KEYSTONE') && (t.tags || []).includes('logistics_cap');
  const logisticsCap = () => (D.logisticsCap ?? 2) + (state.ship.extraLogistics || 0);
  const typeEffectNames = t => [...(t.effects || []), ...(t.hullSizeEffects || [])].map(e => e.effect);

  function entryFor(n, optionId) {
    return { node: n, declared: n.type, effective: optionId && types.get(optionId) ? types.get(optionId) : n.type };
  }
  // The build in allocation order (root first, then nodes a modspec cache grants), as the game's AllocatedNode list.
  function buildEntries(skip, withGranted = true) {
    const list = state.root ? [entryFor(byId.get(state.root), null)] : [];
    if (withGranted) for (const [id, g] of subState().granted) if (g.status === 'active' && id !== skip) list.push(entryFor(byId.get(id), null));
    for (const id of state.alloc) if (id !== skip) { const n = byId.get(id); list.push(entryFor(n, isChoice(n) ? state.choice.get(id) : null)); }
    return list;
  }
  // ShieldSkillEffect.resolveDisplayShieldType over the build's effects. null while the ship's shield isn't set,
  // unless a node settles it (removing the shield, say).
  function currentShield(list) {
    let s = state.ship.shield;
    for (const e of list) {
      for (const name of typeEffectNames(e.effective)) {
        if (name === 'REMOVE_SHIELD') s = 'NONE';
        else if (name === 'CREATE_FRONT_SHIELD_IF_NONE' && s === 'NONE') s = 'FRONT';
        else if (name === 'CONVERT_SHIELD_TO_FRONT' && hasShields(s)) s = 'FRONT';
        else if (name === 'CONVERT_SHIELD_TO_OMNI' && hasShields(s)) s = 'OMNI';
      }
    }
    return s;
  }
  const blockText = (key, fallback, args) => fill(S[key] || fallback, args || {});
  const nonPhaseText = () => blockText('node.requires.req_non_phase_hull', tr('rule.fallback.nonPhase'));
  // Effects that refuse some ships (each SkillEffect's blockAllocationReason). The extractor marks them with `blocks`;
  // tools/update.mjs flags any it marks that this table doesn't know.
  const EFFECT_BLOCKS = {
    REMOVE_SHIELD: s => s.shield != null && !hasShields(s.shield) ? blockText('node.block.noShields', tr('rule.fallback.noShields')) : null,
    SHIELD_UPKEEP_AT_LOW_SPEED_PERCENT: s => EFFECT_BLOCKS.REMOVE_SHIELD(s),
    DYNAMIC_GRID_ENERGY_WEAPON_BONUS_PERCENT: s => EFFECT_BLOCKS.REMOVE_SHIELD(s),
    CREATE_FRONT_SHIELD_IF_NONE: s => s.shield === 'PHASE' ? nonPhaseText() : null,
    CONVERT_SHIELD_TO_FRONT: s => s.shield === 'FRONT' ? blockText('node.block.hasFrontShield', tr('rule.fallback.frontShield')) : s.shield === 'PHASE' ? nonPhaseText() : null,
    CONVERT_SHIELD_TO_OMNI: s => s.shield === 'OMNI' ? blockText('node.block.hasOmniShield', tr('rule.fallback.omniShield')) : s.shield === 'PHASE' ? nonPhaseText() : null,
    PHASE_ANCHOR_EMERGENCY_DIVE: s => s.phaseHull === false ? blockText('node.block.phaseHull', tr('rule.fallback.phaseHull')) : null,
    ARMOR_FLAT_FOR_LOW_BASE_ARMOR: s => {
      // LowBaseArmorBonus.fits: a non-phase hull with base armor at or under its hull size's cutoff.
      const args = D.effects.ARMOR_FLAT_FOR_LOW_BASE_ARMOR?.hullArgs?.[HULL_ENUM[state.hull]];
      const cutoff = args ? evalExpr(args.cutoff, 1) : NaN;
      const why = blockText('node.block.lowBaseArmor', tr('rule.fallback.lowArmor'));
      if (s.phaseHull === true) return why;
      if (state.ship.armor != null && !(state.ship.armor <= cutoff)) return tr('rule.lowArmorDetail', { reason: why, cutoff: fmt(cutoff), hull: hullLabel(), armor: fmt(state.ship.armor) });
      return null;
    },
    REMOVE_ALL_FIGHTER_BAYS: () => state.ship.builtInWings === false ? blockText('node.block.builtInWingsOnly', tr('rule.fallback.builtInWings')) : null,
  };
  function hullRequirementUnmet(tag) {
    const sh = state.ship;
    const unmet = tag === 'req_civilian_hull' ? (sh.civilian === false && !sh.hullMods.has('civgrade'))
      : tag === 'req_non_phase_hull' ? sh.shield === 'PHASE'
      : tag === 'req_system_charges' ? sh.charges === false
      : tag === 'req_modules' ? sh.modules === false : false;
    return unmet ? blockText('node.requires.' + tag, tr('rule.fallback.requires', { requirement: requirementName(tag) })) : null;
  }
  const HULL_SIZE_NAMES = { FRIGATE: tr('name.hull.frigate.plural'), DESTROYER: tr('name.hull.destroyer.plural'), CRUISER: tr('name.hull.cruiser.plural'), CAPITAL_SHIP: tr('name.hull.capital.plural') };
  // "a, b and c"
  const listWords = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(tr('common.listComma')) + tr('common.listAnd') + a[a.length - 1];

  // Why `n` (as `optionId`, for choice nodes) can't be allocated after the entries in `list`, or null.
  // Same order as NodeEligibility.check: locked, hull size, hull requirements, hull mods, other nodes, effects, logistics.
  function blockOf(n, optionId, list) {
    const sh = state.ship;
    const e = entryFor(n, optionId);
    for (const t of [e.declared, e.effective]) {
      if (sh.lockedTypes.has(t.id)) return { kind: 'locked', text: tr('rule.notUnlocked', { unlock: unlockText(t) }) };
    }
    const gate = n.gates.find(g => sh.lockedGates.has(g));
    // The mod's gate wording, lowercased to fit inside the sentence.
    if (gate) return { kind: 'locked', text: tr('rule.lockedUntil', { gate: gateText(gate).replace(/^./, c => c.toLowerCase()) }) };
    const hull = HULL_ENUM[state.hull];
    for (const t of [e.declared, e.effective]) {
      const sizes = t.requiredHullSizes || [];
      if (sizes.length && !sizes.includes(hull)) return { kind: 'hull', text: tr('rule.hullSize', { hull: HULL_SIZE_NAMES[hull], hulls: listWords(sizes.map(x => HULL_SIZE_NAMES[x] || x)) }) };
    }
    const tags = new Set([...n.tags, ...(e.declared.tags || []), ...(optionId ? e.effective.tags || [] : [])]);
    for (const tag of tags) { const why = hullRequirementUnmet(tag); if (why) return { kind: 'ship', text: why }; }
    for (const t of [e.declared, e.effective]) {
      for (const h of typeRules(t).exclusiveAndOwn) {
        if (shipHasHullMod(h)) return { kind: 'ship', text: blockText('node.block.hullModInstalled', textTemplate('rule.fallback.hullModInstalled', {}), { hullmod: hullModName(h) }) };
      }
    }
    for (const other of list) {
      if (other.node !== n && entriesExclusive(e, other)) {
        return { kind: 'conflict', with: other.node, text: blockText('node.block.typeAllocated', textTemplate('rule.fallback.typeAllocated', {}), { node: other.effective.name }) };
      }
    }
    const shield = currentShield(list);
    const facts = { shield, phaseHull: sh.shield == null ? null : sh.shield === 'PHASE' };
    for (const name of typeEffectNames(e.effective)) {
      const why = EFFECT_BLOCKS[name] && EFFECT_BLOCKS[name](facts);
      if (why) return { kind: 'ship', text: why };
    }
    if (isLogistics(e.effective) && list.filter(x => isLogistics(x.effective)).length >= logisticsCap()) {
      return { kind: 'logistics', text: tr('rule.logisticsDetail', { reason: blockText('node.block.logisticsCap', tr('rule.fallback.logisticsCap')), limit: logisticsCap() }) };
    }
    return null;
  }
  // AllocationCheck.computeAllocation: a choice node can go in if any option can. Prefers `preferred`, then the others.
  function placement(n, list, preferred) {
    if (!isChoice(n)) { const b = blockOf(n, null, list); return { option: null, block: b }; }
    const order = [...new Set([preferred, ...n.type.options])].filter(o => o && n.type.options.includes(o));
    let first = null;
    for (const o of order) { const b = blockOf(n, o, list); if (!b) return { option: o, block: null }; first = first || b; }
    return { option: null, block: first };
  }

  // Per-change caches: the build as entries, each unallocated node's block against it, and allocated nodes that
  // break a rule (replaying the build in order, so of two conflicting nodes the later one is flagged).
  let ruleCache = null;
  function rules() {
    if (ruleCache) return ruleCache;
    const list = buildEntries();
    const problems = new Map();
    const replay = list.filter(e => !state.alloc.has(e.node.id));
    for (const e of list.filter(x => state.alloc.has(x.node.id))) {
      const b = blockOf(e.node, isChoice(e.node) ? state.choice.get(e.node.id) : null, replay);
      if (b) problems.set(e.node.id, b);
      replay.push(e);
    }
    ruleCache = { list, problems, blocks: new Map() };
    return ruleCache;
  }
  function staticBlock(n) {
    const rc = rules();
    if (!rc.blocks.has(n.id)) rc.blocks.set(n.id, held(n.id) ? null : placement(n, rc.list, defaultOptionOrNull(n)).block);
    return rc.blocks.get(n.id);
  }
  const defaultOptionOrNull = n => (isChoice(n) && state.root ? defaultOption(n) : null);

  // Wording for the Ship rules lists.
  function gateText(g) {
    const s = S['socketable.anchor.gate.' + g];
    if (s) return plain(s).replace(/^Inert until\s+/i, '').replace(/\.$/, '').replace(/^./, c => c.toUpperCase());
    return gameStateName(g);
  }
  // ------------------------------------------------------------------ subroutines (socket items besides anchors)
  // One item per socket: an anchor (state.links) or a subroutine (state.subs). A subroutine only works while its socket is
  // allocated. Mirrors the mod: SubroutineRadius/NodeRadiusCache (radius), RootConduits, EmptyShells, GatedSubroutines,
  // ModspecCaches/NodeAllocator.grantSocketedNodes (granted notables), DoctrineOverrides (shown, not simulated: its rolls
  // come from a hidden per-item seed).
  const SUBS = new Map((D.subroutines || []).map(s => [s.id, s]));
  // Rarity 0 in subroutines.csv: no drop pool picks it (ItemDrops.isDroppable). Still socketable here, for copies already owned.
  const UNOBTAINABLE_TEXT = tr('label.unobtainable');
  const AFFINITY_KEYS = ['LOW_TECH_AFFINITY_FLAT', 'MIDLINE_AFFINITY_FLAT', 'HIGH_TECH_AFFINITY_FLAT'];
  // Gating subroutines: the effect that gates, its condition (the id is the mod's summary.gated.* key), and the
  // condition's name as a heading and inside a sentence.
  const GATE_OF = { GATES_RADIUS_WHILE_PHASED: 'PHASED', GATES_RADIUS_BELOW_HALF_HULL: 'LOW_HULL', GATES_RADIUS_WHILE_SYSTEM_ACTIVE: 'SYSTEM_ACTIVE' };
  const GATE_NAMES = { PHASED: tr('name.gate.phased'), LOW_HULL: tr('name.gate.lowHull'), SYSTEM_ACTIVE: tr('name.gate.systemActive') };
  const GATE_IN_SENTENCE = { PHASED: tr('name.gate.phased.inSentence'), LOW_HULL: tr('name.gate.lowHull.inSentence'), SYSTEM_ACTIVE: tr('name.gate.systemActive.inSentence') };
  const RADIUS_NAMES = { small: tr('label.radius.small'), medium: tr('label.radius.medium'), large: tr('label.radius.large'), extra_large: tr('label.radius.extra_large') };
  const radiusName = r => RADIUS_NAMES[r] || tr('label.radius.other', { radius: String(r).replace(/_/g, ' ') });
  const subRadius = def => (def && def.radius && D.nodeRadii ? D.nodeRadii[def.radius] || 0 : 0);
  const radiusExcluded = n => n.volume === 'exotech' || n.type.id === 'exoship';
  const radiusMembers = new Map();
  // Nodes within `r` of the socket (straight-line, inclusive), any tree but Exotech; the socket itself excluded.
  function nodesInRadius(socket, r) {
    const key = socket.id + '|' + r;
    let list = radiusMembers.get(key);
    if (!list) {
      list = radiusExcluded(socket) ? [] : nodes.filter(n => n !== socket && !radiusExcluded(n) && (n.x - socket.x) ** 2 + (n.y - socket.y) ** 2 <= r * r);
      radiusMembers.set(key, list);
    }
    return list;
  }
  const RADIUS_TIERS = new Set(['SMALL', 'NOTABLE', 'KEYSTONE']);
  const subLine = (def, effect) => (def.lines || []).find(l => l.effect === effect);
  // Notables a modspec cache can hold: NOTABLE, not a choice node, anywhere in the tree (ModspecCaches.rollableNodeIds).
  const grantableNodes = nodes.filter(n => n.tier === 'NOTABLE' && !isChoice(n));

  // What the socketed subroutines do with the current build. Cached per change (cleared in changed()).
  let subCache = null;
  function subState() {
    if (subCache) return subCache;
    const active = [...state.subs].filter(([s, e]) => state.alloc.has(s) && SUBS.has(e.id)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([s, e]) => ({ socket: byId.get(s), def: SUBS.get(e.id), entry: e }));
    const sc = { active, silent: new Set(), shellCount: new Map(), gated: new Map(), granted: new Map(), conduit: null, doctrine: null };
    for (const a of active) {
      const r = subRadius(a.def);
      if (subLine(a.def, 'EVERY_AFFINITY_FLAT_PER_EMPTY_SHELL_NODE') && r) {
        // EmptyShells: small nodes in its radius grant nothing; the socket counts all of them, allocated or not.
        const smalls = nodesInRadius(a.socket, r).filter(n => n.tier === 'SMALL');
        sc.shellCount.set(a.socket.id, smalls.length);
        for (const n of smalls) if (state.alloc.has(n.id)) sc.silent.add(n.id);
      }
      const gate = (a.def.lines || []).find(l => GATE_OF[l.effect]);
      if (gate && r) {
        // GatedSubroutines: the first socket (by id) claims a node.
        for (const n of nodesInRadius(a.socket, r)) {
          if (RADIUS_TIERS.has(n.tier) && !sc.gated.has(n.id)) sc.gated.set(n.id, { when: GATE_OF[gate.effect], strength: gate.max, def: a.def, socket: a.socket });
        }
      }
      if (a.def.kind === 'DOCTRINE' && !sc.doctrine && r) {
        sc.doctrine = { def: a.def, socket: a.socket, nodes: new Set(nodesInRadius(a.socket, r).filter(n => RADIUS_TIERS.has(n.tier)).map(n => n.id)) };
      }
      if (a.def.kind === 'ROOT_CONDUIT' && !sc.conduit) sc.conduit = { def: a.def, socket: a.socket, aff: a.entry.aff || AFFINITY_KEYS[0], route: null, count: 0 };
      if (a.def.kind === 'MODSPEC_CACHE') {
        for (const id of a.entry.grants || []) {
          const n = byId.get(id);
          if (!n) continue;
          let status = 'active';
          if (sat(id)) status = 'byPath';
          else if (sc.granted.has(id)) status = 'duplicate';
          else if (switchedOff(n)) status = 'volumeOff';
          sc.granted.set(id, sc.granted.get(id) || { def: a.def, socket: a.socket, status });
        }
      }
    }
    // A granted node the rules refuse stays inactive (AllocationCheck.grant: eligibility only, item cost waived).
    const placed = buildEntries(null, false);
    for (const [id, g] of sc.granted) {
      if (g.status !== 'active') continue;
      const b = blockOf(byId.get(id), null, placed);
      if (b) { g.status = 'ineligible'; g.block = b; } else placed.push(entryFor(byId.get(id), null));
    }
    if (sc.conduit) {
      const route = conduitRoute(sc.conduit.socket, id => sat(id) || sc.granted.get(id)?.status === 'active');
      sc.conduit.route = route;
      sc.conduit.count = route ? Math.max(0, route.length - 2) : 0;
    }
    subCache = sc;
    return sc;
  }
  const grantedActive = id => { const g = subState().granted.get(id); return !!g && g.status === 'active'; };
  const held = id => sat(id) || grantedActive(id);
  // RootConduits.allocatedRoute: shortest route over allocated nodes from the root to the socket; exits only through partners.
  function conduitRoute(socket, isHeld) {
    if (!state.root) return null;
    const prev = new Map([[state.root, null]]);
    const queue = [byId.get(state.root)];
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      if (cur === socket) break;
      const steps = cur.adj.filter(m => m.tier !== 'WORMHOLE_EXIT');
      const p = partnerOf(cur);
      if (p) steps.push(p);
      for (const m of steps) {
        if (prev.has(m.id) || !isHeld(m.id)) continue;
        prev.set(m.id, cur.id);
        queue.push(m);
      }
    }
    if (!prev.has(socket.id)) return null;
    const route = [];
    for (let id = socket.id; id; id = prev.get(id)) route.push(id);
    return route.reverse();
  }
  // Per-ship limits: SubroutineKind (doctrine, conduit: 1) and the item's own socket_limit (uniques: 1).
  function subLimitProblem(def, socketId) {
    const others = [...state.subs].filter(([s]) => s !== socketId).map(([, e]) => SUBS.get(e.id)).filter(Boolean);
    const kindCap = D.subroutineKinds && D.subroutineKinds[def.kind] ? D.subroutineKinds[def.kind].perShip : null;
    if (kindCap != null && others.filter(o => o.kind === def.kind).length >= kindCap) return tr('rule.subKindLimit', { count: kindCap, kind: idName('subKind', def.kind, () => humanize(def.kind).toLowerCase()) });
    if (def.socketLimit && others.filter(o => o.id === def.id).length >= def.socketLimit) return tr('rule.subLimit', { count: def.socketLimit });
    return null;
  }
  const affinityName = k => AFFINITY_NAMES[k] || humanize(k);
  // A node's icon for the HTML lists and tooltips. Sockets have no icon in the data (the tree draws them as octagons),
  // so they show the socketed subroutine's icon, or a drawn octagon when empty.
  const SOCKET_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="7.5,2 16.5,2 22,7.5 22,16.5 16.5,22 7.5,22 2,16.5 2,7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
  function nodeIconHtml(n, t = effectiveType(n)) {
    if (n.tier === 'SOCKET') {
      const e = state.subs.get(n.id), d = e && SUBS.get(e.id);
      return d && d.icon ? iconImg(d.icon, d.name) : `<span class="icon-svg">${SOCKET_SVG}</span>`;
    }
    return t && t.icon ? iconImg(t.icon, t.name) : '<span class="icon-svg"></span>';
  }
  function unlockText(t) {
    const parts = (t.unlockConditions || []).map(c => {
      if (c.type === 'blueprint') return tr('rule.unlock.blueprint', { hullmod: hullModName(c.id || c.key) });
      if (c.type === 'characterStat') return humanize(String(c.statId || c.key || tr('rule.unlock.characterStat')).replace(/^has_/, ''));
      if (c.type === 'memoryFlag') return humanize(String(c.key || tr('rule.unlock.campaignFlag')).replace(/^\$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'));
      if (c.type === 'minShipLevel') return tr('rule.unlock.shipLevel', { level: c.minLevel });
      return humanize(String(c.type));
    });
    return parts.length ? parts.join(tr('common.listOr')) : tr('rule.unlock.any');
  }

  // ------------------------------------------------------------------ template export
  // Matches the mod's shared template file (SkillTreeTemplateStore / TemplateCodec):
  //   saves/common/exiledSector_skillTreeTemplates.json.data = {"v":1,"templates":[{v,id,name,root,hull,steps,anchors,integrate}]}
  // integrate (mod 0.12.0): node ids marked for integration, only nodes in the steps (SkillTreeTemplate.marksOnSteps).
  // In game the marks are reminders (templates never integrate); the planner loads them as integrated nodes.
  // Steps follow TemplateCapture: allocation order, each step joined to the root or an earlier step, a wormhole's
  // partner (or a socket's linked exit) right after it, choice nodes as "node=option", root excluded.
  const TEMPLATE_FILE = 'exiledSector_skillTreeTemplates.json.data';
  const TEMPLATE_NAME_MAX = 32;
  const HULL_ENUM = { frigate: 'FRIGATE', destroyer: 'DESTROYER', cruiser: 'CRUISER', capitalShip: 'CAPITAL_SHIP' };
  const HULL_ENUM_VALUES = new Set(Object.values(HULL_ENUM));
  const HULL_ENUM_LABEL = { FRIGATE: tr('name.hull.frigate'), DESTROYER: tr('name.hull.destroyer'), CRUISER: tr('name.hull.cruiser'), CAPITAL_SHIP: tr('name.hull.capital') };
  // A hull size inside a sentence, by the Hull dropdown's value.
  const HULL_IN_SENTENCE = { frigate: tr('name.hull.frigate.inSentence'), destroyer: tr('name.hull.destroyer.inSentence'), cruiser: tr('name.hull.cruiser.inSentence'), capitalShip: tr('name.hull.capital.inSentence') };
  const anchorByExit = new Map((D.wormholeAnchors || []).map(a => [a.exit, a]));

  function templateSteps() {
    const unplaced = [...state.alloc].filter(id => id !== state.root);
    const placed = new Set([state.root]);
    const steps = [];
    const place = n => {
      placed.add(n.id);
      const opt = isChoice(n) ? state.choice.get(n.id) : null;
      steps.push(opt ? `${n.id}=${opt}` : n.id);
    };
    while (unplaced.length) {
      const i = unplaced.findIndex(id => { const n = byId.get(id); return n.links.length === 0 || n.links.some(l => placed.has(l)); });
      if (i < 0) break;
      const n = byId.get(unplaced.splice(i, 1)[0]);
      place(n);
      const p = partnerOf(n);
      const j = p ? unplaced.indexOf(p.id) : -1;
      if (j >= 0) { unplaced.splice(j, 1); place(p); }
    }
    for (const id of unplaced) place(byId.get(id)); // the mod appends anything left over the same way
    return steps;
  }
  function templateAnchors() {
    const anchors = {};
    for (const [socket, exit] of state.links) { const a = anchorByExit.get(exit); if (a) anchors[socket] = a.id; }
    return anchors;
  }
  // The build's integrations as template marks: allocated nodes only, since a mark must be on a step.
  const templateMarks = () => [...state.integrated].filter(id => state.alloc.has(id));
  function newTemplateId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  // The template the build came from (loaded or saved) is shown in the top bar. `sig` is a hash of the root and steps
  // at that moment, so the bar can say "(edited)" once the build no longer matches.
  const hashText = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  // Integration marks join the signature only when there are any, so older saved signatures still match.
  const templateSig = () => {
    if (!state.root) return '';
    const marks = templateMarks();
    return hashText(state.root + '|' + templateSteps().join(',') + (marks.length ? '|i:' + marks.join(',') : ''));
  };
  function setCurrentTemplate(name) {
    state.template = name ? { name: String(name).trim(), sig: templateSig() } : null;
    renderChrome();
    persist();
  }
  function buildTemplate(name, id) {
    const t = { v: 1, id: id || newTemplateId(), name: name.trim(), root: state.root, hull: HULL_ENUM[state.hull], steps: templateSteps() };
    const anchors = templateAnchors();
    if (Object.keys(anchors).length) t.anchors = anchors;
    const marks = templateMarks();
    if (marks.length) t.integrate = marks;
    return t;
  }
  // Template names: the mod's rules (TemplateNames: trimmed, 1 to 32 characters, unique per root) plus a safe character
  // set, printable ASCII. The mod itself accepts any non-control character, but its keyboard input and default font only
  // reliably handle English letters, digits and keyboard symbols, so other characters may not type or show in game.
  const NAME_CHAR = /[\x20-\x7E]/;
  const badNameChars = s => [...new Set([...String(s)].filter(c => !NAME_CHAR.test(c)))];
  const charLabel = c => (/\s|[​-‏﻿]/.test(c) || c.codePointAt(0) < 32 ? '' : `"${c}" `) + `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
  // The first five unusable characters, as a list ("é" U+00E9, …).
  const badCharsText = bad => {
    const list = bad.slice(0, 5).map(charLabel).join(tr('common.listComma'));
    return bad.length > 5 ? tr('templates.name.charsMore', { chars: list }) : list;
  };
  function templateNameProblem(name) {
    const n = name.trim();
    if (!n) return tr('templates.name.empty');
    const bad = badNameChars(n);
    if (bad.length) return tr('templates.name.badChars', { chars: badCharsText(bad) });
    if ([...n].length > TEMPLATE_NAME_MAX) return tr('templates.name.tooLong', { max: TEMPLATE_NAME_MAX });
    return null;
  }
  // Keeps a name box to the safe set as you type or paste: anything else is taken out and the status says what.
  // (Skipped while an input method is composing, then applied when it finishes.)
  function guardNameInput(input, report) {
    const clean = () => {
      const bad = badNameChars(input.value);
      if (!bad.length) return false;
      const pos = input.selectionStart;
      const before = input.value.slice(0, pos ?? input.value.length);
      input.value = [...input.value].filter(c => NAME_CHAR.test(c)).join('');
      const caret = [...before].filter(c => NAME_CHAR.test(c)).join('').length;
      try { input.setSelectionRange(caret, caret); } catch { /* not focused */ }
      report(tr('templates.name.removed', { chars: badCharsText(bad) }), 'err');
      input.dataset.cleaned = '1'; // tells the box's own input handler to keep this message once
      return true;
    };
    input.addEventListener('input', e => { if (!e.isComposing) clean(); }, true);
    input.addEventListener('compositionend', () => { if (clean()) input.dispatchEvent(new Event('input')); });
  }
  // Reads the file's templates the way the mod does: an object with "templates", or a bare array. Empty means none.
  function parseTemplateFile(text) {
    const s = (text || '').trim();
    if (!s) return [];
    let parsed;
    try { parsed = JSON.parse(s); } catch { throw new Error(tr('templates.file.notJson')); }
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.templates) ? parsed.templates : null;
    if (!list) throw new Error(tr('templates.file.noList'));
    return list;
  }
  // Index of the template with this name and root (names are unique per root, case-insensitive, like TemplateNames).
  function findTemplateIndex(list, name, root = state.root) {
    const folded = name.trim().toLowerCase();
    return list.findIndex(t => t && typeof t === 'object' && t.root === root && String(t.name || '').trim().toLowerCase() === folded);
  }
  // A free name in the style of TemplateNames.unique: the name itself, else "name 2", "name 3"... within 32 characters.
  function uniqueTemplateName(base, list) {
    const cut = (s, n) => [...s].slice(0, n).join('').trimEnd();
    const b = cut(base.trim(), TEMPLATE_NAME_MAX);
    if (findTemplateIndex(list, b) < 0) return b;
    for (let k = 2; ; k++) {
      const suffix = ' ' + k;
      const candidate = cut(b, TEMPLATE_NAME_MAX - suffix.length) + suffix;
      if (findTemplateIndex(list, candidate) < 0) return candidate;
    }
  }
  // What saving under this name would do: replace a template (and whether its hull differs) or add one.
  function planMerge(fileText, name) {
    const list = parseTemplateFile(fileText);
    const i = findTemplateIndex(list, name);
    const existing = i >= 0 ? list[i] : null;
    const existingHull = existing && HULL_ENUM_VALUES.has(existing.hull) ? existing.hull : null;
    const hullConflict = !!existingHull && existingHull !== HULL_ENUM[state.hull];
    return { list, index: i, existing, existingHull, hullConflict };
  }
  // Saves the build under `name`. Replacing keeps the template's id, so ships assigned to it stay assigned.
  // hull: 'keep' keeps an existing template's hull (as the game's replaceSteps does), 'change' writes the Hull dropdown's.
  // A name that matches nothing adds a new template with the dropdown's hull.
  function mergeTemplate(fileText, name, hull = 'keep') {
    const plan = planMerge(fileText, name);
    const { list, index: i, existing } = plan;
    const template = buildTemplate(name, existing ? existing.id : null);
    if (existing && hull === 'keep') {
      if (existing.hull) template.hull = existing.hull; else delete template.hull;
    }
    if (i >= 0) list[i] = template; else list.push(template);
    return { text: JSON.stringify({ v: 1, templates: list }, null, 2), replaced: i >= 0, template, count: list.length };
  }

  // ------------------------------------------------------------------ template codes
  // One template as pasteable text: "ES1." + base64url(deflate-raw(JSON)). The JSON is the template file entry without
  // its id (the receiver's file gives it one), plus the mod version it was made with. "ES0." is the same without
  // compression, for browsers lacking CompressionStream.
  const CODE_PREFIX = 'ES1.';
  const CODE_PREFIX_PLAIN = 'ES0.';
  const bytesToB64url = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const b64urlToBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  async function streamBytes(bytes, transform) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer());
  }
  async function templateToCode(t) {
    const body = { v: 1, name: t.name, root: t.root };
    if (t.hull) body.hull = t.hull;
    body.steps = Array.isArray(t.steps) ? t.steps : [];
    if (t.anchors && Object.keys(t.anchors).length) body.anchors = t.anchors;
    if (Array.isArray(t.integrate) && t.integrate.length) body.integrate = t.integrate;
    if (D.modVersion) body.mod = D.modVersion;
    const bytes = new TextEncoder().encode(JSON.stringify(body));
    if (typeof CompressionStream === 'function') return CODE_PREFIX + bytesToB64url(await streamBytes(bytes, new CompressionStream('deflate-raw')));
    return CODE_PREFIX_PLAIN + bytesToB64url(bytes);
  }
  // Accepts a code only (whitespace and line breaks from chat apps are ignored). Pasted template JSON was accepted
  // once; it was dropped with the Copy template JSON button (see TODO.md).
  async function codeToTemplate(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error(tr('templates.code.empty'));
    const invalid = () => new Error(tr('templates.code.invalid'));
    let json;
    {
      const code = raw.replace(/\s+/g, '');
      const compressed = code.startsWith(CODE_PREFIX);
      if (!compressed && !code.startsWith(CODE_PREFIX_PLAIN)) throw invalid();
      if (code.length > 200000) throw invalid();
      try {
        let bytes = b64urlToBytes(code.slice(CODE_PREFIX.length));
        if (compressed) {
          if (typeof DecompressionStream !== 'function') throw Object.assign(new Error(tr('templates.code.browser')), { browser: true });
          bytes = await streamBytes(bytes, new DecompressionStream('deflate-raw'));
        }
        json = new TextDecoder().decode(bytes);
      } catch (err) {
        if (err && err.browser) throw err;
        throw invalid();
      }
    }
    let t;
    try { t = JSON.parse(json); } catch { throw invalid(); }
    if (!t || typeof t !== 'object' || Array.isArray(t) || !t.root || !t.name || !Array.isArray(t.steps)) {
      throw invalid();
    }
    return t;
  }

  // ------------------------------------------------------------------ serialization (URL hash + localStorage)
  function serialize() {
    const o = { v: 1, r: state.root, a: [...state.alloc], h: state.hull, cap: state.cap };
    if (state.hiddenVolumes.size) o.ov = [...state.hiddenVolumes];
    if (state.choice.size) o.c = Object.fromEntries(state.choice);
    if (state.links.size) o.s = Object.fromEntries(state.links);
    const sh = state.ship, so = {};
    if (sh.shield) so.sh = sh.shield;
    if (sh.armor != null) so.ar = sh.armor;
    for (const k of TRI_FACTS) if (sh[k] != null) so[k] = sh[k] ? 1 : 0;
    if (sh.hullMods.size) so.hm = [...sh.hullMods];
    if (sh.extraLogistics) so.lg = sh.extraLogistics;
    if (sh.lockedGates.size) so.gt = [...sh.lockedGates];
    if (sh.lockedTypes.size) so.ty = [...sh.lockedTypes];
    if (sh.integCost !== 'EXPONENTIAL') so.ic = sh.integCost;
    if (Object.keys(so).length) o.ship = so;
    if (state.template) { o.tn = state.template.name; o.th = state.template.sig; }
    if (state.integrated.size) o.ig = [...state.integrated];
    if (state.subs.size) {
      o.sb = {};
      for (const [s, e] of state.subs) {
        const x = { i: e.id };
        if (e.aff) x.a = e.aff;
        if (e.grants && e.grants.length) x.g = e.grants;
        o.sb[s] = x;
      }
    }
    return JSON.stringify(o);
  }
  function readShip(so) {
    const sh = blankShip();
    if (!so || typeof so !== 'object') return sh;
    if (SHIELDS[so.sh]) sh.shield = so.sh;
    if (Number.isFinite(so.ar) && so.ar >= 0) sh.armor = so.ar;
    for (const k of TRI_FACTS) if (so[k] === 0 || so[k] === 1) sh[k] = so[k] === 1;
    if (Array.isArray(so.hm)) sh.hullMods = new Set(so.hm.filter(h => typeof h === 'string'));
    if (Number.isFinite(so.lg) && so.lg > 0) sh.extraLogistics = Math.min(20, Math.round(so.lg));
    if (Array.isArray(so.gt)) sh.lockedGates = new Set(so.gt.filter(g => typeof g === 'string'));
    if (Array.isArray(so.ty)) sh.lockedTypes = new Set(so.ty.filter(t => types.has(t)));
    if (Object.hasOwn(INTEG_COST, so.ic)) sh.integCost = so.ic;
    return sh;
  }
  function deserialize(json) {
    let o;
    try { o = JSON.parse(json); } catch { return false; }
    if (!o || typeof o !== 'object') return false;
    state.root = o.r && byId.has(o.r) && byId.get(o.r).tier === 'ROOT' ? o.r : null;
    state.alloc = new Set((o.a || []).filter(id => byId.has(id) && id !== state.root));
    state.choice = new Map(Object.entries(o.c || {}).filter(([id, opt]) => state.alloc.has(id) && types.has(opt)));
    state.links = new Map(Object.entries(o.s || {}).filter(([s, e]) => state.alloc.has(s) && state.alloc.has(e)));
    if (HULL_KEYS.includes(o.h)) state.hull = o.h;
    if (Number.isFinite(o.cap) && o.cap > 0) state.cap = Math.min(999, Math.round(o.cap));
    // Hidden Optional Volumes. Older builds had one "Faction volumes" switch (wv: 0 hid them all) and a
    // "Core wormholes" switch (wc), which the game has no setting for and is now ignored.
    state.hiddenVolumes = new Set(Array.isArray(o.ov) ? o.ov.filter(id => OPTIONAL_VOLUMES.some(g => g.id === id))
      : o.wv === 0 ? OPTIONAL_VOLUMES.map(g => g.id) : []);
    state.ship = readShip(o.ship);
    state.template = typeof o.tn === 'string' && o.tn.trim() ? { name: o.tn.trim().slice(0, 64), sig: String(o.th || '') } : null;
    state.integrated = new Set((Array.isArray(o.ig) ? o.ig : []).filter(id => typeof id === 'string').map(currentNodeId).filter(id => byId.has(id)));
    state.subs = new Map();
    for (const [s, x] of Object.entries(o.sb || {})) {
      if (!x || !SUBS.has(x.i) || !state.alloc.has(s) || state.links.has(s) || byId.get(s)?.tier !== 'SOCKET') continue;
      const e = { id: x.i };
      if (AFFINITY_KEYS.includes(x.a)) e.aff = x.a;
      if (Array.isArray(x.g)) e.grants = x.g.map(currentNodeId).filter(id => byId.has(id)).slice(0, 3);
      state.subs.set(s, e);
    }
    if (!state.root) state.alloc.clear();
    else pruneSwitchedOff(); // a hand-edited or old link could hold nodes the options rule out
    return true;
  }
  const b64encode = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64decode = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
  // Unused while the Copy link button is removed (see TODO.md); #b= links still load in loadInitial.
  function shareUrl() {
    const url = new URL(location.href);
    url.hash = 'b=' + b64encode(serialize());
    return url.toString();
  }
  function loadInitial() {
    const m = location.hash.match(/b=([A-Za-z0-9_-]+)/);
    if (m) { try { if (deserialize(b64decode(m[1]))) return; } catch { /* fall through */ } }
    try { const saved = localStorage.getItem('esp.build'); if (saved) deserialize(saved); } catch { /* storage unavailable */ }
  }
  function persist() {
    try { localStorage.setItem('esp.build', serialize()); } catch { /* storage unavailable */ }
  }

  // ------------------------------------------------------------------ text
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function styled(text) {
    // Game markup: <good>, <bad>, <hl>, <muted>, <builtIn> (the story point colour). Escape everything else.
    return esc(text)
      .replace(/&lt;(good|bad|hl|muted|builtIn)&gt;/g, (_, c) => `<span class="${c.toLowerCase()}">`)
      .replace(/&lt;\/(good|bad|hl|muted|builtIn)&gt;/g, '</span>');
  }
  const plain = html => html.replace(/<[^>]+>/g, '');
  function fmt(v) {
    if (!Number.isFinite(v)) return String(v);
    const r = Math.round(v * 100) / 100;
    return String(r);
  }
  function fill(tpl, args) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in args ? args[k] : '?'));
  }
  function evalExpr(expr, magnitude) {
    try {
      // Extractor only emits numbers, operators and these names.
      // eslint-disable-next-line no-new-func
      // join(...) builds "a/b/c/d" per-hull lists, as the mod's *ByHullSize helpers do.
      const join = (...xs) => xs.map(fmt).join('/');
      return Function('magnitude', 'round', 'abs', 'max', 'min', 'join', `return (${expr});`)(magnitude, Math.round, Math.abs, Math.max, Math.min, join);
    } catch { return NaN; }
  }
  function humanize(name) {
    return name.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  }
  const swapGoodBad = s => s.replace(/<(\/?)good>/g, '<$1tmpx>').replace(/<(\/?)bad>/g, '<$1good>').replace(/<(\/?)tmpx>/g, '<$1bad>');

  // Returns game-markup text for one effect at a magnitude.
  function describeRaw(name, mag) {
    const e = D.effects[name] || {};
    const key = 'effect.' + name;
    let tpl = S[key];
    let value = mag;
    // Hull-specific wording (effect.NAME.hullSize) when the effect has per-hull values for the Hull dropdown's size.
    const hullArgs = e.hullArgs && S[key + '.hullSize'] != null ? e.hullArgs[HULL_ENUM[state.hull]] : null;
    if (hullArgs) tpl = S[key + '.hullSize'];
    if (tpl == null) {
      if (S[key + '.one'] != null || S[key + '.other'] != null) tpl = Math.abs(mag) === 1 ? (S[key + '.one'] ?? S[key + '.other']) : (S[key + '.other'] ?? S[key + '.one']);
      else if (S[key + '.more'] != null) { tpl = mag >= 0 ? S[key + '.more'] : S[key + '.less']; value = Math.abs(mag); }
      else if (S[key + '.increases'] != null) { tpl = mag >= 0 ? S[key + '.increases'] : S[key + '.reduces']; value = Math.abs(mag); }
    }
    if (tpl != null) {
      const args = { value: fmt(value) };
      const argExprs = { ...(e.args || {}), ...(hullArgs || {}) };
      for (const [k, expr] of Object.entries(argExprs)) {
        const v = evalExpr(expr, mag);
        if (typeof v === 'string') args[k] = v;
        else if (Number.isFinite(v)) args[k] = fmt(k === 'value' && value !== mag ? Math.abs(v) : v);
      }
      return fill(tpl, args);
    }
    let mode = e.mode || (name.endsWith('_MULT') ? 'mult' : name.endsWith('_PERCENT') ? 'pct' : name.endsWith('_FLAT') ? 'flat' : null);
    if (mode === 'percent') mode = 'pct';
    let stat = null;
    if (e.weaponFamily) {
      const statName = S['weapon.stat.' + e.weaponFamily];
      stat = e.weaponScope && !e.unqualified ? fill(S['weapon.qualified'] || '{scope} {stat}', { scope: S['weapon.scope.' + e.weaponScope], stat: statName }) : statName;
      if (e.weaponFamily === 'GUIDANCE' && mode === 'flat' && S['weapon.guidanceImproved']) return S['weapon.guidanceImproved'];
    } else if (e.stat) stat = S[e.stat];
    else if (/_AFFINITY_FLAT$/.test(name)) stat = AFFINITY_STATS[name] || null;
    if (stat && mode) {
      // As the mod's describeStat: `negate` words -magnitude (the survey cost reductions are stored as positive amounts),
      // and `subject` puts "Your fleet has" first (desc.<mode>.<up|down>.subject).
      const shown = e.negate ? -mag : mag;
      const dir = shown >= 0 ? 'up' : 'down';
      const subject = e.subject && S[e.subject];
      const t = (subject && S[`desc.${mode}.${dir}.subject`]) || S[`desc.${mode}.${dir}`];
      if (t) {
        const out = fill(t, { stat, value: fmt(Math.abs(shown)), subject: subject || '' });
        return e.lowerIsBetter ? swapGoodBad(out) : out;
      }
    }
    return `${humanize(name)}: <hl>${fmt(mag)}</hl>`;
  }
  const describe = (name, mag) => styled(describeRaw(name, mag));

  // integ: use the type's integrated block (IntegratedEffects: a full replacement of effects and hullSizeEffects, and
  // of effectText when it has any), as SkillType.effectsFor(hullSize, integrated) does.
  function typeEffects(t, integ = false) {
    const src = integ && t.integrated ? t.integrated : t;
    const out = [];
    for (const e of src.effects || []) out.push({ effect: e.effect, magnitude: e.magnitude });
    // A per-hull value of 0 is left out, as the game's HullSizeSkillEffect.addNonZero does (Inertial Supercharging's
    // damage taken is frigate only, for example), so it shows no "0%" line and gives no source.
    for (const e of src.hullSizeEffects || []) { const v = e[state.hull] ?? 0; if (v !== 0) out.push({ effect: e.effect, magnitude: v, hullScaled: true }); }
    return out;
  }
  const typeText = (t, integ = false) => (integ && t.integrated && (t.integrated.effectText || []).length ? t.integrated.effectText : t.effectText || []);
  function typeLines(t, integ = false) {
    const lines = typeEffects(t, integ).map(e => describe(e.effect, e.magnitude) + (e.hullScaled ? ` <span class="muted">(${hullLabel()})</span>` : ''));
    for (const txt of typeText(t, integ)) lines.push(styled(txt));
    for (const hm of grantedHullMods(t)) lines.push(trHtml('tooltip.grantsHullmod', { hullmod: hullModName(hm) }));
    return lines;
  }
  // ---- a type's integrated effects beside its normal ones (tooltip and list view)
  // Rows pair each normal line with its integrated counterpart the way the game's IntegrationLines does: the same text is
  // an unchanged row, the same wording with other numbers a changed row, and the rest are lines integrating adds or drops.
  // Two views, chosen with the summary panel's "Integrated effects" setting (integView, localStorage['esp.integView']):
  // 'columns' puts Normal and Integrated side by side (style.css stacks them in narrow windows), 'inline' lists each line
  // once with the other set's numbers in brackets, which is shorter for most nodes. DESIGN NOTE: both are a first try
  // (2026-11-09); if one reads badly in use, change it (see TODO.md).
  let integView = 'inline'; // the default: shorter for most nodes
  try { if (localStorage.getItem('esp.integView') === 'columns') integView = 'columns'; } catch { /* storage unavailable */ }
  // A number with its trailing %, as IntegrationLines.NUMBER (mod 0.12.2+), so "15%" -> "20%" is one changed value.
  const NUMBER = /[+-]?\d+(?:[.,]\d+)*%?/g;
  const wordingKey = html => plain(html).replace(NUMBER, '#');
  // Ports IntegrationLines.Comparison (mod 0.12.2+), in the integrated lines' order: each integrated line is 'same'
  // (identical text), 'changed' (same wording, other numbers), 'replaced' (no counterpart, taking the place of a normal
  // line left over) or 'added' (no counterpart and none left over). Normal lines still left over are 'dropped', at the end.
  function integrationRows(t) {
    const normal = typeLines(t, false), integ = typeLines(t, true);
    const unmatched = normal.slice();
    const take = (key, k) => { const i = unmatched.findIndex(l => k(l) === key); return i < 0 ? null : unmatched.splice(i, 1)[0]; };
    const identical = integ.map(m => take(plain(m), plain));
    const counterpart = integ.map((m, i) => (identical[i] != null ? null : take(wordingKey(m), wordingKey)));
    let replaced = 0;
    const rows = integ.map((m, i) => {
      if (identical[i] != null) return { kind: 'same', normal: identical[i], integ: m };
      if (counterpart[i] != null) return { kind: 'changed', normal: counterpart[i], integ: m };
      if (replaced < unmatched.length) return { kind: 'replaced', normal: unmatched[replaced++], integ: m };
      return { kind: 'added', normal: null, integ: m };
    });
    for (const l of unmatched.slice(replaced)) rows.push({ kind: 'dropped', normal: l, integ: null });
    return rows;
  }
  // The game's wording for lines that aren't a simple value change: node.integration.instead / inAddition / removes, or
  // their ...Sentence forms ("Instead grants: When ...") when the line doesn't start with a value (IntegrationLines.grantsLine).
  const GRANTS_FALLBACK = { instead: tr('tooltip.integ.instead'), inAddition: tr('tooltip.integ.inAddition'), removes: tr('tooltip.integ.removes') };
  function grantsLine(kind, html) {
    const key = `node.integration.${kind}${/^[+-]?\d/.test(plain(html)) ? '' : 'Sentence'}`;
    const tpl = S[key] ?? S[`node.integration.${kind}`] ?? GRANTS_FALLBACK[kind];
    return styled(tpl).replace('{line}', html);
  }
  // On a hull the node's requiredHullSizes refuse, it can't be allocated, so it can't be integrated either: show just its
  // normal effects (the tooltip gives the refusal), not a comparison (Dedicated Targeting Core on a frigate, say).
  const hullRefuses = t => { const sizes = t.requiredHullSizes || []; return sizes.length > 0 && !sizes.includes(HULL_ENUM[state.hull]); };
  const integrationCompareHtml = (n, t) => (hullRefuses(t) ? typeLines(t).map(l => `<div>${l}</div>`).join('')
    : integView === 'inline' ? integrationInlineHtml(n, t) : integrationColumnsHtml(n, t));
  function integrationColumnsHtml(n, t) {
    const marked = state.integrated.has(n.id);
    // Which column the build uses now (none while the node isn't allocated).
    const active = !state.alloc.has(n.id) ? null : integratedOn(n) ? 'integ' : 'normal';
    const tag = side => (active === side ? ` <span class="ic-active">${esc(tr('tooltip.integ.active'))}</span>` : '');
    const cost = marked ? '' : ` <span class="muted">${esc(tr('tooltip.integ.cost', { points: pointsText(nextIntegrationCost()) }))}</span>`;
    const cell = (label, html) => `<div data-label="${esc(label)}">${html}</div>`;
    const normalLabel = tr('tooltip.integ.normal'), integLabel = tr('tooltip.integ.integrated');
    const none = '<span class="muted">—</span>';
    const up = '<span class="builtin" aria-hidden="true">▲ </span>';
    const integCell = r => (r.kind === 'dropped' ? '<span class="builtin">—</span>'
      : r.kind === 'same' ? r.integ
      : r.kind === 'replaced' ? up + grantsLine('instead', r.integ)
      : r.kind === 'added' ? up + grantsLine('inAddition', r.integ)
      : up + r.integ);
    const rows = integrationRows(t).map(r => `<div class="ic-row ic-${r.kind}">` +
      cell(normalLabel, r.normal ?? none) + cell(integLabel, integCell(r)) + '</div>').join('');
    // The column the build doesn't use is drawn lighter (style.css: .ic-on-normal / .ic-on-integ).
    return `<div class="ic${active ? ` ic-on-${active}` : ''}"><div class="ic-row ic-head"><div>${esc(normalLabel)}${tag('normal')}</div><div><span class="builtin">${esc(integLabel)}</span>${cost}${tag('integ')}</div></div>${rows}</div>`;
  }
  // The inline view: the set the build uses (normal while the node isn't allocated) line by line. A changed number gets the
  // other set's value in brackets, a line only the other set has is shown faded, and a dropped line says so.
  function integrationInlineHtml(n, t) {
    const marked = state.integrated.has(n.id);
    const integOn = state.alloc.has(n.id) && integratedOn(n);
    const otherKey = integOn ? 'tooltip.integ.otherValue.normal' : 'tooltip.integ.otherValue.integrated';
    const cost = marked ? '' : ` <span class="muted">${esc(tr('tooltip.integ.cost', { points: pointsText(nextIntegrationCost()) }))}</span>`;
    const head = integOn
      ? `<div class="ic-inl-head"><span class="builtin">${esc(tr('tooltip.integ.integrated'))}</span> <span class="ic-active">${esc(tr('tooltip.integ.active'))}</span> <span class="muted">${esc(tr('tooltip.integ.normalInBrackets'))}</span></div>`
      : `<div class="ic-inl-head"><span class="muted">${esc(tr('tooltip.integ.integratedInBrackets'))}</span>${cost}</div>`;
    // Puts the other line's numbers, where they differ, in brackets after this line's numbers (tags hold no digits).
    const withOther = (html, otherHtml) => {
      const nums = plain(otherHtml).match(NUMBER) || [];
      let i = 0;
      return html.replace(/(<[^>]*>)|([+-]?\d+(?:[.,]\d+)*%?)/g, (m, tag, num) => {
        if (tag) return tag;
        const o = nums[i++];
        return o != null && o !== num ? `${num} <span class="ic-alt">${esc(tr(otherKey, { value: o }))}</span>` : num;
      });
    };
    const rows = integrationRows(t).map(r => {
      if (r.kind === 'same') return `<div>${r.normal}</div>`;
      if (r.kind === 'changed') return `<div>${integOn ? withOther(r.integ, r.normal) : withOther(r.normal, r.integ)}</div>`;
      // Lines without a counterpart: while integrated, the line itself (▲); otherwise, the integrated line faded under a
      // "When integrated:" lead, in the game's "Instead grants" / "In addition, grants" wording.
      const whenInteg = html => `<div class="ic-off"><span class="builtin">${esc(tr('tooltip.integ.whenIntegrated'))}</span> ${html}</div>`;
      if (r.kind === 'replaced') return integOn ? `<div><span class="builtin" aria-hidden="true">▲ </span>${r.integ}</div>`
        : `<div>${r.normal}</div>${whenInteg(grantsLine('instead', r.integ))}`;
      if (r.kind === 'added') return integOn ? `<div><span class="builtin" aria-hidden="true">▲ </span>${r.integ}</div>`
        : whenInteg(grantsLine('inAddition', r.integ));
      return integOn ? `<div class="ic-off">${grantsLine('removes', r.normal)}</div>`
        : `<div>${r.normal} <span class="ic-alt">${esc(tr('tooltip.integ.removed'))}</span></div>`;
    }).join('');
    return `<div class="ic-inl">${head}${rows}</div>`;
  }
  function setIntegView(v) {
    integView = v === 'columns' ? 'columns' : 'inline';
    try { localStorage.setItem('esp.integView', integView); } catch { /* storage unavailable */ }
    renderPanel();
    if (hover) showTooltip(hover, lastMouse.x, lastMouse.y);
  }
  const grantedHullMods = t => [...new Set([t.vanillaHullMod, ...(t.phantomHullMods || [])].filter(Boolean))];
  // Names for hull mods: the extracted table, then the skill type that grants the hull mod, then the id itself.
  let grantedNames = null;
  const hullModName = id => {
    if (D.hullModNames && D.hullModNames[id]) return D.hullModNames[id];
    if (!grantedNames) { grantedNames = new Map(); for (const t of D.types) for (const h of grantedHullMods(t)) if (!grantedNames.has(h)) grantedNames.set(h, t.name); }
    return grantedNames.get(id) || id;
  };
  const hullLabel = () => HULL_IN_SENTENCE[state.hull];
  const volumeName = v => VOLUME_NAMES[v] || humanize(v);

  // ------------------------------------------------------------------ summary math
  // Nodes that give their effects: allocated ones and nodes a modspec cache grants. Empty Shell nodes give nothing, and
  // gated nodes only give theirs under the gate's condition (marked with `gate`).
  function contributions() {
    const sc = subState();
    const list = [];
    for (const n of nodes) {
      if (!held(n.id) || sc.silent.has(n.id)) continue;
      list.push({ node: n, type: effectiveType(n), integ: integratedOn(n), gate: sat(n.id) || grantedActive(n.id) ? sc.gated.get(n.id) || null : null });
    }
    return list;
  }
  function totals() {
    const sums = new Map();
    // `by` keeps each source's share (by name, like the game's stat breakdown), for the Stats tab's Sources.
    // `integ` holds the source names that are integrated nodes (shown in the story point colour, as the game's summary).
    const add = (effect, mag, src, into = sums, label = '', integ = false) => {
      const cur = into.get(effect) || { effect, magnitude: 0, sources: 0, affinity: 0, by: new Map(), integ: new Set() };
      cur.magnitude += mag;
      if (src === 'aff') cur.affinity += mag; else cur.sources++;
      if (label) cur.by.set(label, (cur.by.get(label) || 0) + mag);
      if (label && integ) cur.integ.add(label);
      into.set(effect, cur);
    };
    // Gated nodes: only effects read live in combat survive, at the gate's strength (SkillTreeEffectSource.gatedEffects).
    const gated = new Map(); // condition (GATE_OF id) -> { sums, nodes, strength, item }
    // Temporary nodes (temporaryAfterDeploymentSeconds): their effects only last that long after deployment, so they're
    // kept apart from the permanent totals, as the game's EffectTotals groups them.
    const temp = new Map(); // seconds -> { sums, nodes }
    for (const c of contributions()) {
      const secs = c.type.temporaryAfterDeploymentSeconds;
      if (!c.gate && secs) {
        const g = temp.get(secs) || { sums: new Map(), nodes: 0 };
        g.nodes++;
        for (const e of typeEffects(c.type, c.integ)) add(e.effect, e.magnitude, 'node', g.sums, c.type.name, c.integ);
        temp.set(secs, g);
        continue;
      }
      if (!c.gate) { for (const e of typeEffects(c.type, c.integ)) add(e.effect, e.magnitude, 'node', sums, c.type.name, c.integ); continue; }
      const g = gated.get(c.gate.when) || { sums: new Map(), nodes: 0, strength: c.gate.strength, item: c.gate.def.name };
      g.nodes++;
      for (const e of typeEffects(c.type, c.integ)) if (D.effects[e.effect]?.live) add(e.effect, e.magnitude * c.gate.strength, 'node', g.sums, c.type.name, c.integ);
      gated.set(c.gate.when, g);
    }
    // Socket effects: Empty Shell affinity and the Root Conduit route.
    const sc = subState();
    for (const a of sc.active) {
      const shell = subLine(a.def, 'EVERY_AFFINITY_FLAT_PER_EMPTY_SHELL_NODE');
      if (shell) for (const k of AFFINITY_KEYS) add(k, shell.max * (sc.shellCount.get(a.socket.id) || 0), 'node', sums, a.def.name);
    }
    if (sc.conduit && sc.conduit.count) add(sc.conduit.aff, 5 * sc.conduit.count, 'node', sums, sc.conduit.def.name);
    const aff = {};
    for (const k of Object.keys(D.affinitySteps || {})) aff[k] = sums.get(k)?.magnitude || 0;
    const affBonuses = [];
    for (const [k, steps] of Object.entries(D.affinitySteps || {})) {
      for (const st of steps) {
        const reached = Math.floor((aff[k] || 0) / st.size);
        affBonuses.push({ affinity: k, ...st, reached });
        if (reached > 0) add(st.effect, reached * st.bonus, 'aff', sums, `${tr('panel.affinityTile', { affinity: AFFINITY_NAMES[k] || humanize(k) })} ${reached}×${st.size}`);
      }
    }
    return { sums, aff, affBonuses, gated, temp };
  }
  // The Effects tab's groups, in order: [heading, effect name pattern]. Effects matching none go under Other.
  const GROUPS = [
    [tr('name.group.affinity'), /AFFINITY/],
    [tr('name.group.strikeCraft'), /FIGHTER|STRIKECRAFT|HANGAR|BOMBER|WING|INTERCEPTOR|CARRIER/],
    [tr('name.group.weapons'), /WEAPON|MISSILE|BEAM|BALLISTIC|DAMAGE_TO|PD_|PIERCE|EMP_DAMAGE(?!_TAKEN)/],
    [tr('name.group.flux'), /FLUX|VENT|OVERLOAD/],
    [tr('name.group.defense'), /HULL|ARMOR|DAMAGE_TAKEN|SHIELD|ENGINE_DURABILITY/],
    [tr('name.group.mobility'), /SPEED|MANEUVER|ACCELERATION|DECELERATION|TURN|BURN|MASS/],
    [tr('name.group.phase'), /PHASE|TIMEFLOW/],
    [tr('name.group.shipSystem'), /SYSTEM/],
    [tr('name.group.combatReadiness'), /CR_|COMBAT_READINESS|REPAIR_RATE/],
    [tr('name.group.logistics'), /CREW|CARGO|FUEL|SUPPLIES|REPAIR|SALVAGE|SENSOR|SURVEY|DMOD|D_MOD|COMMAND|NAV|ELECTRONIC|OBJECTIVE|CORONA/],
  ];
  const OTHER_GROUP = tr('name.group.other');
  const groupOf = name => (GROUPS.find(([, re]) => re.test(name)) || [OTHER_GROUP])[0];
  // The totals without the integration preview (null while it's off), to show what the preview changes.
  function integPreviewBase() {
    if (!integPreview) return null;
    if (!baseTotals) { integPreview = false; try { baseTotals = totals(); } finally { integPreview = true; } }
    return baseTotals;
  }
  // Under a total the preview changed: its value without the preview, or that it's new. '' when unchanged.
  function previewDiffHtml(baseSums, s) {
    if (!baseSums) return '';
    const b = baseSums.get(s.effect);
    if (!b || Math.abs(b.magnitude) < 1e-9) return `<div class="ic-was"><span class="builtin">${esc(tr('panel.preview.new'))}</span></div>`;
    if (Math.abs(b.magnitude - s.magnitude) < 1e-9) return '';
    return `<div class="ic-was">${trHtml('panel.preview.without', { lineHtml: describe(s.effect, b.magnitude) })}</div>`;
  }
  // Totals the preview takes away entirely (an integration that drops a line), as entries of the base map.
  const previewGone = (baseSums, sums) => (baseSums ? [...baseSums.values()].filter(b => Math.abs(b.magnitude) > 1e-9 && Math.abs(sums.get(b.effect)?.magnitude || 0) < 1e-9) : []);
  const goneHtml = (b, describeIt = x => describe(x.effect, x.magnitude)) => `<span class="builtin">-</span> <span class="muted">${plain(describeIt(b))}</span>`;

  // ------------------------------------------------------------------ images
  // The planner ships none of the mod's art. It's read from the Exiled Sector folder the user picks (the Mod art
  // dialog), by the mod-relative paths in the data, and turned into blob URLs. Without a folder, `artUrl` is null and
  // everything draws as a placeholder (lettered icons, a drawn halo, no nebula or planet images).
  const artUrls = new Map(); // mod-relative path -> blob URL
  const images = new Map();
  const HALO_PATH = 'graphics/fx/star_halo.png';
  const artUrl = path => (path && artUrls.get(path)) || null;
  function img(path) {
    if (!path) return null;
    let rec = images.get(path);
    if (!rec) {
      rec = { el: new Image(), ok: false, dim: null, tinted: new Map() };
      const url = artUrl(path);
      if (url) {
        rec.el.onload = () => { rec.ok = true; requestDraw(); };
        rec.el.onerror = () => { rec.failed = true; };
        rec.el.src = url;
      } else rec.failed = true;
      images.set(path, rec);
    }
    return rec;
  }
  // Every image the planner can draw, as mod-relative paths.
  function artPaths() {
    const set = new Set([HALO_PATH]);
    for (const t of D.types) if (t.icon) set.add(t.icon);
    for (const s of D.subroutines || []) if (s.icon) set.add(s.icon);
    for (const d of D.decorations || []) for (const k of ['imagePath', 'ringArtPath', 'overlayPath']) if (d[k]) set.add(d[k]);
    return [...set];
  }
  // Swaps in a new set of art (a Map of path -> blob URL, or null for placeholders) and redraws everything.
  function setArt(urls) {
    for (const u of artUrls.values()) URL.revokeObjectURL(u);
    artUrls.clear();
    if (urls) for (const [k, v] of urls) artUrls.set(k, v);
    images.clear();
    for (const t of D.types) img(t.icon);
    requestDraw();
  }
  // A short stand-in for an icon: the first letters of the first two words ("Flux Capacity" -> "FC").
  function initials(name) {
    const words = String(name || '?').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  }
  // An icon for the HTML lists: the mod's image when the art is loaded, else a lettered box.
  function iconImg(path, name) {
    const url = artUrl(path);
    return url ? `<img src="${esc(url)}" alt="">` : `<span class="icon-ph" aria-hidden="true">${esc(initials(name))}</span>`;
  }
  function dimmed(rec) {
    // Unallocated icons draw at about 35% brightness, like the mod's (90,90,90) tint.
    if (!rec.dim || rec.dimTheme !== theme) {
      const c = document.createElement('canvas');
      c.width = rec.el.naturalWidth; c.height = rec.el.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(rec.el, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = P.dimWith;
      g.fillRect(0, 0, c.width, c.height);
      rec.dim = c; rec.dimTheme = theme;
    }
    return rec.dim;
  }
  function tinted(rec, rgb) {
    const k = rgb.join(',');
    let c = rec.tinted.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = rec.el.naturalWidth; c.height = rec.el.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(rec.el, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgb(${k})`;
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(rec.el, 0, 0);
      rec.tinted.set(k, c);
    }
    return c;
  }

  // ------------------------------------------------------------------ canvas + camera
  const canvas = document.getElementById('tree');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const cam = { x: 0, y: 0, zoom: 0.12 };
  const MIN_ZOOM = 0.006, MAX_ZOOM = 2.5;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    document.documentElement.style.setProperty('--bar-h', els.topbar.offsetHeight + 'px');
    requestDraw();
  }
  const toScreenX = x => (x - cam.x) * cam.zoom + W / 2;
  const toScreenY = y => (y - cam.y) * cam.zoom + H / 2;
  const toWorldX = sx => (sx - W / 2) / cam.zoom + cam.x;
  const toWorldY = sy => (sy - H / 2) / cam.zoom + cam.y;

  function frameCore() {
    const panelW = !els.panel.classList.contains('closed') && W > 720 ? els.panel.offsetWidth : 0;
    const top = els.topbar.offsetHeight;
    const availW = W - panelW, availH = H - top;
    const radius = 4500;
    cam.zoom = Math.min(availW, availH) / (radius * 2);
    cam.x = (panelW / 2) / cam.zoom;
    cam.y = -(top / 2) / cam.zoom;
    requestDraw();
  }
  function focusNode(n, zoom) {
    const panelW = !els.panel.classList.contains('closed') && W > 720 ? els.panel.offsetWidth : 0;
    if (zoom) cam.zoom = zoom;
    cam.x = n.x + (panelW / 2) / cam.zoom;
    cam.y = n.y - (els.topbar.offsetHeight / 2) / cam.zoom;
    requestDraw();
  }

  // Background stars, in screen space with a little parallax.
  const bgStars = Array.from({ length: 700 }, (_, i) => {
    const r = mulberry(i * 7919 + 13);
    return { x: r() * 4096, y: r() * 4096, s: r() < 0.08 ? 1.6 : r() < 0.4 ? 1.1 : 0.7, a: 0.25 + r() * 0.6, p: 0.02 + r() * 0.05 };
  });
  function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ------------------------------------------------------------------ interaction state
  let hover = null;          // hovered node
  let preview = null;        // { add:Set } | { remove:Set }
  let searchHits = null;     // Set of node ids
  let searchOrder = [];
  let searchCursor = -1;
  let drawQueued = false;
  let time = 0;

  function accent() { return state.root ? ROOT_COLOURS[byId.get(state.root).type.id] || GLOW : GLOW; }
  function requestDraw() { if (!drawQueued) { drawQueued = true; requestAnimationFrame(frame); } }
  function frame(t) {
    drawQueued = false;
    const now = t / 1000;
    const dt = Math.min(0.1, Math.max(0, now - time));
    time = now;
    keyboardCamera(dt);
    draw();
    requestDraw(); // keep breathing rings alive; rAF pauses in background tabs
  }

  // ------------------------------------------------------------------ theme
  // 'dark' or 'light', chosen with the Theme button ('auto' follows the system). The CSS keys off data-theme on <html>;
  // the canvas uses the palette P. In light mode rgba() also deepens bright colours (lime, cyan, yellow, pale grey) so
  // lines, rings and text stay readable on the light background; rgbaRaw() skips that (the star, image tints).
  const THEMES = {
    dark: {
      bg: '#000', star: [220, 230, 255], starA: 1,
      laneCore: 'rgba(0,0,0,0.92)', litCore: 'rgba(255,255,255,0.75)', dot: 'rgba(170,170,170,0.7)',
      dimWith: 'rgba(0,0,0,0.62)', nebulaA: 0.9, nebulaOp: 'lighter',
      phLit: '#34404a', phDim: '#182027', phTextLit: '#ffffff', phTextDim: '#b4bec6',
      label: { KEYSTONE: '#d6caff', NOTABLE: '#ffc4f2', SMALL: '#c9d1d8' }, labelHalo: 'rgba(0,0,0,0.85)',
      socketFill: 'rgba(10,16,24,0.85)', rootFill: 'rgba(4,6,10,0.92)', hover: 'rgba(255,255,255,0.85)',
      regionBg: '#0b1118', regionEdge: '#3a5566', regionText: '#e6e6e6', regionMuted: '#9aa4ad',
      badgeText: '#000', searchOutline: 'rgba(0,0,0,0.85)',
    },
    light: {
      bg: '#e8ecf0', star: [40, 55, 80], starA: 0.35,
      laneCore: 'rgba(232,236,240,0.95)', litCore: 'rgba(255,255,255,0.85)', dot: 'rgba(70,80,92,0.8)',
      dimWith: 'rgba(255,255,255,0.55)', nebulaA: 0.35, nebulaOp: 'source-over',
      phLit: '#b9c6d2', phDim: '#fbfcfd', phTextLit: '#0d1418', phTextDim: '#3c4852',
      label: { KEYSTONE: '#4a35b5', NOTABLE: '#a0157f', SMALL: '#27313a' }, labelHalo: 'rgba(255,255,255,0.9)',
      socketFill: 'rgba(250,251,252,0.92)', rootFill: 'rgba(252,253,254,0.95)', hover: 'rgba(10,20,30,0.85)',
      regionBg: '#ffffff', regionEdge: '#9aabb8', regionText: '#14191e', regionMuted: '#56626c',
      badgeText: '#fff', searchOutline: 'rgba(255,255,255,0.95)',
    },
  };
  let themeSetting = 'dark';
  let theme = 'dark';
  let P = THEMES.dark;
  const rgbaRaw = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const deepCache = new Map();
  // Lowers a colour's lightness to about L (keeping hue, a little more saturation). Darker colours pass unchanged.
  function deepen(c, L = 0.4) {
    const key = `${c[0]},${c[1]},${c[2]},${L}`;
    let d = deepCache.get(key);
    if (d) return d;
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (l <= L + 0.02) d = c;
    else {
      let h = 0, s = 0;
      if (max !== min) {
        const dd = max - min;
        s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
        h = max === r ? (g - b) / dd + (g < b ? 6 : 0) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
        h /= 6;
      }
      const S = Math.min(1, s * 1.1);
      const q = L < 0.5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q;
      const hue = t => {
        t = (t + 1) % 1;
        return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
      };
      d = [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map(v => Math.round(v * 255));
    }
    deepCache.set(key, d);
    return d;
  }
  const rgba = (c, a) => rgbaRaw(theme === 'light' ? deepen(c) : c, a);
  const systemTheme = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  function applyTheme(setting) {
    themeSetting = (THEMES[setting] || setting === 'auto') ? setting : 'dark';
    theme = themeSetting === 'auto' ? systemTheme() : themeSetting;
    P = THEMES[theme];
    document.documentElement.dataset.theme = theme;
  }
  try { applyTheme(localStorage.getItem('esp.theme') || 'dark'); } catch { applyTheme('dark'); }

  function draw() {
    const z = cam.zoom;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);

    // stars
    for (const s of bgStars) {
      const x = ((s.x - cam.x * z * s.p) % W + W) % W;
      const y = ((s.y - cam.y * z * s.p) % H + H) % H;
      ctx.fillStyle = rgbaRaw(P.star, s.a * P.starA);
      ctx.fillRect(x, y, s.s, s.s);
    }

    const view = { minX: toWorldX(0), maxX: toWorldX(W), minY: toWorldY(0), maxY: toWorldY(H) };
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));

    drawDecorations(view, z);
    const choosing = !state.root;
    const treeAlpha = choosing ? 0.35 : 1;
    drawConnectors(view, z, treeAlpha);
    drawSearchGlow(view, z);
    drawSubroutines(z);
    for (const n of nodes) if (n.tier !== 'ROOT') drawNode(n, view, z, treeAlpha);
    for (const n of roots) drawRoot(n, view, z, choosing);
    drawSearchRings(view, z);
    drawNodeLabels(view, z, treeAlpha);
    if (targets.mode) drawTargetMarks(view, z);
    if (waypoints.length) drawWaypoints(view, z);
    if (flash) {
      const age = time - flash.start;
      if (age > FLASH_SECONDS || age < 0) flash = null;
      else drawFlash(byId.get(flash.id), age, z);
    }
    if (hover) drawHover(hover, z, time);
    drawRegionLabels(z);
  }

  // Socketed subroutines: a dashed circle for each radius, and the Root Conduit's route in its affinity's colour.
  const SUB_COLOURS = { DOCTRINE: [255, 211, 77], UNIQUE: [190, 140, 255], ROOT_CONDUIT: [140, 228, 255] };
  const connectorByPair = new Map(connectors.map(c => [pairKey(c.a.id, c.b.id), c]));
  function drawSubroutines(z) {
    const sc = subState();
    const px = 1 / z;
    for (const a of sc.active) {
      const r = subRadius(a.def);
      if (!r) continue;
      const col = SUB_COLOURS[a.def.kind] || GLOW;
      ctx.fillStyle = rgba(col, 0.05);
      ctx.beginPath(); ctx.arc(a.socket.x, a.socket.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(col, 0.6);
      ctx.lineWidth = 2 * px;
      ctx.setLineDash([10 * px, 8 * px]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const c = sc.conduit;
    if (c && c.route && c.count) {
      ctx.strokeStyle = rgba(AFFINITY_COLOURS[c.aff] || GLOW, 0.85);
      ctx.lineWidth = Math.max(3 * px, 10);
      ctx.lineCap = 'round';
      for (let i = 1; i < c.route.length; i++) {
        const con = connectorByPair.get(pairKey(c.route[i - 1], c.route[i]));
        ctx.beginPath();
        if (con) traceConnector(con);
        else { const p = byId.get(c.route[i - 1]), q = byId.get(c.route[i]); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }

  // Tree names, drawn in screen space once a tree is small on screen; they fade out as you zoom in.
  const LABEL_FULL_PX = 140;  // tree radius on screen at which the label is fully shown
  const LABEL_GONE_PX = 260;  // ...and fully hidden
  let regionLabelRects = [];
  function drawRegionLabels(z) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    regionLabelRects = [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of regions) {
      const screenR = r.radius * z;
      const a = clamp((LABEL_GONE_PX - screenR) / (LABEL_GONE_PX - LABEL_FULL_PX), 0, 1);
      if (a <= 0 || volumeHidden(r.volume)) continue; // a hidden optional volume isn't drawn at all
      const sx = toScreenX(r.x), sy = toScreenY(r.y);
      if (sx < -200 || sx > W + 200 || sy < -50 || sy > H + 50) continue;
      const name = r.volume === 'core' ? tr('name.region.core') : volumeName(r.volume);
      const count = r.ids.reduce((c, id) => c + (sat(id) ? 1 : 0), 0);
      const sub = count ? tr('label.regionAllocated', { count }) : '';
      ctx.font = `600 14px ${FONT}`;
      const w1 = ctx.measureText(name).width;
      ctx.font = `12px ${FONT}`;
      const w2 = sub ? ctx.measureText(sub).width : 0;
      const w = Math.max(w1, w2) + 14, h = sub ? 36 : 22;
      const x0 = sx - w / 2, y0 = sy - h / 2;
      ctx.globalAlpha = a;
      ctx.fillStyle = P.regionBg;
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = count ? rgba(accent(), 0.9) : P.regionEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      ctx.fillStyle = P.regionText;
      ctx.font = `600 14px ${FONT}`;
      ctx.fillText(name, sx, sub ? sy - 8 : sy);
      if (sub) {
        ctx.fillStyle = P.regionMuted;
        ctx.font = `12px ${FONT}`;
        ctx.fillText(sub, sx, sy + 9);
      }
      ctx.globalAlpha = 1;
      if (a > 0.5) regionLabelRects.push({ x0, y0, w, h, region: r });
    }
  }
  function regionLabelAt(sx, sy) {
    for (let i = regionLabelRects.length - 1; i >= 0; i--) {
      const b = regionLabelRects[i];
      if (sx >= b.x0 && sx <= b.x0 + b.w && sy >= b.y0 && sy <= b.y0 + b.h) return b.region;
    }
    return null;
  }
  function focusRegion(r) {
    const panelW = !els.panel.classList.contains('closed') && W > 720 ? els.panel.offsetWidth : 0;
    const top = els.topbar.offsetHeight;
    const zoom = clamp(Math.min(W - panelW, H - top) / (r.radius * 2.1), MIN_ZOOM, MAX_ZOOM);
    focusNode(r, zoom);
  }

  function inView(view, x, y, r) { return x + r >= view.minX && x - r <= view.maxX && y + r >= view.minY && y - r <= view.maxY; }

  function drawDecorations(view, z) {
    for (const d of D.decorations || []) {
      if (volumeHidden((d.tags || []).find(t => !t.startsWith('gate_')) || 'core')) continue; // stars and nebulae of a hidden volume
      if (d.kind === 'ringBelt') {
        const r = (d.innerRadius + d.outerRadius) / 2, w = d.outerRadius - d.innerRadius;
        if (!inView(view, d.x, d.y, d.outerRadius)) continue;
        // The band texture runs across the ring horizontally and along it vertically: wrap it in segments.
        const rec = img(d.ringArtPath);
        if (!rec || !rec.ok) continue;
        const segLen = w * (rec.el.naturalHeight / rec.el.naturalWidth);
        const count = Math.max(24, Math.ceil((2 * Math.PI * r) / segLen));
        const step = (2 * Math.PI) / count;
        const spin = time * ((d.rotationSpeed || 0) * Math.PI / 180);
        const segH = 2 * Math.PI * r / count + 2; // slight overlap hides seams
        ctx.save();
        ctx.globalAlpha = 0.8;
        for (let i = 0; i < count; i++) {
          const a = i * step + spin;
          const sx = d.x + Math.cos(a) * r, sy = d.y + Math.sin(a) * r;
          if (!inView(view, sx, sy, Math.max(w, segH))) continue;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.translate(DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
          ctx.scale(DPR * z, DPR * z);
          ctx.translate(sx, sy);
          ctx.rotate(a);
          ctx.drawImage(rec.el, -w / 2, -segH / 2, w, segH);
        }
        ctx.restore();
      } else if (d.kind === 'image') {
        const rad = Math.hypot(d.width, d.height) / 2;
        if (!inView(view, d.x, d.y, rad)) continue;
        const rec = img(d.imagePath);
        if (!rec || !rec.ok) continue;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(((d.rotation || 0) * Math.PI) / 180);
        ctx.globalAlpha = P.nebulaA;
        ctx.globalCompositeOperation = P.nebulaOp;
        ctx.drawImage(rec.el, -d.width / 2, -d.height / 2, d.width, d.height);
        ctx.restore();
      } else if (d.kind === 'star') {
        const r = d.radius || 200;
        if (!inView(view, d.x, d.y, r * 4)) continue;
        // In light mode the star is toned down to a deeper colour with a soft centre and a weaker glow, so it
        // doesn't glare against the light background.
        const light = theme === 'light';
        const base = hexRgb(STAR_COLOURS[d.starType] || '#fff2b8') || [255, 242, 184];
        const col = light ? deepen(base, 0.56) : base;
        const centre = light ? deepen(base, 0.7) : [255, 255, 255];
        const g = ctx.createRadialGradient(d.x, d.y, r * 0.6, d.x, d.y, r * 3.2);
        g.addColorStop(0, rgbaRaw(col, light ? 0.3 : 0.55)); g.addColorStop(0.35, rgbaRaw(col, light ? 0.07 : 0.12)); g.addColorStop(1, rgbaRaw(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, r * 3.2, 0, Math.PI * 2); ctx.fill();
        if (d.starType !== 'black_hole') {
          const core = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
          core.addColorStop(0, rgbaRaw(centre, 1)); core.addColorStop(0.7, rgbaRaw(col, 1)); core.addColorStop(1, rgbaRaw(col, 0.85));
          ctx.fillStyle = core;
        } else ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function connectorState(c) {
    if (preview && preview.remove && (preview.remove.has(c.a.id) || preview.remove.has(c.b.id)) && sat(c.a.id) && sat(c.b.id)) return 'remove';
    if (sat(c.a.id) && sat(c.b.id)) return 'lit';
    if (preview && preview.add && (preview.add.has(c.a.id) || sat(c.a.id)) && (preview.add.has(c.b.id) || sat(c.b.id))) return 'add';
    return 'dull';
  }
  function endpointRadius(n) {
    if (n.tier === 'ROOT') return n.fp / 2 * 0.7;
    if (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT') return n.fp / 2 * 0.6;
    if (n.tier === 'SOCKET') return n.fp / 2 * 0.85;
    return n.fp * ICON_INSET / 2 + 4;
  }

  function drawConnectors(view, z, treeAlpha) {
    const px = 1 / z;
    const laneW = Math.max(2.2, Math.min(5, 3.2 * Math.sqrt(z / 0.25))) * px;
    const lit = accent();
    const simple = z < 0.05;
    const batches = { dull: [], lit: [], add: [], remove: [] };
    for (const c of connectors) {
      if (c.maxX < view.minX || c.minX > view.maxX || c.maxY < view.minY || c.minY > view.maxY) continue;
      if (switchedOff(c.a) || switchedOff(c.b)) continue; // lanes into a hidden optional volume
      batches[connectorState(c)].push(c);
    }
    ctx.lineCap = 'round';
    // dull lanes: two thin edges (wide grey stroke with a black core)
    const searchDim = searchHits ? SEARCH_DIM_LANE : 1;
    ctx.globalAlpha = treeAlpha * searchDim;
    ctx.strokeStyle = rgba(DULL, simple ? 0.45 : 0.6);
    ctx.lineWidth = laneW;
    strokeBatch(batches.dull);
    if (!simple) {
      ctx.strokeStyle = P.laneCore;
      ctx.lineWidth = Math.max(0, laneW - 2.4 * px);
      strokeBatch(batches.dull);
    }
    ctx.globalAlpha = treeAlpha;
    for (const [kind, col] of [['add', PREVIEW_ADD], ['remove', PREVIEW_REMOVE], ['lit', lit]]) {
      const list = batches[kind];
      if (!list.length) continue;
      ctx.strokeStyle = rgba(col, 0.22);
      ctx.lineWidth = laneW * 2.6;
      strokeBatch(list);
      ctx.strokeStyle = rgba(col, 0.95);
      ctx.lineWidth = laneW * 0.85;
      strokeBatch(list);
      ctx.strokeStyle = P.litCore;
      ctx.lineWidth = Math.max(0.8 * px, laneW * 0.25);
      strokeBatch(list);
    }
    ctx.globalAlpha = 1;
  }
  function strokeBatch(list) {
    if (!list.length) return;
    ctx.beginPath();
    for (const c of list) traceConnector(c);
    ctx.stroke();
  }
  function traceConnector(c) {
    const r1 = endpointRadius(c.a), r2 = endpointRadius(c.b);
    if (c.cx == null) {
      const dx = c.b.x - c.a.x, dy = c.b.y - c.a.y, len = Math.hypot(dx, dy);
      if (len <= r1 + r2) return;
      const ux = dx / len, uy = dy / len;
      ctx.moveTo(c.a.x + ux * r1, c.a.y + uy * r1);
      ctx.lineTo(c.b.x - ux * r2, c.b.y - uy * r2);
      return;
    }
    // Quadratic curve trimmed by arc length (approximated from the control polygon).
    const len = (Math.hypot(c.cx - c.a.x, c.cy - c.a.y) + Math.hypot(c.b.x - c.cx, c.b.y - c.cy) + Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y)) / 2;
    if (len <= r1 + r2) return;
    const t0 = r1 / len, t1 = 1 - r2 / len;
    const seg = 18;
    for (let i = 0; i <= seg; i++) {
      const t = t0 + (t1 - t0) * (i / seg), u = 1 - t;
      const x = u * u * c.a.x + 2 * u * t * c.cx + t * t * c.b.x;
      const y = u * u * c.a.y + 2 * u * t * c.cy + t * t * c.b.y;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }

  // ---- search and theme-filter highlight, the same in both themes and with or without the mod's art.
  // Non-matching nodes and lanes are dimmed (not too far, so the tree's shape stays readable). Matches get a pulsing
  // gold glow under the node and an outlined gold ring with a ripple over it, each with a minimum size on screen so
  // they show at any zoom. The result Enter last stepped to gets a second, wider ring.
  const SEARCH_DIM_NODE = 0.45;
  const SEARCH_DIM_LANE = 0.75;
  const SEARCH_PULSE = 1.6; // seconds
  function drawSearchGlow(view, z) {
    if (!searchHits || !searchHits.size) return;
    const px = 1 / z;
    const pulse = 0.75 + 0.25 * Math.sin(time * Math.PI * 2 / SEARCH_PULSE);
    ctx.globalAlpha = 1;
    for (const id of searchHits) {
      const n = byId.get(id);
      const r = Math.max(n.fp * 1.6, 28 * px);
      if (!inView(view, n.x, n.y, r)) continue;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
      g.addColorStop(0, rgba(SEARCH_GOLD, 0.85 * pulse)); g.addColorStop(0.45, rgba(SEARCH_GOLD, 0.4 * pulse)); g.addColorStop(1, rgba(SEARCH_GOLD, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawSearchRings(view, z) {
    if (!searchHits || !searchHits.size) return;
    const px = 1 / z;
    const t = (time / SEARCH_PULSE) % 1;
    const current = searchCursor >= 0 ? searchOrder[searchCursor] : null;
    const ring = (n, r, lw, a) => {
      ctx.globalAlpha = a;
      ctx.strokeStyle = P.searchOutline; ctx.lineWidth = lw + 2.5 * px;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(SEARCH_GOLD, 1); ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    };
    for (const id of searchHits) {
      const n = byId.get(id);
      const r = Math.max(n.fp * (n.tier === 'ROOT' ? 0.58 : 0.7), 10 * px);
      if (!inView(view, n.x, n.y, r * 2)) continue;
      const lw = Math.max(3.5 * px, n.fp * 0.09);
      ring(n, r, lw, 1);
      ctx.globalAlpha = (1 - t) * 0.7;
      ctx.strokeStyle = rgba(SEARCH_GOLD, 1); ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.arc(n.x, n.y, r * (1 + 1.1 * t), 0, Math.PI * 2); ctx.stroke();
      if (n === current) ring(n, r * 1.45 + 3 * px, lw, 1);
    }
    ctx.globalAlpha = 1;
  }
  function nodeAlpha(n, treeAlpha) {
    if (searchHits && !searchHits.has(n.id)) return treeAlpha * SEARCH_DIM_NODE;
    return treeAlpha;
  }
  function canAllocateNow(n) {
    if (!state.root || sat(n.id) || n.tier === 'WORMHOLE_EXIT' || switchedOff(n)) return false;
    return n.adj.some(m => sat(m.id)) && !staticBlock(n);
  }
  function breath() { return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * Math.PI * 2 / 2.2)); }

  function drawNode(n, view, z, treeAlpha) {
    const fp = n.fp;
    const reach = n.tier === 'NOTABLE' ? fp * 1.7 : n.tier === 'KEYSTONE' ? fp * 1.4 : fp;
    if (switchedOff(n) || !inView(view, n.x, n.y, reach)) return; // nodes in a hidden optional volume aren't drawn
    const allocated = held(n.id);
    const alpha = nodeAlpha(n, treeAlpha);
    const screenSize = fp * z;
    const pAdd = preview && preview.add && preview.add.has(n.id);
    const pRem = preview && preview.remove && preview.remove.has(n.id);
    const ac = accent();
    const px = 1 / z;

    const refused = isMarkedRefused(n);
    if (screenSize < 5) { // far away: a dot
      ctx.globalAlpha = alpha;
      ctx.fillStyle = searchHits && searchHits.has(n.id) ? rgba(SEARCH_GOLD, 1) : refused ? rgba(RULE_PROBLEM, 0.9) : allocated ? rgba(ac, 1) : n.tier === 'KEYSTONE' ? rgba(DEFAULT_AURORA, 0.9) : n.tier === 'NOTABLE' ? rgba(NOTABLE_PINK, 0.8) : P.dot;
      const r = Math.max(1.5 * px, fp * 0.35);
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const stateA = allocated ? 1 : UNALLOCATED_ALPHA;
    ctx.globalAlpha = alpha;
    if (n.tier === 'NOTABLE') {
      const halo = img(HALO_PATH);
      const s = fp * 3.2 * 0.6;
      ctx.globalAlpha = alpha * stateA * 0.55;
      if (halo.ok) ctx.drawImage(tinted(halo, NOTABLE_GLOW), n.x - s / 2, n.y - s / 2, s, s);
      else { // drawn stand-in for the halo sprite
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, s / 2);
        g.addColorStop(0, rgba(NOTABLE_GLOW, 0.5)); g.addColorStop(0.45, rgba(NOTABLE_GLOW, 0.18)); g.addColorStop(1, rgba(NOTABLE_GLOW, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(n.x, n.y, s / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = alpha * stateA;
      const base = fp * ICON_INSET / 2;
      for (let i = 0; i < 3; i++) {
        const r = base * (1.08 + i * 0.12) + Math.sin(time * (1.3 + i * 0.4) + n.idx) * base * 0.02;
        ctx.strokeStyle = rgba(NOTABLE_PINK, 0.55 - i * 0.15);
        ctx.lineWidth = Math.max(1 * px, fp * 0.03);
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (n.tier === 'KEYSTONE') {
      const inner = fp * ICON_INSET / 2, outer = inner + fp * 0.55;
      const col = n.ringBeltColor || DEFAULT_AURORA;
      const g = ctx.createRadialGradient(n.x, n.y, inner * 0.9, n.x, n.y, outer);
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.25, rgba(col, 0.75 * stateA)); g.addColorStop(0.6, rgba(col, 0.3 * stateA)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(n.x, n.y, outer, 0, Math.PI * 2); ctx.fill();
    } else if (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT') {
      drawWormhole(n, allocated, alpha);
      drawRingState(n, allocated, alpha, ac, pAdd, pRem, z, true);
      if (refused) drawRefusedMark(n, alpha, z);
      ctx.globalAlpha = 1;
      return;
    } else if (n.tier === 'SOCKET') {
      drawSocket(n, allocated, alpha, ac);
    }

    // icon
    if (n.tier !== 'SOCKET') {
      const t = effectiveType(n);
      const iconSize = fp * ICON_INSET;
      const lit = allocated || (searchHits && searchHits.has(n.id));
      if (isChoice(n) && !allocated) drawSplitIcon(n, iconSize, alpha);
      else {
        const rec = img(t.icon);
        ctx.globalAlpha = alpha;
        if (rec && rec.ok) ctx.drawImage(lit ? rec.el : dimmed(rec), n.x - iconSize / 2, n.y - iconSize / 2, iconSize, iconSize);
        else drawPlaceholderIcon(n, t, iconSize, lit, z);
      }
    }
    drawRingState(n, allocated, alpha, ac, pAdd, pRem, z, false);
    drawIntegratedRing(n, alpha, z);
    if (refused) drawRefusedMark(n, alpha, z);
    ctx.globalAlpha = 1;
  }
  // Integrated nodes: a story point green ring outside the allocation ring (the game draws a green miniature circuit).
  // Solid when integrated, faint when kept on an unallocated node, dashed for nodes only the preview integrates.
  function drawIntegratedRing(n, alpha, z) {
    const marked = state.integrated.has(n.id) && integrable(effectiveType(n));
    const previewOnly = !marked && integPreview && canIntegrate(n);
    if (!marked && !previewOnly) return;
    const px = 1 / z;
    const r = n.fp * ICON_INSET / 2 + Math.max(5 * px, n.fp * 0.12);
    const w = Math.max(2 * px, n.fp * 0.05);
    const a = state.alloc.has(n.id) ? 1 : 0.45;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = P.searchOutline;
    ctx.lineWidth = w * 2;
    if (previewOnly) ctx.setLineDash([w * 2.5, w * 2]);
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(STORY_GREEN, a);
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  // A red X on unallocated nodes the rules refuse and on allocated nodes that break a rule (always on).
  function isMarkedRefused(n) {
    if (!state.root && n.tier === 'ROOT') return false;
    return sat(n.id) ? rules().problems.has(n.id) : !switchedOff(n) && !!staticBlock(n);
  }
  function drawRefusedMark(n, alpha, z) {
    const px = 1 / z;
    const r = (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT' ? n.fp * 0.42 : n.tier === 'SOCKET' ? n.fp * 0.5 : n.fp * ICON_INSET / 2) * 0.62;
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    for (const [col, w] of [['rgba(0,0,0,0.75)', Math.max(4 * px, n.fp * 0.13)], [rgba(RULE_PROBLEM, 0.95), Math.max(2 * px, n.fp * 0.07)]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(n.x - r, n.y - r); ctx.lineTo(n.x + r, n.y + r);
      ctx.moveTo(n.x + r, n.y - r); ctx.lineTo(n.x - r, n.y + r);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function drawRingState(n, allocated, alpha, ac, pAdd, pRem, z, wormhole) {
    const px = 1 / z;
    const r = wormhole ? n.fp * 0.42 : n.tier === 'SOCKET' ? n.fp * 0.52 : n.fp * ICON_INSET / 2 + 1.5 * px;
    const w = Math.max(1.4 * px, n.fp * 0.035);
    ctx.globalAlpha = alpha;
    let col = null, a = 1;
    if (pRem) col = PREVIEW_REMOVE;
    else if (pAdd) col = PREVIEW_ADD;
    else if (allocated && rules().problems.has(n.id)) { col = RULE_PROBLEM; a = 0.6 + 0.4 * breath(); }
    else if (allocated) col = ac;
    else if (canAllocateNow(n)) { col = ac; a = breath(); }

    if (wormhole && !col) return;
    if (!col) { ctx.strokeStyle = rgba(DULL, 0.55); ctx.lineWidth = w; }
    else {
      ctx.strokeStyle = rgba(col, 0.28 * a);
      ctx.lineWidth = w * 3;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = w;
    }
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
  }

  // ---- placeholders, when the mod's art isn't loaded
  // Each node is a disc tinted by what it is (affinity nodes in their tech's colour, notables pink, keystones violet),
  // with its initials once big enough, and its name underneath when zoomed in (drawNodeLabels).
  const OPTION_TINT = {
    low_tech_affinity: AFFINITY_COLOURS.LOW_TECH_AFFINITY_FLAT,
    midline_affinity: AFFINITY_COLOURS.MIDLINE_AFFINITY_FLAT,
    high_tech_affinity: AFFINITY_COLOURS.HIGH_TECH_AFFINITY_FLAT,
  };
  const TIER_TINT = { NOTABLE: [255, 120, 230], KEYSTONE: [165, 145, 255] };
  const PLAIN_TINT = [150, 165, 178];
  const placeholderMode = () => artUrls.size === 0;
  const initialsCache = new Map();
  function placeholderDisc(n, size, tint, lit, z) {
    const r = size / 2;
    ctx.fillStyle = lit ? P.phLit : P.phDim;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(tint, lit ? 0.5 : 0.2);
    ctx.fill();
    ctx.strokeStyle = rgba(tint, lit ? 0.95 : 0.55);
    ctx.lineWidth = Math.max(1 / z, size * 0.05);
    ctx.stroke();
  }
  function placeholderText(n, text, size, lit, z) {
    if (size * z < 18) return;
    ctx.fillStyle = lit ? P.phTextLit : P.phTextDim;
    ctx.font = `600 ${size * 0.36}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, n.x, n.y + size * 0.02);
  }
  function drawPlaceholderIcon(n, t, size, lit, z) {
    const tint = OPTION_TINT[t.id] || TIER_TINT[n.tier] || PLAIN_TINT;
    placeholderDisc(n, size, tint, lit, z);
    if (OPTION_TINT[t.id]) return; // the colour says which affinity
    let text = initialsCache.get(t.id);
    if (!text) initialsCache.set(t.id, text = initials(t.name));
    placeholderText(n, text, size, lit, z);
  }
  // An unallocated choice node: a pie of its options (affinity in the three tech colours).
  function drawPlaceholderSplit(n, opts, size, z) {
    const r = size / 2, k = opts.length;
    const affinity = opts.every(o => OPTION_TINT[o.id]);
    for (let i = 0; i < k; i++) {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / k, a1 = a0 + (2 * Math.PI) / k;
      const tint = OPTION_TINT[opts[i].id] || (i % 2 ? [120, 135, 150] : PLAIN_TINT);
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.arc(n.x, n.y, r, a0, a1); ctx.closePath();
      ctx.fillStyle = P.phDim; ctx.fill();
      ctx.fillStyle = rgba(tint, affinity ? 0.62 : 0.2); ctx.fill();
    }
    ctx.strokeStyle = rgba(PLAIN_TINT, 0.55);
    ctx.lineWidth = Math.max(1 / z, size * 0.05);
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    if (!affinity) {
      let text = initialsCache.get(n.type.id);
      if (!text) initialsCache.set(n.type.id, text = initials(n.type.name));
      placeholderText(n, text, size, false, z);
    }
  }
  // Names under the nodes, in screen space so they stay readable: notables and keystones from a moderate zoom,
  // small nodes once closer. Affinity nodes go unlabelled (their colours say it, and there are 155 of them).
  const LABEL_STYLE = {
    KEYSTONE: { min: 14, font: `600 12px ${FONT}` },
    NOTABLE: { min: 14, font: `600 12px ${FONT}` },
    SMALL: { min: 22, font: `11px ${FONT}` },
  };
  const labelLines = new Map();
  function wrapLabel(text, font, maxW) {
    const key = `${font}|${maxW}|${text}`;
    let lines = labelLines.get(key);
    if (lines) return lines;
    ctx.font = font;
    lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
    if (lines.length === 2 && ctx.measureText(lines[1]).width > maxW) {
      let s = lines[1];
      while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
      lines[1] = s.trimEnd() + '…';
    }
    labelLines.set(key, lines);
    return lines;
  }
  function drawNodeLabels(view, z, treeAlpha) {
    if (!placeholderMode()) return;
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    for (const n of nodes) {
      const style = LABEL_STYLE[n.tier];
      if (!style || switchedOff(n) || n.fp * z < style.min || !inView(view, n.x, n.y, n.fp)) continue;
      const t = isChoice(n) && !held(n.id) ? n.type : effectiveType(n);
      if (isChoice(n) && n.type.options.every(id => OPTION_TINT[id])) continue;
      const maxW = Math.round(Math.max(90, Math.min(170, n.fp * z * 2.6)) / 10) * 10;
      const lines = wrapLabel(t.name, style.font, maxW);
      const x = toScreenX(n.x);
      let y = toScreenY(n.y) + (n.fp * z) * (n.tier === 'SMALL' ? 0.5 : 0.62) + 4;
      ctx.font = style.font;
      ctx.globalAlpha = nodeAlpha(n, treeAlpha) * (held(n.id) ? 1 : 0.8);
      for (const line of lines) {
        ctx.strokeStyle = P.labelHalo; ctx.lineWidth = 3;
        ctx.strokeText(line, x, y);
        ctx.fillStyle = P.label[n.tier];
        ctx.fillText(line, x, y);
        y += 13;
      }
    }
    ctx.restore();
  }
  function drawSplitIcon(n, size, alpha) {
    const opts = n.type.options.map(id => types.get(id)).filter(Boolean);
    const k = opts.length;
    if (!opts.some(o => { const r = img(o.icon); return r && r.ok; })) {
      ctx.save(); ctx.globalAlpha = alpha; drawPlaceholderSplit(n, opts, size, cam.zoom); ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < k; i++) {
      const rec = img(opts[i].icon);
      if (!rec || !rec.ok) continue;
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / k, a1 = a0 + (2 * Math.PI) / k;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.arc(n.x, n.y, size / 2, a0, a1); ctx.closePath(); ctx.clip();
      ctx.drawImage(dimmed(rec), n.x - size / 2, n.y - size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawWormhole(n, allocated, alpha) {
    const col = n.wormholeColor || [120, 110, 255];
    const r = n.fp / 2;
    const open = allocated ? 1 : 0.55;
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 1.25);
    g.addColorStop(0, `rgba(255,60,220,${0.95 * open})`);
    g.addColorStop(0.18, `rgba(40,0,60,${0.9 * open})`);
    g.addColorStop(0.45, rgba(col, 0.75 * open));
    g.addColorStop(0.62, rgba(col, 0.25 * open));
    g.addColorStop(0.8, rgba(col, 0.55 * open));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(n.x, n.y, r * 1.25, 0, Math.PI * 2); ctx.fill();
    // spinning arcs
    ctx.lineWidth = r * 0.06;
    for (let i = 0; i < 3; i++) {
      const a = time * (0.6 + i * 0.25) * (i % 2 ? -1 : 1) + i;
      ctx.strokeStyle = rgba(col, 0.7 * open);
      ctx.beginPath(); ctx.arc(n.x, n.y, r * (0.55 + i * 0.16), a, a + Math.PI * 0.9); ctx.stroke();
    }
  }

  function drawSocket(n, allocated, alpha, ac) {
    const h = n.fp / 2;
    const d = h * 0.42; // octagon corner cut
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(n.x - h + d, n.y - h); ctx.lineTo(n.x + h - d, n.y - h); ctx.lineTo(n.x + h, n.y - h + d); ctx.lineTo(n.x + h, n.y + h - d);
    ctx.lineTo(n.x + h - d, n.y + h); ctx.lineTo(n.x - h + d, n.y + h); ctx.lineTo(n.x - h, n.y + h - d); ctx.lineTo(n.x - h, n.y - h + d); ctx.closePath();
    ctx.fillStyle = P.socketFill;
    ctx.fill();
    ctx.strokeStyle = allocated ? rgba(ac, 0.95) : 'rgba(150,150,150,0.6)';
    ctx.lineWidth = n.fp * 0.04;
    ctx.stroke();
    const exitId = state.links.get(n.id);
    if (exitId) {
      const ex = byId.get(exitId);
      const col = ex.wormholeColor || [120, 110, 255];
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, h * 0.75);
      g.addColorStop(0, 'rgba(255,60,220,0.95)'); g.addColorStop(0.4, rgba(col, 0.8)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(n.x, n.y, h * 0.75, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = allocated ? rgba(ac, 0.5) : 'rgba(150,150,150,0.35)';
      ctx.font = `600 ${h * 0.9}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', n.x, n.y + h * 0.04);
    }
  }

  function drawRoot(n, view, z, choosing) {
    if (!inView(view, n.x, n.y, n.fp)) return;
    const col = ROOT_COLOURS[n.type.id] || GLOW;
    const r = n.fp / 2;
    const chosen = state.root === n.id;
    const allocated = sat(n.id);
    const alpha = searchHits && !searchHits.has(n.id) ? SEARCH_DIM_NODE : 1;
    const pulse = choosing ? breath() : 1;
    ctx.globalAlpha = alpha;
    // circuit glow
    const g = ctx.createRadialGradient(n.x, n.y, r * 0.55, n.x, n.y, r * 1.5);
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.35, rgba(col, (allocated ? 0.35 : 0.12) * pulse)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(n.x, n.y, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.rootFill;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
    const rec = img(n.type.icon);
    if (rec && rec.ok) {
      const s = n.fp * 0.68;
      ctx.globalAlpha = alpha * (allocated || choosing ? 0.4 : 0.22);
      ctx.drawImage(rec.el, n.x - s / 2, n.y - s / 2, s, s);
      ctx.globalAlpha = alpha;
    }
    const w = n.fp * 0.035;
    const preRem = preview && preview.remove && preview.remove.has(n.id);
    const preAdd = preview && preview.add && preview.add.has(n.id);
    const ringCol = preRem ? PREVIEW_REMOVE : preAdd ? PREVIEW_ADD : allocated || choosing ? col : DULL;
    const ringA = allocated ? 1 : choosing ? pulse : canAllocateNow(n) ? breath() : 0.5;
    ctx.strokeStyle = rgba(ringCol, 0.25 * ringA); ctx.lineWidth = w * 3;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(ringCol, ringA); ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    // Affinity number for this root's tech, as the mod shows it.
    if (state.root) {
      const affKey = { root_low_tech: 'LOW_TECH_AFFINITY_FLAT', root_midline: 'MIDLINE_AFFINITY_FLAT', root_high_tech: 'HIGH_TECH_AFFINITY_FLAT' }[n.type.id];
      const v = cachedTotals ? Math.round(cachedTotals.aff[affKey] || 0) : 0;
      ctx.fillStyle = rgba(col, chosen ? 1 : 0.8);
      ctx.font = `700 ${r * 0.55}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(v), n.x, n.y + r * 0.04);
    } else if (z * n.fp > 40) {
      ctx.fillStyle = rgba(col, 0.95);
      ctx.font = `700 ${r * 0.24}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.type.name.toUpperCase(), n.x, n.y + r * 1.32);
    }
    ctx.globalAlpha = 1;
  }

  // Expanding gold rings on a jump destination.
  function drawFlash(n, age, z) {
    const fade = 1 - age / FLASH_SECONDS;
    ctx.lineWidth = 2.5 / z;
    for (let i = 0; i < 2; i++) {
      const t = ((age / 0.8) + i * 0.5) % 1;
      ctx.strokeStyle = rgba(SEARCH_GOLD, (1 - t) * fade);
      ctx.beginPath(); ctx.arc(n.x, n.y, n.fp * (0.6 + t * 1.6), 0, Math.PI * 2); ctx.stroke();
    }
  }
  function drawHover(n, z, time) {
    const r = n.tier === 'ROOT' ? n.fp / 2 + 6 / z : n.fp * 0.55 + 3 / z;
    ctx.strokeStyle = P.hover;
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    if (n.tier === 'WORMHOLE' && n.volume === 'core' && n.pairedWith) drawWormholeLink(n, byId.get(n.pairedWith), z, time);
  }
  // Hovering one of the core's wormholes: a dashed line, moving toward the other end, plus a ring on that end, in the
  // pair's colour, so it's clear which two are linked (the mod hides these links: hiddenConnectors).
  function drawWormholeLink(a, b, z, time) {
    if (!b) return;
    const col = a.wormholeColor || [120, 110, 255];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (!len) return;
    const ux = dx / len, uy = dy / len, ra = a.fp * 0.55 + 3 / z, rb = b.fp * 0.55 + 3 / z;
    if (len <= ra + rb) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash([10 / z, 8 / z]);
    ctx.lineDashOffset = -(time * 40) / z;
    ctx.beginPath(); ctx.moveTo(a.x + ux * ra, a.y + uy * ra); ctx.lineTo(b.x - ux * rb, b.y - uy * rb);
    ctx.strokeStyle = P.searchOutline; ctx.lineWidth = 5 / z; ctx.stroke(); // dark edge so it reads over the tree
    ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 2.5 / z; ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(b.x, b.y, rb, 0, Math.PI * 2);
    ctx.strokeStyle = P.searchOutline; ctx.lineWidth = 5 / z; ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 2.5 / z; ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ hit testing
  function nodeAt(sx, sy) {
    const wx = toWorldX(sx), wy = toWorldY(sy);
    const minHalf = 7 / cam.zoom; // keep tiny nodes clickable when zoomed out
    let best = null, bestD = Infinity;
    for (const n of nodes) {
      if (switchedOff(n)) continue; // a hidden optional volume can't be hovered or clicked
      const half = Math.max(n.fp / 2, minHalf);
      const dx = Math.abs(wx - n.x), dy = Math.abs(wy - n.y);
      if (dx <= half && dy <= half) {
        const d = dx * dx + dy * dy;
        if (d < bestD) { best = n; bestD = d; }
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ DOM
  const els = {
    topbar: document.getElementById('topbar'),
    rootName: document.getElementById('root-name'),
    used: document.getElementById('used'),
    cap: document.getElementById('cap'),
    hull: document.getElementById('hull'),
    search: document.getElementById('search'),
    searchCount: document.getElementById('search-count'),
    undo: document.getElementById('btn-undo'),
    shipBtn: document.getElementById('btn-ship'),
    storyBtn: document.getElementById('btn-story'),
    tplGroup: document.getElementById('tpl-group'),
    tplCurrent: document.getElementById('tpl-current'),
    tplEdited: document.getElementById('tpl-edited'),
    shipTab: document.getElementById('tab-ship'),
    panelShip: document.getElementById('panel-ship'),
    panel: document.getElementById('panel'),
    panelBody: document.getElementById('panel-body'),
    panelSub: document.getElementById('panel-sub'),
    panelFoot: document.getElementById('panel-foot'),
    affinity: document.getElementById('affinity'),
    tooltip: document.getElementById('tooltip'),
    picker: document.getElementById('picker'),
    banner: document.getElementById('banner'),
    toast: document.getElementById('toast'),
  };
  let panelTab = 'stats';
  let cachedTotals = null;
  let baseTotals = null; // the totals without the integration preview, to mark what it changes (integPreviewBase)

  // When the hidden optional volumes change, the search (and the list, which follows it) is run again so their nodes
  // drop out of or come back into the matches. var, not let: changed() can run before this line during start-up.
  var hiddenVolSig = '', filterReady = false;
  function changed() {
    dropLostIntegrations();
    baseTotals = null;
    const hvSig = [...state.hiddenVolumes].sort().join();
    if (hvSig !== hiddenVolSig) { hiddenVolSig = hvSig; if (filterReady) runFilter(); }
    subCache = null;
    ruleCache = null;
    planCache = null;
    cachedTotals = totals();
    updatePreview();
    renderChrome();
    renderPanel();
    renderTargets();
    if (hover) showTooltip(hover, lastMouse.x, lastMouse.y);
    persist();
    if (!storyEl.hidden) renderStory();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    requestDraw();
  }

  function renderChrome() {
    const r = state.root ? byId.get(state.root) : null;
    els.rootName.textContent = r ? r.type.name : tr('bar.chooseRoot');
    els.rootName.classList.toggle('muted', !r);
    if (r) els.rootName.style.color = rgba(ROOT_COLOURS[r.type.id] || GLOW, 1); else els.rootName.style.color = '';
    els.used.textContent = used();
    els.used.classList.toggle('over', used() > state.cap);
    if (document.activeElement !== els.cap) els.cap.value = state.cap;
    els.hull.value = state.hull;
    els.undo.disabled = undoStack.length === 0;
    els.undo.title = tr('bar.undo', { count: undoStack.length });
    const shipN = shipRuleCount(), storyN = storyRuleCount() + state.hiddenVolumes.size;
    els.shipBtn.textContent = shipN ? tr('bar.shipRules.set', { n: shipN }) : tr('bar.shipRules');
    els.storyBtn.textContent = storyN ? tr('bar.optionalRules.set', { n: storyN }) : tr('bar.optionalRules');
    els.shipTab.textContent = shipN ? tr('panel.tab.ship.set', { n: shipN }) : tr('panel.tab.ship');
    const tm = state.root ? state.template : null;
    els.tplGroup.hidden = !tm;
    if (tm) { els.tplCurrent.textContent = tm.name; els.tplEdited.hidden = templateSig() === tm.sig; }
    if (!state.root) waypoints = [];
    els.banner.hidden = targets.mode || (!!state.root && !waypoints.length);
    els.banner.textContent = !state.root ? S['ui.node.startingRootPrompt'] || tr('bar.chooseRoot') : tr('bar.waypoints', { count: waypoints.length });
    els.banner.classList.toggle('small', !!state.root);
  }

  function renderPanel() {
    const t = cachedTotals || totals();
    els.panelSub.textContent = state.root ? tr('panel.nodesUsed', { used: used(), cap: state.cap }) : '';
    // affinity tiles
    els.affinity.innerHTML = Object.keys(AFFINITY_NAMES).map(k => {
      const v = Math.round((t.aff[k] || 0) * 100) / 100;
      return `<div class="aff" style="border-color:${rgba(AFFINITY_COLOURS[k], 0.4)}"><div class="n" style="color:${rgba(AFFINITY_COLOURS[k], 1)}">${v}</div><div class="t">${esc(tr('panel.affinityTile', { affinity: AFFINITY_NAMES[k] }))}</div></div>`;
    }).join('');
    renderAffMix();
    renderInteg();

    // The Ship tab is a form, kept in its own element so typing isn't lost when the panel re-renders.
    const onShip = panelTab === 'ship';
    els.panelBody.hidden = onShip;
    els.panelShip.hidden = !onShip;
    els.shipBtn.setAttribute('aria-pressed', String(onShip && !els.panel.classList.contains('closed')));
    // Views outside the panel that show the build follow every change (whatever tab the panel shows).
    const sheetOpen = document.getElementById('statsheet');
    if (sheetOpen && !sheetOpen.hidden) renderSheet();
    refreshList();
    if (onShip) { renderShipPane(); els.panelFoot.textContent = footText(); return; }
    if (panelTab === 'search') {
      els.panelBody.innerHTML = searchResultsHtml();
      els.panelFoot.textContent = footText();
      const cur = els.panelBody.querySelector('.node-row.current');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (!state.root) {
      els.panelBody.innerHTML = `<div class="empty">${esc(tr('panel.pickRoot'))}</div>`;
      els.panelFoot.textContent = footText();
      return;
    }
    if (panelTab === 'sheet') {
      els.panelBody.innerHTML = sheetTabHtml();
      els.panelFoot.textContent = footText();
      return;
    }
    if (panelTab === 'stats') {
      const groups = new Map();
      for (const s of t.sums.values()) {
        if (Math.abs(s.magnitude) < 1e-9) continue;
        const g = groupOf(s.effect);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(s);
      }
      const order = [...GROUPS.map(g => g[0]), OTHER_GROUP];
      const base = integPreviewBase();
      for (const b of previewGone(base && base.sums, t.sums)) {
        const g = groupOf(b.effect);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push({ ...b, gone: true });
      }
      let html = '';
      for (const g of order) {
        const list = groups.get(g);
        if (!list) continue;
        html += `<div class="stat-group"><h3>${esc(g)}</h3>`;
        for (const s of list) {
          if (s.gone) { html += `<div class="stat-line">${goneHtml(s)}</div>`; continue; }
          const src = s.affinity && s.sources ? tr('panel.src.nodesAffinity', { count: s.sources }) : s.affinity ? tr('panel.src.affinity') : tr('panel.src.nodes', { count: s.sources });
          html += `<div class="stat-line">${describe(s.effect, s.magnitude)}<span class="src">${esc(src)}</span>${previewDiffHtml(base && base.sums, s)}</div>`;
        }
        html += '</div>';
      }
      // granted hull mods and text-only effects
      const extras = new Set();
      for (const c of contributions()) {
        if (c.node.tier === 'WORMHOLE' || c.node.tier === 'WORMHOLE_EXIT') continue; // their text is travel instructions
        for (const hm of grantedHullMods(c.type)) extras.add(trHtml('tooltip.grantsHullmod', { hullmod: hullModName(hm) }));
        for (const txt of typeText(c.type, c.integ)) extras.add(styled(txt));
      }
      if (extras.size) html += `<div class="stat-group"><h3>${esc(tr('panel.otherEffects'))}</h3>${[...extras].map(e => `<div class="stat-line">${e}</div>`).join('')}</div>`;
      // Temporary nodes: their effects only for the first N seconds after deployment.
      for (const [secs, g] of t.temp || []) {
        const lines = [...g.sums.values()].filter(s => Math.abs(s.magnitude) > 1e-9);
        if (!lines.length) continue;
        html += `<div class="stat-group"><h3>${esc(tr('panel.temp.heading', { seconds: secs }))}</h3>` +
          lines.map(s => `<div class="stat-line">${describe(s.effect, s.magnitude)}<span class="src">${esc(tr('panel.src.nodes', { count: s.sources }))}</span></div>`).join('') + '</div>';
      }
      // Gated nodes: their live-in-combat effects at the gate's strength, only under its condition.
      for (const [when, g] of t.gated || []) {
        const lines = [...g.sums.values()].filter(s => Math.abs(s.magnitude) > 1e-9);
        html += `<div class="stat-group"><h3>${esc(tr('panel.gated.heading', { when: GATE_NAMES[when], item: g.item, strength: g.strength }))}</h3>` +
          (lines.length ? lines.map(s => `<div class="stat-line">${describe(s.effect, s.magnitude)}</div>`).join('') : `<div class="stat-line muted">${esc(tr('panel.gated.nothing'))}</div>`) +
          `<div class="stat-line muted">${esc(tr('panel.gated.nodes', { count: g.nodes }))}</div></div>`;
      }
      const subLines = subState().active.map(a => `<div class="stat-line"><span class="hl">${esc(a.def.name)}</span> <span class="src">${esc(subSummary(a.def, a.entry, a.socket))}</span>${a.def.unobtainable ? ` <span class="bad">${UNOBTAINABLE_TEXT}</span>` : ''}</div>`);
      if (subLines.length) html += `<div class="stat-group"><h3>${esc(tr('panel.subroutines'))}</h3>${subLines.join('')}</div>`;
      const reached = t.affBonuses.filter(b => b.reached > 0);
      if (reached.length) {
        html += `<div class="stat-group"><h3>${esc(tr('panel.thresholds'))}</h3>`;
        for (const b of reached) html += `<div class="stat-line">${describe(b.effect, b.reached * b.bonus)}<span class="src">${esc(tr('panel.threshold.src', { affinity: AFFINITY_NAMES[b.affinity], reached: b.reached, size: b.size }))}</span></div>`;
        html += '</div>';
      }
      els.panelBody.innerHTML = html || `<div class="empty">${esc(tr('panel.noEffects'))}</div>`;
    } else {
      const list = nodes.filter(n => sat(n.id) && ['NOTABLE', 'KEYSTONE', 'SOCKET', 'WORMHOLE', 'ROOT'].includes(n.tier));
      const rank = { ROOT: 0, KEYSTONE: 1, NOTABLE: 2, SOCKET: 3, WORMHOLE: 4 };
      list.sort((a, b) => rank[a.tier] - rank[b.tier] || effectiveType(a).name.localeCompare(effectiveType(b).name));
      els.panelBody.innerHTML = list.length ? list.map(n => {
        const t2 = effectiveType(n);
        let sub = TIER_LABEL[n.tier];
        if (n.tier === 'SOCKET') {
          const e = state.links.get(n.id), s = state.subs.get(n.id), d = s && SUBS.get(s.id);
          sub += d ? ` · ${d.name}${d.unobtainable ? ` ${tr('panel.nodes.unobtainable')}` : ''}` : e ? ` · ${tr('panel.nodes.anchor', { volume: volumeName(byId.get(e).volume) })}` : ` · ${tr('panel.nodes.empty')}`;
        }
        if (n.volume !== 'core') sub += ` · ${volumeName(n.volume)}`;
        const ig = isIntegrated(n) ? ` <span class="builtin">${esc(tr('tooltip.integ.integrated'))}</span>` : integPreview && canIntegrate(n) ? ` <span class="builtin">${esc(tr('tooltip.integ.preview'))}</span>` : '';
        return `<div class="node-row ${n.tier.toLowerCase()}" data-node="${esc(n.id)}" title="${integrable(t2) ? esc(tr('panel.nodes.integTitle')) : ''}">${nodeIconHtml(n, t2)}<div><div class="nm${isIntegrated(n) ? ' builtin' : ''}">${esc(t2.name)}</div><div class="tr">${esc(sub)}${ig}</div></div></div>`;
      }).join('') : `<div class="empty">${esc(tr('panel.nodes.none'))}</div>`;
    }
    els.panelBody.insertAdjacentHTML('afterbegin', problemsHtml());
    els.panelFoot.textContent = footText();
  }
  // Allocated nodes that break a rule, for the top of the summary (rows jump to the node).
  function problemsHtml() {
    const problems = rules().problems;
    if (!problems.size) return '';
    const rows = [...problems].map(([id, b]) => {
      const n = byId.get(id), t2 = effectiveType(n);
      return `<div class="node-row" data-node="${esc(id)}">${nodeIconHtml(n, t2)}<div><div class="nm">${esc(t2.name)}</div><div class="tr bad">${esc(b.text)}</div></div></div>`;
    }).join('');
    return `<div class="rule-problems"><h3>${esc(tr('panel.problems.heading', { count: problems.size }))}</h3>` +
      `<p class="muted">${esc(tr('panel.problems.note'))}</p>${rows}</div>`;
  }
  // Affinity nodes block under the affinity totals: set them all to one option, or to a split of the three.
  const affMix = {
    box: document.getElementById('aff-mix'),
    count: document.getElementById('aff-count'),
    inputs: [...document.querySelectorAll('#aff-mix input[data-mix]')],
    note: document.getElementById('aff-note'),
    apply: document.getElementById('aff-apply'),
  };
  function affCounts() {
    const c = Object.fromEntries(affMix.inputs.map(i => [i.dataset.mix, 0]));
    for (const n of affinityNodes()) { const o = state.choice.get(n.id); if (o in c) c[o]++; }
    return c;
  }
  const affTargets = () => Object.fromEntries(affMix.inputs.map(i => [i.dataset.mix, Math.max(0, Math.round(Number(i.value) || 0))]));
  function renderAffMix() {
    const n = state.root ? affinityNodes().length : 0;
    affMix.box.hidden = !n;
    if (!n) return;
    affMix.count.textContent = n;
    if (!affMix.inputs.includes(document.activeElement)) { const c = affCounts(); for (const i of affMix.inputs) i.value = c[i.dataset.mix]; }
    updateAffNote();
  }
  function updateAffNote() {
    const n = affinityNodes().length, t = affTargets(), c = affCounts();
    const sum = Object.values(t).reduce((a, b) => a + b, 0);
    affMix.apply.disabled = sum !== n || Object.keys(c).every(k => c[k] === t[k]);
    affMix.note.textContent = sum !== n ? tr('panel.affMix.mismatch', { sum, count: n }) : '';
    affMix.note.className = sum !== n ? 'bad' : 'muted';
  }
  function applyAffinity(targets) {
    const moved = setAffinitySplit(targets);
    for (const i of affMix.inputs) i.blur();
    renderAffMix();
    if (moved) toast(tr('toast.affinityChanged', { count: moved }));
  }
  for (const i of affMix.inputs) {
    i.addEventListener('input', updateAffNote);
    i.addEventListener('keydown', e => { if (e.key === 'Enter' && !affMix.apply.disabled) { e.preventDefault(); applyAffinity(affTargets()); } });
  }
  affMix.apply.addEventListener('click', () => applyAffinity(affTargets()));
  affMix.box.addEventListener('click', e => {
    const b = e.target.closest('[data-all]');
    if (b) applyAffinity({ [b.dataset.all]: affinityNodes().length });
  });

  // Integrated nodes block under the affinity one: the count and story point cost, Integrate all / Remove all (saved
  // with the build), the preview (not saved) and the keep setting (a browser setting, esp.keepIntegration).
  const integEl = {
    box: document.getElementById('integ'),
    summary: document.getElementById('integ-summary'),
    all: document.getElementById('integ-all'),
    none: document.getElementById('integ-none'),
    preview: document.getElementById('integ-preview'),
    keep: document.getElementById('integ-keep'),
    note: document.getElementById('integ-note'),
    view: document.getElementById('integ-view'),
  };
  function renderInteg() {
    const able = state.root ? integrableAllocated() : [];
    const k = state.integrated.size;
    integEl.box.hidden = !state.root;
    if (integEl.box.hidden) return;
    const kept = [...state.integrated].filter(id => !state.alloc.has(id)).length;
    const cost = storyPointCost(k);
    integEl.summary.innerHTML = trHtml('panel.integ.summary', { count: cost, countHtml: `<b class="builtin">${k}</b>`, total: able.length + kept, pointsHtml: `<b>${cost}</b>` });
    integEl.all.disabled = able.every(n => state.integrated.has(n.id));
    integEl.none.disabled = !k;
    integEl.preview.checked = integPreview;
    integEl.keep.checked = keepIntegration;
    integEl.view.value = integView;
    const notes = [];
    if (kept) notes.push(tr('panel.integ.kept', { count: kept }));
    if (integPreview) notes.push(tr('panel.integ.preview', { total: able.length, points: pointsText(storyPointCost(able.length)) }));
    integEl.note.textContent = notes.join(' ');
  }
  integEl.all.addEventListener('click', () => { const c = setAllIntegrated(true); if (c) toast(tr('toast.integratedAll', { count: c })); });
  integEl.none.addEventListener('click', () => { const c = setAllIntegrated(false); if (c) toast(tr('toast.integrationsRemoved', { count: c })); });
  integEl.preview.addEventListener('change', () => setIntegPreview(integEl.preview.checked));
  integEl.keep.addEventListener('change', () => setKeepIntegration(integEl.keep.checked));
  integEl.view.addEventListener('change', () => setIntegView(integEl.view.value));

  // After a hull or ship rules change: say so when allocated nodes newly break a rule.
  function warnNewProblems(before) {
    const now = rules().problems.size;
    if (now > before) toast(tr('ship.problemCount', { count: now }));
  }
  // The planner's version (version.js): a release tag like v0.2.0-alpha.3+es0.11.1-alpha, `git describe` output when
  // served locally (that tag plus -<commits>-g<hash>, and -dirty for uncommitted changes), or "dev". The footer shows
  // the tag without its +es<mod release> part, since the mod's version is right beside it.
  const PLANNER_VERSION = typeof window.PLANNER_VERSION === 'string' && window.PLANNER_VERSION ? window.PLANNER_VERSION : 'dev';
  const plannerVersionShort = (() => {
    let v = PLANNER_VERSION;
    const dirty = v.endsWith('-dirty');
    if (dirty) v = v.slice(0, -'-dirty'.length);
    const ahead = /-(\d+)-g[0-9a-f]+$/.exec(v);
    if (ahead) v = v.slice(0, ahead.index);
    v = v.replace(/\+es.*$/, '');
    const shown = `${v}${ahead ? ` +${ahead[1]}` : ''}`;
    return dirty ? tr('panel.version.edited', { version: shown }) : shown;
  })();
  // The mod data's version: mod_info.json's (D.modVersion), or, for data extracted past a release (unreleased work on
  // a branch like Dev; D.modGit from extract.mjs), the nearest release tag with the branch and commit.
  const MOD_GIT = D.modGit && typeof D.modGit === 'object' ? D.modGit : null;
  const modPastRelease = !!MOD_GIT && (!MOD_GIT.release || MOD_GIT.ahead > 0 || !!MOD_GIT.dirty);
  const modVersionShort = (() => {
    if (!modPastRelease) return D.modVersion || '?';
    const release = MOD_GIT.release || D.modVersion || '?';
    const v = MOD_GIT.branch ? tr('panel.modVersion.branch', { release, branch: MOD_GIT.branch, commit: MOD_GIT.commit })
      : tr('panel.modVersion.commit', { release, commit: MOD_GIT.commit });
    return MOD_GIT.dirty ? tr('panel.version.edited', { version: v }) : v;
  })();
  const modVersionLong = modPastRelease
    ? tr(MOD_GIT.dirty ? 'panel.modLong.dirty' : 'panel.modLong', {
      version: D.modVersion || tr('panel.modVersion.unknown'),
      release: MOD_GIT.release ? tr('panel.modLong.ahead', { count: MOD_GIT.ahead, release: MOD_GIT.release }) : tr('panel.modLong.noRelease'),
      where: MOD_GIT.branch ? tr('panel.modLong.branch', { branch: MOD_GIT.branch }) : tr('panel.modLong.commit'),
      commit: MOD_GIT.commit,
    })
    : tr('panel.modShort', { version: D.modVersion || tr('panel.modVersion.unknown') });
  const footText = () => tr('panel.foot', { mod: modVersionShort, planner: plannerVersionShort });

  // ------------------------------------------------------------------ tooltip
  let lastMouse = { x: 0, y: 0 };
  // The game's "Mutually exclusive with" lists (SkillNode.describeExclusivity). Nodes: every other type it clashes with
  // (typesExclusive), by name. Hull mods: the game lists the type's own ones plus the conflicting ones the player knows
  // (mod 0.12.4); the planner can't know those, so it lists the own ones plus those entered in Ship rules.
  const exclusiveNodeCache = new Map();
  function exclusiveNodeNames(t) {
    let names = exclusiveNodeCache.get(t.id);
    if (!names) {
      names = [...new Set([...types.values()].filter(o => o !== t && typesExclusive(t, o)).map(o => o.name))];
      exclusiveNodeCache.set(t.id, names);
    }
    return names;
  }
  function exclusivityHtml(t) {
    const hullMods = [...new Set([...grantedHullMods(t), ...typeRules(t).excluded.filter(shipHasHullMod)])].map(hullModName);
    const nodeNames = exclusiveNodeNames(t);
    const label = (key, n, fallback) => (S[`${key}.${n === 1 ? 'one' : 'other'}`] || fallback).replace(/<\/?\w+>/g, '').replace(/:\s*$/, '');
    let html = '';
    if (hullMods.length) html += `<div class="tt-note">${esc(label('node.exclusive.hullmods', hullMods.length, tr('tooltip.exclusive.hullmods')))}: ${esc(hullMods.join(', '))}</div>`;
    if (nodeNames.length) html += `<div class="tt-note">${esc(label('node.exclusive.nodes', nodeNames.length, tr('tooltip.exclusive.nodes')))}: ${esc(nodeNames.join(', '))}</div>`;
    return html;
  }
  function tooltipHtml(n) {
    const t = effectiveType(n);
    const allocated = sat(n.id);
    const tierClass = n.tier.toLowerCase();
    let html = `<div class="tt-head">${nodeIconHtml(n, t)}<div><div class="tt-title">${esc(t.name)}</div><div class="tt-tier ${tierClass}">${esc(TIER_LABEL[n.tier] || n.tier)}${n.volume !== 'core' ? ' · ' + esc(volumeName(n.volume)) : ''}${state.integrated.has(n.id) && integrable(t) ? ` · <span class="builtin">${esc(tr('tooltip.integ.integrated'))}</span>` : integPreview && canIntegrate(n) ? ` · <span class="builtin">${esc(tr('tooltip.integ.preview'))}</span>` : ''}</div></div></div>`;

    if (isChoice(n)) {
      const cur = state.choice.get(n.id);
      const others = state.root ? (allocated ? buildEntries(n.id) : rules().list) : null;
      for (const id of n.type.options) {
        const o = types.get(id);
        if (!o) continue;
        const b = others && cur !== id ? blockOf(n, id, others) : null;
        html += `<div class="tt-option"><div class="${cur === id ? 'on' : ''}">${esc(o.name)}${cur === id ? ' ✓' : ''}</div>${typeLines(o).map(l => `<div>${l}</div>`).join('')}${exclusivityHtml(o)}${b ? `<div class="bad">${esc(b.text)}</div>` : ''}</div>`;
      }
    } else if (n.tier === 'SOCKET') {
      const e = state.links.get(n.id);
      const se = state.subs.get(n.id), sd = se && SUBS.get(se.id);
      if (sd) html += `<div class="tt-effects"><div><span class="hl">${esc(sd.name)}</span></div><div>${esc(subSummary(sd, se, n))}</div>${sd.unobtainable ? `<div class="bad">${UNOBTAINABLE_TEXT}</div>` : ''}</div>${sd.description ? `<div class="tt-flavour">${esc(sd.description)}</div>` : ''}`;
      else html += `<div class="tt-effects"><div>${e ? trHtml('tooltip.socket.linked', { volume: volumeName(byId.get(e).volume) }) : trHtml('tooltip.socket.empty')}</div></div>`;
    } else if (n.tier === 'WORMHOLE') {
      const p = partnerOf(n);
      html += `<div class="tt-effects"><div>${p ? trHtml('tooltip.wormhole.leadsTo', { node: effectiveType(p).name }) : trHtml('tooltip.wormhole.leadsToAnother')}</div></div>`;
    } else if (n.tier === 'WORMHOLE_EXIT') {
      html += `<div class="tt-effects"><div>${trHtml('tooltip.exit', { volume: volumeName(n.volume) })}</div></div>`;
    } else if (integrable(t)) {
      html += `<div class="tt-effects">${integrationCompareHtml(n, t)}</div>`;
    } else {
      const lines = typeLines(t);
      if (lines.length) html += `<div class="tt-effects">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
    }
    if (!isChoice(n)) html += exclusivityHtml(t);
    const nodeTheme = nodeThemes(n);
    if (nodeTheme && nodeTheme.size) html += `<div class="tt-note">${trHtml('tooltip.themes', { themes: [...nodeTheme].map(themeName).join(', ') })}</div>`;
    const reqs = (t.tags || []).filter(x => x.startsWith('req_')).map(requirementName);
    if (reqs.length) html += `<div class="tt-note">${trHtml('tooltip.needs', { needs: reqs.join(tr('common.listComma')) })}</div>`;
    if (n.gates.length) html += `<div class="tt-note">${trHtml('tooltip.unlockedBy', { gates: n.gates.map(gameStateName).join(tr('common.listComma')) })}</div>`;
    if (t.flavour) html += `<div class="tt-flavour">${esc(t.flavour)}</div>`;
    const problem = allocated && rules().problems.get(n.id);
    if (problem) html += `<div class="tt-warn">${trHtml('tooltip.problem', { reason: problem.text })}</div>`;
    html += radiusNotesHtml(n);
    const grant = subState().granted.get(n.id);
    if (grant && grant.status === 'active') {
      html += `<div class="tt-note">${trHtml('tooltip.granted', { item: grant.def.name })}</div>`;
      return html;
    }

    // action hint
    const note = (key, args) => `<div class="tt-note">${trHtml(key, args)}</div>`;
    const warn = (key, args) => `<div class="tt-warn">${trHtml(key, args)}</div>`;
    const jt = jumpTarget(n);
    if (targets.mode && state.root) return html + targetTooltipNote(n) + (jt ? note('tooltip.jump', { place: placeName(jt) }) : '');
    if (jt && n.tier === 'SOCKET') html += note('tooltip.jump', { place: placeName(jt) });
    if (jt && (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT')) {
      html += note(!state.root || n.id === state.root ? 'tooltip.wormhole.options' : allocated ? 'tooltip.wormhole.options.remove' : 'tooltip.wormhole.options.allocate', { place: placeName(jt) });
    } else if (!state.root) html += n.tier === 'ROOT' ? note('tooltip.root.choose') : '';
    else if (n.id === state.root) html += note('tooltip.root.start');
    else if (allocated) {
      const gone = removalSet(n) || [];
      if (n.tier === 'SOCKET') html += note(state.links.get(n.id) || state.subs.get(n.id) ? 'tooltip.socket.change' : 'tooltip.socket.fill');
      else if (isChoice(n)) html += note('tooltip.choice.options');
      else html += gone.length > 1 ? warn('tooltip.removeMany', { count: gone.length }) : warn('tooltip.remove');
    } else if (switchedOff(n)) {
      html += `<div class="tt-warn">${esc(hiddenText(n))}</div>`;
    } else {
      const found = routeTo(n);
      const path = found.path;
      const via = waypoints.includes(n) ? waypoints.indexOf(n) : waypoints.length;
      const waypointsText = tr('tooltip.waypoints', { count: via });
      if (!path && found.block) html += via ? warn('tooltip.refusedVia', { count: via, reason: refusalText(n, found.block) }) : warn('tooltip.refused', { reason: refusalText(n, found.block) });
      else if (!path) html += warn(n.tier === 'WORMHOLE_EXIT' ? 'tooltip.exitUnlinked' : 'tooltip.unreachable');
      else if (used() + path.length > state.cap) {
        html += warn(via ? 'tooltip.overCapVia' : 'tooltip.overCap', { nodes: tr('tooltip.nodes', { count: path.length }), waypoints: waypointsText, left: Math.max(0, state.cap - used()) });
      } else {
        const kind = path.length > 1 ? (via ? 'tooltip.allocate.manyVia' : 'tooltip.allocate.many') : via ? 'tooltip.allocate.via' : 'tooltip.allocate';
        html += note(isChoice(n) ? `${kind}.choice` : kind, { count: path.length, waypoints: waypointsText });
      }
    }
    if (state.root && n.id !== state.root && integrable(t) && !isChoice(n)) {
      if (state.integrated.has(n.id)) html += note(allocated ? 'tooltip.integ.remove' : 'tooltip.integ.removeKept');
      else if (allocated) html += note('tooltip.integ.add', { points: pointsText(nextIntegrationCost()) });
    }
    if (state.root && n.id !== state.root) {
      const wi = waypoints.indexOf(n);
      if (wi >= 0) html += note('tooltip.waypoint.this', { number: wi + 1 });
      else if (waypoints.length) html += note('tooltip.waypoint.next', { number: waypoints.length + 1 });
    }
    if (state.root && isChoice(n) && (sat(n.id) || pathTo(n))) {
      const last = types.get(lastChoice.get(n.type.id));
      if (last && state.choice.get(n.id) !== last.id) {
        const many = !sat(n.id) && pathTo(n).length > 1;
        html += note(sat(n.id) ? 'tooltip.choice.switchTo' : many ? 'tooltip.choice.allocateAsPath' : 'tooltip.choice.allocateAs', { option: last.name });
      }
    }
    return html;
  }
  // How socketed subroutines affect a node in their radius.
  function radiusNotesHtml(n) {
    const sc = subState();
    let html = '';
    if (sc.silent.has(n.id)) html += `<div class="tt-warn">${trHtml('tooltip.shell.silenced')}</div>`;
    else if (n.tier === 'SMALL' && sc.active.some(a => subLine(a.def, 'EVERY_AFFINITY_FLAT_PER_EMPTY_SHELL_NODE') && nodesInRadius(a.socket, subRadius(a.def)).includes(n))) {
      html += `<div class="tt-note">${trHtml('tooltip.shell.inRadius')}</div>`;
    }
    const g = sc.gated.get(n.id);
    if (g) html += `<div class="tt-note">${trHtml('tooltip.gated', { item: g.def.name, when: GATE_IN_SENTENCE[g.when], strength: g.strength })}</div>`;
    const d = sc.doctrine;
    if (d && d.nodes.has(n.id)) {
      if (d.def.behaviour === 'REWRITE') {
        const pool = (n.tier === 'KEYSTONE' ? d.def.keystones : n.tier === 'NOTABLE' ? d.def.notables : d.def.small_nodes) || [];
        html += pool.length ? `<div class="tt-note">${trHtml('tooltip.doctrine.rewrites', { item: d.def.name, types: pool.map(id => types.get(id)?.name || id).join(', ') })}</div>`
          : `<div class="tt-note">${trHtml('tooltip.doctrine.noReplacements', { item: d.def.name, tier: TIER_IN_SENTENCE[n.tier] || n.tier.toLowerCase() })}</div>`;
      } else {
        const lines = (d.def.modifiers || []).map(m => (D.subroutineModifiers[m] || []).map(l => describeRange(l)).join(tr('tooltip.doctrine.lineJoin'))).filter(Boolean);
        html += `<div class="tt-note">${trHtml('tooltip.doctrine.adds', { item: d.def.name, lines: d.def.minLines === d.def.maxLines ? d.def.minLines : `${d.def.minLines}–${d.def.maxLines}` })}</div>` +
          lines.map(l => `<div class="tt-option-line">· ${l}</div>`).join('');
      }
    }
    if (sc.conduit && sc.conduit.route && sc.conduit.route.includes(n.id) && n !== sc.conduit.socket && n.id !== state.root) html += `<div class="tt-note">${trHtml('tooltip.conduitRoute', { affinity: affinityName(sc.conduit.aff) })}</div>`;
    return html;
  }
  const TIER_IN_SENTENCE = { SMALL: tr('name.tier.small.inSentence'), NOTABLE: tr('name.tier.notable.inSentence'), KEYSTONE: tr('name.tier.keystone.inSentence') };
  // "+2–4% more armor": an effect described with a min–max range.
  function describeRange(l) {
    if (l.min === l.max) return describe(l.effect, l.min);
    const lo = describeRaw(l.effect, l.min), hi = describeRaw(l.effect, l.max);
    // Join the two wordings on their first differing number.
    const a = lo.match(/-?\d+(\.\d+)?/), b = hi.match(/-?\d+(\.\d+)?/);
    if (!(a && b && lo.replace(a[0], '') === hi.replace(b[0], ''))) return styled(tr('tooltip.range', { low: lo, high: hi }));
    const [p, q] = [a[0], b[0]].sort((x, y) => Math.abs(x) - Math.abs(y));
    return styled(lo.replace(a[0], `${p}–${q}`));
  }
  function showTooltip(n, x, y) {
    els.tooltip.innerHTML = tooltipHtml(n);
    els.tooltip.hidden = false;
    placeFloating(els.tooltip, x, y);
  }
  function hideTooltip() { els.tooltip.hidden = true; }
  function placeFloating(el, x, y) {
    const pad = 16, gap = 18;
    const r = el.getBoundingClientRect();
    let left = x + gap, top = y + gap;
    if (left + r.width > W - pad) left = x - gap - r.width;
    if (left < pad) left = pad;
    if (top + r.height > H - pad) top = Math.max(pad, H - pad - r.height);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function updatePreview() {
    preview = null;
    if (targets.mode) {
      // Target mode previews the plan instead of the hovered node's path.
      const p = state.root ? currentPlan() : null;
      if (p && (p.add.length || p.remove.length)) preview = { add: new Set(p.add.filter(id => !state.alloc.has(id))), remove: new Set(p.remove) };
      return;
    }
    if (!hover || !state.root) return;
    if (sat(hover.id)) {
      if (hover.id === state.root || isChoice(hover) || hover.tier === 'SOCKET') return;
      const gone = removalSet(hover);
      if (gone) preview = { remove: new Set(gone) };
    } else {
      const path = routeTo(hover).path;
      if (path) preview = { add: new Set(path) };
    }
  }

  // ------------------------------------------------------------------ wormhole jumps (camera only; the build is untouched)
  // The other end of a core wormhole pair, a socket's linked exit, or the socket an exit is linked to.
  function jumpTarget(n) {
    if (n.tier === 'WORMHOLE' && n.pairedWith) return byId.get(n.pairedWith) || null;
    if (n.tier === 'SOCKET') { const e = state.links.get(n.id); return e ? byId.get(e) : null; }
    if (n.tier === 'WORMHOLE_EXIT') { const s = linkedSocketOf(n.id); return s ? byId.get(s) : null; }
    return null;
  }
  // Where a jump lands, for "Jump to …": a faction volume, or in the core the node's own id, "Core (midline_wormhole_1)",
  // since the core's wormholes and sockets have no other names that tell them apart (the mod tags core nodes just "core").
  function placeName(n) {
    return n.volume !== 'core' ? tr('tooltip.place.volume', { volume: volumeName(n.volume) }) : tr('tooltip.place.core', { id: n.id });
  }
  let flash = null; // { id, start }: rings drawn on a jump's destination so it's easy to spot
  const FLASH_SECONDS = 1.6;
  function jumpTo(n) {
    closePicker(); hideTooltip(); setHover(null);
    focusNode(n, clamp(Math.max(cam.zoom, 0.4), MIN_ZOOM, MAX_ZOOM));
    flash = { id: n.id, start: time };
  }

  // ------------------------------------------------------------------ picker (choice nodes, sockets, wormholes)
  let pickerFor = null;
  function openPicker(n, sx, sy) {
    if (!reopening) socketSection = null;
    reopening = false;
    pickerFor = n;
    pickerPos = { x: sx, y: sy };
    hideTooltip();
    let html = '';
    if (n.id === state.root) {
      // The game never removes a starting root; here it's a shortcut to Reset, so warn first.
      html += `<h4>${esc(tr('picker.reset.heading'))}</h4>`;
      html += `<button data-act="reset" class="danger">${esc(tr('picker.reset.button'))}</button>`;
      html += `<button data-act="cancel">${esc(tr('common.cancel'))}</button>`;
    } else if (isChoice(n)) {
      const cur = state.choice.get(n.id);
      html += `<h4>${esc(tr('picker.choice.heading', { node: n.type.name }))}</h4>`;
      const others = sat(n.id) ? buildEntries(n.id) : rules().list;
      for (const id of n.type.options) {
        const o = types.get(id);
        if (!o) continue;
        const line = typeLines(o).map(plain).join(' ');
        const b = cur === id ? null : blockOf(n, id, others);
        html += `<button data-opt="${esc(id)}" class="${cur === id ? 'current' : ''}" ${b ? 'disabled' : ''}>${iconImg(o.icon, o.name)}<span><div>${esc(o.name)}</div><div class="sub">${esc(line)}</div>${b ? `<div class="sub bad">${esc(b.text)}</div>` : ''}</span></button>`;
      }
      if (sat(n.id)) html += `<button data-act="remove" class="danger">${esc(tr('picker.removeNode'))}</button>`;
    } else if (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT') {
      const target = jumpTarget(n);
      html += `<h4>${esc(TIER_LABEL[n.tier])}</h4>`;
      if (target) html += `<button data-act="jump" class="current"><span><div>${esc(tr('picker.jump', { place: placeName(target) }))}</div></span></button>`;
      if (state.root && n.id !== state.root) {
        if (sat(n.id)) {
          const count = (removalSet(n) || []).length;
          html += `<button data-act="remove" class="danger">${esc(tr(n.tier === 'WORMHOLE_EXIT' ? 'picker.unlink' : 'picker.remove', { count }))}</button>`;
        } else if (switchedOff(n)) {
          html += `<div class="sub" style="padding:2px 0">${esc(hiddenText(n))}</div>`;
        } else {
          const path = routeTo(n).path;
          html += path ? `<button data-act="alloc">${esc(tr(waypoints.length ? 'picker.allocateVia' : 'picker.allocate', { count: path.length }))}</button>`
            : `<div class="sub" style="padding:2px 0">${esc(tr('picker.unreachable'))}</div>`;
        }
      }
    } else if (n.tier === 'SOCKET') {
      // Two collapsible sections; the one in use says what the socket holds.
      const se = state.subs.get(n.id), sd = se && SUBS.get(se.id);
      const cur = state.links.get(n.id);
      html += `<h4>${esc(TIER_LABEL.SOCKET)}</h4>`;
      html += `<button data-section="sub" class="section${socketSection === 'sub' ? ' open' : ''}" aria-expanded="${socketSection === 'sub'}"><span><div>${socketSection === 'sub' ? '▾' : '▸'} ${esc(tr('picker.socket.subroutine'))}</div><div class="sub">${esc(sd ? sd.name : tr('picker.socket.noneSocketed'))}</div></span></button>`;
      if (socketSection === 'sub') html += `<div class="section-body">${subroutinePickerHtml(n)}</div>`;
      html += `<button data-section="anchor" class="section${socketSection === 'anchor' ? ' open' : ''}" aria-expanded="${socketSection === 'anchor'}"><span><div>${socketSection === 'anchor' ? '▾' : '▸'} ${esc(tr('picker.socket.anchor'))}</div><div class="sub">${esc(cur ? tr('picker.socket.linkedTo', { volume: volumeName(byId.get(cur).volume) }) : tr('picker.socket.noneLinked'))}</div></span></button>`;
      if (socketSection === 'anchor') html += `<div class="section-body">${anchorPickerHtml(n)}</div>`;
      html += `<button data-act="remove" class="danger">${esc(tr('picker.socket.remove'))}</button>`;
    }
    els.picker.innerHTML = html;
    els.picker.hidden = false;
    placeFloating(els.picker, sx, sy);
  }
  // The subroutine part of a socket's picker: what's socketed (with its settings), then every subroutine to socket.
  const grantLabel = n => `${n.type.name} · ${volumeName(n.volume)}`;
  const grantByLabel = new Map(grantableNodes.map(n => [grantLabel(n).toLowerCase(), n.id]));
  function subroutinePickerHtml(n) {
    const e = state.subs.get(n.id);
    const def = e && SUBS.get(e.id);
    let html = '';
    if (def) {
      html += `<h4>${esc(tr('picker.sub.socketed'))}</h4><div class="sub-current">${iconImg(def.icon, def.name)}<div><div>${esc(def.name)}</div><div class="sub">${esc(subSummary(def, e, n))}</div>${def.unobtainable ? `<div class="sub bad">${UNOBTAINABLE_TEXT}</div>` : ''}</div></div>`;
      if (def.kind === 'ROOT_CONDUIT') {
        html += `<div class="sub">${esc(tr('picker.sub.conduitAffinity'))}</div><div class="pick-row">` +
          AFFINITY_KEYS.map(k => `<button data-aff="${k}" class="${e.aff === k ? 'current' : ''}">${esc(affinityName(k))}</button>`).join('') + '</div>';
      }
      if (def.kind === 'MODSPEC_CACHE') {
        const grants = e.grants || [];
        const sc = subState();
        html += `<div class="sub">${esc(tr('picker.sub.cacheNotables', { have: grants.length, max: cacheMax(def) }))}</div>`;
        for (const id of grants) {
          const g = byId.get(id), st = sc.granted.get(id);
          const note = !st || st.status === 'active' ? '' : st.status === 'byPath' ? tr('picker.cache.byPath') : st.status === 'duplicate' ? tr('picker.cache.duplicate')
            : st.status === 'volumeOff' ? tr('picker.cache.volumeOff') : tr('picker.cache.inactive', { reason: st.block ? st.block.text : tr('picker.cache.refused') });
          html += `<button data-ungrant="${esc(id)}" title="${esc(tr('picker.cache.removeTitle'))}"><span><div>${esc(g ? g.type.name : id)} ×</div>${note ? `<div class="sub bad">${esc(note)}</div>` : ''}</span></button>`;
        }
        if (grants.length < cacheMax(def)) {
          html += `<input id="grant-input" list="grant-list" type="text" autocomplete="off" placeholder="${esc(tr('picker.cache.addPlaceholder'))}" style="width:100%">` +
            `<datalist id="grant-list">${grantableNodes.filter(g => !grants.includes(g.id)).map(g => `<option value="${esc(grantLabel(g))}"></option>`).join('')}</datalist>`;
        }
      }
      html += `<button data-act="unsub" class="danger">${esc(tr('picker.sub.remove'))}</button>`;
    }
    html += `<h4>${esc(tr(def ? 'picker.sub.listHeading' : 'picker.sub.listHeadingEmpty'))}</h4>`;
    for (const s of SUBS.values()) {
      const current = def && s.id === def.id;
      const problem = current ? null : subLimitProblem(s, n.id);
      const sub = current ? tr('picker.sub.current') : problem || subKindText(s);
      html += `<button data-sub="${esc(s.id)}" class="${current ? 'current' : ''}" ${problem ? 'disabled' : ''} title="${esc(tr(current ? 'picker.sub.removeTitle' : 'picker.sub.addTitle'))}">${iconImg(s.icon, s.name)}<span><div>${esc(s.name)}</div><div class="sub">${esc(sub)}</div>${s.unobtainable ? `<div class="sub bad">${UNOBTAINABLE_TEXT}</div>` : ''}</span></button>`;
    }
    return html;
  }
  const subKindText = s => s.kind === 'DOCTRINE' ? tr(s.behaviour === 'REWRITE' ? 'label.subKind.doctrine.rewrite' : 'label.subKind.doctrine.augment', { radius: radiusName(s.radius) })
    : s.kind === 'ROOT_CONDUIT' ? tr('label.subKind.conduit')
    : s.kind === 'MODSPEC_CACHE' ? tr('label.subKind.cache')
    : s.lines && s.lines.some(l => GATE_OF[l.effect]) ? tr('label.subKind.gate', { radius: radiusName(s.radius), when: GATE_IN_SENTENCE[GATE_OF[s.lines.find(l => GATE_OF[l.effect]).effect]], strength: s.lines[0].max })
    : s.lines && subLine(s, 'EVERY_AFFINITY_FLAT_PER_EMPTY_SHELL_NODE') ? tr('label.subKind.shell', { radius: radiusName(s.radius) }) : humanize(s.kind);
  // One line on what a socketed subroutine does right now.
  function subSummary(def, e, socket) {
    const sc = subState();
    const on = state.alloc.has(socket.id);
    if (!on) return tr('picker.summary.inactive');
    if (def.kind === 'ROOT_CONDUIT') {
      const c = sc.conduit && sc.conduit.socket === socket ? sc.conduit : null;
      return c && c.route ? tr('picker.summary.conduit', { bonus: 5 * c.count, affinity: affinityName(c.aff), count: c.count }) : tr('picker.summary.conduitNone');
    }
    if (subLine(def, 'EVERY_AFFINITY_FLAT_PER_EMPTY_SHELL_NODE')) {
      const k = sc.shellCount.get(socket.id) || 0, silent = [...sc.silent].length;
      return tr('picker.summary.shell', { small: k, count: silent });
    }
    const gate = (def.lines || []).find(l => GATE_OF[l.effect]);
    if (gate) {
      const mine = [...sc.gated.values()].filter(g => g.socket === socket);
      const allocatedIn = [...sc.gated].filter(([id, g]) => g.socket === socket && held(id)).length;
      return tr('picker.summary.gate', { when: GATE_NAMES[GATE_OF[gate.effect]], count: allocatedIn, total: mine.length, strength: gate.max });
    }
    if (def.kind === 'DOCTRINE') {
      const d = sc.doctrine && sc.doctrine.socket === socket ? sc.doctrine : null;
      if (!d) return tr('picker.summary.doctrineInactive');
      return tr(def.behaviour === 'REWRITE' ? 'picker.summary.rewritten' : 'picker.summary.augmented', { count: d.nodes.size });
    }
    if (def.kind === 'MODSPEC_CACHE') {
      const act = (e.grants || []).filter(id => sc.granted.get(id)?.status === 'active').length;
      return tr('picker.summary.cache', { count: act });
    }
    return def.description || '';
  }
  // The anchor part of a socket's picker: every faction volume exit to link.
  function anchorPickerHtml(n) {
    const cur = state.links.get(n.id);
    let html = '';
    if (cur) html += `<button data-act="jump"><span><div>${esc(tr('picker.jump', { place: placeName(byId.get(cur)) }))}</div></span></button>`;
    const taken = new Set([...state.links].filter(([s]) => s !== n.id).map(([, e]) => e));
    const list = rules().list;
    for (const ex of [...exits].sort((a, b) => volumeName(a.volume).localeCompare(volumeName(b.volume)))) {
      const hidden = switchedOff(ex);
      const block = hidden || taken.has(ex.id) || cur === ex.id ? null : blockOf(ex, null, list);
      const dis = hidden || taken.has(ex.id) || !!block;
      const sub = hidden ? tr('picker.anchor.hidden') : taken.has(ex.id) ? tr('picker.anchor.taken') : block ? block.text
        : ex.gates.length ? tr('picker.anchor.inGame', { gates: ex.gates.map(gameStateName).join(tr('common.listComma')) }) : '';
      html += `<button data-exit="${esc(ex.id)}" class="${cur === ex.id ? 'current' : ''}" ${dis ? 'disabled' : ''}><span><div>${esc(volumeName(ex.volume))}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</span></button>`;
    }
    if (cur) html += `<button data-act="unlink">${esc(tr('picker.anchor.unlink'))}</button>`;
    return html;
  }
  let pickerPos = { x: 0, y: 0 };
  // Which socket section is expanded ('sub' | 'anchor' | null). Kept while the picker redraws after a change in it.
  let socketSection = null, reopening = false;
  function reopenPicker(n) { reopening = true; openPicker(n, pickerPos.x, pickerPos.y); }
  function addGrantFromInput(n) {
    const input = document.getElementById('grant-input');
    if (!input) return;
    const id = grantByLabel.get(input.value.trim().toLowerCase());
    if (!id) { toast(tr('toast.pickNotable')); return; }
    const e = state.subs.get(n.id);
    setGrants(n, [...(e.grants || []), id]);
    reopenPicker(n);
    document.getElementById('grant-input')?.focus();
  }
  els.picker.addEventListener('change', e => { if (e.target.id === 'grant-input' && pickerFor) addGrantFromInput(pickerFor); });
  els.picker.addEventListener('keydown', e => { if (e.target.id === 'grant-input' && e.key === 'Enter' && pickerFor) { e.preventDefault(); addGrantFromInput(pickerFor); } });
  function closePicker() { els.picker.hidden = true; pickerFor = null; }
  els.picker.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !pickerFor) return;
    const n = pickerFor;
    if (b.dataset.section) { socketSection = socketSection === b.dataset.section ? null : b.dataset.section; reopenPicker(n); return; }
    if (b.dataset.sub) {
      // Clicking the socketed subroutine again takes it out; any other one replaces it.
      if (state.subs.get(n.id)?.id === b.dataset.sub) removeSub(n); else socketSub(n, b.dataset.sub);
      reopenPicker(n);
      return;
    }
    if (b.dataset.aff) { const s = state.subs.get(n.id); if (s && s.aff !== b.dataset.aff) { pushUndo(); s.aff = b.dataset.aff; changed(); } reopenPicker(n); return; }
    if (b.dataset.ungrant) { const s = state.subs.get(n.id); setGrants(n, (s.grants || []).filter(id => id !== b.dataset.ungrant)); reopenPicker(n); return; }
    if (b.dataset.act === 'unsub') { removeSub(n); reopenPicker(n); return; }
    if (b.dataset.opt) {
      rememberChoice(n, b.dataset.opt);
      if (sat(n.id)) setChoice(n, b.dataset.opt); else allocate(n, b.dataset.opt);
    }
    else if (b.dataset.exit) linkSocket(n, byId.get(b.dataset.exit));
    else if (b.dataset.act === 'jump') { const t = jumpTarget(n); closePicker(); if (t) jumpTo(t); return; }
    else if (b.dataset.act === 'alloc') allocate(n);
    else if (b.dataset.act === 'unlink') unlinkSocket(n);
    else if (b.dataset.act === 'remove') deallocate(n);
    else if (b.dataset.act === 'reset') { closePicker(); resetBuild(); toast(tr('toast.buildCleared')); return; }
    closePicker();
  });

  // ------------------------------------------------------------------ actions
  function primaryAction(n, sx, sy, quick = false, shift = false, alt = false) {
    // Alt+click integrates a node or takes its integration back (the game's click and hold).
    if (alt && state.root) { toggleIntegration(n); return; }
    // Wormholes: Ctrl/Cmd+click travels to the other end (as in the mod); a plain click offers jump or allocate/remove.
    const jump = jumpTarget(n);
    if (jump && quick) { jumpTo(jump); return; }
    if (targets.mode && state.root) { cycleTarget(n); return; }
    if (shift && state.root) { toggleWaypoint(n); return; }
    if (jump && (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT')) { openPicker(n, sx, sy); return; }
    if (!state.root) { if (n.tier === 'ROOT') chooseRoot(n); return; }
    if (n.id === state.root) return;
    // Ctrl/Cmd+click on a choice node: use the option last picked for that node type, skipping the picker.
    if (quick && isChoice(n)) {
      const opt = lastChoice.get(n.type.id);
      if (!opt) { toast(tr('toast.pickOptionFirst')); openPicker(n, sx, sy); return; }
      if (sat(n.id)) setChoice(n, opt);
      else if (routeTo(n, opt, true).path) allocate(n, opt, true);
      return;
    }
    if (sat(n.id)) {
      if (isChoice(n) || n.tier === 'SOCKET') openPicker(n, sx, sy);
      else deallocate(n);
      return;
    }
    if (switchedOff(n)) { toast(hiddenText(n)); return; }
    const found = routeTo(n);
    const path = found.path;
    if (!path) {
      // A choice node is refused only when every option is; the picker then shows each option's reason.
      if (found.block && isChoice(n) && found.block.node === n) { openPicker(n, sx, sy); return; }
      if (found.block) toast(refusalText(n, found.block));
      else if (n.tier === 'WORMHOLE_EXIT') toast(tr('toast.exitsNeedAnchor'));
      return;
    }
    if (isChoice(n)) { openPicker(n, sx, sy); return; }
    if (allocate(n) && n.tier === 'SOCKET') openPicker(n, sx, sy);
  }
  function secondaryAction(n, sx, sy) {
    if (!state.root) return;
    if (targets.mode && n.id !== state.root) { clearTarget(n); return; }
    if (n.id === state.root) { openPicker(n, sx, sy); return; }
    if (sat(n.id)) deallocate(n);
  }

  // ------------------------------------------------------------------ targets (mark nodes wanted or forbidden, then allocate them)
  // In target mode a click cycles a node: wanted, forbidden, unmarked. The plan is the build with the fewest nodes that holds
  // every wanted node, avoids the forbidden ones and passes the node rules. It's a node-weighted Steiner arborescence over
  // units (a node plus its partner, since taking one takes the other) grown from the current build, or from the root alone
  // when "Keep current build" is off. Edges are directed because a wormhole exit is entered only through its partner.
  // Exact (Dreyfus-Wagner) up to TARGET_EXACT_MAX wanted units; above that the shortest-path heuristic, pruned. The rules
  // are then replayed in allocation order: a refused node on the way is avoided and the plan redone, and a wanted node
  // that can't be had makes the plan impossible.
  const TARGET_EXACT_MAX = 10;
  const TARGET_RETRIES = 40;
  const targets = { mode: false, want: new Set(), forbid: new Set(), keep: true };
  try {
    const t = JSON.parse(localStorage.getItem('esp.targets') || '{}');
    for (const id of t.w || []) if (byId.has(id)) targets.want.add(id);
    for (const id of t.f || []) if (byId.has(id) && !targets.want.has(id)) targets.forbid.add(id);
    if (t.k === 0) targets.keep = false;
  } catch { /* storage unavailable */ }
  function saveTargets() {
    try { localStorage.setItem('esp.targets', JSON.stringify({ w: [...targets.want], f: [...targets.forbid], k: targets.keep ? 1 : 0 })); } catch { /* storage unavailable */ }
  }
  const tgt = {
    btn: document.getElementById('btn-targets'),
    bar: document.getElementById('targets'),
    counts: document.getElementById('targets-counts'),
    status: document.getElementById('targets-status'),
    keep: document.getElementById('targets-keep'),
    apply: document.getElementById('targets-apply'),
  };
  let planCache = null;
  const currentPlan = () => planCache || (planCache = computePlan());
  function targetsChanged() {
    planCache = null;
    saveTargets();
    updatePreview();
    renderTargets();
    if (hover) showTooltip(hover, lastMouse.x, lastMouse.y);
    requestDraw();
    refreshList();
  }
  function cycleTarget(n) {
    if (n.id === state.root) { toast(tr('toast.rootAlwaysIn')); return; }
    if (targets.want.has(n.id)) { targets.want.delete(n.id); targets.forbid.add(n.id); }
    else if (targets.forbid.has(n.id)) targets.forbid.delete(n.id);
    else targets.want.add(n.id);
    targetsChanged();
  }
  function clearTarget(n) {
    const a = targets.want.delete(n.id), b = targets.forbid.delete(n.id);
    if (a || b) targetsChanged();
  }
  function setTargetMode(on) {
    if (targets.mode === on) return;
    targets.mode = on;
    closePicker();
    waypoints = [];
    renderChrome();
    targetsChanged();
  }
  function setTargetKeep(on) { targets.keep = on; targetsChanged(); }

  const targetLabel = n => (n.volume !== 'core' ? tr('target.label.volume', { node: effectiveType(n).name, volume: volumeName(n.volume) }) : effectiveType(n).name);
  const preferredOption = n => (isChoice(n) ? state.choice.get(n.id) || defaultOption(n) : null);
  const SHIELD_CHANGERS = new Set(['REMOVE_SHIELD', 'CREATE_FRONT_SHIELD_IF_NONE', 'CONVERT_SHIELD_TO_FRONT', 'CONVERT_SHIELD_TO_OMNI']);

  // Units over the nodes outside the base; unit 0 is the base itself (contracted, weight 0). A unit is blocked when one of
  // its nodes is forbidden, avoided, or refused against the base. A -> B when a node of A neighbours a node of B that
  // isn't a wormhole exit.
  function planGraph(base, refused, avoid, ignoreMarks = false) {
    const unitOf = new Map(), units = [{ members: [...base].map(id => byId.get(id)), w: 0, blocked: false }];
    for (const id of base) unitOf.set(id, 0);
    for (const n of nodes) {
      if (unitOf.has(n.id) || switchedOff(n)) continue;
      const p = partnerOf(n);
      if (n.tier === 'WORMHOLE_EXIT' && !p) continue;
      const members = p && !unitOf.has(p.id) ? [n, p] : [n];
      const blocked = members.some(m => (!ignoreMarks && targets.forbid.has(m.id)) || avoid.has(m.id) || refused.has(m.id));
      for (const m of members) unitOf.set(m.id, units.length);
      units.push({ members, w: members.length, blocked });
    }
    const N = units.length, out = Array.from({ length: N }, () => []), inn = Array.from({ length: N }, () => []);
    for (let a = 0; a < N; a++) {
      if (units[a].blocked) continue;
      const seen = new Set();
      for (const m of units[a].members) {
        for (const x of m.adj) {
          if (x.tier === 'WORMHOLE_EXIT') continue;
          const b = unitOf.get(x.id);
          if (b === undefined || b === a || seen.has(b) || units[b].blocked) continue;
          seen.add(b); out[a].push(b); inn[b].push(a);
        }
      }
    }
    return { units, unitOf, out, inn, N, base };
  }
  function heapPush(h, d, v) {
    h.push([d, v]);
    for (let i = h.length - 1; i > 0;) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; }
  }
  function heapPop(h) {
    const top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && h[l][0] < h[m][0]) m = l;
        if (r < h.length && h[r][0] < h[m][0]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top;
  }
  // Dreyfus-Wagner, node-weighted and directed: dp[S][v] is the cheapest tree rooted at v reaching the terminals in S,
  // counting v. A merge joins two subtrees at v; relaxing moves the root one step to a parent u (edge u -> v).
  // Returns the chosen units, or null when the terminals can't all be reached.
  function steinerExact(g, T) {
    const N = g.N, k = T.length, full = (1 << k) - 1;
    const w = Float64Array.from(g.units, u => u.w);
    const dp = [], kind = [], val = []; // kind: 1 terminal leaf, 2 merge (val = sub mask), 3 step to child (val = child)
    for (let mask = 1; mask <= full; mask++) {
      const d = new Float64Array(N).fill(Infinity), kd = new Int8Array(N), vl = new Int32Array(N);
      dp[mask] = d; kind[mask] = kd; val[mask] = vl;
      if ((mask & (mask - 1)) === 0) {
        const t = T[31 - Math.clz32(mask)];
        d[t] = w[t]; kd[t] = 1;
      } else {
        const low = mask & -mask;
        for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
          if (!(sub & low)) continue;
          const a = dp[sub], b = dp[mask ^ sub];
          for (let v = 0; v < N; v++) {
            const c = a[v] + b[v] - w[v];
            if (c < d[v]) { d[v] = c; kd[v] = 2; vl[v] = sub; }
          }
        }
      }
      const h = [];
      for (let v = 0; v < N; v++) if (d[v] < Infinity) heapPush(h, d[v], v);
      while (h.length) {
        const [dv, v] = heapPop(h);
        if (dv > d[v]) continue;
        for (const u of g.inn[v]) {
          const c = dv + w[u];
          if (c < d[u]) { d[u] = c; kd[u] = 3; vl[u] = v; heapPush(h, c, u); }
        }
      }
    }
    if (!(dp[full][0] < Infinity)) return null;
    const chosen = new Set();
    const stack = [[full, 0]];
    while (stack.length) {
      const [mask, v] = stack.pop();
      chosen.add(v);
      const kd = kind[mask][v], x = val[mask][v];
      if (kd === 2) stack.push([x, v], [mask ^ x, v]);
      else if (kd === 3) stack.push([mask, x]);
    }
    return chosen;
  }
  // Shortest-path heuristic: from the tree, repeatedly add the cheapest path to the nearest terminal not yet reached.
  function steinerGreedy(g, T) {
    const N = g.N, inTree = new Uint8Array(N), left = new Set(T);
    inTree[0] = 1;
    while (left.size) {
      const d = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), h = [];
      for (let v = 0; v < N; v++) if (inTree[v]) { d[v] = 0; heapPush(h, 0, v); }
      while (h.length) {
        const [dv, v] = heapPop(h);
        if (dv > d[v]) continue;
        for (const b of g.out[v]) {
          const c = dv + (inTree[b] ? 0 : g.units[b].w);
          if (c < d[b]) { d[b] = c; prev[b] = v; heapPush(h, c, b); }
        }
      }
      let best = -1;
      for (const t of left) if (best < 0 || d[t] < d[best]) best = t;
      if (!(d[best] < Infinity)) return null;
      for (let v = best; v >= 0 && !inTree[v]; v = prev[v]) inTree[v] = 1;
      for (const t of [...left]) if (inTree[t]) left.delete(t);
    }
    const chosen = new Set();
    for (let v = 0; v < N; v++) if (inTree[v]) chosen.add(v);
    return chosen;
  }
  // Drops chosen units that no terminal needs (leaves of the breadth-first tree from the base), until none are left.
  function pruneTree(g, chosen, T) {
    const term = new Set(T);
    for (;;) {
      const parent = new Map([[0, -1]]), q = [0];
      for (let i = 0; i < q.length; i++) for (const b of g.out[q[i]]) if (chosen.has(b) && !parent.has(b)) { parent.set(b, q[i]); q.push(b); }
      const kids = new Set([...parent.values()]);
      let removed = false;
      for (const b of [...chosen]) if (b !== 0 && !term.has(b) && (!parent.has(b) || !kids.has(b))) { chosen.delete(b); removed = true; }
      if (!removed) return chosen;
    }
  }
  // Allocation order: breadth-first from the base through the chosen units; in a unit, the node it's entered by first.
  function planOrder(g, chosen) {
    const order = [], seen = new Set([0]), q = [0];
    for (let i = 0; i < q.length; i++) {
      const from = new Set(g.units[q[i]].members.map(m => m.id));
      for (const b of g.out[q[i]]) {
        if (!chosen.has(b) || seen.has(b)) continue;
        seen.add(b); q.push(b);
        const mem = g.units[b].members;
        const entry = mem.find(m => m.tier !== 'WORMHOLE_EXIT' && m.adj.some(x => from.has(x.id))) || mem[0];
        order.push(entry, ...mem.filter(m => m !== entry));
      }
    }
    return order;
  }

  // { ok, text, add (node ids in allocation order), remove, options, total, exact } or { ok: false, text, ... }.
  function computePlan() {
    const fail = (text, extra) => ({ ok: false, text, add: [], remove: [], ...extra });
    if (!state.root) return fail(tr('common.chooseRoot'));
    const keep = targets.keep;
    const granted = subState().granted;
    const isGranted = id => granted.get(id)?.status === 'active';
    const base = new Set([state.root, ...(keep ? state.alloc : [])]);
    const baseList = keep ? rules().list.slice()
      : [entryFor(byId.get(state.root), null), ...[...granted].filter(([, g]) => g.status === 'active').map(([id]) => entryFor(byId.get(id), null))];
    const notes = [];
    if (keep) {
      const bad = [...targets.forbid].filter(id => base.has(id));
      if (bad.length) notes.push(tr('target.forbiddenInBuild', { count: bad.length }));
    }
    if (!targets.want.size) return { ok: true, text: tr('target.markWanted'), add: [], remove: [], options: new Map(), notes };
    const wanted = [...targets.want].map(id => byId.get(id)).filter(n => n.id !== state.root && !base.has(n.id) && !isGranted(n.id));
    for (const n of wanted) {
      if (switchedOff(n)) return fail(tr('target.hidden', { node: targetLabel(n), reason: hiddenText(n) }));
      if (n.tier === 'WORMHOLE_EXIT' && !partnerOf(n)) return fail(tr('target.exitNeedsAnchor', { node: targetLabel(n) }));
    }
    // Nodes the rules refuse against the base, whatever else the plan adds.
    const refused = new Map();
    for (const n of nodes) {
      if (base.has(n.id) || switchedOff(n)) continue;
      const b = placement(n, baseList, preferredOption(n)).block;
      if (b) refused.set(n.id, b);
    }
    const avoid = new Map(); // node id -> why the plan steers around it
    for (let attempt = 0; attempt <= TARGET_RETRIES; attempt++) {
      const g = planGraph(base, refused, avoid);
      const T = [...new Set(wanted.map(n => g.unitOf.get(n.id)))];
      for (const n of wanted) {
        const u = g.units[g.unitOf.get(n.id)];
        if (!u.blocked) continue;
        const m = u.members.find(x => targets.forbid.has(x.id) || avoid.has(x.id) || refused.has(x.id));
        const why = targets.forbid.has(m.id) ? tr('target.youForbade') : (refused.get(m.id) || avoid.get(m.id)).text;
        return fail(m === n ? tr('target.cantAllocate', { node: targetLabel(n), reason: why })
          : tr('target.takesWith', { node: targetLabel(n), other: targetLabel(m), reason: why.replace(/\.$/, '') }));
      }
      if (!T.length) return { ok: true, text: tr('target.allIn'), add: [], remove: [], options: new Map(), notes };
      const exact = T.length <= TARGET_EXACT_MAX;
      const found = exact ? steinerExact(g, T) : steinerGreedy(g, T);
      if (!found) {
        // Name a wanted node nothing legal leads to.
        const reach = new Set([0]), q = [0];
        for (let i = 0; i < q.length; i++) for (const b of g.out[q[i]]) if (!reach.has(b)) { reach.add(b); q.push(b); }
        const lost = wanted.find(n => !reach.has(g.unitOf.get(n.id))) || wanted[0];
        // Unreachable even with nothing blocked: a faction volume with no anchor linked to it.
        const open = planGraph(base, new Map(), new Map(), true);
        const all = new Set([0]), q2 = [0];
        for (let i = 0; i < q2.length; i++) for (const b of open.out[q2[i]]) if (!all.has(b)) { all.add(b); q2.push(b); }
        if (!all.has(open.unitOf.get(lost.id))) {
          return fail(tr(lost.volume !== 'core' && !switchedOff(lost) ? 'target.noAnchor' : 'target.unreachable', { node: targetLabel(lost) }));
        }
        const steered = [...avoid].map(([id, a]) => tr('target.steeredItem', { node: targetLabel(byId.get(id)), reason: a.text.replace(/\.$/, '') }));
        if (!steered.length) return fail(tr('target.noWay', { node: targetLabel(lost) }));
        const named = steered.slice(0, 2).join(tr('common.listAnd'));
        return fail(tr('target.noWayHere', { node: targetLabel(lost), steered: steered.length > 2 ? tr('target.steeredMore', { list: named, count: steered.length - 2 }) : named }));
      }
      const chosen = pruneTree(g, found, T);
      const order = planOrder(g, chosen);
      // Replay the rules in allocation order.
      const list = baseList.slice(), options = new Map(), added = new Set(order.map(n => n.id));
      let culprit = null, stop = null;
      for (const n of order) {
        const p = placement(n, list, preferredOption(n));
        if (p.block) {
          const own = !targets.want.has(n.id);
          const mine = e => added.has(e.node.id) && !targets.want.has(e.node.id);
          if (own) culprit = n;
          else if (p.block.with && added.has(p.block.with.id) && !targets.want.has(p.block.with.id)) culprit = p.block.with;
          else if (p.block.kind === 'logistics') culprit = list.find(e => mine(e) && isLogistics(e.effective))?.node || null;
          else if (p.block.kind === 'ship') culprit = [...list].reverse().find(e => mine(e) && typeEffectNames(e.effective).some(x => SHIELD_CHANGERS.has(x)))?.node || null;
          if (culprit) avoid.set(culprit.id, { text: culprit === n ? p.block.text : tr('target.cantTakeWith', { node: targetLabel(n) }) });
          else stop = tr('target.cantWithRest', { node: targetLabel(n), reason: p.block.text });
          break;
        }
        options.set(n.id, p.option);
        list.push(entryFor(n, p.option));
      }
      if (stop) return fail(stop);
      if (culprit) continue;
      const add = order.map(n => n.id);
      const remove = keep ? [] : [...state.alloc].filter(id => !added.has(id));
      const total = (keep ? used() : 1) + add.length;
      const plan = { add, remove, options, total, exact: exact && !avoid.size, notes };
      if (total > state.cap) return { ...plan, ok: false, text: tr('target.overCap', { total, over: total - state.cap, cap: state.cap }) };
      return { ...plan, ok: true, text: '' };
    }
    return fail(tr('target.retries', { count: TARGET_RETRIES }));
  }
  function applyPlan() {
    const p = currentPlan();
    if (!p.ok) { toast(p.text); return; }
    const before = new Set(state.alloc);
    const gained = p.add.filter(id => !before.has(id)).length;
    if (!gained && !p.remove.length) { toast(p.text || tr('toast.nothingToChange')); return; }
    pushUndo();
    if (targets.keep) for (const id of p.add) state.alloc.add(id);
    else state.alloc = new Set(p.add);
    for (const id of p.add) {
      const n = byId.get(id), o = p.options.get(id);
      if (isChoice(n) && o) state.choice.set(id, o);
    }
    for (const id of [...state.choice.keys()]) if (!state.alloc.has(id)) state.choice.delete(id);
    for (const [s, e] of [...state.links]) if (!state.alloc.has(s) || !state.alloc.has(e)) { state.links.delete(s); state.alloc.delete(e); }
    dropOrphanSubs();
    targets.mode = false;
    planCache = null;
    changed();
    toast(tr(p.remove.length ? 'toast.planAppliedRemoved' : 'toast.planApplied', { count: gained, removed: p.remove.length }));
  }
  function renderTargets() {
    tgt.bar.hidden = !targets.mode;
    tgt.btn.classList.toggle('on', targets.mode);
    tgt.btn.setAttribute('aria-pressed', String(targets.mode));
    if (!targets.mode) return;
    tgt.keep.checked = targets.keep;
    tgt.counts.textContent = tr('target.counts', { wanted: targets.want.size, forbidden: targets.forbid.size });
    const p = currentPlan();
    const gained = p.add.filter(id => !state.alloc.has(id)).length;
    let text;
    if (!p.ok) text = tr('target.notPossible', { reason: p.text });
    else if (!gained && !p.remove.length) text = p.text || tr('toast.nothingToChange');
    else {
      text = tr(p.remove.length ? 'target.planRemoved' : 'target.plan', { count: gained, removed: p.remove.length, total: p.total, cap: state.cap }) + ' ' +
        (p.exact ? tr('target.exact') : targets.want.size > TARGET_EXACT_MAX ? tr('target.approxMany', { max: TARGET_EXACT_MAX }) : tr('target.approxSteered'));
    }
    if (p.notes && p.notes.length) text += ' ' + p.notes.join(' ');
    tgt.status.textContent = text;
    tgt.status.classList.toggle('bad', !p.ok);
    tgt.apply.disabled = !p.ok || (!gained && !p.remove.length);
  }
  // Wanted: a white ring with four ticks. Forbidden: a red ring with a slash. Drawn over the nodes in target mode.
  function drawTargetMarks(view, z) {
    const px = 1 / z;
    for (const set of [targets.want, targets.forbid]) {
      for (const id of set) {
        const n = byId.get(id), want = set === targets.want;
        if (switchedOff(n) || !inView(view, n.x, n.y, n.fp * 2)) continue;
        const dot = n.fp * z < 5;
        const inner = n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT' ? n.fp * 0.42 : n.tier === 'SOCKET' ? n.fp * 0.52 : n.tier === 'ROOT' ? n.fp * 0.3 : n.fp * ICON_INSET / 2;
        const r = dot ? Math.max(6 * px, n.fp * 0.6) : inner * 1.3;
        const lw = dot ? 2 * px : Math.max(2 * px, n.fp * 0.06);
        ctx.globalAlpha = 1;
        ctx.lineCap = 'round';
        for (const [col, extra] of [['rgba(0,0,0,0.8)', lw * 1.2], [want ? 'rgba(255,255,255,0.95)' : rgba(RULE_PROBLEM, 0.95), 0]]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw + extra;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          if (want && !dot) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(n.x + dx * r * 0.8, n.y + dy * r * 0.8); ctx.lineTo(n.x + dx * r * 1.3, n.y + dy * r * 1.3); }
          if (!want) { const d = r * Math.SQRT1_2; ctx.moveTo(n.x + d, n.y - d); ctx.lineTo(n.x - d, n.y + d); }
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
    }
  }
  // Waypoints: a gold ring with the waypoint's number in a badge at its upper right.
  function drawWaypoints(view, z) {
    const px = 1 / z;
    waypoints.forEach((n, i) => {
      if (switchedOff(n) || !inView(view, n.x, n.y, n.fp * 2)) return;
      const dot = n.fp * z < 5;
      const r = dot ? Math.max(6 * px, n.fp * 0.6) : n.fp * 0.66;
      const lw = dot ? 2 * px : Math.max(2 * px, n.fp * 0.06);
      ctx.globalAlpha = 1;
      for (const [col, extra] of [['rgba(0,0,0,0.8)', lw * 1.2], [rgba(SEARCH_GOLD, 0.95), 0]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw + extra;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
      }
      const br = Math.max(8 * px, n.fp * 0.22), bx = n.x + r * 0.75, by = n.y - r * 0.75;
      ctx.fillStyle = rgba(SEARCH_GOLD, 1);
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.badgeText;
      ctx.font = `600 ${br * 1.3}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), bx, by + br * 0.05);
    });
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  function targetTooltipNote(n) {
    if (n.id === state.root) return `<div class="tt-note">${trHtml('tooltip.target.root')}</div>`;
    const st = targets.want.has(n.id) ? 'wanted' : targets.forbid.has(n.id) ? 'forbidden' : 'none';
    const onPath = st === 'none' && !sat(n.id) && currentPlan().add.includes(n.id);
    return `<div class="tt-note">${trHtml(`tooltip.target.${st}`)}</div>` +
      (onPath ? `<div class="tt-note">${trHtml('tooltip.target.onPath')}</div>` : '');
  }
  tgt.btn.addEventListener('click', () => setTargetMode(!targets.mode));
  tgt.keep.addEventListener('change', () => { setTargetKeep(tgt.keep.checked); tgt.keep.blur(); });
  tgt.apply.addEventListener('click', applyPlan);
  document.getElementById('targets-clear').addEventListener('click', () => { targets.want.clear(); targets.forbid.clear(); targetsChanged(); });
  document.getElementById('targets-done').addEventListener('click', () => setTargetMode(false));

  let toastTimer = 0;
  function toast(msg, html) {
    els.toast.innerHTML = html || esc(msg);
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, html ? 9000 : 3200);
  }

  // ------------------------------------------------------------------ input
  const pointers = new Map();
  let drag = null; // {x,y,camX,camY,moved}
  let pinch = null;
  let lastTouchNode = null;

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!els.picker.hidden) closePicker();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      drag = null;
    } else if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, camX: cam.x, camY: cam.y, moved: false, button: e.button };
    }
  });
  canvas.addEventListener('pointermove', e => {
    lastMouse = { x: e.clientX, y: e.clientY };
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(pinch.mx, pinch.my, clamp(pinch.zoom * d / pinch.d, MIN_ZOOM, MAX_ZOOM) / cam.zoom);
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; canvas.classList.add('dragging'); hideTooltip(); setHover(null); }
      if (drag.moved) { cam.x = drag.camX - dx / cam.zoom; cam.y = drag.camY - dy / cam.zoom; requestDraw(); return; }
    }
    if (e.pointerType === 'mouse') {
      if (regionLabelAt(e.clientX, e.clientY)) {
        setHover(null); hideTooltip();
        canvas.classList.add('pointing');
        return;
      }
      const n = nodeAt(e.clientX, e.clientY);
      setHover(n);
      if (n && els.picker.hidden) showTooltip(n, e.clientX, e.clientY); else hideTooltip();
    }
  });
  function endPointer(e) {
    const wasDrag = drag;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      canvas.classList.remove('dragging');
      drag = null;
      if (wasDrag && !wasDrag.moved && e.type === 'pointerup') {
        const label = regionLabelAt(e.clientX, e.clientY);
        if (label && wasDrag.button === 0) { hideTooltip(); setHover(null); lastTouchNode = null; focusRegion(label); return; }
        const n = nodeAt(e.clientX, e.clientY);
        if (e.pointerType !== 'mouse') {
          // Touch: first tap shows the tooltip, a second tap on the same node acts.
          if (!n) { hideTooltip(); setHover(null); lastTouchNode = null; return; }
          if (lastTouchNode !== n) { lastTouchNode = n; setHover(n); showTooltip(n, e.clientX, e.clientY - 60); return; }
          lastTouchNode = null; hideTooltip();
          // Touch has no right-click, so a second tap on the chosen root offers the reset.
          if (n.id === state.root) secondaryAction(n, e.clientX, e.clientY);
          else primaryAction(n, e.clientX, e.clientY);
          setHover(null);
          return;
        }
        if (n) {
          if (wasDrag.button === 2) secondaryAction(n, e.clientX, e.clientY);
          else if (wasDrag.button === 0) primaryAction(n, e.clientX, e.clientY, e.ctrlKey || e.metaKey, e.shiftKey, e.altKey);
        }
      }
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag) { setHover(null); hideTooltip(); } });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    zoomAt(e.clientX, e.clientY, clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM) / cam.zoom);
    if (hover) showTooltip(hover, e.clientX, e.clientY);
  }, { passive: false });

  function zoomAt(sx, sy, f) {
    const wx = toWorldX(sx), wy = toWorldY(sy);
    cam.zoom *= f;
    cam.x = wx - (sx - W / 2) / cam.zoom;
    cam.y = wy - (sy - H / 2) / cam.zoom;
    requestDraw();
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function setHover(n) {
    if (hover === n) { canvas.classList.toggle('pointing', !!n); return; }
    hover = n;
    canvas.classList.toggle('pointing', !!n);
    updatePreview();
    requestDraw();
  }

  // toolbar
  els.cap.addEventListener('change', () => {
    const v = parseInt(els.cap.value, 10);
    if (Number.isFinite(v) && v > 0) { state.cap = Math.min(999, v); changed(); } else els.cap.value = state.cap;
  });
  els.hull.addEventListener('change', () => {
    const before = rules().problems.size;
    pushUndo();
    state.hull = els.hull.value;
    changed();
    warnNewProblems(before);
  });
  document.getElementById('btn-fit').addEventListener('click', frameCore);
  els.undo.addEventListener('click', undo);
  document.getElementById('btn-reset').addEventListener('click', () => { if (state.root || state.alloc.size) { resetBuild(); toast(tr('toast.buildCleared')); } });
  // Copy code: the build as a template code (the same as Templates → Copy code), named after the template name field.
  document.getElementById('btn-code').addEventListener('click', async () => {
    if (!state.root) { toast(tr('common.chooseRoot')); return; }
    let name = tpl.name.value.trim();
    if (!name) { try { name = (localStorage.getItem('esp.tplName') || '').trim(); } catch { /* storage unavailable */ } }
    if (!name || templateNameProblem(name)) name = tr('templates.defaultName', { root: byId.get(state.root).type.name });
    const code = await templateToCode(buildTemplate(name));
    try {
      await navigator.clipboard.writeText(code);
      toast(tr('toast.codeCopied', { name }));
    } catch {
      toast('', `${esc(tr('toast.copyThisCode'))}<br><input style="width:min(560px,80vw);margin-top:6px" readonly value="${esc(code)}" onfocus="this.select()">`);
      setTimeout(() => els.toast.querySelector('input')?.focus(), 0);
    }
  });
  document.getElementById('btn-panel').addEventListener('click', togglePanel);
  function togglePanel() {
    els.panel.classList.toggle('closed');
    document.body.classList.toggle('panel-open', !els.panel.classList.contains('closed'));
    try { localStorage.setItem('esp.panel', els.panel.classList.contains('closed') ? '0' : '1'); } catch { /* ignore */ }
  }
  function setPanelTab(tab) {
    panelTab = tab;
    document.querySelectorAll('.panel-tabs button').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    renderPanel();
  }
  document.querySelectorAll('.panel-tabs button').forEach(b => b.addEventListener('click', () => setPanelTab(b.dataset.tab)));
  // Rows in the notables and search lists jump to their node.
  els.panelBody.addEventListener('click', e => {
    const row = e.target.closest('[data-node]');
    if (!row) return;
    const n = byId.get(row.dataset.node);
    if (e.altKey && state.root) { toggleIntegration(n); return; }
    if (panelTab === 'search') {
      searchCursor = searchOrder.indexOf(n);
      els.searchCount.textContent = `${searchCursor + 1}/${searchOrder.length}`;
      renderPanel();
    }
    jumpTo(n);
  });

  // search
  const searchText = new Map();
  function nodeSearchText(n) {
    let s = searchText.get(n.id);
    if (s == null) {
      const ts = isChoice(n) ? n.type.options.map(id => types.get(id)).filter(Boolean) : [n.type];
      s = [n.id, n.type.name, volumeName(n.volume), ...ts.flatMap(t => [t.name, t.flavour || '', ...typeLines(t).map(plain), ...(t.integrated ? typeLines(t, true).map(plain) : [])])].join(' \n ').toLowerCase();
      searchText.set(n.id, s);
    }
    return s;
  }
  // Where a node sits, short form for list and search rows: "Hegemony volume", or "Core" (one tree).
  const shortPlace = n => n.volume === 'core' ? tr('list.place.core') : tr('list.place.volume', { volume: volumeName(n.volume) });
  let searchTerms = [];
  // Results are listed core first, then by volume, side and name; Enter cycles in the same order.
  function sortSearchResults(list) {
    return list.map(n => ({ n, k: [n.volume === 'core' ? 0 : 1, shortPlace(n), effectiveType(n).name] }))
      .sort((a, b) => a.k[0] - b.k[0] || a.k[1].localeCompare(b.k[1]) || a.k[2].localeCompare(b.k[2]))
      .map(x => x.n);
  }
  // Why a node matched when its name doesn't say: the first effect or flavour line holding a search term.
  function matchSnippet(n) {
    const names = [effectiveType(n).name, n.type.name, n.id].join(' ').toLowerCase();
    if (searchTerms.every(t => names.includes(t))) return '';
    const ts = isChoice(n) ? n.type.options.map(id => types.get(id)).filter(Boolean) : [n.type];
    for (const t of ts) {
      for (const line of [...typeLines(t).map(plain), t.flavour || '']) {
        const low = line.toLowerCase();
        if (searchTerms.some(term => low.includes(term))) return line.length > 110 ? line.slice(0, 107) + '…' : line;
      }
    }
    return '';
  }
  function searchResultsHtml() {
    if (!searchOrder.length) return `<div class="empty">${esc(tr(filterCount() && searchTerms.length ? 'search.none.both' : filterCount() ? 'search.none.filter' : 'search.none.search'))}</div>`;
    const have = searchOrder.filter(n => sat(n.id)).length;
    const filterParts = [];
    if (themeFilter.size) {
      const kind = themeFilter.size > 1 ? (themeMatchAll ? 'search.filter.allThemes' : 'search.filter.anyTheme') : 'search.filter.theme';
      filterParts.push(tr(kind, { themes: [...themeFilter].map(themeName).join(tr('common.listComma')) }));
    }
    if (showAffinity) filterParts.push(tr('search.filter.affinity'));
    const head = filterParts.length ? (state.root ? 'search.head.filterAllocated' : 'search.head.filter') : state.root ? 'search.head.allocated' : 'search.head';
    let html = `<div class="search-head">${esc(tr(head, { matches: tr('search.matches', { count: searchOrder.length }), filter: filterParts.join(tr('common.listOr')), have }))}</div>`;
    searchOrder.forEach((n, i) => {
      const t = effectiveType(n);
      const snippet = matchSnippet(n);
      html += `<div class="node-row ${n.tier.toLowerCase()}${i === searchCursor ? ' current' : ''}" data-node="${esc(n.id)}">` +
        nodeIconHtml(n, t) +
        `<div><div class="nm">${esc(t.name)}${sat(n.id) ? `<span class="have">${esc(tr('search.allocatedTag'))}</span>` : ''}</div>` +
        `<div class="tr">${esc(TIER_LABEL[n.tier] || n.tier)} · ${esc(shortPlace(n))}</div>` +
        (snippet ? `<div class="match">${esc(snippet)}</div>` : '') + '</div></div>';
    });
    return html;
  }
  let tabBeforeSearch = null;
  let panelOpenedBySearch = false;
  const searchTab = document.getElementById('tab-search');
  // Shows the Search tab (opening the panel if needed) while a search is active, and puts things back after.
  function updateSearchTab(active) {
    if (active) {
      searchTab.hidden = false;
      searchTab.textContent = tr('search.tab', { n: searchOrder.length });
      if (els.panel.classList.contains('closed')) { togglePanel(); panelOpenedBySearch = true; }
      if (panelTab !== 'search') { tabBeforeSearch = panelTab; setPanelTab('search'); } else renderPanel();
    } else if (!searchTab.hidden) {
      searchTab.hidden = true;
      if (panelTab === 'search') setPanelTab(tabBeforeSearch || 'stats');
      if (panelOpenedBySearch && !els.panel.classList.contains('closed')) togglePanel();
      panelOpenedBySearch = false;
    }
  }
  // ---- theme filter: the mod's theme tags (SkillTags.THEME, names from theme.*), combined with the search text.
  // A choice node has the themes of all its options; roots, wormholes, exits and sockets have none and never match.
  const THEME_LIST = D.themes || [];
  const THEME_IDS = new Set(THEME_LIST.map(t => t.id));
  const NO_THEME = '_none';
  const STRUCTURAL_TIERS = new Set(['ROOT', 'WORMHOLE', 'WORMHOLE_EXIT', 'SOCKET']);
  const themeName = id => (id === NO_THEME ? tr('name.theme.none') : (THEME_LIST.find(t => t.id === id) || {}).name || humanize(id));
  const nodeThemeCache = new Map();
  function nodeThemes(n) {
    if (STRUCTURAL_TIERS.has(n.tier)) return null;
    let set = nodeThemeCache.get(n.id);
    if (!set) {
      const ts = isChoice(n) ? n.type.options.map(id => types.get(id)).filter(Boolean) : [n.type];
      set = new Set(ts.flatMap(t => (t.tags || []).filter(x => THEME_IDS.has(x))));
      nodeThemeCache.set(n.id, set);
    }
    return set;
  }
  const themeFilter = new Set(); // theme ids, plus NO_THEME
  let themeMatchAll = false;
  // Affinity nodes are their own Filter entry ("Show affinity nodes") and are never matched by a theme: the mod tags
  // the affinity options too (Low Tech: hull, armour; Midline: flux, hull; High Tech: flux), so all 155 of them would
  // otherwise bury the real Flux, Hull and Armor nodes.
  let showAffinity = false;
  const isAffinityNode = n => isChoice(n) && n.type.options.every(id => OPTION_TINT[id]);
  const hasTheme = (set, id) => (id === NO_THEME ? set.size === 0 : set.has(id));
  function themeMatch(n) {
    const set = nodeThemes(n);
    if (!set || !themeFilter.size || isAffinityNode(n)) return false;
    const ids = [...themeFilter];
    return themeMatchAll ? ids.every(id => hasTheme(set, id)) : ids.some(id => hasTheme(set, id));
  }
  const filterCount = () => themeFilter.size + (showAffinity ? 1 : 0);
  // A node passes the Filter when a ticked theme matches it, or when it's an affinity node and those are shown.
  const filterMatch = n => themeMatch(n) || (showAffinity && isAffinityNode(n));
  // The search box and the Filter together decide searchHits (the canvas highlight) and the Search tab list.
  function runFilter() {
    const q = els.search.value.trim().toLowerCase();
    const textOn = q.length >= 2, filterOn = filterCount() > 0;
    if (!textOn && !filterOn) {
      searchHits = null; searchOrder = []; searchTerms = []; els.searchCount.textContent = '';
      updateSearchTab(false); requestDraw(); refreshList(); return;
    }
    searchTerms = textOn ? q.split(/\s+/) : [];
    searchOrder = sortSearchResults(nodes.filter(n => {
      if (switchedOff(n)) return false; // nodes in a hidden optional volume never match
      if (filterOn && !filterMatch(n)) return false;
      if (!textOn) return true;
      const s = nodeSearchText(n);
      return searchTerms.every(t => s.includes(t));
    }));
    searchHits = new Set(searchOrder.map(n => n.id));
    searchCursor = -1;
    els.searchCount.textContent = `${searchOrder.length}`;
    // The list view already shows the matches, so the panel's Search tab only appears on the map.
    const listShowing = !(document.getElementById('listview') || { hidden: true }).hidden;
    updateSearchTab(!listShowing);
    requestDraw();
    refreshList();
  }
  // The list view (see setView) follows the search and Filter; looked up by id so it's safe before that section runs.
  function refreshList() {
    const el = document.getElementById('listview');
    if (el && !el.hidden) renderList();
  }
  els.search.addEventListener('input', runFilter);
  filterReady = true; // changed() may now rerun the search (see hiddenVolSig)

  const themeEl = document.getElementById('theme-filter');
  const themeBtnEl = document.getElementById('btn-themes');
  // Node counts per theme (affinity nodes aside), and the affinity node count.
  const themeCounts = new Map([[NO_THEME, 0]]);
  for (const n of nodes) {
    const set = nodeThemes(n);
    if (!set || isAffinityNode(n)) continue;
    if (!set.size) themeCounts.set(NO_THEME, themeCounts.get(NO_THEME) + 1);
    for (const id of set) themeCounts.set(id, (themeCounts.get(id) || 0) + 1);
  }
  const affinityNodeCount = nodes.filter(isAffinityNode).length;
  function renderFilterButton() {
    const k = filterCount();
    themeBtnEl.textContent = k ? tr('filter.button.set', { n: k }) : tr('filter.button');
    themeBtnEl.setAttribute('aria-pressed', String(k > 0));
    const clear = document.getElementById('theme-clear');
    if (clear) clear.disabled = !k;
  }
  function renderThemeFilter() {
    renderFilterButton();
    if (themeEl.hidden) return;
    const row = id => `<label><input type="checkbox" data-theme-tag="${esc(id)}"${themeFilter.has(id) ? ' checked' : ''}> ${esc(themeName(id))} <span class="muted">${themeCounts.get(id) || 0}</span></label>`;
    const used = THEME_LIST.filter(t => themeCounts.get(t.id)).map(t => t.id);
    themeEl.innerHTML =
      `<div class="theme-head"><b>${esc(tr('filter.heading'))}</b></div>` +
      `<p class="filter-affinity"><label title="${esc(tr('filter.affinityTitle'))}"><input type="checkbox" id="filter-affinity"${showAffinity ? ' checked' : ''}> ${esc(tr('filter.affinity'))} <span class="muted">${affinityNodeCount}</span></label></p>` +
      `<div class="theme-head"><b>${esc(tr('filter.themes'))}</b><label>${esc(tr('filter.match'))} <select id="theme-match">` +
      `<option value="any"${themeMatchAll ? '' : ' selected'}>${esc(tr('filter.matchAny'))}</option><option value="all"${themeMatchAll ? ' selected' : ''}>${esc(tr('filter.matchAll'))}</option></select></label></div>` +
      `<div class="theme-list">${used.map(row).join('')}${themeCounts.get(NO_THEME) ? row(NO_THEME) : ''}</div>` +
      `<div class="export-actions"><button id="theme-clear"${filterCount() ? '' : ' disabled'}>${esc(tr('filter.clear'))}</button><button id="theme-close">${esc(tr('common.close'))}</button></div>`;
  }
  function toggleThemeFilter(show = themeEl.hidden) {
    themeEl.hidden = !show;
    themeBtnEl.setAttribute('aria-expanded', String(show));
    if (show) {
      closePicker(); hideTooltip();
      renderThemeFilter();
      const r = themeBtnEl.getBoundingClientRect();
      themeEl.style.top = `${Math.round(r.bottom + 4)}px`;
      themeEl.style.left = `${Math.round(Math.max(16, Math.min(r.left, window.innerWidth - themeEl.offsetWidth - 16)))}px`;
      const first = themeEl.querySelector('input');
      if (first) first.focus();
    } else if (themeEl.contains(document.activeElement)) themeBtnEl.focus();
  }
  themeBtnEl.addEventListener('click', () => toggleThemeFilter());
  themeEl.addEventListener('change', e => {
    const box = e.target.matches('[data-theme-tag]') ? e.target : null;
    if (box) { if (box.checked) themeFilter.add(box.dataset.themeTag); else themeFilter.delete(box.dataset.themeTag); }
    else if (e.target.id === 'theme-match') themeMatchAll = e.target.value === 'all';
    else if (e.target.id === 'filter-affinity') showAffinity = e.target.checked;
    else return;
    renderFilterButton();
    runFilter();
  });
  themeEl.addEventListener('click', e => {
    if (e.target.id === 'theme-clear') { themeFilter.clear(); showAffinity = false; renderThemeFilter(); runFilter(); }
    else if (e.target.id === 'theme-close') toggleThemeFilter(false);
  });
  document.addEventListener('pointerdown', e => {
    if (!themeEl.hidden && !themeEl.contains(e.target) && e.target !== themeBtnEl) toggleThemeFilter(false);
  });
  renderThemeFilter();
  els.search.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !listEl.hidden) listStep();
    else if (e.key === 'Enter' && searchOrder.length) {
      searchCursor = (searchCursor + 1) % searchOrder.length;
      jumpTo(searchOrder[searchCursor]);
      els.searchCount.textContent = `${searchCursor + 1}/${searchOrder.length}`;
      if (panelTab === 'search') renderPanel();
    } else if (e.key === 'Escape') { els.search.value = ''; els.search.dispatchEvent(new Event('input')); els.search.blur(); }
  });

  // keyboard camera: arrows pan, Page Up / Page Down zoom, for as long as they're held
  const KEY_PAN_SPEED = 900;  // screen pixels per second
  const KEY_ZOOM_RATE = 1.6;  // zoom changes by e^rate per second
  const camKeys = new Set();
  const CAM_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'];
  function keyboardCamera(dt) {
    if (!camKeys.size || !dt) return;
    const dx = (camKeys.has('ArrowRight') ? 1 : 0) - (camKeys.has('ArrowLeft') ? 1 : 0);
    const dy = (camKeys.has('ArrowDown') ? 1 : 0) - (camKeys.has('ArrowUp') ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      cam.x += (dx / len) * KEY_PAN_SPEED * dt / cam.zoom;
      cam.y += (dy / len) * KEY_PAN_SPEED * dt / cam.zoom;
    }
    const dz = (camKeys.has('PageUp') ? 1 : 0) - (camKeys.has('PageDown') ? 1 : 0);
    if (dz) {
      // Zoom about the middle of the visible tree area (left of the summary panel when it's open).
      const panelW = !els.panel.classList.contains('closed') && W > 720 ? els.panel.offsetWidth : 0;
      const target = clamp(cam.zoom * Math.exp(dz * KEY_ZOOM_RATE * dt), MIN_ZOOM, MAX_ZOOM);
      zoomAt((W - panelW) / 2, (H + els.topbar.offsetHeight) / 2, target / cam.zoom);
    }
    if (hover) { setHover(null); hideTooltip(); }
  }
  window.addEventListener('keyup', e => camKeys.delete(e.key));
  window.addEventListener('blur', () => camKeys.clear());

  // Theme button: Dark -> Light -> Auto (follows the system) -> Dark.
  const themeBtn = document.getElementById('btn-theme');
  function renderThemeButton() {
    const name = { dark: tr('bar.theme.dark'), light: tr('bar.theme.light') };
    themeBtn.textContent = tr(themeSetting === 'auto' ? 'bar.theme.auto' : 'bar.theme.fixed', { theme: name[theme] });
  }
  function setTheme(setting) {
    applyTheme(setting);
    try { localStorage.setItem('esp.theme', themeSetting); } catch { /* storage unavailable */ }
    renderThemeButton();
    hideTooltip();
    renderChrome();
    renderPanel();
    requestDraw();
  }
  themeBtn.addEventListener('click', () => setTheme({ dark: 'light', light: 'auto', auto: 'dark' }[themeSetting]));
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (themeSetting === 'auto') setTheme('auto'); });
  }
  renderThemeButton();

  // ------------------------------------------------------------------ stat sheet (the Stats tab and the Full Sheet)
  // Mirrors the mod's in-game stat sheet (ShipStatSheets, StatSheetLayout): sections in StatGroup order, each effect
  // under the section of its effect class's package (D.effects[name].group, from the extractor). The planner has no
  // real ship, so there are no base stats to show; every effect is an effect row, as the game does for effects no stat
  // row covers. Temporary and gated effects stay in their section with the game's own wording around them. Hovering a
  // row shows its sources (each node or affinity step and its share), like the game's breakdown.
  const STAT_GROUPS = D.statGroups && D.statGroups.length ? D.statGroups : ['MECHANICS'];
  const gameString = (k, fallback) => (k && D.strings && D.strings[k]) || fallback;
  const SHEET_MIN_COLUMN = 400, SHEET_COLUMN_GAP = 24; // StatSheetLayout.MIN_COLUMN_WIDTH, COLUMN_GAP
  function statSheet() {
    const t = cachedTotals || totals();
    const last = STAT_GROUPS[STAT_GROUPS.length - 1];
    const sections = new Map(STAT_GROUPS.map(g => [g, []]));
    if (STAT_GROUPS[0] === 'PROGRESSION') sections.get('PROGRESSION').push({ label: gameString('ui.stats.nodes', tr('sheet.fallback.nodes')), value: `${state.alloc.size + 1}/${state.cap}` });
    // With the integration preview on, each row also says what it is without the preview (baseSums: the same bucket).
    const base = integPreviewBase();
    const push = (s, wrap, baseSums) => {
      if (Math.abs(s.magnitude) < 1e-9) return;
      const g = (D.effects[s.effect] && D.effects[s.effect].group) || last;
      const raw = describeRaw(s.effect, s.magnitude);
      (sections.get(g) || sections.get(last)).push({ html: styled(wrap ? wrap(raw) : raw) + previewDiffHtml(baseSums, s), effect: s.effect, by: [...(s.by || [])], integ: [...(s.integ || [])] });
    };
    const pushGone = (baseSums, sums, wrap) => {
      for (const b of previewGone(baseSums, sums)) {
        const g = (D.effects[b.effect] && D.effects[b.effect].group) || last;
        (sections.get(g) || sections.get(last)).push({ html: goneHtml(b, x => styled(wrap ? wrap(describeRaw(x.effect, x.magnitude)) : describeRaw(x.effect, x.magnitude))), effect: b.effect, by: [] });
      }
    };
    for (const s of t.sums.values()) push(s, null, base && base.sums);
    if (base) pushGone(base.sums, t.sums);
    const forFirst = gameString('summary.forFirst', textTemplate('sheet.fallback.forFirst', {}));
    for (const [secs, g] of t.temp || []) {
      const wrap = raw => forFirst.replace('{seconds}', secs).replace('{text}', raw);
      const bs = base && (base.temp.get(secs)?.sums || new Map());
      for (const s of g.sums.values()) push(s, wrap, bs);
      if (base) pushGone(bs, g.sums, wrap);
    }
    for (const [when, g] of t.gated || []) {
      // {text} stays a placeholder here: wrap() fills it with each effect below.
      const tpl = gameString(`summary.gated.${when}`, tr('sheet.fallback.gated', { when: GATE_NAMES[when], text: '{text}' }));
      const wrap = raw => tpl.replace('{text}', raw);
      const bs = base && (base.gated.get(when)?.sums || new Map());
      for (const s of g.sums.values()) push(s, wrap, bs);
      if (base) pushGone(bs, g.sums, wrap);
    }
    return STAT_GROUPS.filter(g => sections.get(g).length).map(g => ({ id: g, name: gameString(`ui.stats.group.${g}`, humanize(g)), rows: sections.get(g) }));
  }
  function sheetSectionHtml(sec, rows) {
    let h = `<section class="gs-sec"><h3>${esc(sec.name)}</h3>`;
    for (const r of sec.rows) {
      const i = rows.push(r) - 1;
      h += r.label != null
        ? `<div class="gs-row" data-row="${i}"><span>${esc(r.label)}</span><span class="gs-val">${esc(r.value)}</span></div>`
        : `<div class="gs-eff" data-row="${i}">${r.html}</div>`;
    }
    return h + '</section>';
  }
  // The Stats tab: one column, like the game's side panel.
  let sheetTabRows = [];
  function sheetTabHtml() {
    const rows = [];
    const html = `<div class="gs-tabhead"><span class="muted">${esc(tr('sheet.tabHint'))}</span>` +
      `<button id="gs-expand" title="${esc(tr('sheet.expandTitle'))}">${esc(gameString('ui.stats.expand', tr('sheet.fallback.expand')))}</button></div>` +
      `<div class="gs gs-side">${statSheet().map(s => sheetSectionHtml(s, rows)).join('')}</div>`;
    sheetTabRows = rows;
    return html;
  }
  // The Full Sheet: the game's colours, sections laid into as many 400 px columns as fit, each into the shortest
  // column so far (StatSheetLayout.build).
  const sheetEl = document.getElementById('statsheet');
  const sheetBody = document.getElementById('statsheet-body');
  const sheetSub = document.getElementById('statsheet-sub');
  const sheetTip = document.getElementById('sheet-tip');
  let sheetRows = [];
  function renderSheet() {
    if (sheetEl.hidden) return;
    const rows = [];
    if (!state.root) {
      sheetBody.innerHTML = `<div class="gs-col"><p class="gs-empty">${esc(tr('panel.pickRoot'))}</p></div>`;
      sheetSub.textContent = '';
      sheetRows = rows;
      return;
    }
    const width = sheetBody.clientWidth - 32;
    const columns = Math.max(1, Math.floor((width + SHEET_COLUMN_GAP) / (SHEET_MIN_COLUMN + SHEET_COLUMN_GAP)));
    sheetBody.innerHTML = '<div class="gs-col"></div>'.repeat(columns);
    const cols = [...sheetBody.children];
    for (const sec of statSheet()) {
      const col = cols.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a));
      col.insertAdjacentHTML('beforeend', sheetSectionHtml(sec, rows));
    }
    sheetRows = rows;
    const root = byId.get(state.root);
    sheetSub.textContent = tr('sheet.sub', { root: root ? root.type.name : '', hull: HULL_ENUM_LABEL[HULL_ENUM[state.hull]], used: state.alloc.size + 1, cap: state.cap });
  }
  function toggleSheet(show = sheetEl.hidden) {
    sheetEl.hidden = !show;
    sheetTip.hidden = true;
    if (show) {
      closePicker(); hideTooltip(); toggleKeys(false);
      if (!storyEl.hidden) toggleStory(false);
      if (!exportEl.hidden) toggleExport(false);
      if (!artEl.hidden) toggleArt(false);
      renderSheet();
      document.getElementById('statsheet-close').focus();
    }
  }
  document.getElementById('statsheet-close').addEventListener('click', () => toggleSheet(false));
  document.getElementById('statsheet-side').addEventListener('click', () => {
    toggleSheet(false);
    if (els.panel.classList.contains('closed')) togglePanel();
    setPanelTab('sheet');
  });
  els.panelBody.addEventListener('click', e => { if (e.target.id === 'gs-expand') toggleSheet(true); });
  window.addEventListener('resize', () => { if (!sheetEl.hidden) renderSheet(); });
  // Sources on hover, in both views.
  function showSheetTip(row, x, y, game) {
    if (!row || !row.by || !row.by.length) { sheetTip.hidden = true; return; }
    sheetTip.classList.toggle('game', game);
    sheetTip.innerHTML = `<div class="tt-title">${esc(gameString('ui.stats.breakdown.heading', tr('sheet.fallback.sources')))}</div>` +
      row.by.map(([name, amount]) => `<div class="gs-src"><b${(row.integ || []).includes(name) ? ` class="builtin" title="${esc(tr('sheet.integratedTitle'))}"` : ''}>${esc(name)}</b>${describe(row.effect, amount)}</div>`).join('');
    sheetTip.hidden = false;
    placeFloating(sheetTip, x, y);
  }
  for (const [container, rowsOf, game] of [[els.panelBody, () => sheetTabRows, false], [sheetBody, () => sheetRows, true]]) {
    container.addEventListener('mousemove', e => {
      const el = e.target.closest('.gs [data-row]');
      if (!el || !container.contains(el)) { sheetTip.hidden = true; return; }
      showSheetTip(rowsOf()[+el.dataset.row], e.clientX, e.clientY, game);
    });
    container.addEventListener('mouseleave', () => { sheetTip.hidden = true; });
  }

  // ------------------------------------------------------------------ list view
  // The List button (or L) swaps the map for a list of every skill node except affinity nodes and the structural ones
  // (roots, wormholes, exits, sockets). The top bar's search box and Filter drive it exactly as they drive the map
  // (searchHits), so search matches the same way. Sort by name (natural order, so "2" before "10") or by skill tree.
  // Clicking a row goes back to the map and jumps to the node.
  const listEl = document.getElementById('listview');
  const listBody = document.getElementById('listview-body');
  const listCount = document.getElementById('listview-count');
  const listSort = document.getElementById('listview-sort');
  const viewBtn = document.getElementById('btn-view');
  // The All nodes list: every node except affinity nodes. The core's wormholes and sockets each share one name, so
  // their rows add the id.
  const listNodes = nodes.filter(n => !isAffinityNode(n));
  const TIER_RANK = { ROOT: -1, KEYSTONE: 0, NOTABLE: 1, SMALL: 2 };
  const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  let listSortMode = 'name';
  try { const v = localStorage.getItem('esp.listSort'); listSortMode = v === 'tree' || v === 'order' ? v : 'name'; } catch { /* storage unavailable */ }
  listSort.value = listSortMode;
  let listCursor = -1;
  // Trees collapsed in the Skill tree sort, by group id: a volume id ("core", "hegemony"), or "affinity" for the Build
  // list's affinity rows. Not by the shown name, so renaming a place in the text files keeps them collapsed.
  const listCollapsed = new Set();
  try { for (const p of JSON.parse(localStorage.getItem('esp.listCollapsed') || '[]')) listCollapsed.add(p); } catch { /* storage unavailable */ }
  const saveCollapsed = () => { try { localStorage.setItem('esp.listCollapsed', JSON.stringify([...listCollapsed])); } catch { /* storage unavailable */ } };
  let listGroupsShown = [];
  const listGroupBtns = document.getElementById('listview-groups');
  const listOpen = () => !listEl.hidden;
  const listName = n => (isChoice(n) && !held(n.id) ? n.type : effectiveType(n)).name + (n.tier === 'WORMHOLE' || n.tier === 'SOCKET' ? ` (${n.id})` : '');
  function listRowHtml(n) {
    const t = isChoice(n) && !held(n.id) ? n.type : effectiveType(n);
    const themes = nodeThemes(n);
    const meta = [TIER_LABEL[n.tier] || n.tier, shortPlace(n)];
    if (n.tier === 'SOCKET' && sat(n.id)) {
      const e = state.subs.get(n.id), d = e && SUBS.get(e.id), exit = state.links.get(n.id);
      meta.push(d ? tr('list.holds', { item: d.name }) : exit && byId.get(exit) ? tr('list.anchorTo', { volume: volumeName(byId.get(exit).volume) }) : tr('list.socketEmpty'));
    }
    if (n.tier === 'WORMHOLE' && n.pairedWith) meta.push(tr('list.pairedWith', { id: n.pairedWith }));
    if (n.tier === 'WORMHOLE_EXIT') { const s = linkedSocketOf(n.id); if (s) meta.push(tr('list.linkedTo', { socket: s })); }
    if (themes && themes.size) meta.push(tr('list.themes', { themes: [...themes].map(themeName).join(tr('common.listComma')) }));
    const lines = isChoice(n) && !held(n.id)
      ? n.type.options.map(id => types.get(id)).filter(Boolean).map(o => `<div><span class="muted">${esc(o.name)}:</span> ${typeLines(o).join(' ')}</div>`)
      : integrable(t) && !isChoice(n) ? [integrationCompareHtml(n, t)]
      : typeLines(t).map(l => `<div>${l}</div>`);
    // Target marks (All nodes list): a green O (wanted) and a red X (forbidden) as buttons while target mode is on,
    // and as a small tag otherwise.
    const mark = targets.want.has(n.id) ? 'want' : targets.forbid.has(n.id) ? 'forbid' : '';
    const marks = listMode !== 'all' || n.id === state.root ? ''
      : targets.mode ? `<span class="lv-target">` +
        `<button type="button" data-mark="want" aria-pressed="${mark === 'want'}" aria-label="${esc(tr('list.mark.wanted'))}" title="${esc(tr(mark === 'want' ? 'list.mark.clear' : 'list.mark.wantTitle'))}">O</button>` +
        `<button type="button" data-mark="forbid" aria-pressed="${mark === 'forbid'}" aria-label="${esc(tr('list.mark.forbidden'))}" title="${esc(tr(mark === 'forbid' ? 'list.mark.clear' : 'list.mark.forbidTitle'))}">X</button></span>`
      : mark ? `<span class="lv-mark ${mark}" title="${esc(tr(mark === 'want' ? 'list.mark.wanted' : 'list.mark.forbidden'))}">${mark === 'want' ? 'O' : 'X'}</span>` : '';
    return `<div class="node-row lv-row ${n.tier.toLowerCase()}${listMode === 'all' && mark ? ` lv-${mark}` : ''}" data-node="${esc(n.id)}">${nodeIconHtml(n, t)}<div class="lv-main">` +
      `<div class="nm">${esc(listName(n))}${sat(n.id) && listMode !== 'build' ? `<span class="have">${esc(tr('search.allocatedTag'))}</span>` : ''}${state.integrated.has(n.id) && integrable(t) ? `<span class="have builtin">${esc(tr('list.integratedTag'))}</span>` : ''}</div>` +
      `<div class="tr">${esc(meta.join(' · '))}</div>` +
      (lines.length ? `<div class="lv-effects">${lines.join('')}</div>` : '') + `</div>${marks}</div>`;
  }
  // Two lists: "all" (every non-affinity node) and "build" (what's allocated: the root, every chosen node including
  // wormholes, exits and sockets, and the affinity nodes summed into one row per tech). Each row is an entry with a
  // place (its tree), a rank (tier), a name, an allocation order and a count, so both lists sort and group alike.
  const AFF_ORDER = ['low_tech_affinity', 'midline_affinity', 'high_tech_affinity'];
  const AFF_GROUP = tr('list.place.affinity');
  let listMode = 'all';
  try { listMode = localStorage.getItem('esp.listMode') === 'build' ? 'build' : 'all'; } catch { /* storage unavailable */ }
  const listModeBtns = [...document.querySelectorAll('#listview [data-mode]')];
  const listHint = document.getElementById('listview-hint');
  const nodeEntry = (n, order) => ({ group: n.volume, place: shortPlace(n), core: n.volume === 'core', rank: TIER_RANK[n.tier] ?? 3, name: listName(n), order, count: 1, html: () => listRowHtml(n) });
  function affRowHtml(g) {
    const k = g.nodes.length, t = g.type;
    const lines = typeEffects(t).map(e => `<div>${describe(e.effect, e.magnitude * k)}</div>`);
    return `<div class="node-row lv-row lv-aff" data-node="${esc(g.nodes[0].id)}">${nodeIconHtml(g.nodes[0], t)}<div class="lv-main">` +
      `<div class="nm">${esc(t.name)} <span class="lv-count">×${k}</span></div>` +
      `<div class="tr">${esc(tr('list.affinityRow', { count: k }))}</div>` +
      (lines.length ? `<div class="lv-effects">${lines.join('')}</div>` : '') + '</div></div>';
  }
  function listEntries(hits) {
    if (listMode !== 'build') return listNodes.filter(n => !switchedOff(n) && (!hits || hits.has(n.id))).map(n => nodeEntry(n, 0));
    const ids = state.root ? [state.root, ...state.alloc] : [];
    const out = [];
    const aff = new Map();
    ids.forEach((id, i) => {
      const n = byId.get(id);
      if (!n || (hits && !hits.has(id))) return;
      if (!isAffinityNode(n)) { out.push(nodeEntry(n, i)); return; }
      const t = effectiveType(n);
      const g = aff.get(t.id) || { type: t, nodes: [], order: i };
      g.nodes.push(n);
      aff.set(t.id, g);
    });
    for (const g of aff.values()) {
      out.push({ group: 'affinity', place: AFF_GROUP, affinity: true, rank: AFF_ORDER.indexOf(g.type.id), name: g.type.name, order: g.order, count: g.nodes.length, html: () => affRowHtml(g) });
    }
    return out;
  }
  let listOrder = [];
  function renderList() {
    if (!listOpen()) return;
    for (const b of listModeBtns) b.setAttribute('aria-pressed', String(b.dataset.mode === listMode));
    const buildSize = state.root ? state.alloc.size + 1 : 0;
    listModeBtns.find(b => b.dataset.mode === 'build').textContent = tr('list.mode.build', { n: buildSize });
    const orderOpt = listSort.querySelector('option[value="order"]');
    orderOpt.hidden = orderOpt.disabled = listMode !== 'build';
    const sortMode = listSortMode === 'order' && listMode !== 'build' ? 'name' : listSortMode;
    listSort.value = sortMode;
    listHint.textContent = tr(listMode !== 'build' && targets.mode ? 'list.hint.target' : 'list.hint');
    const entries = listEntries(searchHits);
    const total = entries.reduce((a, e) => a + e.count, 0);
    const byName = (a, b) => nameCollator.compare(a.name, b.name) || nameCollator.compare(a.place, b.place);
    let html = '', visible = 0;
    if (sortMode === 'tree') {
      // Groups by id; each shows its place name as written in the text files.
      const groups = new Map();
      for (const e of entries) {
        if (!groups.has(e.group)) groups.set(e.group, { place: e.place, core: !!e.core, affinity: !!e.affinity, list: [] });
        groups.get(e.group).list.push(e);
      }
      // Affinity first (build list), then the core as one tree, then the volumes by their shown name.
      const groupRank = g => (g.affinity ? 0 : g.core ? 1 : 2);
      const ordered = [...groups].sort(([, ga], [, gb]) => groupRank(ga) - groupRank(gb)
        || nameCollator.compare(ga.place, gb.place));
      for (const [id, g] of ordered) {
        g.list.sort((a, b) => a.rank - b.rank || byName(a, b));
        const n = g.list.reduce((a, e) => a + e.count, 0);
        const collapsed = listCollapsed.has(id);
        if (!collapsed) visible += n;
        // Each tree's heading collapses or expands it (remembered in esp.listCollapsed).
        html += `<h3 class="lv-group"><button type="button" data-group="${esc(id)}" aria-expanded="${!collapsed}" title="${esc(tr(collapsed ? 'list.group.show' : 'list.group.hide'))}">` +
          `<span class="lv-caret">${collapsed ? '▸' : '▾'}</span> ${esc(g.place)} <span class="muted">${n}</span></button></h3>` +
          (collapsed ? '' : g.list.map(e => e.html()).join(''));
      }
      listGroupsShown = ordered.map(([id]) => id);
    } else {
      entries.sort(sortMode === 'order' ? (a, b) => a.order - b.order : (a, b) => (a.affinity && b.affinity ? a.rank - b.rank : 0) || byName(a, b));
      html = entries.map(e => e.html()).join('');
      visible = total;
    }
    listOrder = entries;
    const inCollapsed = total - visible;
    // list.count.all, .filtered, .collapsed, .filteredCollapsed (and the same for build)
    const variant = searchHits ? (inCollapsed ? '.filteredCollapsed' : '.filtered') : inCollapsed ? '.collapsed' : '';
    if (listMode === 'build') {
      const affCount = entries.filter(e => e.affinity).reduce((a, e) => a + e.count, 0);
      listCount.textContent = !state.root ? tr('list.noBuild')
        : tr(`list.count.build${variant}`, { total, size: buildSize, affinity: affCount, collapsed: inCollapsed });
    } else listCount.textContent = tr(`list.count.all${variant}`, { total, all: listNodes.filter(n => !switchedOff(n)).length, collapsed: inCollapsed });
    listGroupBtns.hidden = sortMode !== 'tree';
    const empty = listMode === 'build' && !state.root ? 'list.empty.noRoot'
      : listMode === 'build' && !searchHits ? 'list.empty.rootOnly' : 'list.empty.noMatch';
    listBody.innerHTML = html || `<div class="empty">${esc(tr(empty))}</div>`;
    listCursor = -1;
  }
  for (const b of listModeBtns) {
    b.addEventListener('click', () => {
      listMode = b.dataset.mode === 'build' ? 'build' : 'all';
      try { localStorage.setItem('esp.listMode', listMode); } catch { /* storage unavailable */ }
      renderList();
      listBody.scrollTop = 0;
    });
  }
  function setView(list) {
    listEl.hidden = !list;
    viewBtn.textContent = tr(list ? 'list.view.map' : 'list.view.list');
    viewBtn.setAttribute('aria-pressed', String(list));
    viewBtn.title = tr(list ? 'list.view.mapTitle' : 'list.view.listTitle');
    closePicker(); hideTooltip(); setHover(null);
    // The Targets bar (Allocate, Keep current build) floats over the map; while the list shows it's docked inside the
    // list, above the rows, so it isn't covered.
    const targetsBar = document.getElementById('targets');
    if (list) listEl.insertBefore(targetsBar, listBody);
    else document.body.insertBefore(targetsBar, document.getElementById('file-notice'));
    runFilter(); // puts the panel's Search tab away for the list, or back for the map; renders the list
    if (list) listBody.scrollTop = 0;
  }
  viewBtn.addEventListener('click', () => setView(!listOpen()));
  listSort.addEventListener('change', () => {
    listSortMode = listSort.value === 'tree' || listSort.value === 'order' ? listSort.value : 'name';
    try { localStorage.setItem('esp.listSort', listSortMode); } catch { /* storage unavailable */ }
    renderList();
  });
  listBody.addEventListener('click', e => {
    const head = e.target.closest('[data-group]');
    if (head) {
      const id = head.dataset.group;
      if (listCollapsed.has(id)) listCollapsed.delete(id); else listCollapsed.add(id);
      saveCollapsed();
      renderList();
      const again = [...listBody.querySelectorAll('[data-group]')].find(b => b.dataset.group === id);
      if (again) again.focus();
      return;
    }
    const row = e.target.closest('[data-node]');
    if (!row) return;
    const n = byId.get(row.dataset.node);
    // Target mode in the All nodes list: the buttons set a mark, and clicking the row cycles it like on the map.
    const markBtn = e.target.closest('[data-mark]');
    if (markBtn) { setTargetMark(n, markBtn.dataset.mark); return; }
    if (e.altKey && state.root) { toggleIntegration(n); return; }
    if (targets.mode && listMode === 'all') { cycleTarget(n); return; }
    setView(false);
    jumpTo(n);
  });
  // Right-click clears a mark, as the Targets bar says (and as on the map).
  listBody.addEventListener('contextmenu', e => {
    const row = e.target.closest('[data-node]');
    if (!row || !targets.mode || listMode !== 'all') return;
    e.preventDefault();
    clearTarget(byId.get(row.dataset.node));
  });
  function setTargetMark(n, kind) {
    const on = kind === 'want' ? targets.want : targets.forbid, off = kind === 'want' ? targets.forbid : targets.want;
    if (on.has(n.id)) on.delete(n.id);
    else { on.add(n.id); off.delete(n.id); }
    targetsChanged();
  }
  document.getElementById('lv-collapse-all').addEventListener('click', () => { for (const p of listGroupsShown) listCollapsed.add(p); saveCollapsed(); renderList(); });
  document.getElementById('lv-expand-all').addEventListener('click', () => { listCollapsed.clear(); saveCollapsed(); renderList(); });
  // Enter in the search box steps through the list while it's showing.
  function listStep() {
    const rows = [...listBody.querySelectorAll('.lv-row')];
    if (!rows.length) return;
    if (rows[listCursor]) rows[listCursor].classList.remove('current');
    listCursor = (listCursor + 1) % rows.length;
    rows[listCursor].classList.add('current');
    rows[listCursor].scrollIntoView({ block: 'nearest' });
    els.searchCount.textContent = `${listCursor + 1}/${rows.length}`;
  }

  // shortcuts list
  const keysEl = document.getElementById('keys');
  const keysBtn = document.getElementById('btn-keys');
  function toggleKeys(show = keysEl.hidden) {
    keysEl.hidden = !show;
    keysBtn.setAttribute('aria-expanded', String(show));
    if (show) { closePicker(); hideTooltip(); if (!exportEl.hidden) toggleExport(false); if (!storyEl.hidden) toggleStory(false); if (!artEl.hidden) toggleArt(false); document.getElementById('keys-close').focus(); }
    else if (keysEl.contains(document.activeElement)) keysBtn.focus();
  }
  keysBtn.addEventListener('click', () => toggleKeys());
  document.getElementById('keys-close').addEventListener('click', () => toggleKeys(false));
  document.addEventListener('pointerdown', e => {
    if (!keysEl.hidden && !keysEl.contains(e.target) && e.target !== keysBtn) toggleKeys(false);
  });

  // Ship rules (the summary panel's Ship tab) and Optional rules (dialog): facts the planner can't see (see blockOf).
  // Both live in state.ship; ship facts describe the hull, story facts the campaign.
  const shipPane = document.getElementById('panel-ship');
  const shipBtn = els.shipBtn;
  const storyEl = document.getElementById('story');
  const storyBtn = els.storyBtn;
  const ship = {
    summary: document.getElementById('ship-summary'),
    shield: document.getElementById('ship-shield'),
    armor: document.getElementById('ship-armor'),
    armorNote: document.getElementById('ship-armor-note'),
    tris: [...shipPane.querySelectorAll('select[data-tri]')],
    mods: document.getElementById('ship-mods'),
    modInput: document.getElementById('ship-mod-input'),
    modList: document.getElementById('ship-mod-list'),
    modStatus: document.getElementById('ship-mod-status'),
    logistics: document.getElementById('ship-logistics'),
    logisticsNote: document.getElementById('ship-logistics-note'),
    problems: document.getElementById('ship-problems'),
  };
  ship.problems.addEventListener('click', e => { const row = e.target.closest('[data-node]'); if (row) jumpTo(byId.get(row.dataset.node)); });
  const story = {
    summary: document.getElementById('story-summary'),
    gates: document.getElementById('story-gates'),
    unlocks: document.getElementById('story-unlocks'),
    other: document.getElementById('story-other'),
    volumes: document.getElementById('story-volumes'),
    integCost: document.getElementById('story-integ-cost'),
  };
  // Types that can appear in the tree (node types and their options), and the hull mods any of them can clash with.
  const treeTypes = [...new Map(nodes.flatMap(n => [n.type.id, ...(n.type.options || [])]).filter(id => types.has(id)).map(id => [id, types.get(id)])).values()];
  const relevantHullMods = new Map();
  for (const t of treeTypes) for (const h of typeRules(t).exclusiveAndOwn) { if (!relevantHullMods.has(h)) relevantHullMods.set(h, []); relevantHullMods.get(h).push(t); }
  // Hull mods are listed by their in-game name; the id is added only where two share a name.
  const nameUses = new Map();
  for (const h of relevantHullMods.keys()) { const k = hullModName(h).toLowerCase(); nameUses.set(k, (nameUses.get(k) || 0) + 1); }
  const hullModLabel = h => (nameUses.get(hullModName(h).toLowerCase()) > 1 ? `${hullModName(h)} (${h})` : hullModName(h));
  let shipListBuilt = false, storyListsBuilt = false;
  // Allocated nodes that break a rule, as a sentence after the Ship tab's and Optional rules dialog's summaries (or nothing).
  const problemSummary = () => {
    const problems = rules().problems.size;
    return problems ? ` ${tr('ship.problemCount', { count: problems })}` : '';
  };
  function renderShipPane() {
    if (!shipListBuilt) {
      shipListBuilt = true;
      ship.modList.innerHTML = [...relevantHullMods.keys()].sort((a, b) => hullModName(a).localeCompare(hullModName(b)))
        .map(h => `<option value="${esc(hullModLabel(h))}"></option>`).join('');
    }
    const sh = state.ship;
    ship.shield.value = sh.shield || '';
    if (document.activeElement !== ship.armor) ship.armor.value = sh.armor ?? '';
    const cut = D.effects.ARMOR_FLAT_FOR_LOW_BASE_ARMOR?.hullArgs?.[HULL_ENUM[state.hull]];
    ship.armorNote.textContent = cut ? tr('ship.armor.note', { armor: fmt(evalExpr(cut.cutoff, 1)), hull: hullLabel() }) : '';
    for (const sel of ship.tris) sel.value = sh[sel.dataset.tri] == null ? '' : sh[sel.dataset.tri] ? '1' : '0';
    ship.mods.innerHTML = sh.hullMods.size ? [...sh.hullMods].map(h => {
      const hits = relevantHullMods.get(h) || [];
      const title = tr(hits.length ? 'ship.hullmod.refuses' : 'ship.hullmod.noClash', { name: hullModName(h), id: h, nodes: hits.map(x => x.name).join(', ') });
      return `<span class="chip" title="${esc(title)}">${esc(hullModLabel(h))} <button data-rm="${esc(h)}" title="${esc(tr('ship.hullmod.remove'))}" aria-label="${esc(tr('ship.hullmod.removeNamed', { name: hullModName(h) }))}">×</button></span>`;
    }).join('') : `<span class="muted">${esc(tr('ship.hullmods.none'))}</span>`;
    if (document.activeElement !== ship.logistics) ship.logistics.value = sh.extraLogistics || 0;
    ship.logisticsNote.textContent = tr('ship.logistics.note', { limit: logisticsCap() });
    ship.summary.textContent = tr('ship.summary', { count: shipRuleCount() }) + problemSummary();
    ship.problems.innerHTML = problemsHtml();
  }
  function renderStory() {
    if (!storyListsBuilt) {
      storyListsBuilt = true;
      const gateCounts = new Map(), gateVolumes = new Map();
      for (const n of nodes) for (const g of n.gates) {
        gateCounts.set(g, (gateCounts.get(g) || 0) + 1);
        if (!gateVolumes.has(g)) gateVolumes.set(g, new Set());
        gateVolumes.get(g).add(n.volume);
      }
      // A gate whose nodes all sit in one optional volume toggle is listed under that toggle; the rest stay in Story gates.
      const gateToggle = g => OPTIONAL_VOLUMES.find(t => [...gateVolumes.get(g)].every(v => t.volumes.includes(v))) || null;
      const gateRow = g => `<label><input type="checkbox" data-gate="${esc(g)}"> ${esc(gateText(g))} <span class="muted">${esc(tr('optional.nodeCount', { count: gateCounts.get(g) }))}</span></label>`;
      const sortedGates = [...gateCounts.keys()].sort((a, b) => gateText(a).localeCompare(gateText(b)));
      story.gates.innerHTML = sortedGates.filter(g => !gateToggle(g)).map(gateRow).join('');
      story.volumes.innerHTML = OPTIONAL_VOLUMES.map(t => {
        const count = nodes.filter(n => t.volumes.includes(n.volume)).length;
        const gates = sortedGates.filter(g => gateToggle(g) === t);
        return `<label><input type="checkbox" data-volgroup="${esc(t.id)}"> ${esc(t.name)} <span class="muted">${esc(tr('optional.nodeCount', { count }))}</span></label>` +
          (gates.length ? `<div class="vol-gates" data-for="${esc(t.id)}"><span class="muted">${esc(tr('optional.volumes.gates'))}</span>${gates.map(gateRow).join('')}</div>` : '');
      }).join('') || `<span class="muted">${esc(tr('optional.volumes.none'))}</span>`;
      // Blueprint unlocks are hull mods (Unlocked hullmods, by name only; the condition is in the hover title). Anything
      // else (today only the Wormhole, unlocked by $playerCanUseGates) goes in the section at the top, with its condition.
      const unlockTypes = treeTypes.filter(t => (t.unlockConditions || []).length).sort((a, b) => a.name.localeCompare(b.name));
      const isBlueprint = t => t.unlockConditions.some(c => c.type === 'blueprint');
      story.unlocks.innerHTML = unlockTypes.filter(isBlueprint).map(t =>
        `<label title="Needs ${esc(unlockText(t))}"><input type="checkbox" data-type="${esc(t.id)}"> ${esc(t.name)}</label>`).join('');
      story.other.innerHTML = unlockTypes.filter(t => !isBlueprint(t)).map(t =>
        `<label><input type="checkbox" data-type="${esc(t.id)}"> ${esc(t.name)} <span class="muted">(${esc(unlockText(t))})</span></label>`).join('');
    }
    const sh = state.ship;
    for (const cb of story.volumes.querySelectorAll('[data-volgroup]')) cb.checked = !state.hiddenVolumes.has(cb.dataset.volgroup);
    // A hidden volume's gates can't refuse anything, so they're greyed out until it's shown again.
    for (const box of story.volumes.querySelectorAll('.vol-gates')) {
      const off = state.hiddenVolumes.has(box.dataset.for);
      box.classList.toggle('off', off);
      for (const cb of box.querySelectorAll('input')) cb.disabled = off;
    }
    for (const cb of storyEl.querySelectorAll('[data-gate]')) cb.checked = !sh.lockedGates.has(cb.dataset.gate);
    for (const cb of [...story.unlocks.querySelectorAll('input'), ...story.other.querySelectorAll('input')]) cb.checked = !sh.lockedTypes.has(cb.dataset.type);
    story.integCost.value = sh.integCost;
    const n = storyRuleCount(), hv = state.hiddenVolumes.size;
    const counts = { gates: tr('optional.count.gates', { count: n }), volumes: tr('optional.count.volumes', { count: hv }) };
    story.summary.textContent = tr(n && hv ? 'optional.summary.both' : n ? 'optional.summary.gates' : hv ? 'optional.summary.volumes' : 'optional.summary.none', counts) + problemSummary();
  }
  function setShip(fn) {
    const before = rules().problems.size;
    pushUndo();
    fn(state.ship);
    changed();
    warnNewProblems(before);
  }
  // The toolbar's Ship rules button opens the summary panel on its Ship tab, or leaves the tab if it's showing.
  shipBtn.addEventListener('click', () => {
    const closed = els.panel.classList.contains('closed');
    if (!closed && panelTab === 'ship') { setPanelTab('stats'); return; }
    if (closed) togglePanel();
    setPanelTab('ship');
  });
  function toggleStory(show = storyEl.hidden) {
    storyEl.hidden = !show;
    storyBtn.setAttribute('aria-expanded', String(show));
    if (show) {
      closePicker(); hideTooltip(); toggleKeys(false); if (!exportEl.hidden) toggleExport(false); if (!artEl.hidden) toggleArt(false);
      renderStory();
      document.getElementById('story-close').focus();
    } else if (storyEl.contains(document.activeElement)) storyBtn.focus();
  }
  storyBtn.addEventListener('click', () => toggleStory());
  document.getElementById('story-close').addEventListener('click', () => toggleStory(false));
  document.addEventListener('pointerdown', e => {
    if (!storyEl.hidden && !storyEl.contains(e.target) && e.target !== storyBtn) toggleStory(false);
  });
  ship.shield.addEventListener('change', () => setShip(s => { s.shield = SHIELDS[ship.shield.value] ? ship.shield.value : null; }));
  ship.armor.addEventListener('change', () => {
    const v = ship.armor.value.trim() === '' ? null : Math.max(0, Math.min(99999, Math.round(Number(ship.armor.value))));
    setShip(s => { s.armor = Number.isFinite(v) ? v : null; });
  });
  for (const sel of ship.tris) sel.addEventListener('change', () => setShip(s => { s[sel.dataset.tri] = sel.value === '' ? null : sel.value === '1'; }));
  ship.logistics.addEventListener('change', () => {
    const v = Math.max(0, Math.min(20, Math.round(Number(ship.logistics.value) || 0)));
    setShip(s => { s.extraLogistics = v; });
  });
  function addHullMod() {
    const raw = ship.modInput.value.trim();
    if (!raw) return;
    const inParens = raw.match(/\(([^()]+)\)\s*$/);
    const folded = raw.toLowerCase();
    const id = inParens && relevantHullMods.has(inParens[1]) ? inParens[1]
      : [...relevantHullMods.keys()].find(h => hullModLabel(h).toLowerCase() === folded || hullModName(h).toLowerCase() === folded || h.toLowerCase() === folded);
    if (!id) { ship.modStatus.textContent = tr('ship.addHullmod.unknown', { name: raw }); return; }
    ship.modStatus.textContent = '';
    ship.modInput.value = '';
    if (!state.ship.hullMods.has(id)) setShip(s => { s.hullMods.add(id); });
  }
  ship.modInput.addEventListener('change', addHullMod);
  ship.modInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addHullMod(); } });
  ship.mods.addEventListener('click', e => {
    const b = e.target.closest('[data-rm]');
    if (b) setShip(s => { s.hullMods.delete(b.dataset.rm); });
  });
  document.getElementById('ship-clear').addEventListener('click', () => setShip(s => {
    const fresh = blankShip();
    for (const k of SHIP_KEYS) s[k] = fresh[k];
  }));
  story.gates.addEventListener('change', e => {
    const g = e.target.dataset.gate;
    if (g) setShip(s => { if (e.target.checked) s.lockedGates.delete(g); else s.lockedGates.add(g); });
  });
  for (const list of [story.unlocks, story.other]) {
    list.addEventListener('change', e => {
      const t = e.target.dataset.type;
      if (t) setShip(s => { if (e.target.checked) s.lockedTypes.delete(t); else s.lockedTypes.add(t); });
    });
  }
  // Tick all / Untick all act on their own section only.
  document.getElementById('story-gate-all').addEventListener('click', () => setShip(s => { s.lockedGates.clear(); }));
  document.getElementById('story-gate-none').addEventListener('click', () => setShip(s => {
    for (const cb of storyEl.querySelectorAll('[data-gate]')) s.lockedGates.add(cb.dataset.gate);
  }));
  document.getElementById('story-unlock-all').addEventListener('click', () => setShip(s => {
    for (const cb of story.unlocks.querySelectorAll('input')) s.lockedTypes.delete(cb.dataset.type);
  }));
  document.getElementById('story-unlock-none').addEventListener('click', () => setShip(s => {
    for (const cb of story.unlocks.querySelectorAll('input')) s.lockedTypes.add(cb.dataset.type);
  }));
  document.getElementById('story-clear').addEventListener('click', () => setShip(s => { s.lockedGates.clear(); s.lockedTypes.clear(); s.integCost = 'EXPONENTIAL'; state.hiddenVolumes.clear(); }));
  story.integCost.addEventListener('change', () => {
    const v = story.integCost.value;
    story.integCost.blur();
    if (Object.hasOwn(INTEG_COST, v) && v !== state.ship.integCost) setShip(s => { s.integCost = v; });
  });
  story.volumes.addEventListener('change', e => {
    const id = e.target.dataset.volgroup, g = e.target.dataset.gate;
    if (id) setVolumeShown(id, e.target.checked);
    else if (g) setShip(s => { if (e.target.checked) s.lockedGates.delete(g); else s.lockedGates.add(g); });
  });

  // templates dialog: linked file (remembered between visits), import, export
  const exportEl = document.getElementById('export');
  const exportBtn = document.getElementById('btn-export');
  const tpl = {
    name: document.getElementById('tpl-name'),
    summary: document.getElementById('tpl-summary'),
    save: document.getElementById('tpl-save'),
    saveNote: document.getElementById('tpl-save-note'),
    status: document.getElementById('tpl-status'),
    file: document.getElementById('tpl-file'),
  };
  const tf = {
    status: document.getElementById('tf-status'),
    link: document.getElementById('tf-link'),
    create: document.getElementById('tf-create'),
    reconnect: document.getElementById('tf-reconnect'),
    reload: document.getElementById('tf-reload'),
    forget: document.getElementById('tf-forget'),
    note: document.getElementById('tf-note'),
    list: document.getElementById('tf-list'),
    watch: document.getElementById('tf-watch'),
    watchNote: document.getElementById('tf-watch-note'),
    watchMode: document.getElementById('tf-watch-mode'),
    watchSecsWrap: document.getElementById('tf-watch-secs'),
    watchLimits: document.getElementById('tf-watch-limits'),
  };
  const canWriteFiles = typeof window.showOpenFilePicker === 'function';
  let linkedHandle = null;   // FileSystemFileHandle, kept in IndexedDB so the link survives reloads
  let linkedAccess = 'none'; // 'none' | 'prompt' (needs a click to reconnect) | 'granted'
  let fileTemplates = null;  // templates read from the linked (or opened) file
  let openedFile = null;     // { name, text } when the browser can't link files and one was opened read-only
  let pendingFileAction = null;

  // --- remembering the linked file
  function handleStore(mode, fn) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('esp', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('handles');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('handles', mode);
        const r = fn(tx.objectStore('handles'));
        tx.oncomplete = () => resolve(r && r.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }
  const rememberHandle = h => handleStore('readwrite', s => (h ? s.put(h, 'templates') : s.delete('templates'))).catch(() => {});
  const recallHandle = () => handleStore('readonly', s => s.get('templates')).catch(() => null);

  async function checkAccess(request) {
    if (!linkedHandle) { linkedAccess = 'none'; return false; }
    let p = await linkedHandle.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted' && request) p = await linkedHandle.requestPermission({ mode: 'readwrite' });
    linkedAccess = p === 'granted' ? 'granted' : 'prompt';
    return linkedAccess === 'granted';
  }
  async function readLinked() {
    const f = await linkedHandle.getFile();
    const text = await f.text();
    const list = parseTemplateFile(text);
    noticeOutsideChange(text, list);
    fileTemplates = list;
    linkedText = text;
    linkedStamp = `${f.lastModified}:${f.size}`;
    if (!observer && !watchTimer && !observerStarting) scheduleWatch(); // the first read of a link starts watching
    return text;
  }

  // --- watching the linked file: the game rewrites it when a template changes in game. The browser has no change event
  // for a linked file, so it's polled (timestamp and size every LINK_POLL_MS, and when the tab comes back), and read only
  // when those change. A read that differs from what the planner last read or wrote raises the file notice.
  // How to watch, set in the Templates dialog: 'observe' (the default: the browser's FileSystemObserver tells the planner
  // as soon as the file changes; nothing is watched where the browser has none or after it reports an error), 'poll'
  // (checking every watchSecs seconds, only when chosen) or 'off'. The top bar's Check file button checks on demand in
  // any mode. Saved as localStorage 'esp.watchMode' and 'esp.watchSecs'.
  const WATCH_DEFAULT = 2, WATCH_MAX = 600;
  const canObserve = typeof window.FileSystemObserver === 'function';
  let watchMode = 'observe', watchSecs = WATCH_DEFAULT, watchTimer = 0;
  let observer = null, observerBroken = false, observerStarting = false, observeDelay = 0, readRetries = 0;
  try {
    const m = localStorage.getItem('esp.watchMode'), s = localStorage.getItem('esp.watchSecs');
    const v = Number(s);
    if (['observe', 'poll', 'off'].includes(m)) watchMode = m;
    else if (s === '0') watchMode = 'off'; // the interval setting used to turn watching off with 0
    if (s != null && Number.isFinite(v) && v >= 1) watchSecs = Math.min(WATCH_MAX, Math.round(v));
  } catch { /* storage unavailable */ }
  let linkedText = null;    // the file as the planner last read or wrote it; null until the first read of this link
  let linkedStamp = '';     // lastModified:size of that read
  let linkedWriting = false, linkedPolling = false;
  let fileChange = null;    // what the notice reports: { added, changed, removed (name lists), current }
  const fileNotice = {
    box: document.getElementById('file-notice'),
    msg: document.getElementById('file-notice-msg'),
    load: document.getElementById('fn-load'),
    open: document.getElementById('fn-open'),
    dismiss: document.getElementById('fn-dismiss'),
  };
  const templateKey = t => (t.id ? 'id:' + t.id : `${t.root}|${String(t.name).trim().toLowerCase()}`);
  const templateBody = t => JSON.stringify([t.name, t.root, t.hull, t.steps, t.anchors || null, t.integrate || null]);
  const validTemplate = t => t && typeof t === 'object' && t.root && t.name;
  function noticeOutsideChange(text, now) {
    if (linkedText == null || text === linkedText) return;
    let before;
    try { before = parseTemplateFile(linkedText); } catch { before = []; }
    const om = new Map(before.filter(validTemplate).map(t => [templateKey(t), t]));
    const nm = new Map(now.filter(validTemplate).map(t => [templateKey(t), t]));
    const added = [...nm].filter(([k]) => !om.has(k)).map(([, t]) => t.name);
    const removed = [...om].filter(([k]) => !nm.has(k)).map(([, t]) => t.name);
    const changed = [...nm].filter(([k, t]) => om.has(k) && templateBody(om.get(k)) !== templateBody(t)).map(([, t]) => t.name);
    if (!added.length && !removed.length && !changed.length) return; // rewritten, same templates
    // The template the current build came from: did it change there?
    let current = null;
    if (state.root && state.template) {
      const i = findTemplateIndex(before, state.template.name);
      const old = i >= 0 ? before[i] : null;
      const j = findTemplateIndex(now, state.template.name);
      const next = old ? nm.get(templateKey(old)) || (j >= 0 ? now[j] : null) : j >= 0 ? now[j] : null;
      if (old && !next) current = { removed: true, name: old.name };
      else if (next && (!old || templateBody(old) !== templateBody(next))) current = { t: next, name: next.name };
    }
    const merge = (a, b) => [...new Set([...(a || []), ...b])];
    fileChange = { added: merge(fileChange?.added, added), changed: merge(fileChange?.changed, changed), removed: merge(fileChange?.removed, removed), current: current || fileChange?.current || null };
    renderFileNotice();
  }
  function renderFileNotice() {
    const c = fileChange;
    fileNotice.box.hidden = !c;
    if (!c) return;
    // Up to three names, then "and N more".
    const names = list => {
      const shown = list.slice(0, 3).map(name => tr('templates.notice.quoted', { name })).join(tr('common.listComma'));
      return list.length > 3 ? tr('templates.notice.more', { names: shown, count: list.length - 3 }) : shown;
    };
    const sentences = [tr('templates.notice.detected', { file: linkedHandle ? linkedHandle.name : '' })];
    for (const [key, list] of [['templates.notice.changed', c.changed], ['templates.notice.added', c.added], ['templates.notice.removed', c.removed]]) {
      if (list.length) sentences.push(tr(key, { names: names(list) }));
    }
    sentences.push(tr('templates.notice.upToDate'));
    const cur = c.current;
    if (cur && cur.removed) sentences.push(tr('templates.notice.currentRemoved', { name: cur.name }));
    else if (cur) {
      const edited = state.template && templateSig() !== state.template.sig;
      sentences.push(tr(edited ? 'templates.notice.currentUpdatedEdited' : 'templates.notice.currentUpdated', { name: cur.name }));
    }
    fileNotice.msg.textContent = sentences.join(' ');
    fileNotice.load.hidden = !(cur && !cur.removed);
    fileNotice.dismiss.textContent = tr(cur && !cur.removed ? 'templates.notice.keep' : 'templates.notice.dismiss');
  }
  function closeFileNotice() { fileChange = null; renderFileNotice(); }
  // One check: compare timestamp and size, and read the file only when they changed. The observer and the timer both
  // come here. A read that fails (the game halfway through writing, say) is retried shortly when the observer is in
  // charge, since no further event may come; the timer just tries again on its next tick.
  async function pollLinked() {
    if (watchMode === 'off' || document.hidden || !linkedHandle || linkedAccess !== 'granted' || linkedWriting || linkedPolling || linkedText == null) return;
    linkedPolling = true;
    try {
      const f = await linkedHandle.getFile();
      if (`${f.lastModified}:${f.size}` !== linkedStamp && !linkedWriting) {
        await readLinked();
        if (!exportEl.hidden) renderTemplatesFile();
      }
      readRetries = 0;
    } catch {
      if (observer && readRetries < 3) { readRetries++; setTimeout(pollLinked, 1000); }
    } finally { linkedPolling = false; }
  }
  // Watching runs only while the page is visible: a hidden tab (another tab in front, the window minimized or covered
  // by the game) has no observer and no timer, and coming back checks at once. It also needs a linked file with access
  // allowed this visit.
  const watchReady = () => watchMode !== 'off' && !document.hidden && !!linkedHandle && linkedAccess === 'granted' && linkedText != null;
  function stopObserver() {
    if (observer) { try { observer.disconnect(); } catch { /* already gone */ } }
    observer = null;
    clearTimeout(observeDelay);
  }
  async function startObserver() {
    observerStarting = true;
    try {
      const o = new FileSystemObserver(records => {
        // 'errored' ends the observation (the system stopped watching, after sleep for example).
        if (records.some(r => r.type === 'errored')) { observerBroken = true; stopObserver(); renderWatchStatus(); return; }
        // One save can arrive as several events; read once, after they settle.
        clearTimeout(observeDelay);
        observeDelay = setTimeout(pollLinked, 300);
      });
      await o.observe(linkedHandle);
      if (watchReady() && watchMode === 'observe') observer = o; else o.disconnect();
    } catch { observerBroken = true; }
    finally { observerStarting = false; }
  }
  async function scheduleWatch() {
    clearInterval(watchTimer);
    watchTimer = 0;
    if (!watchReady()) { stopObserver(); renderWatchStatus(); return; }
    if (watchMode === 'observe') {
      // No fallback to checking: without a working observer nothing is watched (Check file still works).
      if (canObserve && !observerBroken && !observer && !observerStarting) await startObserver();
      renderWatchStatus();
      return;
    }
    stopObserver();
    watchTimer = setInterval(pollLinked, watchSecs * 1000);
    renderWatchStatus();
  }
  // What the Templates dialog says about watching, including what the browser can't do.
  function renderWatchStatus() {
    tf.watchMode.value = watchMode;
    tf.watch.value = watchSecs;
    tf.watchSecsWrap.hidden = watchMode !== 'poll';
    let now;
    if (watchMode === 'off') now = tr('templates.watch.off');
    else if (!linkedHandle || linkedAccess !== 'granted') now = tr('templates.watch.waiting');
    else if (observer) now = tr('templates.watch.observing');
    else if (watchMode === 'observe' && !canObserve) now = tr('templates.watch.noObserver');
    else if (watchMode === 'observe' && observerBroken) now = tr('templates.watch.failed');
    else if (watchMode === 'observe') now = tr('templates.watch.starting');
    else now = tr('templates.watch.polling', { seconds: watchSecs });
    tf.watchNote.textContent = now;
    checkFileBtn.hidden = !linkedHandle;
  }
  // Check file (top bar): one check on demand, whatever the watch setting, with the same notice. As a click, it can
  // also ask the browser for access, so after a browser restart it reconnects the file too.
  const checkFileBtn = document.getElementById('btn-checkfile');
  async function checkFileNow() {
    if (!linkedHandle) { toast(tr('toast.linkFirst')); return; }
    try {
      if (!(await checkAccess(true))) { toast(tr('toast.readRefused')); renderWatchStatus(); return; }
      const before = linkedText, noticeBefore = fileChange;
      const text = await readLinked();
      if (!exportEl.hidden) renderTemplatesFile();
      scheduleWatch();
      const n = fileTemplates ? fileTemplates.length : 0;
      if (before == null) toast(tr('toast.connected', { file: linkedHandle.name, count: n }));
      else if (text === before) toast(tr('toast.noChanges'));
      else if (fileChange === noticeBefore) toast(tr('toast.rewrittenSame'));
    } catch (err) { toast(err.message || String(err)); }
  }
  checkFileBtn.addEventListener('click', () => { checkFileNow(); checkFileBtn.blur(); });
  function setWatch(mode, secs) {
    if (mode) watchMode = mode;
    const n = Number(secs);
    if (secs != null && Number.isFinite(n) && n >= 1) watchSecs = Math.min(WATCH_MAX, Math.round(n));
    try { localStorage.setItem('esp.watchMode', watchMode); localStorage.setItem('esp.watchSecs', String(watchSecs)); } catch { /* storage unavailable */ }
    observerBroken = false;
    stopObserver();
    scheduleWatch();
  }
  tf.watchMode.addEventListener('change', () => { setWatch(tf.watchMode.value); tf.watchMode.blur(); });
  tf.watch.addEventListener('change', () => setWatch(null, tf.watch.value));
  tf.watch.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tf.watch.blur(); } });
  tf.watchLimits.textContent = tr(canObserve ? 'templates.watch.limits' : 'templates.watch.limitsNoObserver');
  renderWatchStatus();
  document.getElementById('tf-watch-row').hidden = !canWriteFiles; // read-only browsers can't watch the file
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) observerBroken = false; // worth trying the observer again after a break
    scheduleWatch();
    if (!document.hidden) pollLinked();
  });
  window.addEventListener('focus', pollLinked);
  fileNotice.load.addEventListener('click', () => {
    const cur = fileChange && fileChange.current;
    closeFileNotice();
    if (cur && cur.t) loadTemplate(cur.t, msg => toast(msg));
  });
  fileNotice.open.addEventListener('click', () => { closeFileNotice(); toggleExport(true); });
  fileNotice.dismiss.addEventListener('click', closeFileNotice);
  // Makes h the linked file (remembered for later visits) and reads it.
  async function adoptLinked(h, remember = true) {
    linkedHandle = h;
    linkedText = null; // a new link: its first read isn't a change
    stopObserver(); clearInterval(watchTimer); watchTimer = 0; observerBroken = false;
    closeFileNotice();
    if (remember) await rememberHandle(h);
    if (await checkAccess(true)) await readLinked();
  }
  async function linkFile() {
    try {
      const opts = { types: [{ description: tr('templates.file.pickerType'), accept: { 'application/json': ['.data', '.json'] } }], multiple: false };
      if (linkedHandle) opts.startIn = linkedHandle;
      const [h] = await window.showOpenFilePicker(opts);
      await adoptLinked(h);
      exportStatus('');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      fileTemplates = null;
      exportStatus(err.message || String(err), 'err');
    }
    renderTemplatesFile();
  }
  // Create templates file: an empty templates file in <planner>/savedTemplates/, linked at once. The browser can't
  // find the planner's folder by itself, so the user picks it once; the handle is kept in IndexedDB ('plannerDir').
  const SAVED_TEMPLATES_DIR = 'savedTemplates';
  const canCreateFiles = canWriteFiles && typeof window.showDirectoryPicker === 'function';
  async function isPlannerDir(dir) {
    try { await (await dir.getDirectoryHandle('web')).getFileHandle('app.js'); return true; } catch { return false; }
  }
  async function plannerDir() {
    const saved = await handleStore('readonly', s => s.get('plannerDir')).catch(() => null);
    if (saved) {
      let p = await saved.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted') p = await saved.requestPermission({ mode: 'readwrite' });
      if (p === 'granted') return saved;
    }
    const dir = await window.showDirectoryPicker({ id: 'esp-planner', mode: 'readwrite' });
    if (!(await isPlannerDir(dir))) {
      throw new Error(tr('templates.create.notPlanner', { folder: dir.name }));
    }
    await handleStore('readwrite', s => s.put(dir, 'plannerDir')).catch(() => {});
    return dir;
  }
  async function freeFileName(dir) {
    const dot = TEMPLATE_FILE.indexOf('.');
    for (let n = 1; ; n++) {
      const name = n === 1 ? TEMPLATE_FILE : `${TEMPLATE_FILE.slice(0, dot)} (${n})${TEMPLATE_FILE.slice(dot)}`;
      try { await dir.getFileHandle(name); } catch (err) { if (err && err.name === 'NotFoundError') return name; throw err; }
    }
  }
  // testDir (plannerTemplatesTest.create) stands in for the picked folder, and the link isn't remembered.
  async function createTemplatesFile(testDir) {
    if (testDir instanceof Event) testDir = null;
    try {
      const root = testDir || await plannerDir();
      if (testDir && !(await isPlannerDir(root))) throw new Error(tr('templates.create.notPlannerShort', { folder: root.name }));
      const sub = await root.getDirectoryHandle(SAVED_TEMPLATES_DIR, { create: true });
      const name = await freeFileName(sub);
      const h = await sub.getFileHandle(name, { create: true });
      const w = await h.createWritable();
      await w.write(JSON.stringify({ v: 1, templates: [] }, null, 2));
      await w.close();
      await adoptLinked(h, !testDir);
      exportStatus(tr('templates.create.done', { path: `${SAVED_TEMPLATES_DIR}\\${name}` }), 'ok');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      exportStatus(err.message || String(err), 'err');
    }
    renderTemplatesFile();
  }

  async function reconnect() {
    try { if (await checkAccess(true)) await readLinked(); } catch (err) { fileTemplates = null; exportStatus(err.message || String(err), 'err'); }
    renderTemplatesFile();
  }
  async function reloadLinked() {
    try {
      if (linkedHandle) { if (await checkAccess(false)) await readLinked(); }
      else if (openedFile) fileTemplates = parseTemplateFile(openedFile.text);
      exportStatus('');
    } catch (err) { fileTemplates = null; exportStatus(err.message || String(err), 'err'); }
    renderTemplatesFile();
  }
  async function forgetLinked() {
    linkedHandle = null; linkedAccess = 'none'; fileTemplates = null; openedFile = null;
    linkedText = null;
    closeFileNotice();
    scheduleWatch(); // nothing to watch: stops the observer or timer
    await rememberHandle(null);
    renderTemplatesFile();
  }

  // --- rendering
  function exportStatus(msg, kind) { tpl.status.textContent = msg; tpl.status.className = kind || ''; }
  function renderTemplatesFile() {
    const linked = !!linkedHandle;
    if (canWriteFiles) {
      tf.status.innerHTML = linked
        ? trHtml(linkedAccess === 'prompt' ? 'templates.file.linkedPrompt' : 'templates.file.linked', { file: linkedHandle.name })
        : trHtml('templates.file.none');
      tf.link.textContent = tr(linked ? 'templates.file.linkOther' : 'templates.file.link');
      tf.link.classList.toggle('primary', !linked);
      tf.create.hidden = !canCreateFiles;
      tf.reconnect.hidden = !(linked && linkedAccess === 'prompt');
      tf.reload.hidden = !(linked && linkedAccess === 'granted');
      tf.forget.hidden = !linked;
      tf.note.textContent = linked ? '' : tr('templates.file.note', { file: TEMPLATE_FILE });
    } else {
      tf.status.innerHTML = openedFile ? trHtml('templates.file.opened', { file: openedFile.name }) : trHtml('templates.file.noneOpened');
      tf.link.textContent = tr(openedFile ? 'templates.file.openOther' : 'templates.file.open');
      tf.create.hidden = true;
      tf.reconnect.hidden = true;
      tf.reload.hidden = true;
      tf.forget.hidden = !openedFile;
      tf.note.textContent = tr('templates.file.readOnly');
    }
    renderTemplateList();
    refreshExport();
  }
  function renderTemplateList() {
    if (!fileTemplates) {
      tf.list.innerHTML = `<p class="muted">${esc(tr(linkedHandle && linkedAccess === 'prompt' ? 'templates.list.reconnect' : 'templates.list.link'))}</p>`;
      return;
    }
    const usable = fileTemplates.map((t, i) => ({ t, i })).filter(({ t }) => t && typeof t === 'object' && t.root && t.name);
    if (!usable.length) { tf.list.innerHTML = `<p class="muted">${esc(tr('templates.list.empty'))}</p>`; return; }
    const groups = new Map();
    for (const u of usable) {
      const root = currentNodeId(u.t.root);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(u);
    }
    // Templates for the current root first.
    const order = [...groups.keys()].sort((a, b) => (b === state.root) - (a === state.root) || String(a).localeCompare(String(b)));
    let html = '';
    for (const root of order) {
      const rn = byId.get(root);
      html += `<div class="group">${esc(tr(root === state.root ? 'templates.list.groupCurrent' : 'templates.list.group', { root: rn ? rn.type.name : root }))}</div><table>`;
      for (const { t, i } of groups.get(root).sort((a, b) => String(a.t.name).localeCompare(String(b.t.name)))) {
        const steps = Array.isArray(t.steps) ? t.steps.length : 0;
        const hull = HULL_FROM_ENUM[t.hull] ? hullLabelFor(HULL_FROM_ENUM[t.hull]) : '';
        html += `<tr><td>${esc(t.name)}</td><td class="num">${esc(tr('templates.summary.steps', { count: steps }))}${hull ? ' · ' + esc(hull) : ''}</td>` +
          `<td><button data-code="${i}" title="${esc(tr('templates.list.codeTitle'))}">${esc(tr('templates.list.code'))}</button> ` +
          `<button data-load="${i}" title="${esc(tr('templates.list.loadTitle'))}">${esc(tr('templates.list.load'))}</button></td></tr>`;
      }
      html += '</table>';
    }
    tf.list.innerHTML = html;
  }
  function refreshExport() {
    if (!state.root) tpl.summary.textContent = tr('common.chooseRoot');
    else {
      const steps = templateSteps(), anchors = Object.keys(templateAnchors()).length, marks = templateMarks().length;
      // Its parts, joined with " · ".
      const parts = [tr('templates.summary.root', { root: byId.get(state.root).type.name }), hullLabel(), tr('templates.summary.steps', { count: steps.length })];
      if (anchors) parts.push(tr('templates.summary.anchors', { count: anchors }));
      if (marks) parts.push(tr('templates.summary.marks', { marks }));
      const i = fileTemplates && tpl.name.value.trim() ? findTemplateIndex(fileTemplates, tpl.name.value) : -1;
      if (i >= 0) {
        const h = fileTemplates[i].hull;
        parts.push(!HULL_ENUM_VALUES.has(h) ? tr('templates.summary.replacesAny')
          : tr(h !== HULL_ENUM[state.hull] ? 'templates.summary.replacesAsk' : 'templates.summary.replaces', { hull: HULL_ENUM_LABEL[h] }));
      }
      tpl.summary.textContent = parts.join(' · ');
    }
    if (canWriteFiles) {
      tpl.save.disabled = !(linkedHandle && linkedAccess === 'granted');
      tpl.save.textContent = linkedHandle ? tr('templates.save', { file: linkedHandle.name }) : tr('templates.saveLinked');
      tpl.saveNote.textContent = !linkedHandle ? tr('templates.save.linkFirst')
        : linkedAccess !== 'granted' ? tr('templates.save.reconnect') : '';
    } else {
      tpl.save.hidden = true;
      tpl.saveNote.textContent = '';
    }
  }

  // --- import
  const HULL_FROM_ENUM = Object.fromEntries(Object.entries(HULL_ENUM).map(([k, v]) => [v, k]));
  const hullLabelFor = h => HULL_IN_SENTENCE[h];
  const anchorById = new Map((D.wormholeAnchors || []).map(a => [a.id, a]));
  // Old node and option ids map to current ones the way the mod reads them (NodeReplacements, AffinityOptions).
  function currentNodeId(id) {
    if (!id || byId.has(id)) return id;
    let c = id;
    for (let hop = 0; hop < 50; hop++) {
      c = D.nodeRenames && D.nodeRenames[c];
      if (!c) return id;
      if (byId.has(c)) return c;
    }
    return id;
  }
  function currentOptionId(opt) {
    if (!opt) return null;
    const o = (D.retiredOptions && D.retiredOptions[opt]) || opt;
    if (types.has(o)) return o;
    const r = D.typeRenames && D.typeRenames[o];
    return r && types.has(r) ? r : o;
  }
  // Replaces the build with a template: steps are taken in order with the planner's rules, a wormhole brings its
  // partner, a socket with an anchor links its exit. Returns what happened, for the status line.
  function importTemplate(t) {
    const root = currentNodeId(t.root);
    if (!byId.has(root) || byId.get(root).tier !== 'ROOT') throw new Error(tr('templates.load.unknownRoot', { name: t.name, root: t.root }));
    const entries = (Array.isArray(t.steps) ? t.steps : []).map(s => String(s).trim()).filter(Boolean).map(s => {
      const k = s.indexOf('=');
      return k < 0 ? { id: currentNodeId(s), opt: null } : { id: currentNodeId(s.slice(0, k)), opt: currentOptionId(s.slice(k + 1)) || null };
    });
    const anchors = new Map();
    for (const [socket, aid] of Object.entries(t.anchors || {})) { const a = anchorById.get(String(aid).trim()); if (a) anchors.set(currentNodeId(socket), a.exit); }
    pushUndo();
    state.root = root; state.alloc.clear(); state.choice.clear(); state.links.clear(); state.subs.clear(); state.integrated.clear(); state.template = null;
    if (HULL_FROM_ENUM[t.hull]) state.hull = HULL_FROM_ENUM[t.hull];
    const turnedOn = [];
    // Show any hidden optional volume the template uses, so its steps can land.
    const usedVolumes = new Set([...entries.map(e => byId.get(e.id)?.volume), ...[...anchors.values()].map(x => byId.get(x)?.volume)]);
    for (const g of OPTIONAL_VOLUMES) {
      if (state.hiddenVolumes.has(g.id) && g.volumes.some(v => usedVolumes.has(v))) { state.hiddenVolumes.delete(g.id); turnedOn.push(g.name); }
    }
    const unknown = entries.filter(e => !byId.has(e.id)).map(e => e.id);
    let pending = entries.filter(e => byId.has(e.id));
    // Steps the rules refuse are skipped, as the game skips them when it applies a template.
    const placed = [entryFor(byId.get(root), null)];
    const refused = [];
    // Repeat passes so a step listed before the node it hangs off still lands; the mod's own order needs one pass.
    for (let progress = true; progress && pending.length;) {
      progress = false;
      const next = [];
      for (const e of pending) {
        const n = byId.get(e.id);
        if (sat(n.id)) { progress = true; continue; }
        const p = partnerOf(n);
        const ok = n.tier === 'WORMHOLE_EXIT' ? !!(p && sat(p.id)) : (n.adj.length === 0 || n.adj.some(m => sat(m.id)));
        if (!ok || switchedOff(n)) { next.push(e); continue; }
        const opt = isChoice(n) ? (e.opt && n.type.options.includes(e.opt) ? e.opt : defaultOption(n)) : null;
        const b = blockOf(n, opt, placed);
        if (b) { refused.push({ node: n, block: b }); progress = true; continue; }
        state.alloc.add(n.id);
        placed.push(entryFor(n, opt));
        if (opt) state.choice.set(n.id, opt);
        if (n.tier === 'SOCKET' && anchors.has(n.id)) {
          const exit = anchors.get(n.id);
          if (byId.has(exit) && !linkedSocketOf(exit) && !blockOf(byId.get(exit), null, placed)) {
            state.links.set(n.id, exit); state.alloc.add(exit); placed.push(entryFor(byId.get(exit), null));
          }
        }
        const partner = partnerOf(n);
        if (partner && !sat(partner.id)) { state.alloc.add(partner.id); placed.push(entryFor(partner, null)); }
        progress = true;
      }
      pending = next;
    }
    // Integration marks on nodes that landed and can be integrated become the build's integrations.
    const marks = (Array.isArray(t.integrate) ? t.integrate : []).map(id => currentNodeId(String(id).trim())).filter(id => byId.has(id));
    for (const id of marks) if (canIntegrate(byId.get(id))) state.integrated.add(id);
    return { name: t.name, taken: state.alloc.size, unknown, unplaced: pending.map(e => e.id), turnedOn, refused, integrated: state.integrated.size, marks: marks.length };
  }
  // Loads a template (from the file or a code) into the planner and reports through `report(message, kind)`.
  function loadTemplate(t, report, extraNote) {
    try {
      const r = importTemplate(t);
      tpl.name.value = [...String(t.name).trim()].slice(0, TEMPLATE_NAME_MAX).join(''); // saving again under this name replaces it
      state.template = { name: tpl.name.value, sig: templateSig() };
      changed();
      const notes = [];
      if (extraNote) notes.push(extraNote);
      if (badNameChars(tpl.name.value).length) notes.push(tr('templates.load.badName'));
      if (r.unknown.length) notes.push(tr('templates.load.unknown', { count: r.unknown.length }));
      if (r.refused.length) {
        const f = r.refused[0];
        notes.push(tr('templates.load.refused', { count: r.refused.length, node: effectiveType(f.node).name, reason: f.block.text.replace(/\.$/, '') }));
      }
      if (r.unplaced.length) notes.push(tr('templates.load.unplaced', { count: r.unplaced.length }));
      if (r.turnedOn.length) notes.push(tr('templates.load.shown', { volumes: r.turnedOn.join(tr('common.listAnd')) }));
      if (r.integrated) notes.push(tr('templates.load.integrated', { count: r.integrated }));
      if (r.marks > r.integrated) notes.push(tr('templates.load.marksLost', { count: r.marks - r.integrated }));
      if (used() > state.cap) notes.push(tr('templates.load.overCap', { used: used(), cap: state.cap }));
      report(notes.length ? tr('templates.loadedNotes', { name: r.name, taken: r.taken, notes: notes.join(tr('templates.load.noteJoin')) })
        : tr('templates.loaded', { name: r.name, taken: r.taken }), notes.length ? '' : 'ok');
      renderTemplateList();
      refreshExport();
      return true;
    } catch (err) { report(err.message || String(err), 'err'); return false; }
  }
  tf.list.addEventListener('click', async e => {
    const load = e.target.closest('[data-load]');
    const code = e.target.closest('[data-code]');
    if (!fileTemplates || (!load && !code)) return;
    if (load) { loadTemplate(fileTemplates[+load.dataset.load], exportStatus); return; }
    const t = fileTemplates[+code.dataset.code];
    showCode(await templateToCode(t), tr('templates.code.label', { name: t.name }));
  });

  // --- template codes
  const codeBox = document.getElementById('code-box');
  const codeStatusEl = document.getElementById('code-status');
  function codeStatus(msg, kind) { codeStatusEl.textContent = msg; codeStatusEl.className = kind || ''; }
  async function showCode(code, label) {
    codeBox.value = code;
    codeBox.scrollIntoView({ block: 'nearest' });
    let copied = false;
    try { await navigator.clipboard.writeText(code); copied = true; } catch { /* clipboard blocked; the box has it */ }
    codeBox.focus(); codeBox.select();
    codeStatus(tr(copied ? 'templates.code.copied' : 'templates.code.inBox', { label, length: code.length }), 'ok');
    toast(copied ? tr('toast.labelCopied', { label }) : tr('toast.clipboardBlocked'));
  }
  document.getElementById('code-copy').addEventListener('click', async () => {
    if (!state.root) { codeStatus(tr('common.chooseRootFirst'), 'err'); return; }
    const problem = templateNameProblem(tpl.name.value);
    if (problem) { codeStatus(tr('templates.code.nameProblem', { problem }), 'err'); tpl.name.focus(); return; }
    showCode(await templateToCode(buildTemplate(tpl.name.value)), tr('templates.code.label', { name: tpl.name.value.trim() }));
  });
  document.getElementById('code-load').addEventListener('click', async () => {
    try {
      const t = await codeToTemplate(codeBox.value);
      const made = t.mod && D.modVersion && t.mod !== D.modVersion ? tr('templates.load.oldMod', { mod: t.mod, planner: D.modVersion }) : '';
      loadTemplate(t, codeStatus, made);
    } catch (err) { codeStatus(err.message || String(err), 'err'); }
  });
  codeBox.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); document.getElementById('code-load').click(); } });
  codeBox.addEventListener('input', () => codeStatus(''));

  // --- open/close
  async function toggleExport(show = exportEl.hidden) {
    exportEl.hidden = !show;
    exportBtn.setAttribute('aria-expanded', String(show));
    if (show) {
      closePicker(); hideTooltip(); toggleKeys(false); if (!storyEl.hidden) toggleStory(false); if (!artEl.hidden) toggleArt(false);
      if (!tpl.name.value) {
        let saved = null;
        try { saved = localStorage.getItem('esp.tplName'); } catch { /* ignore */ }
        tpl.name.value = saved || (state.root ? tr('templates.defaultName', { root: byId.get(state.root).type.name }) : tr('templates.defaultNameNoRoot'));
      }
      exportStatus('');
      renderTemplatesFile();
      tpl.name.focus(); tpl.name.select();
      // Re-read the linked file each time the dialog opens, like the game does, so in-game edits show up.
      if (linkedHandle) { try { if (await checkAccess(false)) await readLinked(); } catch { fileTemplates = null; } renderTemplatesFile(); }
    } else {
      hideConflict();
      if (exportEl.contains(document.activeElement)) exportBtn.focus();
    }
  }

  // --- export
  // Common checks; returns the name to use or null after showing why not.
  function readyToExport() {
    if (!state.root) { exportStatus(tr('common.chooseRootFirst'), 'err'); return null; }
    const problem = templateNameProblem(tpl.name.value);
    if (problem) { exportStatus(problem, 'err'); tpl.name.focus(); return null; }
    try { localStorage.setItem('esp.tplName', tpl.name.value.trim()); } catch { /* ignore */ }
    return tpl.name.value.trim();
  }
  function reportMerge(result, file) {
    setCurrentTemplate(result.template.name);
    exportStatus(tr(result.replaced ? 'templates.saved.replaced' : 'templates.saved.added',
      { name: result.template.name, steps: result.template.steps.length, file, count: result.count }), 'ok');
  }
  function download(text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = TEMPLATE_FILE;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // --- saving into an existing file, asking first when it would overwrite a template (with the hull question when
  // the template was saved for another hull size)
  const conflict = {
    box: document.getElementById('tpl-conflict'),
    msg: document.getElementById('tpl-conflict-msg'),
    keep: document.getElementById('tpl-keep'),
    change: document.getElementById('tpl-change'),
    newName: document.getElementById('tpl-newname'),
    asNew: document.getElementById('tpl-asnew'),
    cancel: document.getElementById('tpl-cancel'),
  };
  let pendingSave = null; // { name } of the save waiting on the question
  function hideConflict() { conflict.box.hidden = true; pendingSave = null; }

  // text: the linked file as just read.
  function startSave(text) {
    hideConflict();
    const name = readyToExport();
    if (!name) return;
    const plan = planMerge(text, name);
    if (!plan.existing) { commitSave(name, 'keep'); return; }
    pendingSave = { name };
    if (plan.hullConflict) {
      const from = HULL_ENUM_LABEL[plan.existingHull], to = HULL_ENUM_LABEL[HULL_ENUM[state.hull]];
      conflict.msg.textContent = tr('templates.conflict.hull', { name: plan.existing.name, from, to });
      conflict.keep.textContent = tr('templates.conflict.keep', { hull: from });
      conflict.change.textContent = tr('templates.conflict.change', { hull: to });
      conflict.change.hidden = false;
    } else {
      // Same name and root, same hull: ask before overwriting it.
      conflict.msg.textContent = tr('templates.conflict.override', { name: plan.existing.name, root: byId.get(state.root).type.name });
      conflict.keep.textContent = tr('templates.conflict.overrideButton');
      conflict.change.hidden = true;
    }
    conflict.newName.value = uniqueTemplateName(name, plan.list);
    conflict.box.hidden = false;
    conflict.box.scrollIntoView({ block: 'nearest' });
    conflict.keep.focus();
    exportStatus('');
  }
  // mode: 'keep' | 'change' (hull of the template being replaced) or 'new' (add under saveName, which must be free).
  async function commitSave(saveName, mode) {
    try {
      if (!(await checkAccess(true))) { exportStatus(tr('templates.writeRefused'), 'err'); renderTemplatesFile(); return; }
      const text = await readLinked(); // re-read so changes the game made meanwhile aren't lost
      if (mode === 'new') {
        const problem = templateNameProblem(saveName);
        if (problem) { exportStatus(problem, 'err'); conflict.newName.focus(); return; }
        if (findTemplateIndex(parseTemplateFile(text), saveName) >= 0) {
          exportStatus(tr('templates.nameTaken', { name: saveName.trim() }), 'err');
          conflict.newName.focus();
          return;
        }
      }
      const result = mergeTemplate(text, saveName, mode === 'keep' ? 'keep' : 'change');
      linkedWriting = true; // the planner's own save isn't a change from outside
      try {
        const w = await linkedHandle.createWritable();
        await w.write(result.text);
        await w.close();
        const f = await linkedHandle.getFile();
        linkedText = result.text;
        linkedStamp = `${f.lastModified}:${f.size}`;
      } finally { linkedWriting = false; }
      fileTemplates = JSON.parse(result.text).templates;
      reportMerge(result, linkedHandle.name);
      if (mode === 'new') {
        tpl.name.value = result.template.name; // later saves go to the new template
        try { localStorage.setItem('esp.tplName', result.template.name); } catch { /* ignore */ }
      }
      hideConflict();
      renderTemplateList();
      refreshExport();
    } catch (err) {
      exportStatus(err && err.message ? err.message : String(err), 'err');
    }
  }
  conflict.keep.addEventListener('click', () => { if (pendingSave) commitSave(pendingSave.name, 'keep'); });
  conflict.change.addEventListener('click', () => { if (pendingSave) commitSave(pendingSave.name, 'change'); });
  conflict.asNew.addEventListener('click', () => { if (pendingSave) commitSave(conflict.newName.value, 'new'); });
  conflict.newName.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); conflict.asNew.click(); } });
  conflict.cancel.addEventListener('click', () => { hideConflict(); exportStatus(tr('templates.nothingSaved')); tpl.name.focus(); });

  async function saveIntoLinked() {
    if (!readyToExport() || !linkedHandle) return;
    try {
      if (!(await checkAccess(true))) { exportStatus(tr('templates.writeRefused'), 'err'); renderTemplatesFile(); return; }
      startSave(await readLinked());
    } catch (err) {
      exportStatus(err && err.message ? err.message : String(err), 'err');
    }
  }
  tf.link.addEventListener('click', () => {
    if (canWriteFiles) { linkFile(); return; }
    pendingFileAction = 'open';
    tpl.file.value = '';
    tpl.file.click();
  });
  tf.create.addEventListener('click', createTemplatesFile);
  tf.reconnect.addEventListener('click', reconnect);
  tf.reload.addEventListener('click', reloadLinked);
  tf.forget.addEventListener('click', forgetLinked);
  tpl.save.addEventListener('click', saveIntoLinked);
  tpl.file.addEventListener('change', async () => {
    const f = tpl.file.files && tpl.file.files[0];
    const action = pendingFileAction;
    pendingFileAction = null;
    if (!f) return;
    try {
      const text = await f.text();
      if (action === 'open') {
        fileTemplates = parseTemplateFile(text);
        openedFile = { name: f.name, text };
        exportStatus('');
        renderTemplatesFile();
      }
    } catch (err) { exportStatus(err.message || String(err), 'err'); }
  });
  document.getElementById('tpl-new').addEventListener('click', () => {
    const name = readyToExport();
    if (!name) return;
    const result = mergeTemplate('', name);
    download(result.text);
    exportStatus(tr('templates.downloaded', { file: TEMPLATE_FILE, name }), 'ok');
  });
  guardNameInput(tpl.name, exportStatus);
  guardNameInput(conflict.newName, exportStatus);
  tpl.name.addEventListener('input', () => {
    if (tpl.name.dataset.cleaned) delete tpl.name.dataset.cleaned; else exportStatus('');
    hideConflict(); refreshExport();
  });
  tpl.name.addEventListener('keydown', e => { if (e.key === 'Enter' && !tpl.save.disabled && !tpl.save.hidden) saveIntoLinked(); });
  exportBtn.addEventListener('click', () => toggleExport());
  els.tplGroup.addEventListener('click', () => toggleExport(true));
  document.getElementById('export-close').addEventListener('click', () => toggleExport(false));
  document.addEventListener('pointerdown', e => {
    if (!exportEl.hidden && !exportEl.contains(e.target) && e.target !== exportBtn) toggleExport(false);
  });
  // Debug/testing: show a file's templates without linking (the picker needs a real click).
  // link(handle) links a stand-in file handle (getFile, queryPermission, createWritable) so the watcher can be tested;
  // poll() runs one watcher check.
  window.plannerTemplatesTest = Object.assign(text => { fileTemplates = parseTemplateFile(text); renderTemplatesFile(); }, {
    startSave,
    link: async h => {
      linkedHandle = h; linkedText = null; stopObserver(); clearInterval(watchTimer); watchTimer = 0; observerBroken = false; closeFileNotice();
      if (await checkAccess(false)) await readLinked();
      renderTemplatesFile();
    },
    poll: pollLinked,
    create: dir => createTemplatesFile(dir),
    watch: () => ({ mode: watchMode, secs: watchSecs, observing: !!observer, timer: !!watchTimer, broken: observerBroken, canObserve }),
    setWatch,
  });
  // Restore the linked file from the last visit (access is re-granted with one click when needed).
  if (canWriteFiles && window.indexedDB) {
    recallHandle().then(async h => {
      if (!h) return;
      linkedHandle = h;
      try { if (await checkAccess(false)) await readLinked(); } catch { fileTemplates = null; }
      renderWatchStatus(); // shows Check file, which can reconnect if access lapsed
      if (!exportEl.hidden) renderTemplatesFile();
    });
  }

  // ------------------------------------------------------------------ mod art (the Mod art dialog)
  // The art is read from the user's own Exiled Sector folder (see setArt). Chrome and Edge keep the folder's handle in
  // IndexedDB, so it only needs a click to reconnect after a browser restart. Other browsers have no folder handles:
  // they use a folder input, picked again each visit. Only the images in artPaths() are read; nothing is written.
  const artEl = document.getElementById('art');
  const artBtn = document.getElementById('btn-art');
  const artUi = {
    status: document.getElementById('art-status'),
    choose: document.getElementById('art-choose'),
    reconnect: document.getElementById('art-reconnect'),
    forget: document.getElementById('art-forget'),
    note: document.getElementById('art-note'),
    browser: document.getElementById('art-browser'),
    files: document.getElementById('art-files'),
  };
  const canPickFolder = typeof window.showDirectoryPicker === 'function';
  let artHandle = null;   // FileSystemDirectoryHandle the user picked (Chrome/Edge)
  let artAccess = 'none'; // 'none' | 'prompt' (needs a click) | 'loading' | 'ready'
  let artInfo = null;     // { folder, version, count } of the art on show
  let artError = '';
  let artGen = 0;         // drops a slow read when a newer pick has started

  const rememberArt = h => handleStore('readwrite', s => (h ? s.put(h, 'modFolder') : s.delete('modFolder'))).catch(() => {});
  const recallArt = () => handleStore('readonly', s => s.get('modFolder')).catch(() => null);

  // mod_info.json is loose JSON (the game allows comments), so read the two fields by pattern.
  function parseModInfo(text) {
    const id = (/"id"\s*:\s*"([^"]+)"/.exec(text) || [])[1];
    if (!id || id.toLowerCase() !== 'exiledsector') return null;
    const vs = /"version"\s*:\s*"([^"]+)"/.exec(text);
    const vo = /"version"\s*:\s*\{\s*"major"\s*:\s*"?(\d+)"?\s*,\s*"minor"\s*:\s*"?(\d+)"?\s*,\s*"patch"\s*:\s*"?([\w.-]+)"?/.exec(text);
    return { version: vs ? vs[1] : vo ? `${vo[1]}.${vo[2]}.${vo[3]}` : '' };
  }
  // A child entry by name, falling back to a case-insensitive match (the game runs on case-insensitive file systems).
  async function child(dir, name, kind) {
    try { return kind === 'file' ? await dir.getFileHandle(name) : await dir.getDirectoryHandle(name); }
    catch (e) { if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e; }
    const low = name.toLowerCase();
    for await (const h of dir.values()) if (h.kind === kind && h.name.toLowerCase() === low) return h;
    return null;
  }
  async function readModInfo(dir) {
    const h = await child(dir, 'mod_info.json', 'file');
    return h ? parseModInfo(await (await h.getFile()).text()) : null;
  }
  // The mod's folder: the one picked, or one inside it (so the Starsector folder or its mods folder also work).
  async function findModDir(dir) {
    const info = await readModInfo(dir);
    if (info) return { dir, info };
    const inside = async parent => {
      for await (const h of parent.values()) {
        if (h.kind !== 'directory') continue;
        const i = await readModInfo(h);
        if (i) return { dir: h, info: i };
      }
      return null;
    };
    const mods = await child(dir, 'mods', 'directory');
    return (mods && await inside(mods)) || await inside(dir);
  }
  // findModDir looks in the folder itself, its mods folder and each folder inside it.
  const notModFolder = () => new Error(tr('assets.notModFolder'));
  // Reads every image the planner draws from a folder handle. Resolves to { urls, info } or throws.
  async function readArtFolder(handle) {
    const found = await findModDir(handle);
    if (!found) throw notModFolder();
    const dirs = new Map([['', Promise.resolve(found.dir)]]);
    const dirAt = path => {
      if (!dirs.has(path)) {
        const cut = path.lastIndexOf('/');
        const parent = cut < 0 ? '' : path.slice(0, cut);
        dirs.set(path, dirAt(parent).then(d => d && child(d, path.slice(cut + 1), 'directory')));
      }
      return dirs.get(path);
    };
    const paths = artPaths(), urls = new Map();
    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const p = paths[next++];
        const cut = p.lastIndexOf('/');
        const d = await dirAt(cut < 0 ? '' : p.slice(0, cut));
        const h = d && await child(d, p.slice(cut + 1), 'file');
        if (h) urls.set(p, URL.createObjectURL(await h.getFile()));
      }
    };
    try { await Promise.all(Array.from({ length: 8 }, worker)); }
    catch (e) { for (const u of urls.values()) URL.revokeObjectURL(u); throw e; }
    return { urls, info: { folder: found.dir.name, version: found.info.version, count: urls.size } };
  }
  // The same from a folder input's file list (browsers without folder handles).
  async function readArtFiles(files) {
    const list = [...files];
    const rel = f => f.webkitRelativePath || f.name;
    const infos = list.filter(f => /(^|\/)mod_info\.json$/i.test(rel(f))).sort((a, b) => rel(a).length - rel(b).length);
    let prefix = null, info = null, folder = '';
    for (const f of infos) {
      info = parseModInfo(await f.text());
      if (info) { const p = rel(f).slice(0, -'mod_info.json'.length); prefix = p.toLowerCase(); folder = p.replace(/\/$/, '').split('/').pop(); break; }
    }
    if (prefix === null) throw notModFolder();
    const byPath = new Map();
    for (const f of list) { const r = rel(f).toLowerCase(); if (r.startsWith(prefix)) byPath.set(r.slice(prefix.length), f); }
    const urls = new Map();
    for (const p of artPaths()) { const f = byPath.get(p.toLowerCase()); if (f) urls.set(p, URL.createObjectURL(f)); }
    return { urls, info: { folder, version: info.version, count: urls.size } };
  }

  function showArt(result) {
    if (!result.urls.size) throw new Error(tr('assets.noImages', { folder: result.info.folder }));
    setArt(result.urls);
    artInfo = result.info; artAccess = 'ready'; artError = '';
    renderArt(); renderPanel();
  }
  // Runs one read (a pick or a reconnect). On failure, whatever art was showing stays.
  async function runArtRead(read, onDone) {
    const gen = ++artGen;
    const before = artAccess;
    artAccess = 'loading'; artError = ''; renderArt();
    try {
      const result = await read();
      if (gen !== artGen) { for (const u of result.urls.values()) URL.revokeObjectURL(u); return false; }
      showArt(result);
      if (onDone) onDone();
      return true;
    } catch (e) {
      if (gen !== artGen) return false;
      artAccess = artInfo ? 'ready' : before === 'loading' ? 'none' : before;
      artError = e && e.message ? e.message : String(e);
      renderArt();
      return false;
    }
  }
  // The remembered folder: read it if access is granted, ask for access when `request` (needs a click).
  async function connectArt(request) {
    if (!artHandle) return false;
    let p = 'prompt';
    try {
      p = await artHandle.queryPermission({ mode: 'read' });
      if (p !== 'granted' && request) p = await artHandle.requestPermission({ mode: 'read' });
    } catch { /* treated as needing a click */ }
    if (p !== 'granted') { artAccess = 'prompt'; renderArt(); return false; }
    return runArtRead(() => readArtFolder(artHandle));
  }
  async function chooseArtFolder() {
    if (!canPickFolder) { artUi.files.value = ''; artUi.files.click(); return; }
    let h;
    try { h = await window.showDirectoryPicker({ id: 'esp-mod-folder', mode: 'read' }); }
    catch (e) { if (e.name !== 'AbortError') { artError = e.message; renderArt(); } return; }
    await runArtRead(() => readArtFolder(h), () => { artHandle = h; rememberArt(h); });
  }
  artUi.files.addEventListener('change', () => {
    const files = artUi.files.files;
    if (files && files.length) runArtRead(() => readArtFiles(files));
  });
  function forgetArt() {
    artGen++;
    artHandle = null; artInfo = null; artAccess = 'none'; artError = '';
    rememberArt(null);
    setArt(null);
    renderArt(); renderPanel();
  }

  function renderArt() {
    artBtn.textContent = tr(artAccess === 'ready' ? 'assets.button.ready' : artAccess === 'loading' ? 'assets.button.loading' : artAccess === 'prompt' ? 'assets.button.reconnect' : 'assets.button.show');
    artBtn.title = artAccess === 'prompt'
      ? tr('assets.button.reconnectTitle', { folder: artHandle ? artHandle.name : '' })
      : tr('assets.button.title');
    let status;
    if (artAccess === 'loading') status = trHtml('assets.status.reading');
    else if (artInfo) status = trHtml(artInfo.version ? 'assets.status.showing' : 'assets.status.showingNoVersion', { folder: artInfo.folder, version: artInfo.version, count: artInfo.count });
    else if (artAccess === 'prompt') status = trHtml('assets.status.prompt', { folder: artHandle.name });
    else status = trHtml('assets.status.none');
    artUi.status.innerHTML = status;
    const notes = [];
    if (artError) notes.push(`<span class="bad">${esc(artError)}</span>`);
    if (artInfo && artInfo.version && D.modVersion && artInfo.version !== D.modVersion) {
      notes.push(trHtml('assets.versionMismatch', { folderVersion: artInfo.version, treeVersion: D.modVersion }));
    }
    artUi.note.innerHTML = notes.join('<br>');
    artUi.choose.textContent = tr(artInfo || artHandle ? 'assets.chooseOther' : 'assets.choose');
    artUi.choose.disabled = artAccess === 'loading';
    artUi.reconnect.hidden = artAccess !== 'prompt';
    artUi.forget.hidden = !artHandle && !artInfo;
    // Other browsers (folder input) get no note for now: the old one is to be reworded later.
    artUi.browser.textContent = canPickFolder ? tr('assets.restartNote') : '';
    artUi.browser.hidden = !canPickFolder;
  }
  function toggleArt(show = artEl.hidden) {
    artEl.hidden = !show;
    artBtn.setAttribute('aria-expanded', String(show));
    if (show) {
      closePicker(); hideTooltip(); toggleKeys(false); if (!storyEl.hidden) toggleStory(false); if (!exportEl.hidden) toggleExport(false);
      renderArt();
      document.getElementById('art-close').focus();
    } else if (artEl.contains(document.activeElement)) artBtn.focus();
  }
  // In the top bar, a lapsed folder reconnects straight away (the click is what lets the browser ask).
  artBtn.addEventListener('click', () => { if (artAccess === 'prompt') connectArt(true); else toggleArt(); });
  artUi.choose.addEventListener('click', chooseArtFolder);
  artUi.reconnect.addEventListener('click', () => connectArt(true));
  artUi.forget.addEventListener('click', forgetArt);
  document.getElementById('art-close').addEventListener('click', () => toggleArt(false));
  document.addEventListener('pointerdown', e => {
    if (!artEl.hidden && !artEl.contains(e.target) && e.target !== artBtn) toggleArt(false);
  });
  // Restore the folder from the last visit; on a first visit, say once where the art went.
  (async () => {
    const h = canPickFolder && window.indexedDB ? await recallArt() : null;
    if (h) { artHandle = h; await connectArt(false); return; }
    renderArt();
    let told = false;
    try { told = localStorage.getItem('esp.artHint') === '1'; localStorage.setItem('esp.artHint', '1'); } catch { /* storage unavailable */ }
    if (!told) toast('', trHtml('toast.assetsHint'));
  })();
  // Testing: link(handle) reads a stand-in folder handle (getDirectoryHandle, getFileHandle, values, queryPermission,
  // name) as if it had been picked, without remembering it.
  window.plannerArtTest = {
    link: h => runArtRead(() => readArtFolder(h), () => { artHandle = h; }),
    files: list => runArtRead(() => readArtFiles(list)),
    forget: forgetArt,
    // placeholders(true) shows the art-free look without forgetting the folder; placeholders(false) reads it again.
    placeholders: on => (on ? (setArt(null), renderPanel()) : connectArt(false)),
    status: () => ({ access: artAccess, info: artInfo, error: artError, images: artUrls.size }),
  };

  // Letter shortcuts: the typed letter when it's a Latin one (so other layouts keep their own letters), else the physical
  // key, so they also work with a non-Latin input mode on (Korean, for example, types ㅑ on the I key).
  const keyIs = (e, letter) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : '';
    return /^[a-z]$/.test(k) ? k === letter : e.code === 'Key' + letter.toUpperCase();
  };
  // Shortcuts stay off while typing: text boxes, and dropdowns (a letter there picks an option). Checkboxes and buttons
  // don't take letters, so the shortcuts work while one has focus.
  const NO_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']);
  const typingIn = el => el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || !!(el && el.isContentEditable)
    || (el instanceof HTMLInputElement && !NO_TEXT.has(el.type));
  // These dropdowns hand focus back to the page once an option is picked, so the shortcuts work again straight away.
  for (const id of ['hull', 'integ-view', 'listview-sort']) document.getElementById(id)?.addEventListener('change', e => e.target.blur());
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !themeEl.hidden) { toggleThemeFilter(false); return; }
    if (e.key === 'Escape' && !sheetEl.hidden) { toggleSheet(false); return; }
    if (e.key === 'Escape' && !exportEl.hidden) { toggleExport(false); return; }
    if (e.key === 'Escape' && !keysEl.hidden) { toggleKeys(false); return; }
    if (e.key === 'Escape' && !storyEl.hidden) { toggleStory(false); return; }
    if (e.key === 'Escape' && !artEl.hidden) { toggleArt(false); return; }
    if (typingIn(e.target)) return;
    if (CAM_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!keysEl.hidden || !exportEl.hidden || !storyEl.hidden || !artEl.hidden || !sheetEl.hidden || !listEl.hidden || !els.picker.hidden) return; // open lists keep the keys for scrolling
      e.preventDefault();
      camKeys.add(e.key);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && keyIs(e, 'z')) { e.preventDefault(); undo(); return; } // repeats while held, like other apps
    // The toggles below act once per press: a held key's repeats are ignored.
    const plainKey = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (e.repeat && (e.key === '?' || (plainKey && ['s', 't', 'l', 'i'].some(k => keyIs(e, k))))) return;
    if (e.key === '?') { e.preventDefault(); toggleKeys(); }
    else if (e.key === 'Home') frameCore();
    else if (keyIs(e, 's') && !e.ctrlKey && !e.metaKey) togglePanel();
    else if (keyIs(e, 't') && plainKey) setTargetMode(!targets.mode);
    else if (keyIs(e, 'l') && plainKey) setView(listEl.hidden);
    else if (keyIs(e, 'i') && plainKey) { if (hover && state.root && listEl.hidden) toggleIntegration(hover); }
    else if (e.key === 'Escape') { if (!els.picker.hidden) closePicker(); else if (waypoints.length) clearWaypoints(); else if (targets.mode) setTargetMode(false); }
    else if (e.key === '/') { e.preventDefault(); els.search.focus(); }
  });
  window.addEventListener('resize', resize);
  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/b=([A-Za-z0-9_-]+)/);
    if (m) { try { pushUndo(); if (deserialize(b64decode(m[1]))) changed(); } catch { /* ignore */ } }
  });

  // ------------------------------------------------------------------ helpers
  function hexRgb(h) {
    const m = /^#?([0-9a-f]{6})/i.exec(h);
    if (!m) return null;
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  // ------------------------------------------------------------------ start
  try { if (localStorage.getItem('esp.panel') === '0' || window.innerWidth < 720) els.panel.classList.add('closed'); } catch { if (window.innerWidth < 720) els.panel.classList.add('closed'); }
  document.body.classList.toggle('panel-open', !els.panel.classList.contains('closed'));
  loadInitial();
  resize();
  frameCore();
  cachedTotals = totals();
  els.panelFoot.title = tr('panel.foot.title', { mod: modVersionLong, planner: PLANNER_VERSION });
  renderChrome();
  renderPanel();
  requestDraw();

  // Everything that shows text drawn again, for the text editor after it changes a text (web/editor/). Text read once
  // when the page loads (names kept in constants) only changes on a reload.
  function refreshText() {
    applyText();
    els.panelFoot.title = tr('panel.foot.title', { mod: modVersionLong, planner: PLANNER_VERSION });
    renderChrome();
    renderPanel();
    renderTargets();
    renderThemeFilter();
    renderThemeButton();
    renderArt();
    renderFileNotice();
    renderWatchStatus();
    if (!searchTab.hidden) searchTab.textContent = tr('search.tab', { n: searchOrder.length });
    refreshList();
    if (!storyEl.hidden) renderStory();
    if (!exportEl.hidden) refreshExport();
    if (hover) showTooltip(hover, lastMouse.x, lastMouse.y);
    requestDraw();
  }

  // Debug/testing hook.
  window.planner = { state, byId, images, cam, lastChoice, tooltipHtml, refreshText, trHtml,
    click: (id, quick) => primaryAction(byId.get(id), 400, 300, quick),
    pick: (id, opt) => { rememberChoice(byId.get(id), opt); },
    load: json => { deserialize(json); changed(); },
    setVolumeShown, templateSteps, buildTemplate, mergeTemplate, planMerge, uniqueTemplateName, importTemplate, currentNodeId,
    templateToCode, codeToTemplate, pathTo, removalSet, allocate: id => allocate(byId.get(id)), chooseRoot: id => chooseRoot(byId.get(id)), totals, describe, serialize,
    findPath: (id, opt) => findPath(byId.get(id), opt), blockOf: (id, opt) => blockOf(byId.get(id), opt || null, rules().list),
    problems: () => [...rules().problems].map(([id, b]) => ({ id, text: b.text })), setShip, setAffinitySplit,
    waypoints: () => waypoints.map(n => n.id), toggleWaypoint: id => toggleWaypoint(byId.get(id)), clearWaypoints, routeTo: (id, opt) => routeTo(byId.get(id), opt),
    statSheet, toggleSheet, targets, setTargetMode, setTargetKeep, cycleTarget: id => cycleTarget(byId.get(id)), plan: () => currentPlan(), applyPlan,
    toggleIntegration: id => toggleIntegration(byId.get(id)), setAllIntegrated, setIntegView, setIntegPreview, setKeepIntegration, integrationRows: id => integrationRows(effectiveType(byId.get(id))),
    socketSub: (socket, id, extra) => socketSub(byId.get(socket), id, extra), setGrants: (socket, ids) => setGrants(byId.get(socket), ids), subState: () => subState(), typesExclusive: (a, b) => typesExclusive(types.get(a), types.get(b)) };
})();
