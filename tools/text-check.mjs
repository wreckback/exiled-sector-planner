#!/usr/bin/env node
// Checks the planner's text files (web/text/*.js) against the code that uses them.
//   node tools/text-check.mjs
//
// Errors (exit code 1; tools/release.mjs refuses to tag on them): a key in use that no text file has, a key defined
// twice, a {placeholder} the code doesn't fill, .one/.other forms with different placeholders, a text file
// index.html doesn't load. Warnings: unused keys, mod data ids with no name line, "// e.g." examples that no longer
// match their text. See tools/lib/text-check.mjs.
import { parseArgs } from 'node:util';
import { good, heading, say, warn } from './lib/common.mjs';
import { checkText } from './lib/text-check.mjs';

const { values: opt } = parseArgs({ options: { help: { type: 'boolean', short: 'h' } } });
if (opt.help) {
    say('Usage: node tools/text-check.mjs');
    say('Checks web/text/*.js against web/app.js and web/index.html: errors exit with code 1, warnings are listed.');
    process.exit(0);
}

const { errors, warnings, stats } = checkText();
say(`${stats.files} text files, ${stats.keys} keys; ${stats.used} keys and ${stats.patterns} key patterns in use, ${stats.calls} calls with values, ${stats.examples} examples checked.`);
if (errors.length) {
    heading(`${errors.length} error${errors.length === 1 ? '' : 's'}:`);
    for (const e of errors) say(`  ${e}`);
}
if (warnings.length) {
    heading(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
    for (const w of warnings) warn(`  ${w}`);
}
if (!errors.length && !warnings.length) good('The text files and the code fit together.');
if (errors.length) process.exitCode = 1;
