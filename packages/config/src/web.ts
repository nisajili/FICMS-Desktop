/**
 * Browser-safe config surface. The renderer imports from `@ficms/config/web`
 * so that Node-only modules (`process.env`, `node:*`) are never pulled into
 * the bundle.
 */
export * from './schema';
export * from './defaults';
