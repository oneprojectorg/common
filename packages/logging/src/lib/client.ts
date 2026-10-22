import type { CaptureLogOptions, LogAttributes } from 'posthog-js';
import posthog from 'posthog-js';

import { redactEmails } from './redact';

export {
  findTwilioSids,
  fingerprintTwilioSid,
  redactEmails,
  redactPhoneNumbers,
  redactTwilioSids,
} from './redact';

export type LogData = Record<string, unknown> & { error?: unknown };

/**
 * The two PostHog calls the client logger makes. `posthog-js` satisfies it;
 * a test hands in a recorder instead, the way `logger.test.ts` hands the
 * server logger a provider.
 */
export interface ClientLogSink {
  captureLog(options: CaptureLogOptions): void;
  captureException(
    error: unknown,
    additionalProperties?: Record<string, unknown>,
  ): void;
}

type ClientLogLevel = 'error' | 'warn' | 'info';

/**
 * Builds the browser logger over a PostHog sink.
 *
 * Every level becomes a structured log record through `captureLog`, so the
 * message is the body and each key of `data` is its own attribute the Logs
 * UI can filter and group on. The previous design wrote `console.error`
 * with the data as a second argument and relied on PostHog's console
 * autocapture, which flattens that argument into the body text; the
 * attributes never existed as attributes.
 *
 * `error` and `warn` also reach Error Tracking through `captureException`,
 * with the same data as event properties: the caught `error` is the
 * captured value when it is an `Error`, otherwise a synthetic one carries
 * the message.
 *
 * The console gets a copy outside production only. In production the
 * project's console autocapture would turn that copy into a second,
 * unstructured record of the same event.
 */
export const createClientLogger = (sink: ClientLogSink) => {
  const send = (level: ClientLogLevel, message: string, data?: LogData) => {
    const body = redactEmails(message);
    const attributes = toLogAttributes(data);

    if (process.env.NODE_ENV !== 'production') {
      const consoleMethod = level === 'info' ? 'info' : level;
      console[consoleMethod](`[${level.toUpperCase()}] ${body}`, data ?? '');
    }

    sink.captureLog({
      body,
      level,
      ...(attributes && { attributes }),
    });

    if (level === 'info') {
      return;
    }

    const { error, ...context } = data ?? {};
    const captured = error instanceof Error ? error : new Error(body);

    sink.captureException(captured, {
      level: level === 'warn' ? 'warning' : level,
      message: body,
      ...(error !== undefined && !(error instanceof Error)
        ? { originalError: toLogAttributeValue(error) }
        : {}),
      ...toLogAttributes(context),
    });
  };

  return {
    error(message: string, data?: LogData) {
      send('error', message, data);
    },
    warn(message: string, data?: LogData) {
      send('warn', message, data);
    },
    info(message: string, data?: Record<string, unknown>) {
      send('info', message, data);
    },
  };
};

export const logger = createClientLogger(posthog);

/**
 * Flattens `data` into log attributes. A caught `Error` becomes three
 * attributes named after its fields. Every other value collapses to a
 * primitive before redaction, an array or object to its JSON, as the server
 * logger does: an address can arrive under any key, inside a list, or nested
 * in an object, and the string is the one place that catches all three.
 */
const toLogAttributes = (data?: LogData): LogAttributes | undefined => {
  if (!data) {
    return undefined;
  }

  return Object.entries(data).reduce<LogAttributes>(
    (attributes, [key, value]) => {
      if (key === 'error' && value instanceof Error) {
        attributes['error.name'] = value.name;
        attributes['error.message'] = redactEmails(value.message);
        attributes['error.stack'] = redactEmails(value.stack ?? '');
        return attributes;
      }

      attributes[key] = toLogAttributeValue(value);
      return attributes;
    },
    {},
  );
};

const toLogAttributeValue = (value: unknown): LogAttributes[string] => {
  if (typeof value === 'string') {
    return redactEmails(value);
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (typeof value === 'object') {
    return redactEmails(serialize(value));
  }

  return serialize(value);
};

const UNSERIALIZABLE = '(Could not serialize value)';

const serialize = (value: unknown): string => {
  try {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  } catch {
    return UNSERIALIZABLE;
  }
};
