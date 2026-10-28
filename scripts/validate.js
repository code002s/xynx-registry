const path = require('path');
const { loadAll } = require('./lib');

const prAuthor = (process.env.PR_AUTHOR || '').toLowerCase();
const changed = (process.env.CHANGED_FILES || '')
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => /^domains\/[^/]+\/[^/]+\.json$/.test(s))
  .map((s) => s.slice('domains/'.length, -'.json'.length)); // "zone/name"

let failed = false;
const results = loadAll();

// Max 3 subdomains per owner.
const perOwner = {};
for (const r of results) {
  const u = r.data && r.data.owner && String(r.data.owner.username).toLowerCase();
  if (u) (perOwner[u] = perOwner[u] || []).push(r);
}
for (const [u, list] of Object.entries(perOwner)) {
  if (list.length > 3) list.forEach((r) => r.errors.push(`owner "${u}" has ${list.length} subdomains (max 3)`));
}

for (const r of results) {
  const errs = [...r.errors];
  // In a PR, the owner of a changed file must be the PR author.
  if (prAuthor && changed.includes(`${r.zone}/${r.name}`) && r.data && r.data.owner) {
    if (String(r.data.owner.username).toLowerCase() !== prAuthor)
      errs.push(`owner.username "${r.data.owner.username}" must match PR author "${prAuthor}"`);
  }
  if (errs.length) {
    failed = true;
    console.error(`\n✖ ${r.name}.${r.zone}`);
    errs.forEach((e) => console.error(`   - ${e}`));
  } else if (!changed.length || changed.includes(`${r.zone}/${r.name}`)) {
    console.log(`✔ ${r.name}.${r.zone}`);
  }
}

if (failed) {
  console.error('\nValidation failed.');
  process.exit(1);
}
console.log(`\nAll ${results.length} domain file(s) are valid.`);
