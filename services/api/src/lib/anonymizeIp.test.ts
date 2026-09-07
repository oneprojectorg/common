import { describe, expect, it } from 'vitest';

import { anonymizeIp } from './anonymizeIp';

describe('anonymizeIp', () => {
  it('zeroes the last octet of an IPv4 address', () => {
    expect(anonymizeIp('203.0.113.42')).toBe('203.0.113.0');
  });

  it('keeps only the client entry of an X-Forwarded-For chain', () => {
    expect(anonymizeIp('203.0.113.42, 70.41.3.18, 150.172.238.178')).toBe(
      '203.0.113.0',
    );
  });

  it('keeps the /48 prefix of an IPv6 address', () => {
    expect(anonymizeIp('2001:db8:1234:5678:9abc:def0:1234:5678')).toBe(
      '2001:db8:1234::',
    );
  });

  it('handles compressed IPv6 forms', () => {
    expect(anonymizeIp('2001:db8:1234::1')).toBe('2001:db8:1234::');
    expect(anonymizeIp('fe80::1')).toBe('fe80::');
    expect(anonymizeIp('::1')).toBe('::');
  });

  it('over-truncates rather than leaking host bits of an IPv4-mapped address', () => {
    expect(anonymizeIp('::ffff:203.0.113.42')).toBe('::');
  });

  it('drops a value that is not a parseable address', () => {
    // X-Forwarded-For is caller-controlled — never log it verbatim.
    expect(anonymizeIp('not-an-ip')).toBeUndefined();
    expect(anonymizeIp('203.0.113.42:8080')).toBeUndefined();
    expect(anonymizeIp('999.1.1.1')).toBeUndefined();
  });

  it('drops an absent or empty value', () => {
    expect(anonymizeIp(null)).toBeUndefined();
    expect(anonymizeIp(undefined)).toBeUndefined();
    expect(anonymizeIp('   ')).toBeUndefined();
    expect(anonymizeIp(', 70.41.3.18')).toBeUndefined();
  });
});
