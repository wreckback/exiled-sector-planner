// The top bar and the banner under it. (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // The browser tab's title.
    "bar.pageTitle": "Exiled Sector Planner",
    "bar.brand": "Exiled Sector",
    "bar.brandSub": "Skill Tree Planner",

    "bar.root": "Root",
    // Root, before one is chosen (also the banner's fallback when the mod's own prompt is missing).
    "bar.chooseRoot": "Choose a root",
    // The template the build came from.
    "bar.template": "Template",
    "bar.template.title": "Click to open Templates.",
    "bar.template.edited": "(edited)",
    "bar.nodes": "Nodes",
    "bar.cap.title": "Node cap (mod default is 60)",
    "bar.hull": "Hull Size",
    "bar.search.placeholder": "Search nodes…",

    // The buttons, left to right. (List, Filter, Ship rules, Optional rules and Show mod assets are in list.js,
    // filter.js, below and assets.js.)
    "bar.center": "Center",
    "bar.undoButton": "Undo",
    "bar.reset": "Reset",
    "bar.reset.title": "Reset build",
    "bar.targets": "Target Mode",
    "bar.targets.title": "Mark nodes wanted or forbidden, then calculate the most efficient path (T)",
    "bar.copyCode": "Copy code",
    "bar.copyCode.title": "Copy the current template into clipboard. Load with Templates → Load code",
    "bar.templates": "Templates",
    "bar.templates.title": "Import and export templates",
    "bar.checkFile": "Check file",
    "bar.checkFile.title": "Check the linked templates file for changes the game made (also reconnects it after a browser restart)",
    "bar.summary": "Summary",
    "bar.summary.title": "Show or hide summary (S)",
    "bar.shortcuts": "Shortcuts",

    // The line of hints at the bottom of the map.
    "bar.help": "<b>Click</b> allocate · <b>Shift+click</b> set waypoint · <b>Right-click</b> remove · <b>Alt+click</b>/<b>I</b> integrate · <b>T</b> target mode · <b>L</b> list view · <b>Drag</b>/<b>arrows</b> pan · <b>Wheel</b>/<b>PgUp</b>/<b>PgDn</b> zoom · <b>?</b> all shortcuts",

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
