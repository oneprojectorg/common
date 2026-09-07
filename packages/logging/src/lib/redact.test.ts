import { describe, expect, it } from 'vitest';

import { redactEmails } from './redact';

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
