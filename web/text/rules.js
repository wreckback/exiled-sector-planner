// Why a node can't be allocated: the node rules (as the mod's NodeEligibility) and the paths to a node.
// Shown in tooltips, pickers, the Ship tab's problem list, target mode and toasts.
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // Paths.
    // e.g. The Hegemony volume is hidden. Enable the Optional Volumes in Optional rules.
    "rule.volumeHidden": "The {volume} volume is hidden. Enable the Optional Volumes in Optional rules.",
    // e.g. Waypoint Ballistic Mastery: The Hegemony volume is hidden. Enable the Optional Volumes in Optional rules.
    "rule.waypointHidden": "Waypoint {node}: {reason}",
    // e.g. Already allocated by the Contraband Modspec Cache. Change its notables in the socket to free it.
    "rule.granted": "Already allocated by the {item}. Change its notables in the socket to free it.",
    // e.g. Wormhole Exit opens only through an anchor linked in a subroutine socket.
    "rule.exitNeedsAnchor": "{node} opens only through an anchor linked in a subroutine socket.",
    // Through waypoints: from one waypoint to the next, or from the build to the first.
    // e.g. No legal way from Ballistic Mastery to Phase Anchor.
    "rule.noWayFrom": "No legal way from {from} to {node}.",
    // e.g. No legal way to reach Phase Anchor.
    "rule.noWay": "No legal way to reach {node}.",
    // When the refusal is on the way to the node, not the node itself. {reason} is one of the reasons below.
    // e.g. The way to Phase Anchor passes Adaptive Phase Coils: Already have Adaptive Phase Coils allocated.
    "rule.wayPasses": "The way to {target} passes {node}: {reason}",

    // Optional rules: unticked unlocks and game states.
    // {unlock} is one or more of the unlock phrases below, joined with "or".
    // e.g. Not unlocked yet: needs the Adaptive Phase Coils blueprint (Optional rules).
    "rule.notUnlocked": "Not unlocked yet: needs {unlock} (Optional rules).",
    "rule.unlock.blueprint": "the {hullmod} blueprint",
    "rule.unlock.shipLevel": "ship level {level}",
    // Used when the mod's unlock names no stat or flag.
    "rule.unlock.characterStat": "a character stat",
    "rule.unlock.campaignFlag": "a campaign flag",
    "rule.unlock.any": "an unlock",
    // {gate} is the mod's own wording for the game state, inside a sentence.
    // e.g. Locked until the Existential Threat is defeated (Optional rules).
    "rule.lockedUntil": "Locked until {gate} (Optional rules).",

    // Hull size. {hull} and {hulls} are hull size plurals (names.js); {hulls} is a list joined with "and".
    // e.g. Not on frigates: only on destroyers and cruisers.
    "rule.hullSize": "Not on {hull}: only on {hulls}.",

    // Ship rules. The mod has its own wording for these (node.block.*, node.requires.*); these are used only when it's
    // missing. {hullmod} and {node} are names.
    "rule.fallback.nonPhase": "Can't be allocated on phase ships.",
    "rule.fallback.noShields": "Ship has no shields.",
    "rule.fallback.frontShield": "Ship already has front shields.",
    "rule.fallback.omniShield": "Ship already has omni-directional shields.",
    "rule.fallback.phaseHull": "Requires a phase hull.",
    "rule.fallback.lowArmor": "Requires a non-phase hull with low base armor.",
    "rule.fallback.builtInWings": "Requires built-in strikecraft wings only.",
    // {requirement} is the requirement's tag in words.
    // e.g. Civilian hull required.
    "rule.fallback.requires": "{requirement} required.",
    "rule.fallback.hullModInstalled": "Ship already has {hullmod} installed.",
    "rule.fallback.typeAllocated": "Already have {node} allocated.",
    "rule.fallback.logisticsCap": "This ship is at its logistics node limit.",
    // After the low armor reason when the Ship tab's base armor is over the cutoff.
    // e.g. Requires a non-phase hull with low base armor. (900 or less on a cruiser; this ship has 2000)
    "rule.lowArmorDetail": "{reason} ({cutoff} or less on a {hull}; this ship has {armor})",
    // After the logistics reason.
    // e.g. This ship is at its logistics node limit. (2 per ship)
    "rule.logisticsDetail": "{reason} ({limit} per ship)",

    // Subroutines: how many of a kind (or of one item) a ship can socket. {kind} is the kind in words.
    // e.g. Only 1 doctrine per ship.
    "rule.subKindLimit": "Only {count} {kind} per ship.",
    // e.g. Only 1 per ship.
    "rule.subLimit": "Only {count} per ship.",
});
