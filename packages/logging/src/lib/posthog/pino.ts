import pino from 'pino';

export type LoggerConfig = {
  /** Logger name/namespace */
  name?: string;
  /** Minimum log level. Defaults to 'info' in production, 'debug' otherwise */
  level?: pino.Level;
  /** Enable pretty printing for development. Defaults to true in non-production */
  pretty?: boolean;
};

// Cache logger instances by name
const loggerInstances = new Map<string, pino.Logger>();

/**
 * Creates a logger configured to send logs to PostHog via OpenTelemetry.
 *
 * In development, logs are pretty-printed to console.
 * In production, logs are sent to PostHog via the OTel transport.
 *
 * IMPORTANT: Call initLogs() before using this logger to ensure
 * the OTel provider is registered globally.
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  const {
    name = 'app',
    level = isDev ? 'debug' : 'info',
    pretty = isDev,
  } = config;

  const targets: pino.TransportTargetOptions[] = [];

  // Add OTel transport for PostHog (always, so logs go to PostHog)
  targets.push({
    target: 'pino-opentelemetry-transport',
    options: {
      // The transport will use the global OTel LoggerProvider
    },
    level,
  });

  // Add pretty printing for development
  if (pretty) {
    targets.push({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
      level,
    });
  }

  return pino({
    name,
    level,
    transport: {
      targets,
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
