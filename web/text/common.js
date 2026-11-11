// Words used in several places of the page.
//
// How the text files work: each line is "key": "text". Change the text on the right; leave the key on the left as it
// is. {name} is filled in by the planner when the text is shown. Write \" for a double quote inside the text.
// A key ending in .one is used for a count of 1, .other for any other count.
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    "common.close": "Close",
    "common.closeEsc": "Close (Esc)",
    "common.notSet": "Not set",
    "common.yes": "Yes",
    "common.no": "No",
    "common.tickAll": "Tick all",
    "common.untickAll": "Untick all",

    // Joining a list of names: "a, b and c", or alternatives "a or b". Keep the spaces.
    "common.listComma": ", ",
    "common.listAnd": " and ",
    "common.listOr": " or ",
});
