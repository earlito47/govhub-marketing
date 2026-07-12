import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Reruns within the same ISO week hit this cache so debugging/re-running the
// pilot locally doesn't re-hammer the API. Never committed (.cache/ is gitignored).

export function cacheKey(endpoint, payload, isoWeek) {
  const hash = createHash('sha256')
    .update(endpoint)
    .update('\n')
    .update(JSON.stringify(payload ?? null))
    .update('\n')
    .update(isoWeek)
    .digest('hex');
  return hash.slice(0, 24);
}

export async function readCache(cacheDir, key) {
  try {
    const raw = await readFile(path.join(cacheDir, `${key}.json`), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
}

export async function writeCache(cacheDir, key, data) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(path.join(cacheDir, `${key}.json`), JSON.stringify(data), 'utf8');
}
