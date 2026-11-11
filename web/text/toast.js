// Toasts: the short messages that pop up at the bottom after an action, then fade.
// (How these files work: see common.js. <b>…</b> is bold.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // First visit.
    "toast.assetsHint": "The mod assets are not included with the planner. Click <b>Show mod assets</b> in the top bar to read them from your Exiled Sector folder.",

    // The build.
    "toast.buildCleared": "Build cleared. Undo brings it back.",
    // e.g. That needs 10 nodes; only 7 left under the cap.
    "toast.overCap": "That needs {needed} nodes; only {left} left under the cap.",
    "toast.waypointRoot": "Every path starts from the root, so it can't be a waypoint.",
    "toast.pickOptionFirst": "Pick an option once; Ctrl+click then reuses it.",
    "toast.exitsNeedAnchor": "Wormhole exits open by linking an anchor in a subroutine socket.",
    "toast.linkAtCap": "Linking an anchor takes one more node; you are at the cap.",
    "toast.pickNotable": "Pick a notable from the list.",
    // e.g. Changed 5 affinity nodes. Undo goes back.
    "toast.affinityChanged.one": "Changed {count} affinity node. Undo goes back.",
    "toast.affinityChanged.other": "Changed {count} affinity nodes. Undo goes back.",

    // Optional Volumes (Optional rules). {volume} is the toggle's name from the mod data.
    // e.g. Lost Sector volumes (Kesteven and Frozen Heart): shown.
    "toast.volumeShown": "{volume}: shown.",
    "toast.volumeHidden": "{volume}: hidden.",
    // e.g. Random Assortment of Things volumes (Exo-Tech and Abyss): hidden. Removed 7 nodes; Undo brings them back.
    "toast.volumeHiddenRemoved.one": "{volume}: hidden. Removed {count} node; Undo brings them back.",
    "toast.volumeHiddenRemoved.other": "{volume}: hidden. Removed {count} nodes; Undo brings them back.",

    // Integration.
    // e.g. Subroutine Socket can't be integrated.
    "toast.cantIntegrate": "{node} can't be integrated.",
    // e.g. Allocate Automated Repair Unit first to integrate it.
    "toast.allocateToIntegrate": "Allocate {node} first to integrate it.",
    // e.g. Integrated 9 nodes.
    "toast.integratedAll.one": "Integrated {count} node.",
    "toast.integratedAll.other": "Integrated {count} nodes.",
    // e.g. Removed 9 integrations.
    "toast.integrationsRemoved.one": "Removed {count} integration.",
    "toast.integrationsRemoved.other": "Removed {count} integrations.",

    // Target mode.
    "toast.rootAlwaysIn": "The starting root is always in the build.",
    "toast.nothingToChange": "Nothing to change.",
    // e.g. Allocated 3 nodes.
    "toast.planApplied.one": "Allocated {count} node.",
    "toast.planApplied.other": "Allocated {count} nodes.",
    // e.g. Allocated 3 nodes and removed 1.
    "toast.planAppliedRemoved.one": "Allocated {count} node and removed {removed}.",
    "toast.planAppliedRemoved.other": "Allocated {count} nodes and removed {removed}.",

    // Codes (the top bar's Copy code, and the Templates dialog). {name} is the template's name.
    // e.g. Code for "My plan" copied. Load it with Templates → Load code.
    "toast.codeCopied": "Code for \"{name}\" copied. Load it with Templates → Load code.",
    // When the clipboard is blocked: followed by a box holding the code.
    "toast.copyThisCode": "Copy this code:",
    // {label} names what was copied (templates.js).
    // e.g. Code for "Alpha plan" copied.
    "toast.labelCopied": "{label} copied.",
    "toast.clipboardBlocked": "The browser blocked the clipboard; the code is in the box to copy by hand.",

    // Check file (top bar).
    "toast.linkFirst": "Link the templates file in Templates first.",
    "toast.readRefused": "The browser wasn't allowed to read the templates file.",
    // e.g. Connected to exiledSector_skillTreeTemplates.json.data: 7 templates. Changes from now on are noticed.
    "toast.connected.one": "Connected to {file}: {count} template. Changes from now on are noticed.",
    "toast.connected.other": "Connected to {file}: {count} templates. Changes from now on are noticed.",
    "toast.noChanges": "No changes in the templates file since the last check.",
    "toast.rewrittenSame": "The templates file was rewritten, but its templates are the same.",
});
