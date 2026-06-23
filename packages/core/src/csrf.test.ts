import { describe, expect, it } from 'vitest';

import { CSRF_HEADER, csrfRejection } from './csrf';

const ALLOWED = (origin: string) => origin.endsWith('.oneproject.org');

const mkReq = (method: string, headers: Record<string, string> = {}): Request =>
  new Request('https://api.oneproject.org/api/v1/trpc/foo', {
    method,
    headers,
  });

describe('csrfRejection', () => {
  it('passes GET regardless of headers', () => {
    expect(
      csrfRejection(mkReq('GET'), { isOriginAllowed: ALLOWED }),
    ).toBeNull();
    expect(
      csrfRejection(mkReq('HEAD'), { isOriginAllowed: ALLOWED }),
    ).toBeNull();
    expect(
      csrfRejection(mkReq('OPTIONS'), { isOriginAllowed: ALLOWED }),
    ).toBeNull();
  });

  it('rejects mutating requests without the custom header', () => {
    const req = mkReq('POST', { origin: 'https://app.oneproject.org' });
    expect(csrfRejection(req, { isOriginAllowed: ALLOWED })).toBe(
      'missing-header',
    );
  });

  it('accepts mutating requests with header + allowed Origin', () => {
    const req = mkReq('POST', {
      [CSRF_HEADER]: '1',
      origin: 'https://app.oneproject.org',
    });
    expect(csrfRejection(req, { isOriginAllowed: ALLOWED })).toBeNull();
  });

  it('rejects mutating requests with header but disallowed Origin', () => {
    const req = mkReq('POST', {
      [CSRF_HEADER]: '1',
      origin: 'https://attacker.example.com',
    });
    expect(csrfRejection(req, { isOriginAllowed: ALLOWED })).toBe(
      'origin-not-allowed',
    );
  });

  it('falls back to Referer when Origin is missing and matches', () => {
    const req = mkReq('POST', {
      [CSRF_HEADER]: '1',
      referer: 'https://app.oneproject.org/some/path',
    });
    expect(csrfRejection(req, { isOriginAllowed: ALLOWED })).toBeNull();
  });

  it('falls back to Referer when Origin is missing and rejects mismatch', () => {
    const req = mkReq('POST', {
      [CSRF_HEADER]: '1',
      referer: 'https://attacker.example.com/some/path',
    });
    expect(csrfRejection(req, { isOriginAllowed: ALLOWED })).toBe(
      'referer-not-allowed',
    );
  });

  it('rejects a malformed Referer', () => {
    const req = mkReq('POST', {
      [CSRF_HEADER]: '1',
      referer: 'not a url',
    });
    expect(csrfRejection(req, { isOriginAllowed: ALLOWED })).toBe(
      'invalid-referer',
    );
  });

  it('rejects an opaque (Origin: null) request — sandboxed iframe / file:// / data:', () => {
    const req = mkReq('POST', { [CSRF_HEADER]: '1', origin: 'null' });
    expect(csrfRejection(req, { isOriginAllowed: ALLOWED })).toBe(
      'origin-not-allowed',
    );
  });

  it('passes mutating requests with header but no Origin or Referer (SSR / non-browser)', () => {
    const req = mkReq('POST', { [CSRF_HEADER]: '1' });
    expect(csrfRejection(req, { isOriginAllowed: ALLOWED })).toBeNull();
  });

  it('still requires the header when isOriginAllowed always returns true (dev mode)', () => {
    const req = mkReq('POST', { origin: 'http://localhost:3100' });
    expect(csrfRejection(req, { isOriginAllowed: () => true })).toBe(
      'missing-header',
    );
  });

  it('passes the dev-mode bypass when header is present', () => {
    const req = mkReq('POST', {
      [CSRF_HEADER]: '1',
      origin: 'http://localhost:3100',
    });
    expect(csrfRejection(req, { isOriginAllowed: () => true })).toBeNull();
  });

  it('covers PUT/PATCH/DELETE the same as POST', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      expect(csrfRejection(mkReq(method), { isOriginAllowed: ALLOWED })).toBe(
        'missing-header',
      );
      expect(
        csrfRejection(
          mkReq(method, {
            [CSRF_HEADER]: '1',
            origin: 'https://app.oneproject.org',
          }),
          { isOriginAllowed: ALLOWED },
        ),
      ).toBeNull();
    }
  });
});
