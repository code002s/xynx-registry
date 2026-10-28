// Builds the static site into dist/ and points it at a concrete repository.
//   node scripts/build-site.js                 (repo is read from git remote origin)
//   REPO=owner/name node scripts/build-site.js (CI / explicit)
// The source in site/ keeps the YOUR-GITHUB-USERNAME/xynx-registry placeholder,
// so forks do not have to edit anything.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function repoFromGitConfig() {
  try {
    const cfg = fs.readFileSync(path.join(root, '.git', 'config'), 'utf8');
    const url = (cfg.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(\S+)/) || [])[1];
    const m = url && url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    return m ? `${m[1]}/${m[2]}` : '';
  } catch {
    return '';
  }
}

const REPO = (process.env.REPO || process.env.GITHUB_REPOSITORY || repoFromGitConfig()).trim();
if (!/^[^/\s]+\/[^/\s]+$/.test(REPO)) {
  console.error('REPO is required, e.g. REPO=owner/name node scripts/build-site.js');
  process.exit(1);
}

const src = path.join(root, 'site');
const out = path.join(root, 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

const index = path.join(out, 'index.html');
const html = fs.readFileSync(index, 'utf8');
const built = html.replaceAll('YOUR-GITHUB-USERNAME/xynx-registry', REPO);
if (built === html) {
  console.error('placeholder YOUR-GITHUB-USERNAME/xynx-registry not found in site/index.html');
  process.exit(1);
}
fs.writeFileSync(index, built);

console.log(`dist/ built for ${REPO}: ${fs.readdirSync(out).join(', ')}`);
