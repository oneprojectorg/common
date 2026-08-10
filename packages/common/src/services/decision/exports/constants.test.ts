import { describe, expect, it } from 'vitest';

import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportFilePath,
  exportStatusCacheKey,
} from './constants';

// Regression: these constants are read by three independent call sites — the
// `exportProposals` service that seeds the status record, the Inngest workflow
// that writes the file and completes the record, and `getExportStatus` that
// reads it back. They were previously hardcoded at each site and drifted, which
// is what produced the dead-download-link bug these tests pin down.

describe('EXPORTS_BUCKET', () => {
  // Exports carry submitter names and email addresses. The `assets` bucket is
  // public by necessity (next.config.mjs rewrites /assets/* to its public
  // object root so avatars resolve), so anything written there is readable by
  // path with no signature. Moving exports back into `assets` would silently
  // un-protect every export while the signed-URL code kept appearing to work.
  it('is not the public `assets` bucket', () => {
    expect(EXPORTS_BUCKET).not.toBe('assets');
  });

  it('is the dedicated exports bucket', () => {
    expect(EXPORTS_BUCKET).toBe('exports');
  });
});

describe('export TTLs', () => {
  // THE invariant. The signed URL must expire before the record that holds it,
  // so that a lapsed URL is still attached to a live record and can be
  // re-signed on read. Invert this and the record dies first: `getExportStatus`
  // returns `not_found` and the refresh branch becomes unreachable code.
  it('expires the signed URL strictly before the cached record', () => {
    expect(EXPORT_URL_TTL_SECONDS).toBeLessThan(EXPORT_CACHE_TTL_SECONDS);
  });

  it('keeps a completed export downloadable for a full day', () => {
    expect(EXPORT_CACHE_TTL_SECONDS).toBe(24 * 60 * 60);
  });

  it('mints short-lived signed URLs', () => {
    expect(EXPORT_URL_TTL_SECONDS).toBe(2 * 60 * 60);
  });
});

describe('exportStatusCacheKey', () => {
  it('namespaces the key by export id', () => {
    expect(exportStatusCacheKey('abc-123')).toBe('export:proposal:abc-123');
  });

  it('is stable for the same id across calls', () => {
    expect(exportStatusCacheKey('abc-123')).toBe(
      exportStatusCacheKey('abc-123'),
    );
  });

  it('distinguishes different exports', () => {
    expect(exportStatusCacheKey('abc-123')).not.toBe(
      exportStatusCacheKey('abc-124'),
    );
  });
});

describe('exportFilePath', () => {
  it('scopes the file to its process instance', () => {
    expect(exportFilePath('instance-1', 'proposals_export_123.csv')).toBe(
      'proposals/instance-1/proposals_export_123.csv',
    );
  });

  // The path is relative to EXPORTS_BUCKET. It used to carry an `exports/`
  // prefix because the file lived inside the shared `assets` bucket; keeping
  // that prefix now would nest the object at exports/exports/proposals/... and
  // strand every file written under the old layout.
  it('does not re-prefix the bucket name into the key', () => {
    expect(exportFilePath('instance-1', 'f.csv')).not.toMatch(/^exports\//);
  });
});
