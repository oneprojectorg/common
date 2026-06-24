import { describe, expect, it } from 'vitest';

import { parseClientIp } from './parseClientIp';

const make = (init: Record<string, string>): Headers => new Headers(init);

describe('parseClientIp', () => {
  it('prefers x-real-ip over x-forwarded-for', () => {
    expect(
      parseClientIp(
        make({
          'x-real-ip': '203.0.113.10',
          'x-forwarded-for': 'spoofed-by-client, 198.51.100.1',
        }),
      ),
    ).toBe('203.0.113.10');
  });

  it('trims surrounding whitespace from x-real-ip', () => {
    expect(parseClientIp(make({ 'x-real-ip': '  203.0.113.10  ' }))).toBe(
      '203.0.113.10',
    );
  });

  it('falls back to the rightmost x-forwarded-for entry — never the leftmost (attacker-controlled)', () => {
    expect(
      parseClientIp(
        make({ 'x-forwarded-for': 'spoofed, 10.0.0.1, 198.51.100.1' }),
      ),
    ).toBe('198.51.100.1');
  });

  it('returns the only x-forwarded-for entry when there is just one hop', () => {
    expect(parseClientIp(make({ 'x-forwarded-for': '198.51.100.1' }))).toBe(
      '198.51.100.1',
    );
  });

  it('skips empty entries when picking the rightmost', () => {
    expect(
      parseClientIp(make({ 'x-forwarded-for': '198.51.100.1, ,  ' })),
    ).toBe('198.51.100.1');
  });

  it('ignores an empty x-real-ip and falls through to x-forwarded-for', () => {
    expect(
      parseClientIp(
        make({ 'x-real-ip': '   ', 'x-forwarded-for': '198.51.100.1' }),
      ),
    ).toBe('198.51.100.1');
  });

  it('returns null when neither header is set', () => {
    expect(parseClientIp(make({}))).toBeNull();
  });

  it('returns null when x-forwarded-for is present but contains only whitespace', () => {
    expect(parseClientIp(make({ 'x-forwarded-for': ' , , ' }))).toBeNull();
  });
});
