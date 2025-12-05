import type { AnyValue } from '@opentelemetry/api-logs';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

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
    // Convert unknown to AnyValue (string, number, boolean, or undefined)
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === undefined ||
      value === null
    ) {
      result[key] = value as AnyValue;
    } else {
      // Convert complex types to string
      result[key] = JSON.stringify(value);
    }
  }
  return result;
}

export class Logger {
  private otelLogger = logs.getLogger('app');
  private pendingLogs: Array<{
    level: LogLevel;
    message: string;
    data?: LogData;
  }> = [];

  private log(level: LogLevel, message: string, data?: LogData) {
    // Always log to console in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'debug' ? 'log' : level;
      console[consoleMethod](`[${level.toUpperCase()}]`, message, data ?? '');
    }

    // Emit to OpenTelemetry
    this.otelLogger.emit({
      severityNumber: severityMap[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes: toAnyValueMap(data),
    });

    // Store for flushing
    this.pendingLogs.push({ level, message, data });
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
    // Clear pending logs - actual flushing is handled by OTel exporters
    this.pendingLogs = [];
    return Promise.resolve();
  }
}

export const logger = new Logger();
