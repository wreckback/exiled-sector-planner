// Templates: the Templates dialog (the linked templates file, saving, codes), the notice when the game changes the
// file, and loading a template. (How these files work: see common.js. <b>…</b> is bold, <muted>…</muted> greys.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // The templates file.
    // e.g. Linked: exiledSector_skillTreeTemplates.json.data
    "templates.file.linked": "Linked: <b>{file}</b>",
    // e.g. Linked: exiledSector_skillTreeTemplates.json.data (click Reconnect to allow access)
    "templates.file.linkedPrompt": "Linked: <b>{file}</b> <muted>(click Reconnect to allow access)</muted>",
    "templates.file.none": "No file linked yet.",
    "templates.file.link": "Link templates file…",
    "templates.file.linkOther": "Link a different file…",
    // {file} is the game's file name.
    // e.g. Pick exiledSector_skillTreeTemplates.json.data in your Starsector saves/common folder. …
    "templates.file.note": "Pick {file} in your Starsector saves/common folder. The planner remembers it for next time. If the file doesn't exist yet, save any template in game first, or use \"Download as a new file\" below.",
    // The name the file picker gives the files it shows.
    "templates.file.pickerType": "Exiled Sector templates",
    // Browsers that can only read files (Firefox, Safari).
    // e.g. Opened (read-only): exiledSector_skillTreeTemplates.json.data
    "templates.file.opened": "Opened (read-only): <b>{file}</b>",
    "templates.file.noneOpened": "No file opened.",
    "templates.file.open": "Open templates file…",
    "templates.file.openOther": "Open a different file…",
    "templates.file.readOnly": "This browser can read files but not write to them.",
    // A file that doesn't read.
    "templates.file.notJson": "That file is not valid JSON. No changes written.",
    "templates.file.noList": "That file has no \"templates\" list. No changes written.",
    // Create templates file… (makes one in the planner's savedTemplates folder).
    // e.g. "Downloads" isn't the planner's folder. Pick the folder that holds the planner's web folder and README.
    "templates.create.notPlanner": "\"{folder}\" isn't the planner's folder. Pick the folder that holds the planner's web folder and README.",
    // e.g. "Downloads" isn't the planner's folder.
    "templates.create.notPlannerShort": "\"{folder}\" isn't the planner's folder.",
    // e.g. Created savedTemplates\exiledSector_skillTreeTemplates.json.data in the planner's folder and linked it.
    "templates.create.done": "Created {path} in the planner's folder and linked it.",

    // Watching the file for changes the game makes.
    "templates.watch.off": "Manually. Use Check file in the top bar to check for changes.",
    "templates.watch.waiting": "Starts once the file is linked and the browser allows access (after a browser restart, click Reconnect or Check file).",
    "templates.watch.observing": "The browser reports each change to the file as it happens.",
    "templates.watch.noObserver": "No file observer detected (unsupported browser). File is not being watched.",
    "templates.watch.failed": "Instant watching failed. File is not being watched. Relink to try again.",
    "templates.watch.starting": "Starting instant watching…",
    // e.g. Checking every 2 s.
    "templates.watch.polling": "Checking every {seconds} s.",
    // Under the watch setting: what the browser can do, then that watching needs the tab in front.
    "templates.watch.limits": "If the system stops reporting changes, reload, or relink. Watching only happens while this tab is visible.",
    "templates.watch.limitsNoObserver": "This browser does not support File System Observer. Unable to use instant watching. Watching only happens while this tab is visible.",

    // The notice when the file changes from outside (most likely the game). Its sentences, in order.
    // e.g. Templates file exiledSector_skillTreeTemplates.json.data change detected (most likely by Starsector).
    "templates.notice.detected": "Templates file {file} change detected (most likely by Starsector).",
    // {names} is a list of template names (below).
    // e.g. Changed: "Alpha plan".
    "templates.notice.changed": "Changed: {names}.",
    // e.g. Added: "Added A", "Added B", "Added C" and 1 more.
    "templates.notice.added": "Added: {names}.",
    // e.g. Removed: "Bravo plan".
    "templates.notice.removed": "Removed: {names}.",
    // A name in those lists, and the end of a list longer than three.
    "templates.notice.quoted": "\"{name}\"",
    "templates.notice.more": "{names} and {count} more",
    "templates.notice.upToDate": "The Templates list is now up to date.",
    // When the template the build came from is gone or changed.
    // e.g. "Alpha plan" was removed from the template file. Current build still loaded in the planner. Don't forget to save to preserve the build.
    "templates.notice.currentRemoved": "\"{name}\" was removed from the template file. Current build still loaded in the planner. Don't forget to save to preserve the build.",
    // e.g. Your build from "Alpha plan" was updated (most likely by Starsector). Load the new version? It will replace your current build. Undo brings it back.
    "templates.notice.currentUpdated": "Your build from \"{name}\" was updated (most likely by Starsector). Load the new version? It will replace your current build. Undo brings it back.",
    // The same, when the build was edited since it was loaded or saved.
    "templates.notice.currentUpdatedEdited": "Your build from \"{name}\" was updated (most likely by Starsector). Load the new version? It will replace your current build, including the edits you made since loading or saving it. Undo brings it back.",
    "templates.notice.keep": "Keep my build",
    "templates.notice.dismiss": "Dismiss",

    // The list of the file's templates (Import).
    "templates.list.reconnect": "Reconnect to see the templates in the file.",
    "templates.list.link": "Link the file to see its templates.",
    "templates.list.empty": "The file has no templates yet.",
    // A group per root. {root} is the root's name.
    // e.g. High Tech Root root
    "templates.list.group": "{root} root",
    // e.g. High Tech Root root (current)
    "templates.list.groupCurrent": "{root} root (current)",
    "templates.list.code": "Code",
    "templates.list.codeTitle": "Copy this template as a code",
    "templates.list.load": "Load",
    "templates.list.loadTitle": "Replace the current build with this template",

    // Export this build: the line under the template name, its parts joined with " · ".
    // e.g. High Tech Root root · cruiser · 23 steps · 1 anchor · 3 marked for integration
    "templates.summary.root": "{root} root",
    "templates.summary.steps.one": "{count} step",
    "templates.summary.steps.other": "{count} steps",
    "templates.summary.anchors.one": "{count} anchor",
    "templates.summary.anchors.other": "{count} anchors",
    "templates.summary.marks": "{marks} marked for integration",
    // When the name is already in the file. {hull} is a hull size (names.js).
    // e.g. replaces the Cruiser template of this name
    "templates.summary.replaces": "replaces the {hull} template of this name",
    // e.g. replaces the Frigate template of this name (you'll be asked about the hull)
    "templates.summary.replacesAsk": "replaces the {hull} template of this name (you'll be asked about the hull)",
    "templates.summary.replacesAny": "replaces the template of this name",
    // The template name box starts with this.
    // e.g. High Tech Root plan
    "templates.defaultName": "{root} plan",
    "templates.defaultNameNoRoot": "My plan",
    // e.g. Save into exiledSector_skillTreeTemplates.json.data
    "templates.save": "Save into {file}",
    "templates.saveLinked": "Save into linked file",
    "templates.save.linkFirst": "Link the templates file above to save straight into it.",
    "templates.save.reconnect": "Reconnect above to save into the file.",

    // Template names.
    "templates.name.empty": "Give the template a name.",
    // {chars} are the characters to remove (below).
    // e.g. Names can only use English letters, digits, spaces and keyboard symbols, so the game can type and show them. Remove "é" U+00E9.
    "templates.name.badChars": "Names can only use English letters, digits, spaces and keyboard symbols, so the game can type and show them. Remove {chars}.",
    // e.g. Names can be at most 32 characters.
    "templates.name.tooLong": "Names can be at most {max} characters.",
    // When the name box takes characters out as you type.
    // e.g. Removed "é" U+00E9: names can only use English letters, digits, spaces and keyboard symbols.
    "templates.name.removed": "Removed {chars}: names can only use English letters, digits, spaces and keyboard symbols.",
    // The end of a list of more than five characters.
    // e.g. "é" U+00E9, "ÿ" U+00FF, "þ" U+00FE, "ý" U+00FD, "ü" U+00FC, …
    "templates.name.charsMore": "{chars}, …",

    // Saving.
    // e.g. Added "Fresh one" (23 steps) in exiledSector_skillTreeTemplates.json.data. The file now has 9 templates.
    "templates.saved.added.one": "Added \"{name}\" ({steps} steps) in {file}. The file now has {count} template.",
    "templates.saved.added.other": "Added \"{name}\" ({steps} steps) in {file}. The file now has {count} templates.",
    // e.g. Replaced "Fresh one" (23 steps) in exiledSector_skillTreeTemplates.json.data. The file now has 9 templates.
    "templates.saved.replaced.one": "Replaced \"{name}\" ({steps} steps) in {file}. The file now has {count} template.",
    "templates.saved.replaced.other": "Replaced \"{name}\" ({steps} steps) in {file}. The file now has {count} templates.",
    // The question when the name is taken. {from} and {to} are hull sizes (names.js).
    // e.g. "Alpha plan" is already in the templates file as a Cruiser template, but the Hull size dropdown is set to Destroyer.
    "templates.conflict.hull": "\"{name}\" is already in the templates file as a {from} template, but the Hull size dropdown is set to {to}.",
    // e.g. Keep Cruiser
    "templates.conflict.keep": "Keep {hull}",
    // e.g. Change to Destroyer
    "templates.conflict.change": "Change to {hull}",
    // e.g. A template named "Fresh one" already exists for the High Tech Root root. Override it?
    "templates.conflict.override": "A template named \"{name}\" already exists for the {root} root. Override it?",
    "templates.conflict.overrideButton": "Override",
    // e.g. "Alpha plan" is already used by a template on this root. Pick another name.
    "templates.nameTaken": "\"{name}\" is already used by a template on this root. Pick another name.",
    "templates.nothingSaved": "Nothing was saved.",
    "templates.writeRefused": "The browser was not allowed to write to that file.",
    // e.g. Downloaded a new exiledSector_skillTreeTemplates.json.data holding only "Download me".
    "templates.downloaded": "Downloaded a new {file} holding only \"{name}\".",

    // Codes.
    // What was copied (also in the toast, toast.js).
    // e.g. Code for "Alpha plan"
    "templates.code.label": "Code for \"{name}\"",
    // e.g. Code for "Alpha plan" (512 characters) copied to the clipboard and shown above.
    "templates.code.copied": "{label} ({length} characters) copied to the clipboard and shown above.",
    // e.g. Code for "Alpha plan" (512 characters) is in the box above; copy it from there.
    "templates.code.inBox": "{label} ({length} characters) is in the box above; copy it from there.",
    // {problem} is a name problem (above).
    // e.g. Give the template a name. (The code uses the template name below.)
    "templates.code.nameProblem": "{problem} (The code uses the template name below.)",
    "templates.code.empty": "Please paste a template code.",
    "templates.code.invalid": "Invalid template code.",
    "templates.code.browser": "This browser can't read codes. Try Chrome, Edge or Firefox.",

    // Loading a template (from the file or a code): what happened, then notes joined with "; ".
    // e.g. Loaded "Alpha plan" (23 nodes).
    "templates.loaded": "Loaded \"{name}\" ({taken} nodes).",
    // e.g. Loaded "Marked" (67 nodes); 2 nodes integrated from the template's marks; 68 nodes is over the 60 cap.
    "templates.loadedNotes": "Loaded \"{name}\" ({taken} nodes); {notes}.",
    // Between two notes. Keep the space.
    "templates.load.noteJoin": "; ",
    // e.g. "Lost root" starts from an unknown root (root_nowhere).
    "templates.load.unknownRoot": "\"{name}\" starts from an unknown root ({root}).",
    // e.g. made with mod 0.0.1, this planner is based on 0.12.4
    "templates.load.oldMod": "made with mod {mod}, this planner is based on {planner}",
    "templates.load.badName": "its name has characters outside English letters, digits and keyboard symbols, so rename it before saving",
    // e.g. 2 steps not in this version of the tree
    "templates.load.unknown.one": "{count} step not in this version of the tree",
    "templates.load.unknown.other": "{count} steps not in this version of the tree",
    // The first refused step, its name and the rule's reason (final full stop taken off).
    // e.g. 1 step refused by the node rules (Phase Anchor: Requires a phase hull)
    "templates.load.refused.one": "{count} step refused by the node rules ({node}: {reason})",
    // e.g. 3 steps refused by the node rules (Phase Anchor: Requires a phase hull, …)
    "templates.load.refused.other": "{count} steps refused by the node rules ({node}: {reason}, …)",
    // e.g. 2 steps couldn't be connected
    "templates.load.unplaced.one": "{count} step couldn't be connected",
    "templates.load.unplaced.other": "{count} steps couldn't be connected",
    // {volumes} are Optional Volumes toggle names, joined with "and".
    // e.g. showed Lost Sector volumes (Kesteven and Frozen Heart) (Optional Volumes, Optional rules)
    "templates.load.shown": "showed {volumes} (Optional Volumes, Optional rules)",
    // e.g. 2 nodes integrated from the template's marks
    "templates.load.integrated.one": "{count} node integrated from the template's marks",
    "templates.load.integrated.other": "{count} nodes integrated from the template's marks",
    // e.g. 1 integration mark on nodes that didn't land or can't be integrated
    "templates.load.marksLost.one": "{count} integration mark on nodes that didn't land or can't be integrated",
    "templates.load.marksLost.other": "{count} integration marks on nodes that didn't land or can't be integrated",
    // e.g. 68 nodes is over the 60 cap
    "templates.load.overCap": "{used} nodes is over the {cap} cap",
});
