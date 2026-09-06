#!/usr/bin/env node
/**
 * Run electron-builder for the desktop app and, on failure, surface the error
 * tail as a GitHub Actions annotation so it is readable via the check-runs API
 * even when raw step logs are not accessible.
 *
 * Cross-platform: invokes electron-builder's CLI entry directly through the
 * local Node binary (no shell shims), with a short pre-flight diagnostic.
 *
 * Usage:
 *   node scripts/run-electron-builder.mjs --linux --x64 --publish never
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopDir = path.join(root, 'apps', 'desktop');
const cli = path.join(desktopDir, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
const args = process.argv.slice(2);

console.log('electron-builder cli:', fs.existsSync(cli) ? 'present' : 'MISSING');
const electronDist = path.join(desktopDir, 'node_modules', 'electron', 'dist');
console.log('electron dist:', fs.existsSync(electronDist) ? 'present' : 'MISSING');
if (fs.existsSync(path.join(electronDist, 'version'))) {
  console.log('electron version file:', fs.readFileSync(path.join(electronDist, 'version'), 'utf8').trim());
}

const result = spawnSync(process.execPath, [cli, ...args], {
  cwd: desktopDir,
  env: process.env,
  encoding: 'utf8'
});
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

if (result.status !== 0) {
  const tail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.split('\n').slice(-30).join(' ');
  const escaped = tail.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::error title=electron-builder::${escaped}`);
  process.exit(result.status ?? 1);
}
