#!/usr/bin/env node
/**
 * Build a self-contained copy of the FICMS backend for embedding in the
 * desktop app's standalone mode.
 *
 * Why this exists: pnpm's default `node-linker=isolated` layout stores
 * `node_modules` as symlinks into a content-addressable store. Those links do
 * not survive packaging (and on Windows they carry absolute junction targets),
 * so a naive `extraResources: ../api/node_modules` would ship a backend that
 * cannot resolve its dependencies on a user's machine.
 *
 * This script therefore assembles a dependency graph of REAL files only:
 *   1. builds @ficms/api (idempotent),
 *   2. installs the backend's external runtime dependencies with pnpm's
 *      `node-linker=hoisted` (a flat, symlink-free node_modules like npm's),
 *      pinned to the exact versions resolved in pnpm-lock.yaml, and
 *   3. lays the compiled `@ficms/*` workspace packages (dist only) directly
 *      into `node_modules/@ficms/*`, so `workspace:*` never reaches the
 *      installer.
 *
 * Output: apps/desktop/backend-bundle/{main.js, node_modules/…}
 *
 * Usage:
 *   node scripts/bundle-backend.mjs
 */
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'apps', 'desktop', 'backend-bundle');

/**
 * External production runtime dependencies of the backend, pinned to the exact
 * versions resolved in pnpm-lock.yaml. Keep in sync with the `dependencies` of
 * `apps/api` and the non-`@ficms/*` dependencies of the workspace packages it
 * imports (@ficms/config, @ficms/security, @ficms/database).
 */
const EXTERNAL_DEPS = {
  '@nestjs/common': '10.4.22',
  '@nestjs/core': '10.4.22',
  '@nestjs/platform-express': '10.4.22',
  '@nestjs/swagger': '7.4.2',
  helmet: '7.2.0',
  pdfkit: '0.15.2',
  'reflect-metadata': '0.2.2',
  rxjs: '7.8.2',
  zod: '3.25.76',
  '@noble/hashes': '1.8.0',
  pg: '8.23.0',
  'sql.js': '1.14.2'
};

/** Compiled workspace packages copied into the bundle's node_modules. */
const WORKSPACE_PACKAGES = ['config', 'types', 'security', 'domain', 'database'];

function run(label, cmd, args, opts = {}) {
  console.log(`\n== ${label} ==\n  $ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

async function main() {
  run('build api', 'corepack', ['pnpm', '--filter', '@ficms/api', 'build']);

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ficms-backend-'));
  const tmpPkg = path.join(tmp, 'pkg');
  await fs.mkdir(tmpPkg, { recursive: true });
  try {
    await fs.writeFile(
      path.join(tmpPkg, 'package.json'),
      JSON.stringify(
        {
          name: 'ficms-backend-runtime',
          version: '0.1.0',
          private: true,
          packageManager: 'pnpm@9.15.9',
          dependencies: EXTERNAL_DEPS
        },
        null,
        2
      ) + '\n'
    );

    run('install runtime deps', 'corepack', ['pnpm', 'install', '--prod', '--node-linker=hoisted'], {
      cwd: tmpPkg
    });

    console.log('\n== assemble bundle ==');
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });

    await fs.cp(path.join(root, 'apps', 'api', 'dist'), outDir, { recursive: true });
    await fs.cp(path.join(tmpPkg, 'node_modules'), path.join(outDir, 'node_modules'), { recursive: true });

    // Hoisted installs still place a `.bin` symlink farm; runtime does not need it.
    await fs.rm(path.join(outDir, 'node_modules', '.bin'), { recursive: true, force: true });

    for (const name of WORKSPACE_PACKAGES) {
      const srcDist = path.join(root, 'packages', name, 'dist');
      const pkgDir = path.join(outDir, 'node_modules', '@ficms', name);
      await fs.cp(srcDist, pkgDir, { recursive: true });
      await fs.writeFile(
        path.join(pkgDir, 'package.json'),
        JSON.stringify({ name: `@ficms/${name}`, version: '0.1.0', main: 'index.js' }, null, 2) + '\n'
      );
    }

    await fs.writeFile(
      path.join(outDir, 'package.json'),
      JSON.stringify({ name: '@ficms/backend-bundle', version: '0.1.0', private: true }, null, 2) + '\n'
    );

    const mainJs = path.join(outDir, 'main.js');
    if (!(await fs.stat(mainJs).catch(() => null))) {
      throw new Error(`Bundle is missing ${mainJs}; the API build produced no entrypoint.`);
    }
    console.log(`\nBackend bundle ready at ${outDir}`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
