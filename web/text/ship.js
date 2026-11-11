// Ship rules: the summary panel's Ship tab. Facts about the ship that the planner can't see, used by the node rules.
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    "ship.intro": "Set ship-specific limitations here. Anything left as \"Not set\" isn't checked. Set hull size in the Hull size dropdown in the main header.",

    // e.g. 3 ship rules set.
    "ship.summary.one": "{count} ship rule set.",
    "ship.summary.other": "{count} ship rules set.",
    // Added after the summary here and in the Optional rules dialog when allocated nodes break a rule.
    // e.g. 3 ship rules set. 2 illegal allocated nodes.
    "ship.problemCount.one": "{count} illegal allocated node.",
    "ship.problemCount.other": "{count} illegal allocated nodes.",

    // Ship Options
    "ship.optionsHeading": "Ship Options",
    "ship.shield.label": "Shield",
    "ship.shield.front": "Front shield",
    "ship.shield.omni": "Omni shield",
    "ship.shield.none": "No shield",
    "ship.shield.phase": "Phase cloak",
    "ship.armor.label": "Base armor",
    "ship.armor.hint": "(before hullmods and skills)",
    // e.g. Low-armor nodes need 900 or less on a cruiser (only Critical Point Refit for now).
    //      ({hull} is the hull size from the Hull Size dropdown, in lowercase)
    "ship.armor.note": "Low-armor nodes need {armor} or less on a {hull} (only Critical Point Refit for now).",
    "ship.civilian.label": "Civilian-grade hull",
    "ship.charges.label": "System uses charges",
    "ship.modules.label": "Has station modules",
    "ship.wings.label": "Only built-in fighter wings",

    // Installed Hullmods
    "ship.hullmodsHeading": "Installed Hullmods",
    "ship.hullmods.none": "None listed.",
    // The hover text of an installed hullmod. {name} is the hullmod's name from the mod data, {id} its id.
    // e.g. ABSORB System (nskr_absorption). Refuses ABSORB Reserve
    "ship.hullmod.refuses": "{name} ({id}). Refuses {nodes}",
    // Only for a hullmod an older saved build lists that no node clashes with any more; its name is then its id.
    // e.g. old_hullmod (old_hullmod). No node clashes with this hullmod
    "ship.hullmod.noClash": "{name} ({id}). No node clashes with this hullmod",
    "ship.hullmod.remove": "Remove",
    // e.g. Remove ABSORB System
    "ship.hullmod.removeNamed": "Remove {name}",
    "ship.addHullmod.label": "Add a hullmod",
    "ship.addHullmod.placeholder": "Type the hullmod's name",
    // {name} is what was typed.
    // e.g. No node clashes with "Armor plating", so it doesn't change anything. Pick one from the list.
    "ship.addHullmod.unknown": "No node clashes with \"{name}\", so it doesn't change anything. Pick one from the list.",

    // Logistics
    "ship.logisticsHeading": "Logistics",
    "ship.logistics.label": "Extra logistics slots",
    // e.g. Limit: 2 logistics notables and keystones. Some items add slots in game.
    "ship.logistics.note": "Limit: {limit} logistics notables and keystones. Some items add slots in game.",

    "ship.reset": "Reset ship rules",
});
