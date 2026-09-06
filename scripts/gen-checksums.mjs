#!/usr/bin/env node
/**
 * Generate SHA-256 checksums for release artifacts.
 *
 * Usage:
 *   node scripts/gen-checksums.mjs [directory] [--out SHA256SUMS.txt]
 *
 * Defaults to the `release/` directory produced by electron-builder. Writes:
 *   - one `SHA256SUMS` file (GNU `sha256sum -c` compatible), and
 *   - one `<file>.sha256` sidecar per artifact.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) ?? 'release';
const outFlag = args.indexOf('--out');
const outFile = outFlag >= 0 ? args[outFlag + 1] : path.join(dir, 'SHA256SUMS');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile() && !entry.name.endsWith('.sha256') && entry.name !== 'SHA256SUMS') files.push(full);
  }
  return files.sort();
}

async function main() {
  const files = await walk(dir);
  if (files.length === 0) {
    console.error(`No artifacts found in ${dir}. Run the packaging step first.`);
    process.exitCode = 1;
    return;
  }

  const lines = [];
  for (const file of files) {
    const buf = await fs.readFile(file);
    const hash = sha256(buf);
    const rel = path.relative(dir, file);
    lines.push(`${hash}  ${rel}`);
    await fs.writeFile(`${file}.sha256`, `${hash}  ${path.basename(file)}\n`);
    console.log(`${hash}  ${rel}`);
  }

  await fs.writeFile(outFile, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${lines.length} checksum(s) to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
