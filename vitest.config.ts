import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Shared Vitest configuration. Cross-package imports resolve to TypeScript
 * source (so tests run without first building `dist`), while production
 * consumers (the NestJS API, Electron) import compiled output.
 */
export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts']
    }
  },
  resolve: {
    alias: {
      '@ficms/types': src('./packages/types/src/index.ts'),
      '@ficms/security': src('./packages/security/src/index.ts'),
      '@ficms/domain': src('./packages/domain/src/index.ts'),
      '@ficms/config': src('./packages/config/src/index.ts'),
      '@ficms/database': src('./packages/database/src/index.ts')
    }
  }
});
