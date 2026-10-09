import { describe, expect, it } from 'vitest';

import {
  formatChannelValue,
  otherChannel,
  validateChannelValue,
} from './signInChannels';

describe('validateChannelValue', () => {
  it('requires a value', () => {
    expect(validateChannelValue('email', '   ', null)).toBe('required');
    expect(validateChannelValue('phone', '', null)).toBe('required');
  });

  it('rejects an email without a domain', () => {
    expect(validateChannelValue('email', 'iza@oneproject', null)).toBe(
      'invalid',
    );
  });

  it('rejects the email already on file, ignoring case', () => {
    expect(
      validateChannelValue('email', 'IZA@oneproject.org', 'iza@oneproject.org'),
    ).toBe('unchanged');
  });

  it('accepts a new email', () => {
    expect(
      validateChannelValue('email', 'new@oneproject.org', 'iza@oneproject.org'),
    ).toBeNull();
  });

  it('rejects a phone number that is too short or too long', () => {
    expect(validateChannelValue('phone', '555-5555', null)).toBe('invalid');
    expect(validateChannelValue('phone', '1234567890123456', null)).toBe(
      'invalid',
    );
  });

  it('treats a number with and without the US country code as the same', () => {
    expect(
      validateChannelValue('phone', '(555) 555-5555', '+1-555-555-5555'),
    ).toBe('unchanged');
  });

  it('rejects a number the login screen would reject', () => {
    // No `+`, and not a North American length, so it has no country code.
    expect(validateChannelValue('phone', '44 20 7946 0958', null)).toBe(
      'invalid',
    );
  });

  it('keeps a 10-digit international number apart from a North American one', () => {
    expect(
      validateChannelValue('phone', '+45 12 34 56 78', '+1-451-234-5678'),
    ).toBeNull();
  });

  it('accepts a new phone number', () => {
    expect(
      validateChannelValue('phone', '+44 20 7946 0958', '+1-555-555-5555'),
    ).toBeNull();
  });
});

describe('formatChannelValue', () => {
  it('formats a North American number', () => {
    expect(formatChannelValue('phone', '1 (555) 555 5555')).toBe(
      '+1-555-555-5555',
    );
  });

  it('leaves other numbers as typed', () => {
    expect(formatChannelValue('phone', ' +44 20 7946 0958 ')).toBe(
      '+44 20 7946 0958',
    );
    expect(formatChannelValue('phone', '+65 9123 4567')).toBe('+65 9123 4567');
  });

  it('trims an email', () => {
    expect(formatChannelValue('email', ' iza@oneproject.org ')).toBe(
      'iza@oneproject.org',
    );
  });
});

describe('otherChannel', () => {
  it('pairs email with phone', () => {
    expect(otherChannel('email')).toBe('phone');
    expect(otherChannel('phone')).toBe('email');
  });
});
