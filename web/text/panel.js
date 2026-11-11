// The summary panel on the right: its heading, the affinity and integration blocks, the Effects and Notables tabs,
// rule problems and the footer. (How these files work: see common.js. <muted>…</muted> greys, <builtIn>…</builtIn> is
// the story point green.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    "panel.heading": "Build summary",
    // Next to "Build summary".
    // e.g. 23 of 60 nodes
    "panel.nodesUsed": "{used} of {cap} nodes",
    // The affinity tiles. {affinity} is Low Tech, Midline or High Tech (names.js).
    // e.g. High Tech affinity
    "panel.affinityTile": "{affinity} affinity",
    // The affinity nodes block: set them all to one tech, or to a split of the three.
    "panel.affMix.count": "Affinity nodes:",
    "panel.affMix.allTo": "All to",
    "panel.affMix.low": "Low",
    "panel.affMix.mid": "Mid",
    "panel.affMix.high": "High",
    "panel.affMix.lowTitle": "Set every allocated affinity node to Low Tech",
    "panel.affMix.midTitle": "Set every allocated affinity node to Midline",
    "panel.affMix.highTitle": "Set every allocated affinity node to High Tech",
    "panel.affMix.apply": "Apply",
    "panel.affMix.applyTitle": "Change affinity nodes to this split (Enter)",
    // Under the affinity split boxes when they don't add up.
    // e.g. These add up to 30; 35 affinity nodes are allocated.
    "panel.affMix.mismatch.one": "These add up to {sum}; {count} affinity node is allocated.",
    "panel.affMix.mismatch.other": "These add up to {sum}; {count} affinity nodes are allocated.",

    // The integration block's buttons and settings.
    "panel.integ.all": "Integrate all nodes",
    "panel.integ.none": "Remove all integrations",
    "panel.integ.previewLabel": "Preview all integrated",
    "panel.integ.previewTitle": "See stats as if every allocated node were integrated. No changes to the build",
    "panel.integ.keepLabel": "Keep when removed",
    "panel.integ.keepTitle": "On: a removed node stays integrated (SP increase). Off: removing a node removes its integration",
    "panel.integ.viewLabel": "Integrated effects",
    "panel.integ.viewTitle": "How tooltips and the list view show a node's integrated effects next to its normal ones",
    "panel.integ.viewInline": "Inline",
    "panel.integ.viewColumns": "Side by side",
    // The integration block. {countHtml} and {pointsHtml} are the numbers, in bold.
    // e.g. Integrated: 3 of 9 · 7 story points
    "panel.integ.summary.one": "<muted>Integrated:</muted> {countHtml} of {total} · {pointsHtml} story point",
    "panel.integ.summary.other": "<muted>Integrated:</muted> {countHtml} of {total} · {pointsHtml} story points",
    // e.g. 1 kept on removed node.
    "panel.integ.kept.one": "{count} kept on removed node.",
    "panel.integ.kept.other": "{count} kept on removed nodes.",
    // {points} is a story point count (names.js).
    // e.g. Preview: all 9 integrated, 511 story points. Totals and the stat sheet show changes; build unchanged.
    "panel.integ.preview": "Preview: all {total} integrated, {points}. Totals and the stat sheet show changes; build unchanged.",

    // Before a root is chosen (also in the Full Sheet).
    "panel.pickRoot": "Pick one of the three roots near the center to start.",

    // The tabs. (Search shows only while searching; see search.js for its count.)
    "panel.tab.stats": "Effects",
    "panel.tab.sheet": "Stats",
    "panel.tab.sheet.title": "The effects in the in-game stat sheet's sections, with a Full Sheet view",
    "panel.tab.nodes": "Notables & keystones",
    "panel.tab.search": "Search",
    // The Ship tab's label, with how many ship rules are set.
    "panel.tab.ship": "Ship",
    // e.g. Ship (3)
    "panel.tab.ship.set": "Ship ({n})",

    // Effects tab: after each total, where it comes from.
    // e.g. 3 nodes
    "panel.src.nodes.one": "{count} node",
    "panel.src.nodes.other": "{count} nodes",
    // e.g. 2 nodes + affinity
    "panel.src.nodesAffinity.one": "{count} node + affinity",
    "panel.src.nodesAffinity.other": "{count} nodes + affinity",
    "panel.src.affinity": "affinity",
    // Under a total the integration preview changed.
    "panel.preview.new": "▲ new when integrated",
    // {lineHtml} is the total without the preview.
    // e.g. ▲ without integration: 40% increased hard flux level at which phased speed reaches its minimum.
    "panel.preview.without": "<builtIn>▲</builtIn> <muted>without integration:</muted> {lineHtml}",
    "panel.otherEffects": "Other effects",
    // e.g. For the first 10 seconds after deployment
    "panel.temp.heading": "For the first {seconds} seconds after deployment",
    // A gating subroutine's group. {when} is the gate condition (names.js).
    // e.g. Below 50% hull (Phoenix Ash Archive, ×3)
    "panel.gated.heading": "{when} ({item}, ×{strength})",
    "panel.gated.nothing": "Nothing: none of their effects are read live in combat.",
    // e.g. 3 allocated nodes in its radius give these instead of their usual effects.
    "panel.gated.nodes.one": "{count} allocated node in its radius give these instead of their usual effects.",
    "panel.gated.nodes.other": "{count} allocated nodes in its radius give these instead of their usual effects.",
    "panel.subroutines": "Subroutines",
    "panel.thresholds": "Affinity thresholds reached",
    // After a threshold's effect: which affinity, how many times, and the step size.
    // e.g. High Tech 2×50
    "panel.threshold.src": "{affinity} {reached}×{size}",
    "panel.noEffects": "No effects yet. Click a glowing node next to your root.",

    // Notables & keystones tab: what a socket holds, after its tier.
    // e.g. Subroutine socket · Hegemony anchor
    "panel.nodes.anchor": "{volume} anchor",
    "panel.nodes.empty": "empty",
    "panel.nodes.unobtainable": "(unobtainable)",
    "panel.nodes.integTitle": "Alt+click to integrate or remove",
    "panel.nodes.none": "No notables or keystones allocated yet.",

    // Allocated nodes that break a rule, at the top of the panel.
    // e.g. 2 illegal nodes
    "panel.problems.heading.one": "{count} illegal node",
    "panel.problems.heading.other": "{count} illegal nodes",
    "panel.problems.note": "Illegal build",

    // The footer: the mod data's version and the planner's.
    // e.g. Exiled Sector 0.12.4 · Planner v0.3.0-alpha.2
    "panel.foot": "Exiled Sector {mod} · Planner {planner}",
    // e.g. Mod data: Exiled Sector 0.12.4. Planner: v0.3.0-alpha.2.
    "panel.foot.title": "Mod data: {mod}. Planner: {planner}.",
    // A version with changes not yet committed (local copies only).
    // e.g. v0.3.0-alpha.2 +4 (edited)
    "panel.version.edited": "{version} (edited)",
    // The mod data's version when it's from unreleased work on a branch (local copies only).
    // e.g. 0.12.4 + Dev 1e0a37d4
    "panel.modVersion.branch": "{release} + {branch} {commit}",
    // e.g. 0.12.4 + commit 1e0a37d4
    "panel.modVersion.commit": "{release} + commit {commit}",
    "panel.modVersion.unknown": "unknown",
    // The same in full, in the footer's hover text. {release} and {where} are the phrases below.
    // e.g. Exiled Sector 0.12.4 (mod_info.json), 3 commits after release v0.12.4, branch Dev at 1e0a37d4
    "panel.modLong": "Exiled Sector {version} (mod_info.json), {release}, {where} {commit}",
    // e.g. Exiled Sector 0.12.4 (mod_info.json), 3 commits after release v0.12.4, branch Dev at 1e0a37d4, with uncommitted changes
    "panel.modLong.dirty": "Exiled Sector {version} (mod_info.json), {release}, {where} {commit}, with uncommitted changes",
    "panel.modLong.ahead.one": "{count} commit after release {release}",
    "panel.modLong.ahead.other": "{count} commits after release {release}",
    "panel.modLong.noRelease": "no release tag",
    "panel.modLong.branch": "branch {branch} at",
    "panel.modLong.commit": "commit",
    // e.g. Exiled Sector 0.12.4
    "panel.modShort": "Exiled Sector {version}",
});
