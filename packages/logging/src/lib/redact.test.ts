import { describe, expect, it } from 'vitest';

import { redactEmails, redactPhoneNumbers } from './redact';

describe('redactEmails', () => {
  it('keeps the domain and drops the local part', () => {
    expect(redactEmails('person@example.com')).toBe('[redacted]@example.com');
  });

  it('redacts an address embedded in a longer string', () => {
    expect(redactEmails('User person@example.com was rejected')).toBe(
      'User [redacted]@example.com was rejected',
    );
  });

  it('redacts every address in the string', () => {
    expect(redactEmails('first@example.com and second@other.org')).toBe(
      '[redacted]@example.com and [redacted]@other.org',
    );
  });

  it('redacts local parts carrying tags and punctuation', () => {
    expect(redactEmails('first.last+tag@example.com')).toBe(
      '[redacted]@example.com',
    );
  });

  it('keeps subdomains', () => {
    expect(redactEmails('person@mail.corp.example.co.uk')).toBe(
      '[redacted]@mail.corp.example.co.uk',
    );
  });

  it('redacts an uppercase address', () => {
    expect(redactEmails('Person@Example.COM')).toBe('[redacted]@Example.COM');
  });

  it('redacts a percent-encoded address in a query string', () => {
    // transformMiddlewareRequest logs the URL of every request, and
    // encodeURIComponent writes `@` as `%40`.
    expect(redactEmails('/login?email=person%40example.com&next=/')).toBe(
      '/login?email=[redacted]%40example.com&next=/',
    );
  });

  it('keeps sentence punctuation that trails an address', () => {
    expect(redactEmails('Invited person@example.com.')).toBe(
      'Invited [redacted]@example.com.',
    );
  });

  it('leaves a run of percent signs alone in linear time', () => {
    // The scanning regex this replaced backtracked here — CodeQL flagged it as
    // polynomial on strings with many '%' (code-scanning/39).
    const hostile = `${'%'.repeat(50_000)}@`;
    const start = performance.now();

    expect(redactEmails(hostile)).toBe(hostile);
    expect(performance.now() - start).toBeLessThan(1_000);
  });

  it('leaves a candidate longer than an address can be alone', () => {
    const overlong = `${'a'.repeat(255)}@example.com`;

    expect(redactEmails(overlong)).toBe(overlong);
  });

  it('leaves a version spec alone', () => {
    // The TLD must be alphabetic, so the `0.1.0` here is not a domain.
    expect(redactEmails('@op/logging@0.1.0')).toBe('@op/logging@0.1.0');
  });

  it('leaves a bare domain alone', () => {
    expect(redactEmails('example.com')).toBe('example.com');
  });

  it('leaves a string with no address alone', () => {
    expect(redactEmails('Login attempt')).toBe('Login attempt');
    expect(redactEmails('')).toBe('');
  });
});

describe('redactPhoneNumbers', () => {
  /**
   * Given an E.164 number
   * When it is redacted
   * Then nothing of the number remains
   */
  it('redacts an E.164 number', () => {
    expect(redactPhoneNumbers('+15551234567')).toBe('[phone]');
  });

  /**
   * Given GoTrue's message for a Twilio refusal, which echoes the number and
   * ends with the Twilio error URL
   * When it is redacted
   * Then the number is gone and the error code in the URL survives
   */
  it('redacts the number inside a Twilio error and keeps the error code', () => {
    expect(
      redactPhoneNumbers(
        'Error sending sms OTP to provider: Invalid parameter `To`: +15551234567 More information: https://www.twilio.com/docs/errors/60200',
      ),
    ).toBe(
      'Error sending sms OTP to provider: Invalid parameter `To`: [phone] More information: https://www.twilio.com/docs/errors/60200',
    );
  });

  /**
   * Given a number written the way a person types it
   * When it is redacted
   * Then the whole formatted number is replaced
   */
  it('redacts a formatted number', () => {
    expect(redactPhoneNumbers('called (415) 555-0132 twice')).toBe(
      'called [phone] twice',
    );
    expect(redactPhoneNumbers('415.555.0132')).toBe('[phone]');
  });

  /**
   * Given digit runs that are not a phone number
   * When they are redacted
   * Then they are left alone
   */
  it('leaves short runs, dates, and long identifiers alone', () => {
    expect(redactPhoneNumbers('code 60203 in 2026')).toBe('code 60203 in 2026');
    expect(redactPhoneNumbers('2026-10-06')).toBe('2026-10-06');
    expect(redactPhoneNumbers('id 1218450028299154')).toBe(
      'id 1218450028299154',
    );
  });

  it('leaves a string with no digits alone', () => {
    expect(redactPhoneNumbers('Login attempt')).toBe('Login attempt');
    expect(redactPhoneNumbers('')).toBe('');
  });
});
