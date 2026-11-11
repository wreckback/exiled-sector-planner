// The list view (List button, or L): every node, or the build, as rows instead of the map.
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // The top bar button swaps between the two views.
    "list.view.list": "List",
    "list.view.map": "Map",
    "list.view.listTitle": "List view of every non-affinity node (L)",
    "list.view.mapTitle": "Skill tree map (L)",

    // The Build button, with how many nodes the build has.
    // e.g. Build (23)
    "list.mode.build": "Build ({n})",

    "list.hint": "Click a node to see it on the map.",
    "list.hint.target": "Target mode: mark nodes Desired or Forbidden (clicking a node cycles its mark, as on the map), then Allocate.",

    // How many rows show. {total} rows of {all} nodes; with the search or Filter on, and with trees collapsed.
    // e.g. 580 of 591 nodes
    "list.count.all": "{total} of {all} nodes",
    // e.g. 12 of 591 nodes matching the search and Filter
    "list.count.all.filtered": "{total} of {all} nodes matching the search and Filter",
    // e.g. 580 of 591 nodes, 120 in collapsed trees
    "list.count.all.collapsed": "{total} of {all} nodes, {collapsed} in collapsed trees",
    // e.g. 12 of 591 nodes matching the search and Filter, 4 in collapsed trees
    "list.count.all.filteredCollapsed": "{total} of {all} nodes matching the search and Filter, {collapsed} in collapsed trees",
    // The Build list: {affinity} of the rows' nodes are affinity nodes.
    // e.g. 23 of 23 allocated nodes (9 affinity)
    "list.count.build": "{total} of {size} allocated nodes ({affinity} affinity)",
    // e.g. 5 of 23 allocated nodes matching the search and Filter (0 affinity)
    "list.count.build.filtered": "{total} of {size} allocated nodes matching the search and Filter ({affinity} affinity)",
    // e.g. 23 of 23 allocated nodes (9 affinity), 9 in collapsed trees
    "list.count.build.collapsed": "{total} of {size} allocated nodes ({affinity} affinity), {collapsed} in collapsed trees",
    // e.g. 5 of 23 allocated nodes matching the search and Filter (0 affinity), 2 in collapsed trees
    "list.count.build.filteredCollapsed": "{total} of {size} allocated nodes matching the search and Filter ({affinity} affinity), {collapsed} in collapsed trees",
    "list.noBuild": "No build yet.",

    // Tree headings (Sort: Skill tree), which collapse or expand their tree.
    "list.group.show": "Show this tree's nodes",
    "list.group.hide": "Hide this tree's nodes",
    // Where a node sits.
    "list.place.core": "Core",
    // e.g. Hegemony volume
    "list.place.volume": "{volume} volume",
    // The Build list's group of affinity nodes, summed per tech.
    "list.place.affinity": "Affinity nodes",
    // e.g. 9 affinity nodes
    "list.affinityRow.one": "{count} affinity node",
    "list.affinityRow.other": "{count} affinity nodes",

    // Under a row's name, after its tier and place.
    // e.g. Holds Root Conduit
    "list.holds": "Holds {item}",
    // e.g. Anchor to the Hegemony volume
    "list.anchorTo": "Anchor to the {volume} volume",
    "list.socketEmpty": "Empty",
    // e.g. Paired with midline_wormhole_1
    "list.pairedWith": "Paired with {id}",
    // e.g. Linked to subroutine_socket_12
    "list.linkedTo": "Linked to {socket}",
    // e.g. Themes: Flux, Phase
    "list.themes": "Themes: {themes}",
    // A small tag after the name of an integrated node.
    "list.integratedTag": "integrated",

    // Target marks on the All nodes list: buttons in target mode, a tag otherwise.
    "list.mark.wanted": "Wanted",
    "list.mark.forbidden": "Forbidden",
    "list.mark.clear": "Clear the mark",
    "list.mark.wantTitle": "Mark wanted: the plan reaches it",
    "list.mark.forbidTitle": "Mark forbidden: the plan avoids it",

    // An empty list.
    "list.empty.noRoot": "Pick a root on the map to start a build.",
    "list.empty.rootOnly": "Nothing allocated yet besides the root.",
    "list.empty.noMatch": "No nodes match. Change search term or Filters.",
});
