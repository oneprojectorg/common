import type {
  LogRecord,
  Logger as OtelLogger,
  LoggerProvider,
} from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Logger } from './logger';

const emitted: Array<LogRecord> = [];

const testLogger: OtelLogger = {
  emit(logRecord) {
    emitted.push(logRecord);
  },
};

const testProvider: LoggerProvider = {
  getLogger: () => testLogger,
};

const lastRecord = (): LogRecord => {
  const record = emitted.at(-1);
  if (!record) {
    throw new Error('No log record was emitted');
  }
  return record;
};

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    emitted.length = 0;
    logs.setGlobalLoggerProvider(testProvider);
    // The OTel logger is resolved when the instance is built, so construct
    // after the provider is registered.
    logger = new Logger();
  });

  afterEach(() => {
    logs.disable();
  });

  it('redacts an email address in an attribute', () => {
    logger.warn('Login failed', { email: 'person@example.com' });

    expect(lastRecord().attributes?.email).toBe('[redacted]@example.com');
  });

  it('redacts an email address in the message', () => {
    logger.info('Invited person@example.com');

    expect(lastRecord().body).toBe('Invited [redacted]@example.com');
  });

  it('redacts an email address carried by an error', () => {
    logger.error('Login error', {
      error: new Error('User person@example.com not found'),
    });

    expect(lastRecord().attributes?.error).not.toContain('person@example.com');
    expect(lastRecord().attributes?.error).toContain('[redacted]@example.com');
  });

  it('redacts an email address nested in a serialised object', () => {
    logger.info('Sending batch invitation emails', {
      recipients: [{ to: 'person@example.com' }],
    });

    expect(lastRecord().attributes?.recipients).toBe(
      JSON.stringify([{ to: '[redacted]@example.com' }]),
    );
  });

  it('leaves the rest of the attributes intact', () => {
    logger.info('Login attempt', {
      emailDomain: 'example.com',
      usingOAuth: true,
      attempt: 2,
    });

    expect(lastRecord().attributes).toMatchObject({
      emailDomain: 'example.com',
      usingOAuth: true,
      attempt: 2,
    });
  });
});
