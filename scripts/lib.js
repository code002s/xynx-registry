const fs = require('fs');
const path = require('path');
const net = require('net');

const ZONES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'zones.json'), 'utf8'));
const DOMAINS_DIR = path.join(__dirname, '..', 'domains');
const RESERVED = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'reserved.json'), 'utf8'))
);

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,28}[a-z0-9])?$/;
const LABEL_RE = /^_?[a-z0-9]([a-z0-9-]{0,28}[a-z0-9])?$/; // leading "_" allowed for TXT (_dmarc, _verify)
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const TYPES = ['A', 'AAAA', 'CNAME', 'TXT'];
const MAX_RECORDS = 10;

function isPrivateV4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  );
}

function validateRecord(r, i, ZONE) {
  const e = [];
  const p = `record[${i}]`;
  if (!r || typeof r !== 'object') return [`${p}: must be an object`];
  if (!TYPES.includes(r.type)) e.push(`${p}: type must be one of ${TYPES.join(', ')}`);
  if (r.name !== undefined && r.name !== '@' && !LABEL_RE.test(r.name))
    e.push(`${p}: name must be "@" or a single label like "www"`);
  if (typeof r.value !== 'string' || !r.value) {
    e.push(`${p}: value is required`);
    return e;
  }
  if (r.type !== 'TXT' && typeof r.name === 'string' && r.name.startsWith('_'))
    e.push(`${p}: names starting with "_" are only allowed for TXT records`);
  if (r.proxied !== undefined && typeof r.proxied !== 'boolean') e.push(`${p}: proxied must be boolean`);
  if (r.type === 'A') {
    if (!net.isIPv4(r.value)) e.push(`${p}: invalid IPv4`);
    else if (isPrivateV4(r.value)) e.push(`${p}: private/reserved IPv4 not allowed`);
  }
  if (r.type === 'AAAA' && !net.isIPv6(r.value)) e.push(`${p}: invalid IPv6`);
  if (r.type === 'CNAME') {
    if (!HOST_RE.test(r.value)) e.push(`${p}: CNAME target must be a hostname`);
    else if (r.value.toLowerCase().endsWith('.' + ZONE) || r.value.toLowerCase() === ZONE)
      e.push(`${p}: CNAME must not point inside ${ZONE}`);
  }
  if (r.type === 'TXT' && r.value.length > 255) e.push(`${p}: TXT value too long (max 255)`);
  return e;
}

function validateFile(file, ZONE) {
  const errors = [];
  const base = path.basename(file, '.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { name: base, zone: ZONE, errors: [`invalid JSON: ${err.message}`] };
  }
  if (!NAME_RE.test(base)) errors.push(`file name "${base}" is not a valid subdomain (a-z, 0-9, "-", 2-30 chars, no leading/trailing "-")`);
  if (base.length < 2) errors.push('name must be at least 2 characters');
  if (base.startsWith('xn--')) errors.push('punycode names are not allowed');
  if (RESERVED.has(base)) errors.push(`"${base}" is reserved`);
  if (!data.owner || typeof data.owner.username !== 'string' || !data.owner.username)
    errors.push('owner.username (GitHub username) is required');
  if (!Array.isArray(data.records) || data.records.length === 0)
    errors.push('records must be a non-empty array');
  else {
    if (data.records.length > MAX_RECORDS) errors.push(`max ${MAX_RECORDS} records`);
    data.records.forEach((r, i) => errors.push(...validateRecord(r, i, ZONE)));
    // CNAME exclusivity per host
    const byHost = {};
    for (const r of data.records) {
      const h = r && (r.name || '@');
      (byHost[h] = byHost[h] || []).push(r && r.type);
    }
    for (const [h, types] of Object.entries(byHost)) {
      if (types.includes('CNAME') && types.some((t) => t !== 'CNAME' && t !== 'TXT'))
        errors.push(`host "${h}": CNAME cannot coexist with A/AAAA`);
      if (types.filter((t) => t === 'CNAME').length > 1)
        errors.push(`host "${h}": only one CNAME allowed`);
    }
  }
  return { name: base, zone: ZONE, data, errors };
}

function loadAll() {
  const out = [];
  for (const zone of ZONES) {
    const dir = path.join(DOMAINS_DIR, zone);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')))
      out.push(validateFile(path.join(dir, f), zone));
  }
  return out;
}

module.exports = { ZONES, loadAll, validateFile };
