import pino from 'pino';

export type LoggerConfig = {
  /** Logger name/namespace */
  name?: string;
  /** Minimum log level. Defaults to 'info' in production, 'debug' otherwise */
  level?: pino.Level;
};

// Re-export pino's Logger type
export type Logger = pino.Logger;

// Cache logger instances by name
const loggerInstances = new Map<string, pino.Logger>();

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Creates a pino logger.
 *
 * When initLogs() has been called, the @opentelemetry/instrumentation-pino
 * automatically sends all pino logs to PostHog via OpenTelemetry.
 *
 * IMPORTANT: Call initLogs() BEFORE creating loggers to ensure
 * the instrumentation is enabled.
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const { name = 'app', level = isDev ? 'debug' : 'info' } = config;

  return pino({ name, level });
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

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

/**
 * Patches console methods to also send logs to PostHog via OTel.
 * Original console output is preserved.
 *
 * @param namespace - Logger namespace for these console logs (default: 'console')
 */
export function patchConsole(namespace: string = 'console'): void {
  const logger = getLogger(namespace);

  const createPatchedMethod = (
    originalMethod: (...args: unknown[]) => void,
    loggerMethod: pino.LogFn,
  ) => {
    return (...args: unknown[]) => {
      // Call original console method
      originalMethod.apply(console, args);

      // Format args into a message
      const message = args
        .map((arg) =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
        )
        .join(' ');

      // Send to OTel via pino
      loggerMethod(message);
    };
  };

  console.log = createPatchedMethod(originalConsole.log, logger.info.bind(logger));
  console.info = createPatchedMethod(originalConsole.info, logger.info.bind(logger));
  console.warn = createPatchedMethod(originalConsole.warn, logger.warn.bind(logger));
  console.error = createPatchedMethod(originalConsole.error, logger.error.bind(logger));
  console.debug = createPatchedMethod(originalConsole.debug, logger.debug.bind(logger));
}

/**
 * Restores original console methods, removing the OTel patches.
 */
export function unpatchConsole(): void {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
}
