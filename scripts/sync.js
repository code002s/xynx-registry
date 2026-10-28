// Syncs domains/*.json to Cloudflare DNS.
// Only touches records whose comment starts with "xynx-registry:" — any other record in the zone is left alone.
const { loadAll, ZONES } = require('./lib');

const TOKEN = process.env.CF_API_TOKEN;
// CF_ZONES is a JSON object: {"xynx.surf":"<zone id>","xynx.pro":"<zone id>",...}
let ZONE_IDS = {};
try { ZONE_IDS = JSON.parse(process.env.CF_ZONES || '{}'); } catch { /* handled below */ }
const DRY = process.argv.includes('--dry-run');
const TAG = 'xynx-registry:';

const missing = ZONES.filter((z) => !ZONE_IDS[z]);
if (!TOKEN || missing.length) {
  console.error(`CF_API_TOKEN and CF_ZONES are required. Missing zone id for: ${missing.join(', ') || '-'}`);
  process.exit(1);
}

const apiFor = (zone) => `https://api.cloudflare.com/client/v4/zones/${ZONE_IDS[zone]}/dns_records`;

async function cf(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${url}: ${JSON.stringify(json.errors)}`);
  return json;
}

async function listManaged(API) {
  const out = [];
  for (let page = 1; ; page++) {
    const j = await cf('GET', `${API}?per_page=100&page=${page}&comment.startswith=${encodeURIComponent(TAG)}`);
    out.push(...j.result);
    if (page >= (j.result_info?.total_pages || 1)) break;
  }
  return out;
}

function desired(zone) {
  const want = [];
  for (const d of loadAll().filter((x) => x.zone === zone)) {
    if (d.errors.length) throw new Error(`${d.name}: refusing to sync invalid file`);
    for (const r of d.data.records) {
      const sub = !r.name || r.name === '@' ? d.name : `${r.name}.${d.name}`;
      const type = r.type;
      want.push({
        type,
        name: `${sub}.${zone}`,
        content: r.value,
        proxied: type === 'TXT' ? false : r.proxied !== false,
        ttl: 1,
        comment: `${TAG}${d.name}`,
      });
    }
  }
  return want;
}

const key = (r) => `${r.type}|${r.name.toLowerCase()}|${r.content.toLowerCase()}`;

async function syncZone(zone) {
  const API = apiFor(zone);
  const want = desired(zone);
  const have = await listManaged(API);
  const haveMap = new Map(have.map((r) => [key(r), r]));
  const wantMap = new Map(want.map((r) => [key(r), r]));

  const toCreate = want.filter((r) => !haveMap.has(key(r)));
  const toDelete = have.filter((r) => !wantMap.has(key(r)));
  const toUpdate = want
    .filter((r) => haveMap.has(key(r)) && haveMap.get(key(r)).proxied !== r.proxied)
    .map((r) => ({ id: haveMap.get(key(r)).id, rec: r }));

  console.log(`[${zone}] create: ${toCreate.length}, update: ${toUpdate.length}, delete: ${toDelete.length}`);

  for (const r of toDelete) {
    console.log(`- DELETE ${r.type} ${r.name}`);
    if (!DRY) await cf('DELETE', `${API}/${r.id}`);
  }
  for (const r of toCreate) {
    console.log(`+ CREATE ${r.type} ${r.name} -> ${r.content}`);
    if (!DRY) await cf('POST', API, r);
  }
  for (const { id, rec } of toUpdate) {
    console.log(`~ UPDATE ${rec.type} ${rec.name} proxied=${rec.proxied}`);
    if (!DRY) await cf('PATCH', `${API}/${id}`, { proxied: rec.proxied });
  }
}

(async () => {
  for (const zone of ZONES) await syncZone(zone);
  console.log(DRY ? 'Dry run complete.' : 'Sync complete.');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
