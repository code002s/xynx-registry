// Builds the static site into dist/ and points it at a concrete repository.
//   node scripts/build-site.js                 (repo is read from git remote origin)
//   REPO=owner/name node scripts/build-site.js (CI / explicit)
// The source in site/ keeps the YOUR-GITHUB-USERNAME/xynx-registry placeholder,
// so forks do not have to edit anything.
//
// Besides copying site/, the build publishes two things the page reads from its
// own origin (raw.githubusercontent.com is blocked on some networks):
//   dist/reserved.json     - reserved names
//   dist/api/domains.json  - every registered subdomain
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

function domainsIndex() {
  const zones = JSON.parse(fs.readFileSync(path.join(root, 'zones.json'), 'utf8'));
  const domains = [];
  for (const zone of zones) {
    const dir = path.join(root, 'domains', zone);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      let data = {};
      try {
        data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      } catch {
        continue;
      }
      domains.push({
        name: file.slice(0, -'.json'.length),
        zone,
        description: typeof data.description === 'string' ? data.description : '',
        owner: (data.owner && data.owner.username) || '',
      });
    }
  }
  return { domains };
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

const page = path.join(out, 'index.html');
const html = fs.readFileSync(page, 'utf8');
const built = html.replaceAll('YOUR-GITHUB-USERNAME/xynx-registry', REPO);
if (built === html) {
  console.error('placeholder YOUR-GITHUB-USERNAME/xynx-registry not found in site/index.html');
  process.exit(1);
}
fs.writeFileSync(page, built);

fs.mkdirSync(path.join(out, 'api'), { recursive: true });
fs.writeFileSync(path.join(out, 'api', 'domains.json'), JSON.stringify(domainsIndex(), null, 2) + '\n');
fs.copyFileSync(path.join(root, 'reserved.json'), path.join(out, 'reserved.json'));

console.log(`dist/ built for ${REPO}: ${fs.readdirSync(out).join(', ')}`);
