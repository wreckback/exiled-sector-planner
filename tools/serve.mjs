#!/usr/bin/env node
// Serves the web planner on http://localhost:<port>/ (Ctrl+C to stop).
//   node tools/serve.mjs [--port 8765] [--root <path>]
//
// version.js is answered with the planner's version from git (the latest vX.Y.Z tag, plus commits since and -dirty),
// so a local copy shows where it stands. The committed file says "dev" and is used when git can't answer.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fail, fromRepo, git, say } from './lib/common.mjs';

const { values: opt } = parseArgs({
    options: {
        port: { type: 'string', default: '8765' },
        root: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
    },
});
if (opt.help) {
    say('Usage: node tools/serve.mjs [--port 8765] [--root <path>]');
    say('Serves web/ on http://localhost:<port>/. Ctrl+C to stop.');
    process.exit(0);
}
const port = Number(opt.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail('serve', `not a port number: ${opt.port}`);

const root = fromRepo(opt.root ?? 'web');
const repo = dirname(root);
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
// Windows paths ignore case, so the "inside the served folder" check does too there.
const caseless = process.platform === 'win32';
const norm = (p) => (caseless ? p.toLowerCase() : p);
const rootPrefix = norm(root.endsWith(sep) ? root : root + sep);

function versionScript() {
    const desc = git(repo, ['describe', '--tags', '--match', 'v*', '--dirty'], { allowFail: true });
    if (!desc) return null;
    return Buffer.from(`window.PLANNER_VERSION = '${desc.replace(/'/g, '')}';\n`, 'utf8');
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
        if (path === 'version.js') {
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
server.listen(port, 'localhost', () => say(`Serving ${root} at http://localhost:${port}/`));
