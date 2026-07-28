#!/usr/bin/env node
// Pre-publish voice guard: no em dashes (—, U+2014) in visible page copy.
// The content voice standard bans them (savvy readers read the em dash as an
// AI-writing tell), so this fails the build if one ships in prose.
//
// It ignores legitimate non-prose uses so it does not false-positive:
//   - <script> and <style> blocks (code, e.g. a tool's placeholder string)
//   - lone em-dash placeholders in empty table cells (>—<)
//   - en dashes (–, U+2013), which are correct in numeric/date ranges
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const offenders = [];
for (const file of htmlFiles(DIST)) {
  const visible = readFileSync(file, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/>\s*—\s*</g, '><'); // empty-cell placeholder, not prose
  const idx = visible.indexOf('—');
  if (idx !== -1) {
    const snippet = visible.slice(Math.max(0, idx - 50), idx + 50).replace(/\s+/g, ' ');
    offenders.push({ file: file.replace(DIST, 'dist'), snippet });
  }
}

if (offenders.length) {
  console.error(`em-dash guard: ${offenders.length} page(s) ship an em dash in visible copy — fix before publishing:`);
  for (const o of offenders) console.error(`  ${o.file}\n    …${o.snippet}…`);
  process.exit(1);
}
console.log(`em-dash guard: clean (${htmlFiles(DIST).length} pages)`);
