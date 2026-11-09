#!/usr/bin/env node
// Serves the web planner on http://localhost:<port>/ (Ctrl+C to stop).
//   node tools/serve.mjs [--port 8765] [--root <path>]
//
// When serving the repo's own web/, version.js is answered with the planner's version from git (the latest vX.Y.Z tag,
// plus commits since and -dirty), so a local copy shows where it stands. The committed file says "dev" and is used when
// git can't answer. Any other folder (--root preview, an unpacked release zip) serves its own version.js.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, fromRepo, git, repoRoot, say } from './lib/common.mjs';

const { values: opt } = parseArgs({
    options: {
        port: { type: 'string', default: '8765' },
        root: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (opt.help) {
    say('Usage: node tools/serve.mjs [--port 8765] [--root <path>]');
    say('Serves web/ (or --root, e.g. preview) on http://localhost:<port>/. Ctrl+C to stop.');
    process.exit(0);
}
const port = Number(opt.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail('serve', `not a port number: ${opt.port}`);

// Windows paths ignore case, so folder comparisons and the "inside the served folder" check do too there.
const caseless = process.platform === 'win32';
const norm = (p) => (caseless ? p.toLowerCase() : p);

const root = fromRepo(opt.root ?? 'web');
// Only the repo's own web/ has 'dev' in version.js, so only it gets the version from git.
const versionFromGit = norm(root) === norm(fromRepo('web'));
try {
    if (!(await stat(root)).isDirectory()) throw new Error();
} catch {
    fail('serve', `no folder at ${root}`);
}

const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webp': 'image/webp',
};
const rootPrefix = norm(root.endsWith(sep) ? root : root + sep);

// git describe runs at most every 2 seconds, so a page load doesn't wait on it per request, and -dirty still shows up
// right after an edit.
let versionCache = null;
let versionAt = 0;
function versionScript() {
    if (Date.now() - versionAt > 2000) {
        const desc = git(repoRoot, ['describe', '--tags', '--match', 'v*', '--dirty'], { allowFail: true });
        versionCache = desc ? Buffer.from(`window.PLANNER_VERSION = '${desc.replace(/'/g, '')}';\n`, 'utf8') : null;
        versionAt = Date.now();
    }
    return versionCache;
}

function send(res, status, body, type) {
    res.writeHead(status, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-cache' });
    res.end(body);
}

const server = createServer(async (req, res) => {
    try {
        let path;
        try {
            path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '');
        } catch {
            res.writeHead(400).end();
            return;
        }
        if (path === '') path = 'index.html';
        if (path === 'version.js' && versionFromGit) {
            const v = versionScript();
            if (v) { send(res, 200, v, types['.js']); return; }
        }
        const file = resolve(root, path);
        if (norm(file).startsWith(rootPrefix)) {
            try {
                if ((await stat(file)).isFile()) {
                    send(res, 200, await readFile(file), types[extname(file).toLowerCase()] ?? 'application/octet-stream');
                    return;
                }
            } catch {
                // Not there: answered with 404 below.
            }
        }
        res.writeHead(404).end();
    } catch {
        // The browser dropped the connection (e.g. a reload mid-load). Skip this request and keep serving.
        if (!res.headersSent) res.writeHead(500);
        res.end();
    }
});
server.on('error', (e) => fail('serve', e.code === 'EADDRINUSE' ? `port ${port} is in use (try --port <other>)` : e.message));
server.listen(port, 'localhost', () =>
    say(`Serving ${root} at http://localhost:${port}/ (version ${versionFromGit ? 'from git describe' : 'from its version.js'})`));
