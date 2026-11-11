// The Optional rules dialog: campaign progress, unlocks and optional volumes the planner can't see.
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    "optional.title": "Optional rules",

    // The summary at the top. {gates} and {volumes} are the counted phrases below.
    "optional.summary.none": "Everything is ticked.",
    // e.g. Unticked: 3 gates or unlocks.
    "optional.summary.gates": "Unticked: {gates}.",
    // e.g. Unticked: 1 optional volume toggle.
    "optional.summary.volumes": "Unticked: {volumes}.",
    // e.g. Unticked: 3 gates or unlocks and 1 optional volume toggle.
    "optional.summary.both": "Unticked: {gates} and {volumes}.",
    "optional.count.gates.one": "{count} gate or unlock",
    "optional.count.gates.other": "{count} gates or unlocks",
    "optional.count.volumes.one": "{count} optional volume toggle",
    "optional.count.volumes.other": "{count} optional volume toggles",

    "optional.wormholesHeading": "Wormholes",

    // Optional Volumes
    "optional.volumesHeading": "Optional Volumes",
    "optional.volumes.intro": "Volumes built around other mods. Install the corresponding mod or turn on its LunaLib option.",
    // After each volume toggle and each gate: how many nodes it covers.
    // e.g. Lost Sector volumes (Kesteven and Frozen Heart) (30 nodes)
    "optional.nodeCount.one": "({count} node)",
    "optional.nodeCount.other": "({count} nodes)",
    // Above the gates listed under a volume toggle.
    "optional.volumes.gates": "Game state reached:",
    "optional.volumes.none": "None in this mod version.",

    "optional.gatesHeading": "Game state reached",
    "optional.unlocksHeading": "Unlocked hullmods",

    // Integration cost
    "optional.integHeading": "Integration cost",
    "optional.integ.intro": "The mod's LunaLib setting Integration Story Point Cost. Only changes the story points shown.",
    "optional.integ.label": "Story points per integration",
    "optional.integ.exponential": "Exponential: 1, 2, 4, 8… (default)",
    "optional.integ.additive": "Additive: 1, 2, 3, 4…",
    "optional.integ.static": "Static: 2 each",

    "optional.reset": "Reset optional rules",
});
