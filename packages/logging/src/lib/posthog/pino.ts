import pino from 'pino';

export type LoggerConfig = {
  /** Logger name/namespace */
  name?: string;
  /** Minimum log level. Defaults to 'info' in production, 'debug' otherwise */
  level?: pino.Level;
};

// Cache logger instances by name
const loggerInstances = new Map<string, pino.Logger>();

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Creates a logger configured to send logs to PostHog via OpenTelemetry.
 *
 * In development, logs are written to stdout as JSON.
 * In production, logs are sent to PostHog via the OTel transport.
 *
 * IMPORTANT: Call initLogs() before using this logger to ensure
 * the OTel provider is registered globally.
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const { name = 'app', level = isDev ? 'debug' : 'info' } = config;

  // In development, use simple stdout logging to avoid worker thread
  // issues with Next.js hot reloading
  if (isDev) {
    return pino({ name, level });
  }

  // In production, use OTel transport for PostHog
  return pino({
    name,
    level,
    transport: {
      target: 'pino-opentelemetry-transport',
      options: {
        // The transport will use the global OTel LoggerProvider
      },
    },
  });
}

/**
 * Gets a logger instance, creating one if it doesn't exist.
 * Logger instances are cached by name for reuse.
 */
export function getLogger(name: string = 'app'): pino.Logger {
  if (!loggerInstances.has(name)) {
    loggerInstances.set(name, createLogger({ name }));
  }
  return loggerInstances.get(name)!;
}
