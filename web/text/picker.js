// Pickers: the small menus a click opens on the map (the root, a choice node, a wormhole or exit, a socket), and the
// one-line summary of what a socketed subroutine does (also in tooltips and the Effects tab).
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // The starting root (right-click): a shortcut to Reset.
    "picker.reset.heading": "Reset the build?",
    "picker.reset.button": "Reset build",

    // A choice node (affinity nodes and others with options).
    // e.g. Affinity: choose an option
    "picker.choice.heading": "{node}: choose an option",
    "picker.removeNode": "Remove node",

    // A wormhole or a linked exit. {place} is a place name (tooltip.js).
    // e.g. Jump to Core (midline_wormhole_1)
    "picker.jump": "Jump to {place}",
    // Removing it takes the nodes beyond it with it.
    // e.g. Remove (2 nodes)
    "picker.remove.one": "Remove ({count} node)",
    "picker.remove.other": "Remove ({count} nodes)",
    // e.g. Unlink anchor (6 nodes)
    "picker.unlink.one": "Unlink anchor ({count} node)",
    "picker.unlink.other": "Unlink anchor ({count} nodes)",
    // e.g. Allocate (5 nodes)
    "picker.allocate.one": "Allocate ({count} node)",
    "picker.allocate.other": "Allocate ({count} nodes)",
    // e.g. Allocate (14 nodes, through the waypoints)
    "picker.allocateVia.one": "Allocate ({count} node, through the waypoints)",
    "picker.allocateVia.other": "Allocate ({count} nodes, through the waypoints)",
    "picker.unreachable": "Not reachable from current build.",

    // A socket: two sections, a subroutine or a wormhole anchor, each saying what the socket holds.
    "picker.socket.subroutine": "Subroutine",
    "picker.socket.noneSocketed": "None socketed",
    "picker.socket.anchor": "Wormhole anchor",
    // e.g. Linked to Hegemony
    "picker.socket.linkedTo": "Linked to {volume}",
    "picker.socket.noneLinked": "None linked",
    "picker.socket.remove": "Remove socket",

    // The subroutine section.
    "picker.sub.socketed": "Socketed subroutine",
    "picker.sub.conduitAffinity": "Affinity (rolled per item; pick the one yours shows):",
    // e.g. Notables it allocates (2 of up to 3; rolled per item, pick the ones yours shows):
    "picker.sub.cacheNotables": "Notables it allocates ({have} of up to {max}; rolled per item, pick the ones yours shows):",
    "picker.cache.removeTitle": "Remove from the cache",
    "picker.cache.addPlaceholder": "Add a notable by name",
    // Under a notable the cache holds when it isn't giving anything.
    "picker.cache.byPath": "(idle: already allocated)",
    "picker.cache.duplicate": "(idle: another cache allocates it)",
    "picker.cache.volumeOff": "(inert while its volume is hidden)",
    // {reason} is the rule's refusal, or the word below when there's none.
    // e.g. (inactive: Not on frigates: only on destroyers and cruisers.)
    "picker.cache.inactive": "(inactive: {reason})",
    "picker.cache.refused": "refused",
    "picker.sub.remove": "Remove subroutine",
    "picker.sub.listHeading": "Subroutines (click the socketed one again to remove it)",
    "picker.sub.listHeadingEmpty": "Socket a subroutine",
    "picker.sub.current": "Socketed. Click to remove.",
    "picker.sub.removeTitle": "Remove from this socket",
    "picker.sub.addTitle": "Socket into this socket",

    // What a socketed subroutine does now.
    "picker.summary.inactive": "Inactive: the socket isn't allocated.",
    // e.g. +45 High Tech affinity (9 nodes between the root and this socket).
    "picker.summary.conduit.one": "+{bonus} {affinity} affinity ({count} node between the root and this socket).",
    "picker.summary.conduit.other": "+{bonus} {affinity} affinity ({count} nodes between the root and this socket).",
    "picker.summary.conduitNone": "Grants nothing: no allocated route from the root reaches this socket.",
    // {small} is how many small nodes are in its radius.
    // e.g. +11 to every affinity (11 small nodes in its radius). 5 allocated small nodes in it grant nothing.
    "picker.summary.shell.one": "+{small} to every affinity ({small} small nodes in its radius). {count} allocated small node in it grant nothing.",
    "picker.summary.shell.other": "+{small} to every affinity ({small} small nodes in its radius). {count} allocated small nodes in it grant nothing.",
    // {when} is the gate condition (names.js).
    // e.g. Below 50% hull: 3 allocated nodes of 5 in its radius apply ×3, live-in-combat effects only.
    "picker.summary.gate.one": "{when}: {count} allocated node of {total} in its radius apply ×{strength}, live-in-combat effects only.",
    "picker.summary.gate.other": "{when}: {count} allocated nodes of {total} in its radius apply ×{strength}, live-in-combat effects only.",
    "picker.summary.doctrineInactive": "Inactive: only one doctrine archive works per ship.",
    // e.g. 14 nodes in its radius are rewritten. What each gets is rolled per item, so the totals leave it out.
    "picker.summary.rewritten": "{count} nodes in its radius are rewritten. What each gets is rolled per item, so the totals leave it out.",
    "picker.summary.augmented": "{count} nodes in its radius are augmented. What each gets is rolled per item, so the totals leave it out.",
    // e.g. 2 notables allocated for free (no path, no node slot).
    "picker.summary.cache.one": "{count} notable allocated for free (no path, no node slot).",
    "picker.summary.cache.other": "{count} notables allocated for free (no path, no node slot).",

    // The anchor section: each faction volume's exit, with why it can't be linked.
    "picker.anchor.hidden": "Hidden under Optional Volumes in Optional rules",
    "picker.anchor.taken": "Linked to another socket",
    // {gates} is a list of game states, from the gate names.
    // e.g. In game: Remnant fought
    "picker.anchor.inGame": "In game: {gates}",
    "picker.anchor.unlink": "Unlink anchor",
});
