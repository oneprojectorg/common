import { context, trace } from '@opentelemetry/api';
import type { AnyValue } from '@opentelemetry/api-logs';
import { SeverityNumber, logs } from '@opentelemetry/api-logs';

import { getLogContext } from './logContext';
import { redactEmails } from './redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogData = Record<string, unknown>;

const severityMap: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

function toAnyValueMap(
  data: LogData | undefined,
): Record<string, AnyValue> | undefined {
  if (!data) {
    return undefined;
  }
  const result: Record<string, AnyValue> = {};
  for (const [key, value] of Object.entries(data)) {
    let attribute: AnyValue;
    // Convert unknown to AnyValue (string, number, boolean, or undefined)
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === undefined ||
      value === null
    ) {
      attribute = value as AnyValue;
    } else if (value instanceof Error) {
      // JSON.stringify(Error) yields "{}" — keep name/message/stack instead
      attribute = value.stack ?? `${value.name}: ${value.message}`;
    } else {
      try {
        // Convert complex types to string
        attribute = JSON.stringify(value);
      } catch (e) {
        attribute = '(Could not deserialize value)';
      }
    }

    // Redact after every branch has collapsed the value to a primitive: an
    // address can arrive under any key, inside an error message, or nested in a
    // serialised object, so this is the one place that catches all three.
    result[key] =
      typeof attribute === 'string' ? redactEmails(attribute) : attribute;
  }
  return result;
}

export class Logger {
  private otelLogger = logs.getLogger('app');

  private log(level: LogLevel, message: string, data?: LogData) {
    // Get trace context
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();
    const traceId = spanContext?.traceId;
    const spanId = spanContext?.spanId;

    // posthogDistinctId links a record to a person; sessionId links it to a
    // session replay. Explicit values in `data` win over the request context.
    const logContext = getLogContext();
    const distinctId = logContext?.posthogDistinctId;
    const sessionId = logContext?.sessionId;

    // Merge trace and user context into data
    const enrichedData: LogData = {
      ...(distinctId && { posthogDistinctId: distinctId }),
      ...(sessionId && { sessionId }),
      ...data,
      ...(traceId && { traceId }),
      ...(spanId && { spanId }),
    };

    // Both sinks read the same redacted payload, so the development console
    // cannot show what the exporter strips — a redaction gap stays visible
    // locally instead of surfacing only once the record reaches PostHog.
    const attributes = toAnyValueMap(enrichedData);
    const body = redactEmails(message);

    // Always log to console in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'debug' ? 'log' : level;
      console[consoleMethod](`[${level.toUpperCase()}]`, body, attributes);
    }

    // Emit to OpenTelemetry with trace context
    const activeContext = context.active();
    this.otelLogger.emit({
      context: activeContext,
      severityNumber: severityMap[level],
      severityText: level.toUpperCase(),
      body,
      attributes,
    });
  }

  debug(message: string, data?: LogData) {
    this.log('debug', message, data);
  }

  info(message: string, data?: LogData) {
    this.log('info', message, data);
  }

  warn(message: string, data?: LogData) {
    this.log('warn', message, data);
  }

  error(message: string, data?: LogData) {
    this.log('error', message, data);
  }

  async flush(): Promise<void> {
    const provider = logs.getLoggerProvider();
    if ('forceFlush' in provider && typeof provider.forceFlush === 'function') {
      await provider.forceFlush();
    }
  }
}

export const logger = new Logger();
