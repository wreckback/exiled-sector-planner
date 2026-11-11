// Search: the summary panel's Search tab while the top bar's search box (or the Filter) is in use.
// (How these files work: see common.js.)
window.ESP_TEXT = Object.assign(window.ESP_TEXT || {}, {
    // The tab's label, with how many nodes match.
    // e.g. Search (12)
    "search.tab": "Search ({n})",

    // The heading over the results. {matches} is the counted phrase below; {filter} says what the Filter shows.
    // e.g. 12 matches. Click one to jump to it.
    "search.head": "{matches}. Click one to jump to it.",
    // e.g. 12 matches, 3 allocated. Click one to jump to it.
    "search.head.allocated": "{matches}, {have} allocated. Click one to jump to it.",
    // e.g. 4 matches for the theme Flux. Click one to jump to it.
    "search.head.filter": "{matches} for {filter}. Click one to jump to it.",
    // e.g. 4 matches for any of the themes Flux, Phase or affinity nodes, 1 allocated. Click one to jump to it.
    "search.head.filterAllocated": "{matches} for {filter}, {have} allocated. Click one to jump to it.",
    "search.matches.one": "{count} match",
    "search.matches.other": "{count} matches",
    // What the Filter shows, joined with "or". {themes} is a list of theme names.
    // e.g. the theme Flux
    "search.filter.theme": "the theme {themes}",
    // e.g. any of the themes Flux, Phase
    "search.filter.anyTheme": "any of the themes {themes}",
    // e.g. all of the themes Flux, Phase
    "search.filter.allThemes": "all of the themes {themes}",
    "search.filter.affinity": "affinity nodes",

    // No results.
    "search.none.both": "No nodes match that search and filter.",
    "search.none.filter": "No nodes match that filter.",
    "search.none.search": "No nodes match that search.",

    // A small tag after the name of an allocated node (here and in the list view).
    "search.allocatedTag": "allocated",
});
