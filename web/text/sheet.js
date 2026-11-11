// The stat sheet: the summary panel's Stats tab and the Full Sheet. Most of its wording is the mod's own (ui.stats.*,
// summary.*); these are the planner's lines, and fallbacks used only when the mod's are missing.
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // The Full Sheet's bar.
    "sheet.title": "Stats",
    "sheet.side": "Side Panel",
    "sheet.sideTitle": "Back to the Stats tab in the summary panel",

    "sheet.tabHint": "The in-game stat sheet. Hover over the effects to see source(s).",
    "sheet.expandTitle": "Open the stat sheet in full, laid out like the game's",
    // Under the Full Sheet's title. {hull} is the Hull Size dropdown's size.
    // e.g. High Tech Root · Cruiser · 23/60 nodes
    "sheet.sub": "{root} · {hull} · {used}/{cap} nodes",
    // On a source in the hover list that's an integrated node.
    "sheet.integratedTitle": "Integrated",

    // Fallbacks for the mod's ui.stats.nodes, ui.stats.expand, ui.stats.breakdown.heading and summary.forFirst.
    "sheet.fallback.nodes": "Nodes",
    "sheet.fallback.expand": "Full Sheet",
    "sheet.fallback.sources": "Sources",
    // {seconds} and {text} are filled in by the planner.
    "sheet.fallback.forFirst": "For the first {seconds} seconds after deployment: {text}",
    // Fallback for the mod's summary.gated.*: {when} is the gate condition (names.js), {text} the effect.
    "sheet.fallback.gated": "{when}: {text}",
});
