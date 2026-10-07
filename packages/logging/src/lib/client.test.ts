import type { CaptureLogOptions } from 'posthog-js';
import { beforeEach, describe, expect, it } from 'vitest';

import { type ClientLogSink, createClientLogger } from './client';

const logs: CaptureLogOptions[] = [];
const exceptions: Array<{
  error: unknown;
  properties?: Record<string, unknown>;
}> = [];

const sink: ClientLogSink = {
  captureLog: (options) => {
    logs.push(options);
  },
  captureException: (error, properties) => {
    exceptions.push({ error, properties });
  },
};

const lastLog = (): CaptureLogOptions => {
  const record = logs.at(-1);
  if (!record) {
    throw new Error('no log record was captured');
  }
  return record;
};

describe('client logger', () => {
  const logger = createClientLogger(sink);

  beforeEach(() => {
    logs.length = 0;
    exceptions.length = 0;
  });

  /**
   * Given a refused SMS code with its vendor details
   * When it is logged as an error
   * Then one structured log record carries the message as its body and every
   * detail as its own attribute, where the Logs UI can filter on it
   */
  it('ships an error as a structured log record with attributes', () => {
    logger.error('GoTrue refused to send a code', {
      code: 'sms_send_failed',
      status: 422,
      twilioCode: 20404,
      twilioAccountSid: 'AC…4567',
    });

    expect(lastLog()).toEqual({
      body: 'GoTrue refused to send a code',
      level: 'error',
      attributes: {
        code: 'sms_send_failed',
        status: 422,
        twilioCode: 20404,
        twilioAccountSid: 'AC…4567',
      },
    });
  });

  /**
   * Given the same error
   * When it is logged
   * Then Error Tracking receives it too, with the same attributes as event
   * properties, so the issue and the log record describe one failure
   */
  it('reports an error to Error Tracking with the same attributes', () => {
    logger.error('GoTrue refused to send a code', { twilioCode: 20404 });

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.error).toBeInstanceOf(Error);
    expect(exceptions[0]?.properties).toMatchObject({
      level: 'error',
      message: 'GoTrue refused to send a code',
      twilioCode: 20404,
    });
  });

  /**
   * Given a caught Error under the `error` key
   * When it is logged
   * Then Error Tracking captures that Error itself, and the log record
   * carries its name, message, and stack as attributes
   */
  it('captures a caught Error and describes it on the log record', () => {
    const caught = new TypeError('Failed to fetch');

    logger.error('Could not load proposals', { error: caught });

    expect(exceptions[0]?.error).toBe(caught);
    expect(lastLog().attributes).toMatchObject({
      'error.name': 'TypeError',
      'error.message': 'Failed to fetch',
    });
    expect(lastLog().attributes?.['error.stack']).toContain('Failed to fetch');
  });

  /**
   * Given a message or attribute that carries an email address
   * When it is logged
   * Then the address is redacted before the record leaves the browser, as
   * the server logger already does
   */
  it('redacts email addresses from the body and string attributes', () => {
    logger.warn('Invite failed for person@example.com', {
      recipient: 'other@example.org',
      count: 2,
    });

    expect(lastLog()).toEqual({
      body: 'Invite failed for [redacted]@example.com',
      level: 'warn',
      attributes: { recipient: '[redacted]@example.org', count: 2 },
    });
  });

  /**
   * Given an attribute whose value is an array or an object holding addresses
   * When it is logged
   * Then the value is collapsed to a string with every address redacted, as
   * the server logger does, so no key can smuggle an address inside a list
   */
  it('redacts email addresses inside arrays and nested objects', () => {
    logger.error('Invitations failed', {
      failed: [
        { email: 'person@example.com', reason: 'bounced' },
        'other@example.org',
      ],
      batch: { owner: { email: 'owner@example.net' }, size: 2 },
    });

    expect(lastLog().attributes).toEqual({
      failed:
        '[{"email":"[redacted]@example.com","reason":"bounced"},"[redacted]@example.org"]',
      batch: '{"owner":{"email":"[redacted]@example.net"},"size":2}',
    });
  });

  /**
   * Given data that carries addresses
   * When it is logged at error or warn
   * Then the properties Error Tracking receives are the redacted attributes,
   * not the raw data
   */
  it('redacts email addresses from the properties sent to Error Tracking', () => {
    logger.warn('Invite failed', {
      recipient: 'other@example.org',
      failed: ['person@example.com'],
    });

    expect(exceptions[0]?.properties).toMatchObject({
      recipient: '[redacted]@example.org',
      failed: '["[redacted]@example.com"]',
    });
  });

  /**
   * Given a warning
   * When it is logged
   * Then it reaches Error Tracking at warning level
   */
  it('reports a warning to Error Tracking at warning level', () => {
    logger.warn('Twilio inbound webhook missing MessageSid');

    expect(exceptions[0]?.properties).toMatchObject({ level: 'warning' });
  });

  /**
   * Given an informational message
   * When it is logged
   * Then it becomes a log record and nothing reaches Error Tracking
   */
  it('ships info as a log record only', () => {
    logger.info('Twilio inbound message received', { messageSid: 'SM…1234' });

    expect(lastLog()).toEqual({
      body: 'Twilio inbound message received',
      level: 'info',
      attributes: { messageSid: 'SM…1234' },
    });
    expect(exceptions).toHaveLength(0);
  });

  /**
   * Given a log call with no data
   * When it is logged
   * Then the record has no attributes key rather than an empty object
   */
  it('omits attributes when there is no data', () => {
    logger.info('Mounted');

    expect(lastLog()).toEqual({ body: 'Mounted', level: 'info' });
  });
});
