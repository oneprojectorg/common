// Server-side logger
export { logger, Logger } from './lib/logger';
export type { LogLevel, LogData } from './lib/logger';

// Client-side exports
export { clientLogger, useLogger, WebVitals } from './lib/client-logger';

// Middleware utilities
export { transformMiddlewareRequest } from './lib/middleware';
