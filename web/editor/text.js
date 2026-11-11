// The text editor's own words (web/editor/editor.js). The editor is for editing the planner's text, only shown with
// `node tools/serve.mjs --edit`, and never part of the release zip, so its text is kept here, apart from web/text/.
// The format is the same as web/text/ (see web/text/common.js), and so is <b>…</b> for bold.
window.ESP_EDIT_TEXT = {
    "editor.title": "Text editor",
    "editor.hide": "Hide",
    "editor.show": "Text editor",
    "editor.pick": "Pick",
    "editor.pickTitle": "Click a text on the page to edit it (Esc to stop)",
    "editor.pickOn": "Click a text on the page. Esc to stop.",
    // e.g. 2 unsaved
    "editor.unsaved": "{count} unsaved",

    "editor.search.placeholder": "Search keys and text",
    "editor.list.recent": "Shown on the page, newest first",
    // e.g. 14 keys found
    "editor.list.found.one": "{count} key found",
    "editor.list.found.other": "{count} keys found",
    "editor.list.empty": "No keys match.",
    "editor.list.now": "now",
    "editor.list.nowTitle": "In the page's latest update",
    "editor.list.edited": "edited",
    // After a Pick on text the code builds: the keys whose text is in what was clicked.
    // e.g. 2 keys found in that text:
    "editor.pick.found.one": "{count} key found in that text:",
    "editor.pick.found.other": "{count} keys found in that text:",
    "editor.pick.none": "No key found in that text. Try the search.",

    "editor.detail.none": "Pick a text on the page, or choose a key from the list.",
    // e.g. In web/text/bar.js
    "editor.detail.file": "In web/text/{file}",
    // e.g. Example: Undo, 3 steps stored (Ctrl+Z)
    "editor.detail.example": "Example: {example}",
    "editor.detail.noExample": "No example line.",
    // e.g. Keep these placeholders: {count}
    "editor.detail.placeholders": "Keep these placeholders: {list}",
    "editor.detail.preview": "Preview",
    "editor.detail.previewValues": "With the values the page last used.",
    "editor.detail.previewNoValues": "Not shown on the page yet, so the placeholders stay as they are.",

    "editor.status.live": "On the page now: the change shows there as you type.",
    "editor.status.loadTime": "Read once when the page loads: save, then reload to see it on the page.",
    "editor.status.offScreen": "Not on screen now: see the preview.",

    // e.g. Missing placeholder: {count}
    "editor.check.missing": "Missing placeholder: {list}",
    // e.g. Unknown placeholder: {cuont}. The page shows it as typed.
    "editor.check.extra": "Unknown placeholder: {list}. The page shows it as typed.",
    // e.g. Markup that doesn't open and close in pairs: <good>.
    "editor.check.markup": "Markup that doesn't open and close in pairs: {list}.",
    "editor.check.forms": "The two forms (for 1 and for other counts) have different placeholders.",

    "editor.save": "Save",
    "editor.saving": "Saving…",
    "editor.revert": "Revert",
    "editor.reload": "Reload page",
    // e.g. Saved to web/text/bar.js.
    "editor.saved": "Saved to web/text/{file}.",
    // e.g. Saved to web/text/bar.js, with its example updated.
    "editor.savedExample": "Saved to web/text/{file}, with its example updated.",
    // e.g. Not saved: the planner wasn't started with --edit.
    "editor.saveFailed": "Not saved: {error}",
    "editor.checkErrors": "The text check found errors:",
    "editor.checkWarnings": "The text check warns about this key:",
};
