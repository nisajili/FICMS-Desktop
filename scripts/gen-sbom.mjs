#!/usr/bin/env node
/**
 * Generate a CycloneDX 1.4 JSON SBOM for the FICMS dependency graph.
 *
 * The component inventory is derived from `pnpm-lock.yaml` (the single source
 * of truth for resolved, pinned dependency versions) and enriched with the
 * license declared by each installed package when available.
 *
 * Usage:
 *   node scripts/gen-sbom.mjs [--out sbom.cdx.json]
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const outFile = outFlag >= 0 ? args[outFlag + 1] : 'sbom.cdx.json';

function purlFor(name, version) {
  const encoded = encodeURIComponent(name).replace(/%40/g, '@');
  return `pkg:npm/${encoded}@${version}`;
}

/** Extract `{name, version}` from a pnpm lockfile snapshot key. */
function parseSnapshotKey(key) {
  const raw = key.replace(/^\//, '').trim();
  const at = raw.lastIndexOf('@');
  if (at <= 0) return null;
  const name = raw.slice(0, at);
  const versionAndPeer = raw.slice(at + 1);
  const version = versionAndPeer.split('(')[0];
  if (!name || !version) return null;
  return { name, version };
}

/** Best-effort license lookup from the installed package manifest. */
async function licenseFor(name, version) {
  const parts = name.startsWith('@') ? name.split('/') : [name];
  const dir = name.startsWith('@') ? path.join('@' + parts[1].replace(/^@/, ''), parts[1]) : name;
  const candidates = [
    path.join('node_modules', '.pnpm', `${name.replace('/', '+')}@${version}`, 'node_modules', name, 'package.json'),
    path.join('node_modules', name, 'package.json')
  ];
  for (const candidate of candidates) {
    try {
      const manifest = JSON.parse(await fs.readFile(candidate, 'utf8'));
      if (manifest.license) return typeof manifest.license === 'string' ? manifest.license : (manifest.license.type ?? 'UNKNOWN');
    } catch {
      /* keep trying */
    }
  }
  return 'UNKNOWN';
}

async function main() {
  const lock = await fs.readFile('pnpm-lock.yaml', 'utf8');
  const lines = lock.split('\n');

  // Locate the top-level `packages:` section.
  let inPackages = false;
  const snapshotKeys = [];
  for (const line of lines) {
    if (!inPackages) {
      if (/^packages:/.test(line)) inPackages = true;
      continue;
    }
    if (/^\S/.test(line)) break; // a new top-level key ends the section
    const m = line.match(/^\s+(['"]?)([^'"]+)\1:\s*$/);
    if (m) snapshotKeys.push(m[2]);
  }

  const seen = new Map();
  for (const key of snapshotKeys) {
    const parsed = parseSnapshotKey(key);
    if (!parsed) continue;
    if (!seen.has(parsed.name)) seen.set(parsed.name, parsed);
  }

  const components = [];
  for (const [name, { version }] of [...seen.entries()].sort()) {
    components.push({
      type: 'library',
      'bom-ref': purlFor(name, version),
      name,
      version,
      purl: purlFor(name, version),
      licenses: [{ license: { name: await licenseFor(name, version) } }]
    });
  }

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'FICMS', name: 'gen-sbom', version: '1.0.0' }],
      component: {
        type: 'application',
        'bom-ref': 'pkg:npm/ficms@0.1.0',
        name: 'FICMS',
        version: '0.1.0'
      }
    },
    components
  };

  await fs.writeFile(outFile, JSON.stringify(sbom, null, 2) + '\n');
  console.log(`SBOM written to ${outFile} (${components.length} components)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
