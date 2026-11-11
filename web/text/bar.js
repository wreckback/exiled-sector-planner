// The top bar and the banner under it. (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // Root, before one is chosen (also the banner's fallback when the mod's own prompt is missing).
    "bar.chooseRoot": "Choose a root",

    // e.g. Undo, 3 steps stored (Ctrl+Z)
    "bar.undo.one": "Undo, {count} step stored (Ctrl+Z)",
    "bar.undo.other": "Undo, {count} steps stored (Ctrl+Z)",

    // The rules buttons, with how many rules are set.
    "bar.shipRules": "Ship rules",
    // e.g. Ship rules (3)
    "bar.shipRules.set": "Ship rules ({n})",
    "bar.optionalRules": "Optional rules",
    // e.g. Optional rules (2)
    "bar.optionalRules.set": "Optional rules ({n})",

    // The theme button: Dark, then Light, then Auto (following the system), then Dark again.
    "bar.theme.dark": "Dark",
    "bar.theme.light": "Light",
    // e.g. Theme: Dark
    "bar.theme.fixed": "Theme: {theme}",
    // e.g. Theme: Auto (Light)
    "bar.theme.auto": "Theme: Auto ({theme})",

    // The banner while waypoints are set.
    // e.g. 2 waypoints: click a node to start pathing. Shift+click an existing waypoint to drop it, Esc to clear.
    "bar.waypoints.one": "{count} waypoint: click a node to start pathing. Shift+click an existing waypoint to drop it, Esc to clear.",
    "bar.waypoints.other": "{count} waypoints: click a node to start pathing. Shift+click an existing waypoint to drop it, Esc to clear.",
});
