// Names the planner gives things the mod's data doesn't name, and short labels used across the page.
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // Node tiers, under a node's name in tooltips, lists and pickers.
    "name.tier.small": "Node",
    "name.tier.notable": "Notable",
    "name.tier.keystone": "Keystone",
    "name.tier.wormhole": "Wormhole",
    "name.tier.wormholeExit": "Wormhole exit",
    "name.tier.root": "Root",
    "name.tier.socket": "Subroutine socket",
    // Inside a sentence ("it has no small replacements"), for the tiers a doctrine archive rewrites.
    "name.tier.small.inSentence": "small",
    "name.tier.notable.inSentence": "notable",
    "name.tier.keystone.inSentence": "keystone",

    // A count of story points (integration costs).
    // e.g. 2 story points
    "label.storyPoints.one": "{count} story point",
    "label.storyPoints.other": "{count} story points",

    // The three techs' affinities. The .stat forms are used where an effect's own wording is missing.
    "name.affinity.lowTech": "Low Tech",
    "name.affinity.midline": "Midline",
    "name.affinity.highTech": "High Tech",
    "name.affinity.lowTech.stat": "low tech affinity",
    "name.affinity.midline.stat": "midline affinity",
    "name.affinity.highTech.stat": "high tech affinity",

    // Volumes: the core tree and the faction volumes (the mod names none of them).
    "name.volume.core": "Core",
    "name.volume.luddic": "Luddic",
    "name.volume.pirate": "Pirate",
    "name.volume.hegemony": "Hegemony",
    "name.volume.persean_league": "Persean League",
    "name.volume.tritachyon": "Tri-Tachyon",
    "name.volume.sindrian_dictat": "Sindrian Diktat",
    "name.volume.REDACTED": "[REDACTED]",
    "name.volume.tania": "Navarchy of Tania",
    "name.volume.stargazer": "Stargazer",
    "name.volume.omega": "Omega",
    "name.volume.abyss": "Abyss",
    "name.volume.shrouded": "Shrouded",
    "name.volume.nightcross": "Nightcross",
    "name.volume.kesteven": "Kesteven",
    "name.volume.exotech": "Exotech",
    "name.volume.enigma": "Enigma",
    "name.volume.threat": "Threat",

    // Hull sizes: on their own, inside a sentence ("on a cruiser"), and as a plural ("Not on frigates").
    "name.hull.frigate": "Frigate",
    "name.hull.destroyer": "Destroyer",
    "name.hull.cruiser": "Cruiser",
    "name.hull.capital": "Capital",
    "name.hull.frigate.inSentence": "frigate",
    "name.hull.destroyer.inSentence": "destroyer",
    "name.hull.cruiser.inSentence": "cruiser",
    "name.hull.capital.inSentence": "capital",
    "name.hull.frigate.plural": "frigates",
    "name.hull.destroyer.plural": "destroyers",
    "name.hull.cruiser.plural": "cruisers",
    "name.hull.capital.plural": "capitals",

    // When a gating subroutine (Phoenix Ash Archive, P-Space Lattice) lets the nodes in its radius work: as a heading,
    // and inside a sentence.
    "name.gate.phased": "While phased",
    "name.gate.lowHull": "Below 50% hull",
    "name.gate.systemActive": "While the ship system is active",
    "name.gate.phased.inSentence": "while phased",
    "name.gate.lowHull.inSentence": "below 50% hull",
    "name.gate.systemActive.inSentence": "while the ship system is active",

    // The summary panel's Effects tab groups totals under these headings.
    "name.group.affinity": "Affinity",
    "name.group.strikeCraft": "Strike craft",
    "name.group.weapons": "Weapons",
    "name.group.flux": "Flux",
    "name.group.defense": "Defense",
    "name.group.mobility": "Mobility",
    "name.group.phase": "Phase",
    "name.group.shipSystem": "Ship system",
    "name.group.combatReadiness": "Combat readiness",
    "name.group.logistics": "Logistics",
    "name.group.other": "Other",

    // The next three groups are keyed by the mod data's own ids. When a mod update adds an id, add a line for it here;
    // until then the planner shows the id in words (as "req_no_shields" -> "No shields").

    // What a node needs from the ship (its req_* tags), in tooltips ("Needs a ship with: …").
    "name.requirement.req_ballistic": "Ballistic",
    "name.requirement.req_beam": "Beam",
    "name.requirement.req_civilian_hull": "Civilian hull",
    "name.requirement.req_crewed": "Crewed",
    "name.requirement.req_energy": "Energy",
    "name.requirement.req_fighter_bays": "Fighter bays",
    "name.requirement.req_flagship": "Flagship",
    "name.requirement.req_missile": "Missile",
    "name.requirement.req_no_fighter_bays": "No fighter bays",
    "name.requirement.req_no_shields": "No shields",
    "name.requirement.req_non_beam_energy": "Non beam energy",
    "name.requirement.req_non_phase_hull": "Non phase hull",
    "name.requirement.req_phase": "Phase",
    "name.requirement.req_shields": "Shields",
    "name.requirement.req_system_charges": "System charges",
    "name.requirement.req_unscripted_hull": "Unscripted hull",

    // Game states that unlock nodes (their gate_* tags), in tooltips ("Unlocked by: …") and the anchor list
    // ("In game: …"). The Optional rules list uses the mod's own wording, and these only where it has none.
    "name.gameState.gate_ancient_prototype_found": "Ancient prototype found",
    "name.gameState.gate_blood_trail_defeated": "Blood trail defeated",
    "name.gameState.gate_dweller_fought": "Dweller fought",
    "name.gameState.gate_existential_threat_defeated": "Existential threat defeated",
    "name.gameState.gate_frost_fire_defeated": "Frost fire defeated",
    "name.gameState.gate_frozen_heart_visited": "Frozen heart visited",
    "name.gameState.gate_last_strive_completed": "Last strive completed",
    "name.gameState.gate_omega_found": "Omega found",
    "name.gameState.gate_pascal_visited": "Pascal visited",
    "name.gameState.gate_remnant_fought": "Remnant fought",
    "name.gameState.gate_singularity_defeated": "Singularity defeated",
    "name.gameState.gate_threat_fought": "Threat fought",

    // Subroutine kinds inside a sentence ("Only 1 doctrine per ship.").
    "name.subKind.DOCTRINE": "doctrine",
    "name.subKind.MODSPEC_CACHE": "modspec cache",
    "name.subKind.ROOT_CONDUIT": "root conduit",
    "name.subKind.UNIQUE": "unique",
    "name.subKind.BYPASS": "bypass",

    // The map's labels over each tree when zoomed out, and how many of its nodes are allocated.
    "name.region.core": "Core tree",
    // e.g. 12 allocated
    "label.regionAllocated": "{count} allocated",

    // The Filter's entry for nodes without a theme.
    "name.theme.none": "No theme",

    // Subroutines: a radius with its article, and what each kind does (in the socket picker's list).
    "label.radius.small": "a small radius",
    "label.radius.medium": "a medium radius",
    "label.radius.large": "a large radius",
    "label.radius.extra_large": "an extra large radius",
    // A radius the mod adds later, before it has its own line here. {radius} is its id with spaces.
    "label.radius.other": "a {radius} radius",
    // e.g. Doctrine (rewrites nodes in a large radius)
    "label.subKind.doctrine.rewrite": "Doctrine (rewrites nodes in {radius})",
    // e.g. Doctrine (augments nodes in a large radius)
    "label.subKind.doctrine.augment": "Doctrine (augments nodes in {radius})",
    "label.subKind.conduit": "Affinity for each node between the root and its socket",
    "label.subKind.cache": "Allocates 1 to 3 notables for free",
    // e.g. Gates nodes in a medium radius: while phased, ×3
    //      ({when} is one of the gate conditions above, inside a sentence)
    "label.subKind.gate": "Gates nodes in {radius}: {when}, ×{strength}",
    // e.g. Silences small nodes in an extra large radius for affinity
    "label.subKind.shell": "Silences small nodes in {radius} for affinity",
    // Subroutines no drop gives any more (rarity 0); still socketable for copies already owned.
    "label.unobtainable": "Unobtainable.",
});
