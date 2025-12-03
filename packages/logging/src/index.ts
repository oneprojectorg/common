export { transformMiddlewareRequest } from '@axiomhq/nextjs';
export { logger, withAxiom } from './lib/axiom/server';
export * from './lib/axiom/client';

// Export types for better TypeScript support
export type { Logger } from '@axiomhq/logging';
export type LogLevel = 'info' | 'error' | 'warn' | 'debug';
export type LogData = Record<string, any>;

// PostHog logging exports
export * from './lib/posthog';
