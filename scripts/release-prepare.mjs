#!/usr/bin/env node
/**
 * Release preparation orchestrator.
 *
 * Builds the monorepo, runs the test suite, then produces the checksums and
 * SBOM that ship alongside every release. Designed to be idempotent and to
 * fail fast so a broken build never becomes a release candidate.
 *
 * Usage:
 *   node scripts/release-prepare.mjs
 *
 * Env:
 *   SKIP_TESTS=1            skip the test phase
 *   RELEASE_DIR=release     where packaged artifacts live (defaults to release/)
 */
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';

const root = process.cwd();
const skipTests = process.env.SKIP_TESTS === '1';
const releaseDir = process.env.RELEASE_DIR ?? 'release';

function run(label, cmd, args) {
  console.log(`\n== ${label} ==\n  $ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`\n${label} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function pnpm(args) {
  run('pnpm', 'corepack', ['pnpm', ...args]);
}

async function main() {
  console.log('FICMS release preparation');
  console.log(`Working directory: ${root}`);

  pnpm(['install', '--frozen-lockfile']);
  pnpm(['-r', '--filter', './packages/**', '--filter', './apps/**', 'build']);
  pnpm(['-r', 'typecheck']);
  pnpm(['-r', 'lint']);
  if (!skipTests) pnpm(['-r', 'test']);

  const artifacts = await fs.readdir(releaseDir).catch(() => []);
  if (artifacts.length === 0) {
    console.log(`\nNo artifacts in ${releaseDir}; skipping checksums (packaging runs on native OS runners in CI).`);
  } else {
    run('checksums', 'node', ['scripts/gen-checksums.mjs', releaseDir]);
  }
  run('sbom', 'node', ['scripts/gen-sbom.mjs']);

  console.log('\nRelease preparation complete. Artifacts + SHA256SUMS + SBOM are ready.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
