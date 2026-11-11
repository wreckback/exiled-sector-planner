// Text editor, part 1: records which text keys the page uses. Loaded before app.js, and only when the planner is
// served with `node tools/serve.mjs --edit` (serve.mjs adds the editor's tags to index.html). editor.js reads it.
//
// app.js calls ESP_EDIT.used(key, values) for every text it looks up (textTemplate and idName in app.js). Uses close
// together in time make one update of the page (a burst): the keys of the latest burst are what's on screen now.
window.ESP_EDIT = {
    uses: new Map(), // key -> { args, burst, at }
    burst: 0,
    last: 0,
    paused: false, // set by the editor while it renders its own preview, so that doesn't count as a use
    used(key, args) {
        if (this.paused) return;
        const now = performance.now();
        if (now - this.last > 120) this.burst++;
        this.last = now;
        this.uses.delete(key); // re-inserted, so the map stays in order of last use
        this.uses.set(key, { args: { ...args }, burst: this.burst, at: now });
    },
};
