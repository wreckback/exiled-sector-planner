/* Exiled Sector skill tree planner.
 * Data comes from data/planner-data.js (tools/extract.ps1 builds it from the mod).
 * Rules follow the mod's AllocationCheck: a node needs an allocated (or starting root) neighbour,
 * wormhole exits are only reached through their partner, and allocating a wormhole takes its partner too. */
(() => {
  'use strict';

  const D = window.PLANNER_DATA;
  if (!D) {
    document.body.innerHTML = '<p style="padding:24px;color:#fc6300">Missing data/planner-data.js. Run tools/extract.ps1 first.</p>';
    return;
  }

  // ------------------------------------------------------------------ constants
  const NODE_SIZE = 64;
  const ICON_INSET = 0.9;
  const TIER_SIZE = { SMALL: 1, NOTABLE: 1, KEYSTONE: 1, WORMHOLE: 1.3, WORMHOLE_EXIT: 1.3, ROOT: 2.5, SOCKET: 1.2 };
  const TIER_LABEL = {
    SMALL: 'Node', NOTABLE: 'Notable', KEYSTONE: 'Keystone', WORMHOLE: 'Wormhole',
    WORMHOLE_EXIT: 'Wormhole exit', ROOT: 'Root', SOCKET: 'Subroutine socket',
  };
  const ROOT_COLOURS = { root_low_tech: [255, 125, 62], root_midline: [255, 212, 112], root_high_tech: [89, 157, 255] };
  const AFFINITY_COLOURS = { LOW_TECH_AFFINITY_FLAT: [226, 154, 72], MIDLINE_AFFINITY_FLAT: [156, 207, 150], HIGH_TECH_AFFINITY_FLAT: [140, 228, 255] };
  const AFFINITY_NAMES = { LOW_TECH_AFFINITY_FLAT: 'Low Tech', MIDLINE_AFFINITY_FLAT: 'Midline', HIGH_TECH_AFFINITY_FLAT: 'High Tech' };
  const ROOT_AFFINITY = { root_low_tech: 'low_tech', root_midline: 'midline', root_high_tech: 'high_tech' };
  const GLOW = [120, 200, 255];
  const DULL = [150, 150, 150];
  const PREVIEW_ADD = [152, 251, 0];
  const PREVIEW_REMOVE = [252, 99, 0];
  const NOTABLE_PINK = [255, 60, 220];
  const NOTABLE_GLOW = [255, 170, 255];
  const DEFAULT_AURORA = [140, 120, 255];
  const SEARCH_GOLD = [255, 211, 77];
  const UNALLOCATED_ALPHA = 0.45;
  const VOLUME_NAMES = {
    core: 'Core', luddic: 'Luddic', pirate: 'Pirate', hegemony: 'Hegemony', persean_league: 'Persean League',
    tritachyon: 'Tri-Tachyon', sindrian_dictat: 'Sindrian Diktat', REDACTED: '[REDACTED]', tania: 'Navarchy of Tania',
    stargazer: 'Stargazer', omega: 'Omega', abyss: 'Abyss', shrouded: 'Shrouded', nightcross: 'Nightcross',
    kesteven: 'Kesteven', exotech: 'Exotech', enigma: 'Enigma', threat: 'Threat',
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
    coreWormholes: true,        // the paired wormholes linking the tech regions
    volumes: true,              // anchor links from sockets to the faction volume exits
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
  // Nodes switched off by the wormhole options: they can't be allocated or travelled through.
  function switchedOff(n) {
    return (n.tier === 'WORMHOLE' && !state.coreWormholes) || (n.tier === 'WORMHOLE_EXIT' && !state.volumes);
  }
  function partnerOf(n) {
    if (switchedOff(n)) return null;
    if (n.pairedWith) return byId.get(n.pairedWith) || null;
    if (n.tier === 'SOCKET') { const e = state.volumes && state.links.get(n.id); return e ? byId.get(e) : null; }
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
  function pathTo(target) {
    if (!state.root || sat(target.id) || switchedOff(target)) return null;
    if (target.tier === 'WORMHOLE_EXIT' && !partnerOf(target)) return null;
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
    state.alloc.clear(); state.choice.clear(); state.links.clear();
    changed();
  }
  // remembered: true picks each choice node on the path from lastChoice (falling back to the root default).
  function allocate(target, option, remembered = false) {
    const path = pathTo(target);
    if (!path) return false;
    if (used() + path.length > state.cap) { toast(`That needs ${path.length} nodes; only ${Math.max(0, state.cap - used())} left under the cap.`); return false; }
    pushUndo();
    // Add in build order (nearest the build first) so allocation order, and exported template steps, read naturally.
    for (const id of [...path].reverse()) {
      state.alloc.add(id);
      const n = byId.get(id);
      if (isChoice(n) && !state.choice.has(id)) {
        const pick = id === target.id && option ? option : remembered && lastChoice.get(n.type.id);
        state.choice.set(id, pick || defaultOption(n));
      }
    }
    changed();
    return true;
  }
  function deallocate(n) {
    if (n.tier === 'WORMHOLE_EXIT') { const s = linkedSocketOf(n.id); if (s) { unlinkSocket(byId.get(s)); return; } }
    const gone = removalSet(n);
    if (!gone) return;
    pushUndo();
    for (const id of gone) { state.alloc.delete(id); state.choice.delete(id); }
    for (const [s, e] of [...state.links]) if (!state.alloc.has(s) || !state.alloc.has(e)) { state.links.delete(s); state.alloc.delete(e); }
    changed();
  }
  function setChoice(n, option) {
    if (state.choice.get(n.id) === option) return;
    pushUndo();
    state.choice.set(n.id, option);
    changed();
  }
  function linkSocket(socket, exit) {
    if (!state.alloc.has(socket.id) || !state.volumes) return;
    const current = state.links.get(socket.id);
    if (current === exit.id) return;
    if (!current && used() + 1 > state.cap) { toast('Linking an anchor takes one more node; you are at the cap.'); return; }
    pushUndo();
    if (current) unlinkInner(socket);
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
  // Drop switched-off nodes (and anchor links when volumes are off), then everything no longer joined to the root.
  // Returns how many nodes were removed.
  function pruneSwitchedOff() {
    const before = state.alloc.size;
    if (!state.volumes) { for (const e of state.links.values()) state.alloc.delete(e); state.links.clear(); }
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
    return before - state.alloc.size;
  }
  function setWormholeOption(key, on) {
    if (state[key] === on) return;
    pushUndo();
    state[key] = on;
    const removed = on ? 0 : pruneSwitchedOff();
    const what = key === 'coreWormholes' ? 'Core wormholes' : 'Faction volumes';
    toast(on ? `${what} on.` : `${what} off.${removed ? ` Removed ${removed} node${removed > 1 ? 's' : ''}; Undo brings them back.` : ''}`);
    changed();
  }
  function resetBuild() {
    pushUndo();
    state.root = null; state.alloc.clear(); state.choice.clear(); state.links.clear();
    changed();
  }

  // ------------------------------------------------------------------ template export
  // Matches the mod's shared template file (SkillTreeTemplateStore / TemplateCodec):
  //   saves/common/exiledSector_skillTreeTemplates.json.data = {"v":1,"templates":[{v,id,name,root,hull,steps,anchors}]}
  // Steps follow TemplateCapture: allocation order, each step joined to the root or an earlier step, a wormhole's
  // partner (or a socket's linked exit) right after it, choice nodes as "node=option", root excluded.
  const TEMPLATE_FILE = 'exiledSector_skillTreeTemplates.json.data';
  const TEMPLATE_NAME_MAX = 32;
  const HULL_ENUM = { frigate: 'FRIGATE', destroyer: 'DESTROYER', cruiser: 'CRUISER', capitalShip: 'CAPITAL_SHIP' };
  const HULL_ENUM_VALUES = new Set(Object.values(HULL_ENUM));
  const HULL_ENUM_LABEL = { FRIGATE: 'Frigate', DESTROYER: 'Destroyer', CRUISER: 'Cruiser', CAPITAL_SHIP: 'Capital' };
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
  function newTemplateId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  function buildTemplate(name, id) {
    const t = { v: 1, id: id || newTemplateId(), name: name.trim(), root: state.root, hull: HULL_ENUM[state.hull], steps: templateSteps() };
    const anchors = templateAnchors();
    if (Object.keys(anchors).length) t.anchors = anchors;
    return t;
  }
  function templateNameProblem(name) {
    const n = name.trim();
    if (!n) return 'Give the template a name.';
    if ([...n].length > TEMPLATE_NAME_MAX) return `Names can be at most ${TEMPLATE_NAME_MAX} characters.`;
    return null;
  }
  // Reads the file's templates the way the mod does: an object with "templates", or a bare array. Empty means none.
  function parseTemplateFile(text) {
    const s = (text || '').trim();
    if (!s) return [];
    let parsed;
    try { parsed = JSON.parse(s); } catch { throw new Error('That file is not valid JSON, so it was left unchanged.'); }
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.templates) ? parsed.templates : null;
    if (!list) throw new Error('That file has no "templates" list, so it was left unchanged.');
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
    if (D.modVersion) body.mod = D.modVersion;
    const bytes = new TextEncoder().encode(JSON.stringify(body));
    if (typeof CompressionStream === 'function') return CODE_PREFIX + bytesToB64url(await streamBytes(bytes, new CompressionStream('deflate-raw')));
    return CODE_PREFIX_PLAIN + bytesToB64url(bytes);
  }
  // Accepts a code (whitespace and line breaks from chat apps are ignored) or a pasted template JSON object.
  async function codeToTemplate(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('Paste a template code first.');
    let json;
    if (raw.startsWith('{')) json = raw;
    else {
      const code = raw.replace(/\s+/g, '');
      const compressed = code.startsWith(CODE_PREFIX);
      if (!compressed && !code.startsWith(CODE_PREFIX_PLAIN)) throw new Error('That isn\'t a planner template code. Codes start with "ES1.".');
      if (code.length > 200000) throw new Error('That code is too long to be a template.');
      try {
        let bytes = b64urlToBytes(code.slice(CODE_PREFIX.length));
        if (compressed) {
          if (typeof DecompressionStream !== 'function') throw new Error('This browser can\'t read compressed codes. Try Chrome, Edge, Firefox or Safari.');
          bytes = await streamBytes(bytes, new DecompressionStream('deflate-raw'));
        }
        json = new TextDecoder().decode(bytes);
      } catch (err) {
        if (err && /browser/.test(err.message)) throw err;
        throw new Error('The code is damaged or cut off. Copy it again in full.');
      }
    }
    let t;
    try { t = JSON.parse(json); } catch { throw new Error('The code is damaged or cut off. Copy it again in full.'); }
    if (!t || typeof t !== 'object' || Array.isArray(t) || !t.root || !t.name || !Array.isArray(t.steps)) {
      throw new Error('That code doesn\'t hold a template (it needs a name, a root and steps).');
    }
    return t;
  }

  // ------------------------------------------------------------------ serialization (URL hash + localStorage)
  function serialize() {
    const o = { v: 1, r: state.root, a: [...state.alloc], h: state.hull, cap: state.cap };
    if (!state.coreWormholes) o.wc = 0;
    if (!state.volumes) o.wv = 0;
    if (state.choice.size) o.c = Object.fromEntries(state.choice);
    if (state.links.size) o.s = Object.fromEntries(state.links);
    return JSON.stringify(o);
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
    state.coreWormholes = o.wc !== 0;
    state.volumes = o.wv !== 0;
    if (!state.root) state.alloc.clear();
    else pruneSwitchedOff(); // a hand-edited or old link could hold nodes the options rule out
    return true;
  }
  const b64encode = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64decode = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
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
    // Game markup: <good>, <bad>, <hl>, <muted>. Escape everything else.
    return esc(text)
      .replace(/&lt;(good|bad|hl|muted)&gt;/g, '<span class="$1">')
      .replace(/&lt;\/(good|bad|hl|muted)&gt;/g, '</span>');
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
    else if (/_AFFINITY_FLAT$/.test(name)) stat = AFFINITY_NAMES[name] ? AFFINITY_NAMES[name].toLowerCase() + ' affinity' : null;
    if (stat && mode) {
      const t = S[`desc.${mode}.${mag >= 0 ? 'up' : 'down'}`];
      if (t) {
        const out = fill(t, { stat, value: fmt(Math.abs(mag)) });
        return e.lowerIsBetter ? swapGoodBad(out) : out;
      }
    }
    return `${humanize(name)}: <hl>${fmt(mag)}</hl>`;
  }
  const describe = (name, mag) => styled(describeRaw(name, mag));

  function typeEffects(t) {
    const out = [];
    for (const e of t.effects || []) out.push({ effect: e.effect, magnitude: e.magnitude });
    for (const e of t.hullSizeEffects || []) out.push({ effect: e.effect, magnitude: e[state.hull] ?? 0, hullScaled: true });
    return out;
  }
  function typeLines(t) {
    const lines = typeEffects(t).map(e => describe(e.effect, e.magnitude) + (e.hullScaled ? ` <span class="muted">(${hullLabel()})</span>` : ''));
    for (const txt of t.effectText || []) lines.push(styled(txt));
    for (const hm of grantedHullMods(t)) lines.push(`Grants <span class="hl">${esc(hullModName(hm))}</span>.`);
    return lines;
  }
  const grantedHullMods = t => [...new Set([t.vanillaHullMod, ...(t.phantomHullMods || [])].filter(Boolean))];
  const hullModName = id => (D.hullModNames && D.hullModNames[id]) || humanize(id);
  const hullLabel = () => ({ frigate: 'frigate', destroyer: 'destroyer', cruiser: 'cruiser', capitalShip: 'capital' }[state.hull]);
  const volumeName = v => VOLUME_NAMES[v] || humanize(v);

  // ------------------------------------------------------------------ summary math
  function contributions() {
    const list = [];
    for (const n of nodes) if (sat(n.id)) list.push({ node: n, type: effectiveType(n) });
    return list;
  }
  function totals() {
    const sums = new Map();
    const add = (effect, mag, src) => {
      const cur = sums.get(effect) || { effect, magnitude: 0, sources: 0, affinity: 0 };
      cur.magnitude += mag;
      if (src === 'aff') cur.affinity += mag; else cur.sources++;
      sums.set(effect, cur);
    };
    for (const c of contributions()) for (const e of typeEffects(c.type)) add(e.effect, e.magnitude, 'node');
    const aff = {};
    for (const k of Object.keys(D.affinitySteps || {})) aff[k] = sums.get(k)?.magnitude || 0;
    const affBonuses = [];
    for (const [k, steps] of Object.entries(D.affinitySteps || {})) {
      for (const st of steps) {
        const reached = Math.floor((aff[k] || 0) / st.size);
        affBonuses.push({ affinity: k, ...st, reached });
        if (reached > 0) add(st.effect, reached * st.bonus, 'aff');
      }
    }
    return { sums, aff, affBonuses };
  }
  const GROUPS = [
    ['Affinity', /AFFINITY/],
    ['Strike craft', /FIGHTER|STRIKECRAFT|HANGAR|BOMBER|WING|INTERCEPTOR|CARRIER/],
    ['Weapons', /WEAPON|MISSILE|BEAM|BALLISTIC|DAMAGE_TO|PD_|PIERCE|EMP_DAMAGE(?!_TAKEN)/],
    ['Flux', /FLUX|VENT|OVERLOAD/],
    ['Defense', /HULL|ARMOR|DAMAGE_TAKEN|SHIELD|ENGINE_DURABILITY/],
    ['Mobility', /SPEED|MANEUVER|ACCELERATION|DECELERATION|TURN|BURN|MASS/],
    ['Phase', /PHASE|TIMEFLOW/],
    ['Ship system', /SYSTEM/],
    ['Readiness & logistics', /CR_|COMBAT_READINESS|CREW|CARGO|FUEL|SUPPLIES|REPAIR|SALVAGE|SENSOR|SURVEY|DMOD|D_MOD|COMMAND|NAV|ELECTRONIC|OBJECTIVE|CORONA/],
  ];
  const groupOf = name => (GROUPS.find(([, re]) => re.test(name)) || ['Other'])[0];

  // ------------------------------------------------------------------ images
  const images = new Map();
  function img(path) {
    if (!path) return null;
    let rec = images.get(path);
    if (!rec) {
      rec = { el: new Image(), ok: false, dim: null, tinted: new Map() };
      rec.el.onload = () => { rec.ok = true; requestDraw(); };
      rec.el.onerror = () => { rec.failed = true; };
      rec.el.src = 'assets/' + path;
      images.set(path, rec);
    }
    return rec;
  }
  function dimmed(rec) {
    // Unallocated icons draw at about 35% brightness, like the mod's (90,90,90) tint.
    if (!rec.dim) {
      const c = document.createElement('canvas');
      c.width = rec.el.naturalWidth; c.height = rec.el.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(rec.el, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(0,0,0,0.62)';
      g.fillRect(0, 0, c.width, c.height);
      rec.dim = c;
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
  const halo = img('graphics/fx/star_halo.png');
  for (const t of D.types) img(t.icon);

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

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function draw() {
    const z = cam.zoom;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // stars
    for (const s of bgStars) {
      const x = ((s.x - cam.x * z * s.p) % W + W) % W;
      const y = ((s.y - cam.y * z * s.p) % H + H) % H;
      ctx.fillStyle = `rgba(220,230,255,${s.a})`;
      ctx.fillRect(x, y, s.s, s.s);
    }

    const view = { minX: toWorldX(0), maxX: toWorldX(W), minY: toWorldY(0), maxY: toWorldY(H) };
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));

    drawDecorations(view, z);
    const choosing = !state.root;
    const treeAlpha = choosing ? 0.35 : 1;
    drawConnectors(view, z, treeAlpha);
    for (const n of nodes) if (n.tier !== 'ROOT') drawNode(n, view, z, treeAlpha);
    for (const n of roots) drawRoot(n, view, z, choosing);
    if (flash) {
      const age = time - flash.start;
      if (age > FLASH_SECONDS || age < 0) flash = null;
      else drawFlash(byId.get(flash.id), age, z);
    }
    if (hover) drawHover(hover, z);
    drawRegionLabels(z);
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
      if (a <= 0) continue;
      const sx = toScreenX(r.x), sy = toScreenY(r.y);
      if (sx < -200 || sx > W + 200 || sy < -50 || sy > H + 50) continue;
      const name = r.volume === 'core' ? 'Core tree' : volumeName(r.volume);
      const count = r.ids.reduce((c, id) => c + (sat(id) ? 1 : 0), 0);
      const off = r.volume !== 'core' && !state.volumes;
      const sub = off ? 'off' : count ? `${count} allocated` : '';
      ctx.font = `600 14px ${FONT}`;
      const w1 = ctx.measureText(name).width;
      ctx.font = `12px ${FONT}`;
      const w2 = sub ? ctx.measureText(sub).width : 0;
      const w = Math.max(w1, w2) + 14, h = sub ? 36 : 22;
      const x0 = sx - w / 2, y0 = sy - h / 2;
      ctx.globalAlpha = a * (off ? 0.6 : 1);
      ctx.fillStyle = '#0b1118';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = count ? rgba(accent(), 0.9) : '#3a5566';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      ctx.fillStyle = '#e6e6e6';
      ctx.font = `600 14px ${FONT}`;
      ctx.fillText(name, sx, sub ? sy - 8 : sy);
      if (sub) {
        ctx.fillStyle = off ? '#fc6300' : '#9aa4ad';
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
        ctx.globalAlpha = 0.9;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(rec.el, -d.width / 2, -d.height / 2, d.width, d.height);
        ctx.restore();
      } else if (d.kind === 'star') {
        const r = d.radius || 200;
        if (!inView(view, d.x, d.y, r * 4)) continue;
        const col = STAR_COLOURS[d.starType] || '#fff2b8';
        const g = ctx.createRadialGradient(d.x, d.y, r * 0.6, d.x, d.y, r * 3.2);
        g.addColorStop(0, hexA(col, 0.55)); g.addColorStop(0.35, hexA(col, 0.12)); g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, r * 3.2, 0, Math.PI * 2); ctx.fill();
        if (d.starType !== 'black_hole') {
          const core = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
          core.addColorStop(0, '#ffffff'); core.addColorStop(0.7, col); core.addColorStop(1, hexA(col, 0.85));
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
      batches[connectorState(c)].push(c);
    }
    ctx.lineCap = 'round';
    // dull lanes: two thin edges (wide grey stroke with a black core)
    const searchDim = searchHits ? 0.35 : 1;
    ctx.globalAlpha = treeAlpha * searchDim;
    ctx.strokeStyle = rgba(DULL, simple ? 0.45 : 0.6);
    ctx.lineWidth = laneW;
    strokeBatch(batches.dull);
    if (!simple) {
      ctx.strokeStyle = 'rgba(0,0,0,0.92)';
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
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
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

  function nodeAlpha(n, treeAlpha) {
    const off = switchedOff(n) ? 0.25 : 1;
    if (searchHits && !searchHits.has(n.id)) return treeAlpha * 0.3 * off;
    return treeAlpha * off;
  }
  function canAllocateNow(n) {
    if (!state.root || sat(n.id) || n.tier === 'WORMHOLE_EXIT' || switchedOff(n)) return false;
    return n.adj.some(m => sat(m.id));
  }
  function breath() { return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * Math.PI * 2 / 2.2)); }

  function drawNode(n, view, z, treeAlpha) {
    const fp = n.fp;
    const reach = n.tier === 'NOTABLE' ? fp * 1.7 : n.tier === 'KEYSTONE' ? fp * 1.4 : fp;
    if (!inView(view, n.x, n.y, reach)) return;
    const allocated = sat(n.id);
    const alpha = nodeAlpha(n, treeAlpha);
    const screenSize = fp * z;
    const pAdd = preview && preview.add && preview.add.has(n.id);
    const pRem = preview && preview.remove && preview.remove.has(n.id);
    const ac = accent();
    const px = 1 / z;

    if (screenSize < 5) { // far away: a dot
      ctx.globalAlpha = alpha;
      ctx.fillStyle = allocated ? rgba(ac, 1) : n.tier === 'KEYSTONE' ? rgba(DEFAULT_AURORA, 0.9) : n.tier === 'NOTABLE' ? rgba(NOTABLE_PINK, 0.8) : 'rgba(170,170,170,0.7)';
      const r = Math.max(1.5 * px, fp * 0.35);
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const stateA = allocated ? 1 : UNALLOCATED_ALPHA;
    ctx.globalAlpha = alpha;
    if (n.tier === 'NOTABLE') {
      if (halo.ok) {
        const s = fp * 3.2 * 0.6;
        ctx.globalAlpha = alpha * stateA * 0.55;
        ctx.drawImage(tinted(halo, NOTABLE_GLOW), n.x - s / 2, n.y - s / 2, s, s);
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
        else { ctx.fillStyle = lit ? '#555' : '#222'; ctx.beginPath(); ctx.arc(n.x, n.y, iconSize / 2, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    drawRingState(n, allocated, alpha, ac, pAdd, pRem, z, false);
    ctx.globalAlpha = 1;
  }

  function drawRingState(n, allocated, alpha, ac, pAdd, pRem, z, wormhole) {
    const px = 1 / z;
    const r = wormhole ? n.fp * 0.42 : n.tier === 'SOCKET' ? n.fp * 0.52 : n.fp * ICON_INSET / 2 + 1.5 * px;
    const w = Math.max(1.4 * px, n.fp * 0.035);
    ctx.globalAlpha = alpha;
    let col = null, a = 1;
    if (pRem) col = PREVIEW_REMOVE;
    else if (pAdd) col = PREVIEW_ADD;
    else if (allocated) col = ac;
    else if (canAllocateNow(n)) { col = ac; a = breath(); }
    if (searchHits && searchHits.has(n.id)) {
      ctx.strokeStyle = rgba(SEARCH_GOLD, 0.95);
      ctx.lineWidth = w * 1.6;
      ctx.beginPath(); ctx.arc(n.x, n.y, r + w * 2.5, 0, Math.PI * 2); ctx.stroke();
    }
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

  function drawSplitIcon(n, size, alpha) {
    const opts = n.type.options.map(id => types.get(id)).filter(Boolean);
    const k = opts.length;
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
    ctx.fillStyle = 'rgba(10,16,24,0.85)';
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
    const alpha = searchHits && !searchHits.has(n.id) ? 0.35 : 1;
    const pulse = choosing ? breath() : 1;
    ctx.globalAlpha = alpha;
    // circuit glow
    const g = ctx.createRadialGradient(n.x, n.y, r * 0.55, n.x, n.y, r * 1.5);
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.35, rgba(col, (allocated ? 0.35 : 0.12) * pulse)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(n.x, n.y, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(4,6,10,0.92)';
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
  function drawHover(n, z) {
    const r = n.tier === 'ROOT' ? n.fp / 2 + 6 / z : n.fp * 0.55 + 3 / z;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
  }

  // ------------------------------------------------------------------ hit testing
  function nodeAt(sx, sy) {
    const wx = toWorldX(sx), wy = toWorldY(sy);
    const minHalf = 7 / cam.zoom; // keep tiny nodes clickable when zoomed out
    let best = null, bestD = Infinity;
    for (const n of nodes) {
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
    optCore: document.getElementById('opt-core'),
    optVolumes: document.getElementById('opt-volumes'),
    search: document.getElementById('search'),
    searchCount: document.getElementById('search-count'),
    undo: document.getElementById('btn-undo'),
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

  function changed() {
    cachedTotals = totals();
    updatePreview();
    renderChrome();
    renderPanel();
    if (hover) showTooltip(hover, lastMouse.x, lastMouse.y);
    persist();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    requestDraw();
  }

  function renderChrome() {
    const r = state.root ? byId.get(state.root) : null;
    els.rootName.textContent = r ? r.type.name : 'Choose a root';
    els.rootName.classList.toggle('muted', !r);
    if (r) els.rootName.style.color = rgba(ROOT_COLOURS[r.type.id] || GLOW, 1); else els.rootName.style.color = '';
    els.used.textContent = used();
    els.used.classList.toggle('over', used() > state.cap);
    if (document.activeElement !== els.cap) els.cap.value = state.cap;
    els.hull.value = state.hull;
    els.optCore.checked = state.coreWormholes;
    els.optVolumes.checked = state.volumes;
    els.undo.disabled = undoStack.length === 0;
    els.banner.hidden = !!state.root;
    els.banner.textContent = S['ui.node.startingRootPrompt'] || 'Choose a root';
  }

  function renderPanel() {
    const t = cachedTotals || totals();
    els.panelSub.textContent = state.root ? `${used()} of ${state.cap} nodes` : '';
    // affinity tiles
    els.affinity.innerHTML = Object.keys(AFFINITY_NAMES).map(k => {
      const v = Math.round((t.aff[k] || 0) * 100) / 100;
      return `<div class="aff" style="border-color:${rgba(AFFINITY_COLOURS[k], 0.4)}"><div class="n" style="color:${rgba(AFFINITY_COLOURS[k], 1)}">${v}</div><div class="t">${AFFINITY_NAMES[k]} affinity</div></div>`;
    }).join('');

    if (panelTab === 'search') {
      els.panelBody.innerHTML = searchResultsHtml();
      els.panelFoot.textContent = footText();
      const cur = els.panelBody.querySelector('.node-row.current');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (!state.root) {
      els.panelBody.innerHTML = '<div class="empty">Pick one of the three roots near the centre to start.</div>';
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
      const order = [...GROUPS.map(g => g[0]), 'Other'];
      let html = '';
      for (const g of order) {
        const list = groups.get(g);
        if (!list) continue;
        html += `<div class="stat-group"><h3>${esc(g)}</h3>`;
        for (const s of list) {
          const src = s.affinity && s.sources ? `${s.sources} node${s.sources > 1 ? 's' : ''} + affinity` : s.affinity ? 'affinity' : `${s.sources} node${s.sources > 1 ? 's' : ''}`;
          html += `<div class="stat-line">${describe(s.effect, s.magnitude)}<span class="src">${src}</span></div>`;
        }
        html += '</div>';
      }
      // granted hull mods and text-only effects
      const extras = new Set();
      for (const c of contributions()) {
        if (c.node.tier === 'WORMHOLE' || c.node.tier === 'WORMHOLE_EXIT') continue; // their text is travel instructions
        for (const hm of grantedHullMods(c.type)) extras.add(`Grants <span class="hl">${esc(hullModName(hm))}</span>.`);
        for (const txt of c.type.effectText || []) extras.add(styled(txt));
      }
      if (extras.size) html += `<div class="stat-group"><h3>Other effects</h3>${[...extras].map(e => `<div class="stat-line">${e}</div>`).join('')}</div>`;
      const reached = t.affBonuses.filter(b => b.reached > 0);
      if (reached.length) {
        html += '<div class="stat-group"><h3>Affinity thresholds reached</h3>';
        for (const b of reached) html += `<div class="stat-line">${describe(b.effect, b.reached * b.bonus)}<span class="src">${AFFINITY_NAMES[b.affinity]} ${b.reached}×${b.size}</span></div>`;
        html += '</div>';
      }
      els.panelBody.innerHTML = html || '<div class="empty">No effects yet. Click a glowing node next to your root.</div>';
    } else {
      const list = nodes.filter(n => sat(n.id) && ['NOTABLE', 'KEYSTONE', 'SOCKET', 'WORMHOLE', 'ROOT'].includes(n.tier));
      const rank = { ROOT: 0, KEYSTONE: 1, NOTABLE: 2, SOCKET: 3, WORMHOLE: 4 };
      list.sort((a, b) => rank[a.tier] - rank[b.tier] || effectiveType(a).name.localeCompare(effectiveType(b).name));
      els.panelBody.innerHTML = list.length ? list.map(n => {
        const t2 = effectiveType(n);
        let sub = TIER_LABEL[n.tier];
        if (n.tier === 'SOCKET') { const e = state.links.get(n.id); sub += e ? ` · ${volumeName(byId.get(e).volume)} anchor` : ' · empty'; }
        if (n.volume !== 'core') sub += ` · ${volumeName(n.volume)}`;
        return `<div class="node-row ${n.tier.toLowerCase()}" data-node="${esc(n.id)}"><img src="assets/${esc(t2.icon)}" alt=""><div><div class="nm">${esc(t2.name)}</div><div class="tr">${esc(sub)}</div></div></div>`;
      }).join('') : '<div class="empty">No notables or keystones allocated yet.</div>';
    }
    els.panelFoot.textContent = footText();
  }
  const footText = () => `Data: Exiled Sector ${D.modVersion || ''} · extracted ${D.generated}. Magnitudes are the mod's current placeholders.`;

  // ------------------------------------------------------------------ tooltip
  let lastMouse = { x: 0, y: 0 };
  function tooltipHtml(n) {
    const t = effectiveType(n);
    const allocated = sat(n.id);
    const tierClass = n.tier.toLowerCase();
    let html = `<div class="tt-head">${t.icon ? `<img src="assets/${esc(t.icon)}" alt="">` : ''}<div><div class="tt-title">${esc(t.name)}</div><div class="tt-tier ${tierClass}">${esc(TIER_LABEL[n.tier] || n.tier)}${n.volume !== 'core' ? ' · ' + esc(volumeName(n.volume)) : ''}</div></div></div>`;

    if (isChoice(n)) {
      const cur = state.choice.get(n.id);
      for (const id of n.type.options) {
        const o = types.get(id);
        if (!o) continue;
        html += `<div class="tt-option"><div class="${cur === id ? 'on' : ''}">${esc(o.name)}${cur === id ? ' ✓' : ''}</div>${typeLines(o).map(l => `<div>${l}</div>`).join('')}</div>`;
      }
    } else if (n.tier === 'SOCKET') {
      const e = state.links.get(n.id);
      html += `<div class="tt-effects"><div>${e ? `Linked to the <span class="hl">${esc(volumeName(byId.get(e).volume))}</span> wormhole exit.` : 'Holds a subroutine. Install an anchor to open a wormhole to a faction volume.'}</div></div>`;
    } else if (n.tier === 'WORMHOLE') {
      const p = partnerOf(n);
      html += `<div class="tt-effects"><div>Leads to ${p ? `<span class="hl">${esc(effectiveType(p).name)}</span>` : 'another wormhole'}. Allocating it also allocates the other end.</div></div>`;
    } else if (n.tier === 'WORMHOLE_EXIT') {
      html += `<div class="tt-effects"><div>Opens into the <span class="hl">${esc(volumeName(n.volume))}</span> volume. Reached by linking an anchor in a subroutine socket.</div></div>`;
    } else {
      const lines = typeLines(t);
      if (lines.length) html += `<div class="tt-effects">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
    }
    const reqs = (t.tags || []).filter(x => x.startsWith('req_')).map(x => humanize(x.slice(4)));
    if (reqs.length) html += `<div class="tt-note">Needs a ship with: ${esc(reqs.join(', '))}</div>`;
    if (n.gates.length) html += `<div class="tt-note">In game, unlocked by: ${esc(n.gates.map(g => humanize(g.slice(5))).join(', '))}</div>`;
    if (t.flavour) html += `<div class="tt-flavour">${esc(t.flavour)}</div>`;

    // action hint
    const jt = jumpTarget(n);
    if (jt && n.tier === 'SOCKET') html += `<div class="tt-note">Ctrl+click to jump to ${esc(placeName(jt))}.</div>`;
    if (jt && (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT')) {
      html += `<div class="tt-note">Click for options (jump${state.root && n.id !== state.root ? (allocated ? ', remove' : ', allocate') : ''}). Ctrl+click to jump to ${esc(placeName(jt))}.</div>`;
    } else if (!state.root) html += n.tier === 'ROOT' ? '<div class="tt-note">Click to start from this root.</div>' : '';
    else if (n.id === state.root) html += '<div class="tt-note">Starting root.</div>';
    else if (allocated) {
      const gone = removalSet(n) || [];
      if (n.tier === 'SOCKET') html += `<div class="tt-note">Click to ${state.links.get(n.id) ? 'change or unlink the anchor' : 'link an anchor'}. Right-click to remove.</div>`;
      else if (isChoice(n)) html += '<div class="tt-note">Click to switch the option. Right-click to remove.</div>';
      else html += `<div class="tt-warn">Click to remove${gone.length > 1 ? ` (${gone.length} nodes)` : ''}.</div>`;
    } else if (switchedOff(n)) {
      html += `<div class="tt-warn">${n.tier === 'WORMHOLE' ? 'Core wormholes' : 'Faction volumes'} are off. Turn them on in the top bar.</div>`;
    } else {
      const path = pathTo(n);
      if (!path) html += `<div class="tt-warn">${n.tier === 'WORMHOLE_EXIT' ? 'Link an anchor in a subroutine socket to reach this.' : 'Not reachable from your allocated nodes.'}</div>`;
      else if (used() + path.length > state.cap) html += `<div class="tt-warn">Needs ${path.length} node${path.length > 1 ? 's' : ''}; ${Math.max(0, state.cap - used())} left under the cap.</div>`;
      else html += `<div class="tt-note">Click to allocate${path.length > 1 ? ` (${path.length} nodes)` : ''}${isChoice(n) ? ' and pick an option' : ''}.</div>`;
    }
    if (state.root && isChoice(n) && (sat(n.id) || pathTo(n))) {
      const last = types.get(lastChoice.get(n.type.id));
      if (last && state.choice.get(n.id) !== last.id) {
        const many = !sat(n.id) && pathTo(n).length > 1;
        html += `<div class="tt-note">Ctrl+click to ${sat(n.id) ? 'switch to' : 'allocate as'} ${esc(last.name)}${many ? ', path included' : ''}.</div>`;
      }
    }
    return html;
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
    if (!hover || !state.root) return;
    if (sat(hover.id)) {
      if (hover.id === state.root || isChoice(hover) || hover.tier === 'SOCKET') return;
      const gone = removalSet(hover);
      if (gone) preview = { remove: new Set(gone) };
    } else {
      const path = pathTo(hover);
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
  // Where a node is, for "Jump to …": a faction volume, or the side of the core tree nearest a root.
  function placeName(n) {
    if (n.volume !== 'core') return `the ${volumeName(n.volume)} volume`;
    let best = null, bestD = Infinity;
    for (const r of roots) { const d = Math.hypot(r.x - n.x, r.y - n.y); if (d < bestD) { bestD = d; best = r; } }
    return best ? `the ${best.type.name} side of the core` : 'the core tree';
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
    pickerFor = n;
    hideTooltip();
    let html = '';
    if (isChoice(n)) {
      const cur = state.choice.get(n.id);
      html += `<h4>${esc(n.type.name)}: choose an option</h4>`;
      for (const id of n.type.options) {
        const o = types.get(id);
        if (!o) continue;
        const line = typeLines(o).map(plain).join(' ');
        html += `<button data-opt="${esc(id)}" class="${cur === id ? 'current' : ''}"><img src="assets/${esc(o.icon)}" alt=""><span><div>${esc(o.name)}</div><div class="sub">${esc(line)}</div></span></button>`;
      }
      if (sat(n.id)) html += `<button data-act="remove" class="danger">Remove node</button>`;
    } else if (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT') {
      const target = jumpTarget(n);
      html += `<h4>${esc(TIER_LABEL[n.tier])}</h4>`;
      if (target) html += `<button data-act="jump" class="current"><span><div>Jump to ${esc(placeName(target))}</div><div class="sub">Ctrl+click jumps straight there</div></span></button>`;
      if (state.root && n.id !== state.root) {
        if (sat(n.id)) {
          const count = (removalSet(n) || []).length;
          html += `<button data-act="remove" class="danger">${n.tier === 'WORMHOLE_EXIT' ? 'Unlink anchor' : 'Remove'} (${count} node${count === 1 ? '' : 's'})</button>`;
        } else if (switchedOff(n)) {
          html += `<div class="sub" style="padding:2px 0">${n.tier === 'WORMHOLE' ? 'Core wormholes' : 'Faction volumes'} are off, so this can't be allocated.</div>`;
        } else {
          const path = pathTo(n);
          html += path ? `<button data-act="alloc">Allocate (${path.length} node${path.length === 1 ? '' : 's'})</button>`
            : '<div class="sub" style="padding:2px 0">Not reachable from your build yet.</div>';
        }
      }
    } else if (n.tier === 'SOCKET') {
      const cur = state.links.get(n.id);
      html += '<h4>Install an anchor</h4>';
      if (cur) html += `<button data-act="jump"><span><div>Jump to ${esc(placeName(byId.get(cur)))}</div><div class="sub">Ctrl+click jumps straight there</div></span></button>`;
      if (!state.volumes) {
        html += '<div class="sub" style="padding:2px 0 6px">Faction volumes are off. Turn them on in the top bar to link anchors.</div>';
        html += '<button data-act="remove" class="danger">Remove socket</button>';
        els.picker.innerHTML = html;
        els.picker.hidden = false;
        placeFloating(els.picker, sx, sy);
        return;
      }
      const taken = new Set([...state.links].filter(([s]) => s !== n.id).map(([, e]) => e));
      for (const ex of [...exits].sort((a, b) => volumeName(a.volume).localeCompare(volumeName(b.volume)))) {
        const dis = taken.has(ex.id);
        const sub = dis ? 'Linked to another socket' : ex.gates.length ? 'In game: ' + ex.gates.map(g => humanize(g.slice(5))).join(', ') : '';
        html += `<button data-exit="${esc(ex.id)}" class="${cur === ex.id ? 'current' : ''}" ${dis ? 'disabled' : ''}><span><div>${esc(volumeName(ex.volume))}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</span></button>`;
      }
      if (cur) html += '<button data-act="unlink">Unlink anchor</button>';
      html += '<button data-act="remove" class="danger">Remove socket</button>';
    }
    els.picker.innerHTML = html;
    els.picker.hidden = false;
    placeFloating(els.picker, sx, sy);
  }
  function closePicker() { els.picker.hidden = true; pickerFor = null; }
  els.picker.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !pickerFor) return;
    const n = pickerFor;
    if (b.dataset.opt) {
      rememberChoice(n, b.dataset.opt);
      if (sat(n.id)) setChoice(n, b.dataset.opt); else allocate(n, b.dataset.opt);
    }
    else if (b.dataset.exit) linkSocket(n, byId.get(b.dataset.exit));
    else if (b.dataset.act === 'jump') { const t = jumpTarget(n); closePicker(); if (t) jumpTo(t); return; }
    else if (b.dataset.act === 'alloc') allocate(n);
    else if (b.dataset.act === 'unlink') unlinkSocket(n);
    else if (b.dataset.act === 'remove') deallocate(n);
    closePicker();
  });

  // ------------------------------------------------------------------ actions
  function primaryAction(n, sx, sy, quick = false) {
    // Wormholes: Ctrl/Cmd+click travels to the other end (as in the mod); a plain click offers jump or allocate/remove.
    const jump = jumpTarget(n);
    if (jump && quick) { jumpTo(jump); return; }
    if (jump && (n.tier === 'WORMHOLE' || n.tier === 'WORMHOLE_EXIT')) { openPicker(n, sx, sy); return; }
    if (!state.root) { if (n.tier === 'ROOT') chooseRoot(n); return; }
    if (n.id === state.root) return;
    // Ctrl/Cmd+click on a choice node: use the option last picked for that node type, skipping the picker.
    if (quick && isChoice(n)) {
      const opt = lastChoice.get(n.type.id);
      if (!opt) { toast('Pick an option once; Ctrl+click then reuses it.'); openPicker(n, sx, sy); return; }
      if (sat(n.id)) setChoice(n, opt);
      else if (pathTo(n)) allocate(n, opt, true);
      return;
    }
    if (sat(n.id)) {
      if (isChoice(n) || n.tier === 'SOCKET') openPicker(n, sx, sy);
      else deallocate(n);
      return;
    }
    if (switchedOff(n)) { toast(`${n.tier === 'WORMHOLE' ? 'Core wormholes' : 'Faction volumes'} are off. Turn them on in the top bar.`); return; }
    const path = pathTo(n);
    if (!path) { if (n.tier === 'WORMHOLE_EXIT') toast('Wormhole exits open by linking an anchor in a subroutine socket.'); return; }
    if (isChoice(n)) { openPicker(n, sx, sy); return; }
    if (allocate(n) && n.tier === 'SOCKET') openPicker(n, sx, sy);
  }
  function secondaryAction(n) {
    if (!state.root || n.id === state.root) return;
    if (sat(n.id)) deallocate(n);
  }

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
          primaryAction(n, e.clientX, e.clientY);
          setHover(null);
          return;
        }
        if (n) {
          if (wasDrag.button === 2) secondaryAction(n);
          else if (wasDrag.button === 0) primaryAction(n, e.clientX, e.clientY, e.ctrlKey || e.metaKey);
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
  els.hull.addEventListener('change', () => { state.hull = els.hull.value; changed(); });
  els.optCore.addEventListener('change', () => { setWormholeOption('coreWormholes', els.optCore.checked); els.optCore.blur(); });
  els.optVolumes.addEventListener('change', () => { setWormholeOption('volumes', els.optVolumes.checked); els.optVolumes.blur(); });
  document.getElementById('btn-fit').addEventListener('click', frameCore);
  els.undo.addEventListener('click', undo);
  document.getElementById('btn-reset').addEventListener('click', () => { if (state.root || state.alloc.size) { resetBuild(); toast('Build cleared. Undo brings it back.'); } });
  document.getElementById('btn-share').addEventListener('click', async () => {
    const url = shareUrl();
    history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied. It contains the whole build.');
    } catch {
      toast('', `Copy this link:<br><input style="width:min(560px,80vw);margin-top:6px" readonly value="${esc(url)}" onfocus="this.select()">`);
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
      s = [n.id, n.type.name, volumeName(n.volume), ...ts.flatMap(t => [t.name, t.flavour || '', ...typeLines(t).map(plain)])].join(' \n ').toLowerCase();
      searchText.set(n.id, s);
    }
    return s;
  }
  // Where a node sits, short form for list rows: "Hegemony volume", "Midline side of the core".
  const shortPlace = n => placeName(n).replace(/^the /, '');
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
    if (!searchOrder.length) return '<div class="empty">No nodes match that search.</div>';
    const have = searchOrder.filter(n => sat(n.id)).length;
    let html = `<div class="search-head">${searchOrder.length} match${searchOrder.length === 1 ? '' : 'es'}` +
      `${state.root ? `, ${have} allocated` : ''}. Click one to jump to it.</div>`;
    searchOrder.forEach((n, i) => {
      const t = effectiveType(n);
      const snippet = matchSnippet(n);
      html += `<div class="node-row ${n.tier.toLowerCase()}${i === searchCursor ? ' current' : ''}" data-node="${esc(n.id)}">` +
        (t.icon ? `<img src="assets/${esc(t.icon)}" alt="">` : '') +
        `<div><div class="nm">${esc(t.name)}${sat(n.id) ? '<span class="have">allocated</span>' : ''}</div>` +
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
      searchTab.textContent = `Search (${searchOrder.length})`;
      if (els.panel.classList.contains('closed')) { togglePanel(); panelOpenedBySearch = true; }
      if (panelTab !== 'search') { tabBeforeSearch = panelTab; setPanelTab('search'); } else renderPanel();
    } else if (!searchTab.hidden) {
      searchTab.hidden = true;
      if (panelTab === 'search') setPanelTab(tabBeforeSearch || 'stats');
      if (panelOpenedBySearch && !els.panel.classList.contains('closed')) togglePanel();
      panelOpenedBySearch = false;
    }
  }
  els.search.addEventListener('input', () => {
    const q = els.search.value.trim().toLowerCase();
    if (q.length < 2) { searchHits = null; searchOrder = []; searchTerms = []; els.searchCount.textContent = ''; updateSearchTab(false); requestDraw(); return; }
    searchTerms = q.split(/\s+/);
    searchOrder = sortSearchResults(nodes.filter(n => { const s = nodeSearchText(n); return searchTerms.every(t => s.includes(t)); }));
    searchHits = new Set(searchOrder.map(n => n.id));
    searchCursor = -1;
    els.searchCount.textContent = `${searchOrder.length}`;
    updateSearchTab(true);
    requestDraw();
  });
  els.search.addEventListener('keydown', e => {
    if (e.key === 'Enter' && searchOrder.length) {
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

  // shortcuts list
  const keysEl = document.getElementById('keys');
  const keysBtn = document.getElementById('btn-keys');
  function toggleKeys(show = keysEl.hidden) {
    keysEl.hidden = !show;
    keysBtn.setAttribute('aria-expanded', String(show));
    if (show) { closePicker(); hideTooltip(); if (!exportEl.hidden) toggleExport(false); document.getElementById('keys-close').focus(); }
    else if (keysEl.contains(document.activeElement)) keysBtn.focus();
  }
  keysBtn.addEventListener('click', () => toggleKeys());
  document.getElementById('keys-close').addEventListener('click', () => toggleKeys(false));
  document.addEventListener('pointerdown', e => {
    if (!keysEl.hidden && !keysEl.contains(e.target) && e.target !== keysBtn) toggleKeys(false);
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
    reconnect: document.getElementById('tf-reconnect'),
    reload: document.getElementById('tf-reload'),
    forget: document.getElementById('tf-forget'),
    note: document.getElementById('tf-note'),
    list: document.getElementById('tf-list'),
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
    const text = await (await linkedHandle.getFile()).text();
    fileTemplates = parseTemplateFile(text);
    return text;
  }
  async function linkFile() {
    try {
      const opts = { types: [{ description: 'Exiled Sector templates', accept: { 'application/json': ['.data', '.json'] } }], multiple: false };
      if (linkedHandle) opts.startIn = linkedHandle;
      const [h] = await window.showOpenFilePicker(opts);
      linkedHandle = h;
      await rememberHandle(h);
      if (await checkAccess(true)) await readLinked();
      exportStatus('');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      fileTemplates = null;
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
    await rememberHandle(null);
    renderTemplatesFile();
  }

  // --- rendering
  function exportStatus(msg, kind) { tpl.status.textContent = msg; tpl.status.className = kind || ''; }
  function renderTemplatesFile() {
    const linked = !!linkedHandle;
    if (canWriteFiles) {
      tf.status.innerHTML = linked
        ? `Linked: <b>${esc(linkedHandle.name)}</b>${linkedAccess === 'prompt' ? ' <span class="muted">(click Reconnect to allow access this visit)</span>' : ''}`
        : 'No file linked yet.';
      tf.link.textContent = linked ? 'Link a different file…' : 'Link templates file…';
      tf.link.classList.toggle('primary', !linked);
      tf.reconnect.hidden = !(linked && linkedAccess === 'prompt');
      tf.reload.hidden = !(linked && linkedAccess === 'granted');
      tf.forget.hidden = !linked;
      tf.note.textContent = linked ? '' : `Pick ${TEMPLATE_FILE} in your Starsector saves/common folder. The planner remembers it for next time. If the file doesn't exist yet, save any template in game first, or use "Download as a new file" below.`;
    } else {
      tf.status.innerHTML = openedFile ? `Opened (read-only): <b>${esc(openedFile.name)}</b>` : 'No file opened.';
      tf.link.textContent = openedFile ? 'Open a different file…' : 'Open templates file…';
      tf.reconnect.hidden = true;
      tf.reload.hidden = true;
      tf.forget.hidden = !openedFile;
      tf.note.textContent = 'This browser can read the file but not write it or remember it (Chrome and Edge can). Open it each visit; exports download a merged copy.';
    }
    renderTemplateList();
    refreshExport();
  }
  function renderTemplateList() {
    if (!fileTemplates) {
      tf.list.innerHTML = `<p class="muted">${linkedHandle && linkedAccess === 'prompt' ? 'Reconnect to see the templates in the file.' : 'Link the file to see its templates.'}</p>`;
      return;
    }
    const usable = fileTemplates.map((t, i) => ({ t, i })).filter(({ t }) => t && typeof t === 'object' && t.root && t.name);
    if (!usable.length) { tf.list.innerHTML = '<p class="muted">The file has no templates yet.</p>'; return; }
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
      html += `<div class="group">${esc(rn ? rn.type.name : root)} root${root === state.root ? ' (current)' : ''}</div><table>`;
      for (const { t, i } of groups.get(root).sort((a, b) => String(a.t.name).localeCompare(String(b.t.name)))) {
        const steps = Array.isArray(t.steps) ? t.steps.length : 0;
        const hull = HULL_FROM_ENUM[t.hull] ? hullLabelFor(HULL_FROM_ENUM[t.hull]) : '';
        html += `<tr><td>${esc(t.name)}</td><td class="num">${steps} step${steps === 1 ? '' : 's'}${hull ? ' · ' + hull : ''}</td>` +
          `<td><button data-code="${i}" title="Copy this template as a code to paste into chat">Code</button> ` +
          `<button data-load="${i}" title="Replace the current build with this template">Load</button></td></tr>`;
      }
      html += '</table>';
    }
    tf.list.innerHTML = html;
  }
  function refreshExport() {
    if (!state.root) tpl.summary.textContent = 'Choose a root and allocate some nodes first.';
    else {
      const steps = templateSteps(), anchors = Object.keys(templateAnchors()).length;
      let replaces = '';
      const i = fileTemplates && tpl.name.value.trim() ? findTemplateIndex(fileTemplates, tpl.name.value) : -1;
      if (i >= 0) {
        const h = fileTemplates[i].hull;
        replaces = HULL_ENUM_VALUES.has(h)
          ? ` · replaces the ${HULL_ENUM_LABEL[h]} template of this name${h !== HULL_ENUM[state.hull] ? ' (you\'ll be asked about the hull)' : ''}`
          : ' · replaces the template of this name';
      }
      tpl.summary.textContent = `${byId.get(state.root).type.name} root · ${hullLabel()} · ${steps.length} step${steps.length === 1 ? '' : 's'}` +
        (anchors ? ` · ${anchors} anchor${anchors === 1 ? '' : 's'}` : '') + replaces;
    }
    if (canWriteFiles) {
      tpl.save.disabled = !(linkedHandle && linkedAccess === 'granted');
      tpl.save.textContent = linkedHandle ? `Save into ${linkedHandle.name}` : 'Save into linked file';
      tpl.saveNote.textContent = !linkedHandle ? 'Link the templates file above to save straight into it.'
        : linkedAccess !== 'granted' ? 'Reconnect above to save into the file.' : '';
    } else {
      tpl.save.hidden = true;
      tpl.saveNote.textContent = '';
    }
  }

  // --- import
  const HULL_FROM_ENUM = Object.fromEntries(Object.entries(HULL_ENUM).map(([k, v]) => [v, k]));
  const hullLabelFor = h => ({ frigate: 'frigate', destroyer: 'destroyer', cruiser: 'cruiser', capitalShip: 'capital' }[h]);
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
    if (!byId.has(root) || byId.get(root).tier !== 'ROOT') throw new Error(`"${t.name}" starts from an unknown root (${t.root}).`);
    const entries = (Array.isArray(t.steps) ? t.steps : []).map(s => String(s).trim()).filter(Boolean).map(s => {
      const k = s.indexOf('=');
      return k < 0 ? { id: currentNodeId(s), opt: null } : { id: currentNodeId(s.slice(0, k)), opt: currentOptionId(s.slice(k + 1)) || null };
    });
    const anchors = new Map();
    for (const [socket, aid] of Object.entries(t.anchors || {})) { const a = anchorById.get(String(aid).trim()); if (a) anchors.set(currentNodeId(socket), a.exit); }
    pushUndo();
    state.root = root; state.alloc.clear(); state.choice.clear(); state.links.clear();
    if (HULL_FROM_ENUM[t.hull]) state.hull = HULL_FROM_ENUM[t.hull];
    const turnedOn = [];
    if (!state.coreWormholes && entries.some(e => byId.get(e.id)?.tier === 'WORMHOLE')) { state.coreWormholes = true; turnedOn.push('Core wormholes'); }
    if (!state.volumes && (anchors.size || entries.some(e => byId.get(e.id)?.tier === 'WORMHOLE_EXIT'))) { state.volumes = true; turnedOn.push('Faction volumes'); }
    const unknown = entries.filter(e => !byId.has(e.id)).map(e => e.id);
    let pending = entries.filter(e => byId.has(e.id));
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
        state.alloc.add(n.id);
        if (isChoice(n)) state.choice.set(n.id, e.opt && n.type.options.includes(e.opt) ? e.opt : defaultOption(n));
        if (n.tier === 'SOCKET' && anchors.has(n.id)) {
          const exit = anchors.get(n.id);
          if (byId.has(exit) && !linkedSocketOf(exit)) { state.links.set(n.id, exit); state.alloc.add(exit); }
        }
        const partner = partnerOf(n);
        if (partner && !sat(partner.id)) state.alloc.add(partner.id);
        progress = true;
      }
      pending = next;
    }
    return { name: t.name, taken: state.alloc.size, unknown, unplaced: pending.map(e => e.id), turnedOn };
  }
  // Loads a template (from the file or a code) into the planner and reports through `report(message, kind)`.
  function loadTemplate(t, report, extraNote) {
    try {
      const r = importTemplate(t);
      tpl.name.value = [...String(t.name).trim()].slice(0, TEMPLATE_NAME_MAX).join(''); // saving again under this name replaces it
      changed();
      const notes = [];
      if (extraNote) notes.push(extraNote);
      if (r.unknown.length) notes.push(`${r.unknown.length} step${r.unknown.length > 1 ? 's' : ''} not in this version of the tree`);
      if (r.unplaced.length) notes.push(`${r.unplaced.length} step${r.unplaced.length > 1 ? 's' : ''} couldn't be connected`);
      if (r.turnedOn.length) notes.push(`turned on ${r.turnedOn.join(' and ')}`);
      if (used() > state.cap) notes.push(`${used()} nodes is over the ${state.cap} cap`);
      report(`Loaded "${r.name}" (${r.taken} nodes)${notes.length ? '; ' + notes.join('; ') : ''}. Undo goes back.`, notes.length ? '' : 'ok');
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
    showCode(await templateToCode(t), `Code for "${t.name}"`);
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
    codeStatus(`${label} (${code.length} characters) ${copied ? 'copied to the clipboard and shown above' : 'is in the box above; copy it from there'}.`, 'ok');
    toast(copied ? `${label} copied.` : 'The browser blocked the clipboard; the code is in the box to copy by hand.');
  }
  document.getElementById('code-copy').addEventListener('click', async () => {
    if (!state.root) { codeStatus('Choose a root and allocate some nodes first.', 'err'); return; }
    const problem = templateNameProblem(tpl.name.value);
    if (problem) { codeStatus(`${problem} (The code uses the template name below.)`, 'err'); tpl.name.focus(); return; }
    showCode(await templateToCode(buildTemplate(tpl.name.value)), `Code for "${tpl.name.value.trim()}"`);
  });
  document.getElementById('code-load').addEventListener('click', async () => {
    try {
      const t = await codeToTemplate(codeBox.value);
      const made = t.mod && D.modVersion && t.mod !== D.modVersion ? `made with mod ${t.mod}, this planner has ${D.modVersion}` : '';
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
      closePicker(); hideTooltip(); toggleKeys(false);
      if (!tpl.name.value) {
        let saved = null;
        try { saved = localStorage.getItem('esp.tplName'); } catch { /* ignore */ }
        tpl.name.value = saved || (state.root ? `${byId.get(state.root).type.name} plan` : 'My plan');
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
    if (!state.root) { exportStatus('Choose a root first.', 'err'); return null; }
    const problem = templateNameProblem(tpl.name.value);
    if (problem) { exportStatus(problem, 'err'); tpl.name.focus(); return null; }
    try { localStorage.setItem('esp.tplName', tpl.name.value.trim()); } catch { /* ignore */ }
    return tpl.name.value.trim();
  }
  function reportMerge(result, where) {
    exportStatus(`${result.replaced ? 'Replaced' : 'Added'} "${result.template.name}" (${result.template.steps.length} steps) ${where}. The file now has ${result.count} template${result.count === 1 ? '' : 's'}.`, 'ok');
  }
  function download(text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = TEMPLATE_FILE;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // --- saving into an existing file, asking first when it would overwrite a template saved for another hull size
  const conflict = {
    box: document.getElementById('tpl-conflict'),
    msg: document.getElementById('tpl-conflict-msg'),
    keep: document.getElementById('tpl-keep'),
    change: document.getElementById('tpl-change'),
    newName: document.getElementById('tpl-newname'),
    asNew: document.getElementById('tpl-asnew'),
    cancel: document.getElementById('tpl-cancel'),
  };
  let pendingSave = null; // { target: 'linked' | 'download', text, fileName, name }
  function hideConflict() { conflict.box.hidden = true; pendingSave = null; }

  function startSave(target, text, fileName) {
    hideConflict();
    const name = readyToExport();
    if (!name) return;
    const plan = planMerge(text, name);
    if (!plan.hullConflict) { commitSave({ target, text, fileName }, name, 'keep'); return; }
    pendingSave = { target, text, fileName, name };
    const from = HULL_ENUM_LABEL[plan.existingHull], to = HULL_ENUM_LABEL[HULL_ENUM[state.hull]];
    conflict.msg.textContent = `"${plan.existing.name}" is already in the file as a ${from} template, but the Hull dropdown is set to ${to}. ` +
      `In game, the template list shows ${from} templates on ${from.toLowerCase()} ships.`;
    conflict.keep.textContent = `Keep ${from}`;
    conflict.keep.title = `Update the steps and keep it a ${from} template, as the game does`;
    conflict.change.textContent = `Change to ${to}`;
    conflict.change.title = `Update the steps and make it a ${to} template`;
    conflict.newName.value = uniqueTemplateName(name, plan.list);
    conflict.box.hidden = false;
    conflict.box.scrollIntoView({ block: 'nearest' });
    conflict.keep.focus();
    exportStatus('');
  }
  // mode: 'keep' | 'change' (hull of the template being replaced) or 'new' (add under saveName, which must be free).
  async function commitSave(p, saveName, mode) {
    try {
      let text = p.text;
      if (p.target === 'linked') {
        if (!(await checkAccess(true))) { exportStatus('The browser was not allowed to write to that file.', 'err'); renderTemplatesFile(); return; }
        text = await readLinked(); // re-read so changes the game made meanwhile aren't lost
      }
      if (mode === 'new') {
        const problem = templateNameProblem(saveName);
        if (problem) { exportStatus(problem, 'err'); conflict.newName.focus(); return; }
        if (findTemplateIndex(parseTemplateFile(text), saveName) >= 0) {
          exportStatus(`"${saveName.trim()}" is already used by a template on this root. Pick another name.`, 'err');
          conflict.newName.focus();
          return;
        }
      }
      const result = mergeTemplate(text, saveName, mode === 'keep' ? 'keep' : 'change');
      if (p.target === 'linked') {
        const w = await linkedHandle.createWritable();
        await w.write(result.text);
        await w.close();
        fileTemplates = JSON.parse(result.text).templates;
        reportMerge(result, `in ${linkedHandle.name}`);
      } else {
        download(result.text);
        reportMerge(result, `in a downloaded copy of ${p.fileName}`);
      }
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
  conflict.keep.addEventListener('click', () => { if (pendingSave) commitSave(pendingSave, pendingSave.name, 'keep'); });
  conflict.change.addEventListener('click', () => { if (pendingSave) commitSave(pendingSave, pendingSave.name, 'change'); });
  conflict.asNew.addEventListener('click', () => { if (pendingSave) commitSave(pendingSave, conflict.newName.value, 'new'); });
  conflict.newName.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); conflict.asNew.click(); } });
  conflict.cancel.addEventListener('click', () => { hideConflict(); exportStatus('Nothing was saved.'); tpl.name.focus(); });

  async function saveIntoLinked() {
    if (!readyToExport() || !linkedHandle) return;
    try {
      if (!(await checkAccess(true))) { exportStatus('The browser was not allowed to write to that file.', 'err'); renderTemplatesFile(); return; }
      startSave('linked', await readLinked());
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
  tf.reconnect.addEventListener('click', reconnect);
  tf.reload.addEventListener('click', reloadLinked);
  tf.forget.addEventListener('click', forgetLinked);
  tpl.save.addEventListener('click', saveIntoLinked);
  document.getElementById('tpl-merge').addEventListener('click', () => {
    if (!readyToExport()) return;
    pendingFileAction = 'merge';
    tpl.file.value = '';
    tpl.file.click();
  });
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
      } else if (action === 'merge') {
        startSave('download', text, f.name);
      }
    } catch (err) { exportStatus(err.message || String(err), 'err'); }
  });
  document.getElementById('tpl-new').addEventListener('click', () => {
    const name = readyToExport();
    if (!name) return;
    const result = mergeTemplate('', name);
    download(result.text);
    exportStatus(`Downloaded a new ${TEMPLATE_FILE} holding only "${name}".`, 'ok');
  });
  document.getElementById('tpl-copy').addEventListener('click', async () => {
    const name = readyToExport();
    if (!name) return;
    const text = JSON.stringify(buildTemplate(name), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      exportStatus('Template JSON copied. Paste it into the "templates" list of the file.', 'ok');
      toast(`Copied "${name}" as template JSON.`);
    } catch {
      exportStatus('The browser blocked the clipboard. Use one of the download options instead.', 'err');
      toast('Couldn\'t copy: the browser blocked the clipboard.');
    }
  });
  tpl.name.addEventListener('input', () => { exportStatus(''); hideConflict(); refreshExport(); });
  tpl.name.addEventListener('keydown', e => { if (e.key === 'Enter' && !tpl.save.disabled && !tpl.save.hidden) saveIntoLinked(); });
  exportBtn.addEventListener('click', () => toggleExport());
  document.getElementById('export-close').addEventListener('click', () => toggleExport(false));
  document.addEventListener('pointerdown', e => {
    if (!exportEl.hidden && !exportEl.contains(e.target) && e.target !== exportBtn) toggleExport(false);
  });
  // Debug/testing: show a file's templates without linking (the picker needs a real click).
  window.plannerTemplatesTest = Object.assign(text => { fileTemplates = parseTemplateFile(text); renderTemplatesFile(); }, { startSave });
  // Restore the linked file from the last visit (access is re-granted with one click when needed).
  if (canWriteFiles && window.indexedDB) {
    recallHandle().then(async h => {
      if (!h) return;
      linkedHandle = h;
      try { if (await checkAccess(false)) await readLinked(); } catch { fileTemplates = null; }
      if (!exportEl.hidden) renderTemplatesFile();
    });
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !exportEl.hidden) { toggleExport(false); return; }
    if (e.key === 'Escape' && !keysEl.hidden) { toggleKeys(false); return; }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    if (CAM_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!keysEl.hidden || !exportEl.hidden || !els.picker.hidden) return; // open lists keep the keys for scrolling
      e.preventDefault();
      camKeys.add(e.key);
      return;
    }
    if (e.key === '?') { e.preventDefault(); toggleKeys(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'Home') frameCore();
    else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) togglePanel();
    else if (e.key === 'Escape') closePicker();
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
  function hexA(h, a) { const c = hexRgb(h) || [255, 255, 255]; return rgba(c, a); }

  // ------------------------------------------------------------------ start
  try { if (localStorage.getItem('esp.panel') === '0' || window.innerWidth < 720) els.panel.classList.add('closed'); } catch { if (window.innerWidth < 720) els.panel.classList.add('closed'); }
  document.body.classList.toggle('panel-open', !els.panel.classList.contains('closed'));
  loadInitial();
  resize();
  frameCore();
  cachedTotals = totals();
  renderChrome();
  renderPanel();
  requestDraw();

  // Debug/testing hook.
  window.planner = { state, byId, images, cam, lastChoice, tooltipHtml,
    click: (id, quick) => primaryAction(byId.get(id), 400, 300, quick),
    pick: (id, opt) => { rememberChoice(byId.get(id), opt); },
    load: json => { deserialize(json); changed(); },
    setWormholeOption, templateSteps, buildTemplate, mergeTemplate, planMerge, uniqueTemplateName, importTemplate, currentNodeId,
    templateToCode, codeToTemplate, pathTo, removalSet, allocate: id => allocate(byId.get(id)), chooseRoot: id => chooseRoot(byId.get(id)), totals, describe, serialize };
})();
