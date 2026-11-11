// Target mode (Target Mode button, or T): the bar's counts and the plan's status, and why a plan can't be made.
// {node} is a node's name, with its volume in brackets outside the core (see target.label).
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // A node's name in these messages.
    // e.g. Ballistic Mastery (Hegemony)
    "target.label.volume": "{node} ({volume})",

    // e.g. 3 wanted · 1 forbidden.
    "target.counts": "{wanted} wanted · {forbidden} forbidden.",

    // The plan. A second sentence says whether it's the fewest nodes.
    // e.g. Plan: 6 more nodes, 7 of 60 in all.
    "target.plan.one": "Plan: {count} more node, {total} of {cap} in all.",
    "target.plan.other": "Plan: {count} more nodes, {total} of {cap} in all.",
    // Without "Keep current build": nodes of the build the plan doesn't use are removed.
    // e.g. Plan: 0 more nodes, 1 removed, 7 of 60 in all.
    "target.planRemoved.one": "Plan: {count} more node, {removed} removed, {total} of {cap} in all.",
    "target.planRemoved.other": "Plan: {count} more nodes, {removed} removed, {total} of {cap} in all.",
    "target.exact": "That is the fewest possible.",
    // e.g. It may not be the fewest (over 10 wanted nodes the search is approximate).
    "target.approxMany": "It may not be the fewest (over {max} wanted nodes the search is approximate).",
    "target.approxSteered": "It may not be the fewest (it had to steer around refused nodes).",
    "target.markWanted": "Click nodes to mark them wanted.",
    "target.allIn": "Every wanted node is already in the build.",
    // After the plan, with "Keep current build" on.
    // e.g. 2 forbidden nodes are already in the build and stay. Untick "Keep current build" to plan without them.
    "target.forbiddenInBuild.one": "{count} forbidden node is already in the build and stays. Untick \"Keep current build\" to plan without it.",
    "target.forbiddenInBuild.other": "{count} forbidden nodes are already in the build and stay. Untick \"Keep current build\" to plan without them.",

    // No plan. {reason} is one of the reasons below.
    // e.g. Not possible. Phase Anchor can't be allocated: Requires a phase hull.
    "target.notPossible": "Not possible. {reason}",
    // {reason} is the rule's refusal (rules.js, or the mod's own wording).
    // e.g. Ballistic Mastery (Hegemony): The Hegemony volume is hidden. Enable the Optional Volumes in Optional rules.
    "target.hidden": "{node}: {reason}",
    // e.g. Exoship (Exotech) opens only through an anchor linked in a subroutine socket. Link one first.
    "target.exitNeedsAnchor": "{node} opens only through an anchor linked in a subroutine socket. Link one first.",
    // e.g. Phase Anchor can't be allocated: Requires a phase hull.
    "target.cantAllocate": "{node} can't be allocated: {reason}",
    // A wormhole brings its partner. {reason} has its final full stop taken off.
    // e.g. Wormhole takes Wormhole with it, and you forbade it.
    "target.takesWith": "{node} takes {other} with it, and {reason}.",
    // The reason when the node was marked forbidden.
    "target.youForbade": "you forbade it",
    // e.g. ABSORB Reserve (Kesteven) is in a faction volume with no anchor linked to it. Link one to its exit in a subroutine socket first.
    "target.noAnchor": "{node} is in a faction volume with no anchor linked to it. Link one to its exit in a subroutine socket first.",
    // e.g. Ballistic Mastery can't be reached from the root.
    "target.unreachable": "{node} can't be reached from the root.",
    // e.g. No legal way to reach Operations Center: every way there passes a forbidden node or one the rules refuse.
    "target.noWay": "No legal way to reach {node}: every way there passes a forbidden node or one the rules refuse.",
    // The same, naming the nodes the plan steered around ({steered}: one or two of target.steeredItem, then
    // target.steeredMore when there are more).
    // e.g. No legal way to reach Ballistic Mastery: every way there passes a forbidden node or one the rules refuse, here Phase Anchor (Requires a phase hull) and 2 more.
    "target.noWayHere": "No legal way to reach {node}: every way there passes a forbidden node or one the rules refuse, here {steered}.",
    // {reason} has its final full stop taken off.
    // e.g. Phase Anchor (Requires a phase hull)
    "target.steeredItem": "{node} ({reason})",
    // e.g. Phase Anchor (Requires a phase hull) and Heavy Ballistics Integration (Already have Ballistic Mastery allocated) and 2 more
    "target.steeredMore": "{list} and {count} more",
    // Why the plan steered around a node that clashes with a wanted one.
    // e.g. it can't be taken with Ballistic Mastery
    "target.cantTakeWith": "it can't be taken with {node}",
    // e.g. Adaptive Phase Coils can't be allocated with the rest: Already have Phase Anchor allocated.
    "target.cantWithRest": "{node} can't be allocated with the rest: {reason}",
    // e.g. 11 nodes needed, 6 over the cap of 5.
    "target.overCap": "{total} nodes needed, {over} over the cap of {cap}.",
    // e.g. No legal plan found after steering around 8 refused nodes.
    "target.retries": "No legal plan found after steering around {count} refused nodes.",
});
