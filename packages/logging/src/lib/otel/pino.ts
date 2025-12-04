import { SeverityNumber } from '@opentelemetry/api-logs';
import pino from 'pino';
import { getLoggerProvider } from './provider';

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

// Map pino levels to OTel severity
const levelToSeverity: Record<number, SeverityNumber> = {
  10: SeverityNumber.TRACE,
  20: SeverityNumber.DEBUG,
  30: SeverityNumber.INFO,
  40: SeverityNumber.WARN,
  50: SeverityNumber.ERROR,
  60: SeverityNumber.FATAL,
};

const levelToName: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

/**
 * Custom pino destination that sends logs to OTel.
 */
function createOTelDestination(loggerName: string): pino.DestinationStream {
  return {
    write(msg: string): void {
      try {
        const log = JSON.parse(msg);
        const provider = getLoggerProvider();

        if (provider) {
          const otelLogger = provider.getLogger(loggerName);
          const { level, time, msg: message, name, pid, hostname, ...attributes } = log;

          otelLogger.emit({
            severityNumber: levelToSeverity[level] ?? SeverityNumber.INFO,
            severityText: levelToName[level] ?? 'info',
            body: message || '',
            attributes,
          });
        }
      } catch {
        // Ignore parse errors
      }
    },
  };
}

/**
 * Creates a pino logger that sends logs to PostHog via OpenTelemetry.
 *
 * IMPORTANT: Call initLogs() before creating loggers to ensure
 * the OTel provider is initialized.
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const { name = 'app', level = isDev ? 'debug' : 'info' } = config;

  return pino({ name, level }, createOTelDestination(name));
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
