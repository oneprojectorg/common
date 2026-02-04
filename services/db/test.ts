/**
 * Test-safe database client export.
 * Same as /client but without server-only - use this in Node.js test environments
 * (vitest, playwright) where server-only would throw.
 */
export { db } from './index';
export * from 'drizzle-orm';
export * from './types';
