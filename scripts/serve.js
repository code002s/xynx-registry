// Tiny static server for local previews, no dependencies:
//   npm run serve  ->  http://127.0.0.1:8080
// Serves site/ as the web root and falls back to the repo root, so
// /reserved.json (used by the name checker) resolves like it does on GitHub.
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SITE = path.join(REPO, 'site');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveIn(root, rel) {
  const file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    // Repo-root fallback exists for /reserved.json; keep it to top-level files
    // so scripts/ and .github/ stay out of the preview.
    const candidates = [resolveIn(SITE, rel), rel.includes('/') ? null : resolveIn(REPO, rel)].filter(Boolean);

    const send = (i, file) => {
      if (!file || i >= candidates.length) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) return send(i + 1, candidates[i + 1]);
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    };
    send(0, candidates[0]);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`xynx site: http://127.0.0.1:${PORT}/`);
    console.log(`real repo preview: http://127.0.0.1:${PORT}/?repo=owner/name`);
  });
