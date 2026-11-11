// The map's tooltips: what shows when the pointer rests on a node, top to bottom.
// (How these files work: see common.js. <hl>…</hl> highlights, <muted>…</muted> greys, <builtIn>…</builtIn> is the
// story point green, <b>…</b> is bold.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // Next to the tier under the node's name: " · Integrated".
    "tooltip.integ.integrated": "Integrated",
    "tooltip.integ.preview": "Integrated (preview)",

    // Effects. A line for each hullmod a node grants.
    // e.g. Grants Adaptive Phase Coils.
    "tooltip.grantsHullmod": "Grants <hl>{hullmod}</hl>.",

    // A node's normal and integrated effects together (the summary panel's "Integrated effects" setting).
    // Side by side: the two column headings, "active" on the one the build uses, and the next integration's cost.
    "tooltip.integ.normal": "Normal",
    "tooltip.integ.active": "active",
    // e.g. (+1 story point)
    "tooltip.integ.cost": "(+{points})",
    // Inline: the heading, then each line with the other set's number in brackets.
    "tooltip.integ.normalInBrackets": "· normal values in brackets",
    "tooltip.integ.integratedInBrackets": "Integrated values in brackets",
    // e.g. 40% (integrated 60%) increased hard flux level at which phased speed reaches its minimum.
    "tooltip.integ.otherValue.integrated": "(integrated {value})",
    // e.g. 60% (normal 40%) increased hard flux level at which phased speed reaches its minimum.
    "tooltip.integ.otherValue.normal": "(normal {value})",
    // Before a line only the integrated node has.
    // e.g. ▲ When integrated: In addition, grants 100% increased shield turn rate.
    "tooltip.integ.whenIntegrated": "▲ When integrated:",
    // After a line the integrated node no longer has.
    "tooltip.integ.removed": "(removed when integrated)",
    // Used only when the mod's own wording (node.integration.instead, .inAddition, .removes) is missing.
    // {line} is the effect line.
    "tooltip.integ.instead": "Instead grants {line}",
    "tooltip.integ.inAddition": "In addition, grants {line}",
    "tooltip.integ.removes": "No longer grants {line}",
    // A doctrine line's lowest and highest roll, when the two wordings differ by more than one number (none in the
    // current data; most show as one line, like "2–4% increased armor.").
    // e.g. 2% increased armor. to 4% increased armor.
    "tooltip.range": "{low} to {high}",

    // Sockets, wormholes and exits, in place of effects.
    // e.g. Linked to Hegemony.
    "tooltip.socket.linked": "Linked to <hl>{volume}</hl>.",
    "tooltip.socket.empty": "Install a subroutine, or an anchor.",
    // e.g. Leads to Wormhole. Allocating it also allocates the other end.
    "tooltip.wormhole.leadsTo": "Leads to <hl>{node}</hl>. Allocating it also allocates the other end.",
    "tooltip.wormhole.leadsToAnother": "Leads to another wormhole. Allocating it also allocates the other end.",
    // e.g. Hegemony volume's Wormhole exit. Reached by linking an anchor in a subroutine socket.
    "tooltip.exit": "<hl>{volume}</hl> volume's Wormhole exit. Reached by linking an anchor in a subroutine socket.",

    // Used only when the mod's own wording (node.exclusive.hullmods, node.exclusive.nodes) is missing.
    "tooltip.exclusive.hullmods": "Mutually exclusive with hullmods",
    "tooltip.exclusive.nodes": "Mutually exclusive with nodes",
    // e.g. Themes:Flux, Phase
    "tooltip.themes": "Themes:{themes}",
    // e.g. Needs a ship with: Shields, Unscripted hull
    "tooltip.needs": "Needs a ship with: {needs}",
    // e.g. Unlocked by: Ancient prototype found, Existential threat defeated
    "tooltip.unlockedBy": "Unlocked by: {gates}",
    // {reason} is the rule's text (often the mod's own wording).
    // e.g. Breaks a node rule: Requires a phase hull.
    "tooltip.problem": "Breaks a node rule: {reason}",

    // How a socketed subroutine affects a node in its radius.
    "tooltip.shell.silenced": "Grants nothing: inside Empty Shell Axion's radius.",
    "tooltip.shell.inRadius": "Inside Empty Shell Axion's radius: no effects granted if allocated.",
    // {when} is a gate condition inside a sentence (names.js).
    // e.g. Phoenix Ash Archive: applies only below 50% hull, at ×3. Effects not read live in combat are lost.
    "tooltip.gated": "{item}: applies only {when}, at ×{strength}. Effects not read live in combat are lost.",
    // e.g. Tri-Tachyon Doctrine Archive rewrites it into one of: TriPad Backdoor, Alpha-Grade Fire Control, Flux Arbitrage. Which one is rolled per item; the planner shows the original.
    "tooltip.doctrine.rewrites": "{item} rewrites it into one of: {types}. Which one is rolled per item; the planner shows the original.",
    // {tier} is the node's tier inside a sentence (names.js).
    // e.g. In the Tri-Tachyon Doctrine Archive's radius, but it has no small replacements, so it stays as it is.
    "tooltip.doctrine.noReplacements": "In the {item}'s radius, but it has no {tier} replacements, so it stays as it is.",
    // {lines} is a number or a range.
    // e.g. Hegemony Doctrine Archive adds 1–2 of these lines (rolled per item, not in the totals):
    "tooltip.doctrine.adds": "{item} adds {lines} of these lines (rolled per item, not in the totals):",
    // Between two effects of one doctrine modifier, shown as one line. Keep the spaces at both ends.
    // (No modifier has two effects in the current data; this is how it would read.)
    // e.g. · 2–4% increased armor and 2–4% increased hull points.
    "tooltip.doctrine.lineJoin": " and ",
    // e.g. On the Root Conduit's route: +5 High Tech affinity.
    "tooltip.conduitRoute": "On the Root Conduit's route: +5 {affinity} affinity.",
    // e.g. Allocated for free by the Contraband Modspec Cache (no path, no node slot). Change the cache's notables in its socket to free it.
    "tooltip.granted": "Allocated for free by the {item} (no path, no node slot). Change the cache's notables in its socket to free it.",

    // What a click does. {place} is a place name (below).
    // e.g. Ctrl+click to jump to the Hegemony volume.
    "tooltip.jump": "Ctrl+click to jump to {place}.",
    // On a wormhole or a linked exit.
    // e.g. Click for options (jump). Ctrl+click to jump to Core (midline_wormhole_1).
    "tooltip.wormhole.options": "Click for options (jump). Ctrl+click to jump to {place}.",
    // e.g. Click for options (jump, allocate). Ctrl+click to jump to Core (midline_wormhole_1).
    "tooltip.wormhole.options.allocate": "Click for options (jump, allocate). Ctrl+click to jump to {place}.",
    // e.g. Click for options (jump, remove). Ctrl+click to jump to the Hegemony volume.
    "tooltip.wormhole.options.remove": "Click for options (jump, remove). Ctrl+click to jump to {place}.",
    "tooltip.root.choose": "Click to start from this root.",
    "tooltip.root.start": "Starting root. Right-click to reset the build.",
    "tooltip.socket.change": "Click to change what it holds. Right-click to remove.",
    "tooltip.socket.fill": "Click to socket a subroutine or link an anchor. Right-click to remove.",
    "tooltip.choice.options": "Click for options. Right-click to remove.",
    "tooltip.remove": "Click to remove.",
    // Removing it takes nodes beyond it with it.
    // e.g. Click to remove (4 nodes).
    "tooltip.removeMany": "Click to remove ({count} nodes).",
    // {reason} is the refusal (rules.js, or the mod's own wording).
    // e.g. Can't be allocated. Requires a phase hull.
    "tooltip.refused": "Can't be allocated. {reason}",
    // e.g. Can't be allocated through 2 waypoints. The way to Phase Anchor passes Adaptive Phase Coils: Already have Adaptive Phase Coils allocated.
    "tooltip.refusedVia.one": "Can't be allocated through {count} waypoint. {reason}",
    "tooltip.refusedVia.other": "Can't be allocated through {count} waypoints. {reason}",
    "tooltip.exitUnlinked": "Link an anchor in a subroutine socket to reach this node.",
    "tooltip.unreachable": "Not reachable from your allocated nodes.",
    // Over the node cap. {nodes} and {waypoints} are the counted phrases below.
    // e.g. 12 nodes needed; Only 3 left (over cap).
    "tooltip.overCap": "{nodes} needed; Only {left} left (over cap).",
    // e.g. 12 nodes through 2 waypoints needed; Only 3 left (over cap).
    "tooltip.overCapVia": "{nodes} through {waypoints} needed; Only {left} left (over cap).",
    "tooltip.nodes.one": "{count} node",
    "tooltip.nodes.other": "{count} nodes",
    "tooltip.waypoints.one": "{count} waypoint",
    "tooltip.waypoints.other": "{count} waypoints",
    // Allocating: one node, several, through waypoints, and on a choice node (which then asks for an option).
    "tooltip.allocate": "Click to allocate.",
    // e.g. Click to allocate (4 nodes).
    "tooltip.allocate.many": "Click to allocate ({count} nodes).",
    // e.g. Click to allocate through 1 waypoint.
    "tooltip.allocate.via": "Click to allocate through {waypoints}.",
    // e.g. Click to allocate (6 nodes through 2 waypoints).
    "tooltip.allocate.manyVia": "Click to allocate ({count} nodes through {waypoints}).",
    "tooltip.allocate.choice": "Click to allocate and pick an option.",
    // e.g. Click to allocate (4 nodes) and pick an option.
    "tooltip.allocate.many.choice": "Click to allocate ({count} nodes) and pick an option.",
    // e.g. Click to allocate through 1 waypoint and pick an option.
    "tooltip.allocate.via.choice": "Click to allocate through {waypoints} and pick an option.",
    // e.g. Click to allocate (6 nodes through 2 waypoints) and pick an option.
    "tooltip.allocate.manyVia.choice": "Click to allocate ({count} nodes through {waypoints}) and pick an option.",
    // Integration.
    "tooltip.integ.remove": "Alt+click or I to remove integration.",
    "tooltip.integ.removeKept": "Integrated, kept while unallocated. Alt+click or I to remove integration.",
    // e.g. Alt+click or I to integrate (+2 story points).
    "tooltip.integ.add": "Alt+click or I to integrate (+{points}).",
    // Waypoints.
    // e.g. Waypoint 2. Shift+click delete waypoint.
    "tooltip.waypoint.this": "Waypoint {number}. Shift+click delete waypoint.",
    // e.g. Shift+click waypoint 3.
    "tooltip.waypoint.next": "Shift+click waypoint {number}.",
    // Ctrl+click on a choice node reuses the option last picked for that kind of node.
    // e.g. Ctrl+click to switch to High Tech.
    "tooltip.choice.switchTo": "Ctrl+click to switch to {option}.",
    // e.g. Ctrl+click to allocate as High Tech.
    "tooltip.choice.allocateAs": "Ctrl+click to allocate as {option}.",
    // e.g. Ctrl+click to allocate as High Tech, path included.
    "tooltip.choice.allocateAsPath": "Ctrl+click to allocate as {option}, path included.",

    // In target mode, in place of the click notes above.
    "tooltip.target.root": "Starting root: always in the build.",
    "tooltip.target.wanted": "<b>Wanted.</b> Click to forbid it. Right-click to clear.",
    "tooltip.target.forbidden": "<b>Forbidden.</b> Click to clear it.",
    "tooltip.target.none": "Click to mark it wanted.",
    "tooltip.target.onPath": "On the planned path.",

    // Place names, for jumps. The core's parts have no names in the mod, so they go by the node's id.
    // e.g. the Hegemony volume
    "tooltip.place.volume": "the {volume} volume",
    // e.g. Core (midline_wormhole_1)
    "tooltip.place.core": "Core ({id})",
});
