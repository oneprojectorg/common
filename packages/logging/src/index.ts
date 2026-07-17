// Server-side logger
export { logger, Logger } from './lib/logger';
export type { LogLevel, LogData } from './lib/logger';

// Per-request log context (PostHog person linking)
export {
  withLogContext,
  setLogDistinctId,
  setLogSessionId,
} from './lib/logContext';

// OpenTelemetry metrics
export { metrics } from '@opentelemetry/api';
export type { Counter } from '@opentelemetry/api';

// Middleware utilities
export { transformMiddlewareRequest } from './lib/middleware';
