import { SeverityNumber, Logger } from '@opentelemetry/api-logs';
import { getLoggerProvider } from './provider';

export type LogAttributes = Record<string, string | number | boolean | undefined>;

export type LogContext = {
  /** User ID for user-scoped logs */
  userId?: string;
  /** Organization ID for org-scoped logs */
  organizationId?: string;
  /** Request ID for request tracing */
  requestId?: string;
  /** Additional custom attributes */
  [key: string]: string | number | boolean | undefined;
};

/**
 * PostHog Logger instance that wraps OpenTelemetry logging
 * with convenient methods for different severity levels.
 */
export class PostHogLogger {
  private logger: Logger | null = null;
  private defaultContext: LogContext;

  constructor(
    private name: string = 'common',
    private version: string = '1.0.0',
    defaultContext: LogContext = {}
  ) {
    this.defaultContext = defaultContext;
  }

  private getLogger(): Logger | null {
    if (!this.logger) {
      const provider = getLoggerProvider();
      if (provider) {
        this.logger = provider.getLogger(this.name, this.version);
      }
    }
    return this.logger;
  }

  private emit(
    severityNumber: SeverityNumber,
    severityText: string,
    message: string,
    attributes?: LogAttributes,
    context?: LogContext
  ): void {
    const logger = this.getLogger();
    if (!logger) {
      // Fallback to console if logger not initialized
      const consoleMethod =
        severityNumber >= SeverityNumber.ERROR
          ? 'error'
          : severityNumber >= SeverityNumber.WARN
            ? 'warn'
            : severityNumber >= SeverityNumber.DEBUG
              ? 'debug'
              : 'log';
      console[consoleMethod](`[${severityText}] ${message}`, {
        ...this.defaultContext,
        ...context,
        ...attributes,
      });
      return;
    }

    logger.emit({
      severityNumber,
      severityText,
      body: message,
      attributes: {
        ...this.defaultContext,
        ...context,
        ...attributes,
      },
    });
  }

  /**
   * Log a trace-level message (most verbose)
   */
  trace(message: string, attributes?: LogAttributes, context?: LogContext): void {
    this.emit(SeverityNumber.TRACE, 'trace', message, attributes, context);
  }

  /**
   * Log a debug-level message
   */
  debug(message: string, attributes?: LogAttributes, context?: LogContext): void {
    this.emit(SeverityNumber.DEBUG, 'debug', message, attributes, context);
  }

  /**
   * Log an info-level message
   */
  info(message: string, attributes?: LogAttributes, context?: LogContext): void {
    this.emit(SeverityNumber.INFO, 'info', message, attributes, context);
  }

  /**
   * Log a warning-level message
   */
  warn(message: string, attributes?: LogAttributes, context?: LogContext): void {
    this.emit(SeverityNumber.WARN, 'warn', message, attributes, context);
  }

  /**
   * Log an error-level message
   */
  error(
    message: string,
    error?: Error,
    attributes?: LogAttributes,
    context?: LogContext
  ): void {
    const errorAttributes: LogAttributes = {
      ...attributes,
    };

    if (error) {
      errorAttributes['error.type'] = error.name;
      errorAttributes['error.message'] = error.message;
      errorAttributes['error.stack'] = error.stack;
    }

    this.emit(SeverityNumber.ERROR, 'error', message, errorAttributes, context);
  }

  /**
   * Log a fatal-level message (most severe)
   */
  fatal(
    message: string,
    error?: Error,
    attributes?: LogAttributes,
    context?: LogContext
  ): void {
    const errorAttributes: LogAttributes = {
      ...attributes,
    };

    if (error) {
      errorAttributes['error.type'] = error.name;
      errorAttributes['error.message'] = error.message;
      errorAttributes['error.stack'] = error.stack;
    }

    this.emit(SeverityNumber.FATAL, 'fatal', message, errorAttributes, context);
  }

  /**
   * Creates a child logger with additional default context.
   * Useful for adding request-specific or user-specific context.
   */
  child(additionalContext: LogContext): PostHogLogger {
    return new PostHogLogger(this.name, this.version, {
      ...this.defaultContext,
      ...additionalContext,
    });
  }
}

// Default logger instance
let defaultLogger: PostHogLogger | null = null;

/**
 * Gets the default PostHog logger instance.
 * Creates one if it doesn't exist.
 */
export function getLogger(name?: string, version?: string): PostHogLogger {
  if (!defaultLogger) {
    defaultLogger = new PostHogLogger(name, version);
  }
  return defaultLogger;
}

/**
 * Creates a new PostHog logger with the given name and optional context.
 */
export function createLogger(
  name: string,
  version: string = '1.0.0',
  defaultContext: LogContext = {}
): PostHogLogger {
  return new PostHogLogger(name, version, defaultContext);
}
