// Mod assets: the top bar button and the Mod assets dialog, which read the mod's images from the user's own Exiled
// Sector folder (the planner doesn't include them). (How these files work: see common.js. <b>…</b> is bold.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // The top bar button, by state.
    "assets.button.show": "Show mod assets",
    "assets.button.loading": "Loading assets…",
    "assets.button.reconnect": "Reconnect assets",
    "assets.button.ready": "Mod assets",
    "assets.button.title": "Show the mod's assets, read from your own Exiled Sector folder",
    // e.g. Allow the planner to read the mod folder "ExiledSector" again, to show the mod's assets
    "assets.button.reconnectTitle": "Allow the planner to read the mod folder \"{folder}\" again, to show the mod's assets",

    // The dialog's status line.
    "assets.status.reading": "Reading the assets…",
    // ({count} is how many of the planner's images the folder has.)
    // e.g. Showing the assets from ExiledSector (Exiled Sector 0.12.4), 412 images.
    "assets.status.showing": "Showing the assets from <b>{folder}</b> (Exiled Sector {version}), {count} images.",
    // The same when the folder's mod_info.json gives no version.
    // e.g. Showing the assets from ExiledSector, 412 images.
    "assets.status.showingNoVersion": "Showing the assets from <b>{folder}</b>, {count} images.",
    // e.g. Permission to read ExiledSector must be regranted. Click Reconnect.
    "assets.status.prompt": "Permission to read <b>{folder}</b> must be regranted. Click Reconnect.",
    "assets.status.none": "No mod folder chosen. Showing placeholders.",
    // When the folder's mod version isn't the one the planner's tree is from.
    // e.g. This folder has Exiled Sector 0.12.2, and the planner's tree is from 0.12.4. Icons of node types that changed between updates may be missing or different.
    "assets.versionMismatch": "This folder has Exiled Sector {folderVersion}, and the planner's tree is from {treeVersion}. Icons of node types that changed between updates may be missing or different.",
    "assets.choose": "Choose mod folder…",
    "assets.chooseOther": "Choose another folder…",
    "assets.restartNote": "After a browser restart, permission must be regranted (Reconnect assets in the top bar).",

    // Folders that don't work.
    "assets.notModFolder": "No Exiled Sector mod_info.json detected.",
    // e.g. Found Exiled Sector in "ExiledSector", but none of the images the planner uses are in it.
    "assets.noImages": "Found Exiled Sector in \"{folder}\", but none of the images the planner uses are in it.",
});
