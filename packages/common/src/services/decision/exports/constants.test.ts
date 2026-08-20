import { describe, expect, it } from 'vitest';

import { ASSETS_BUCKET } from '../../../utils/storage';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportFileName,
  exportFilePath,
  exportStatusCacheKey,
} from './constants';

// Regression: these constants are read by three independent call sites — the
// `exportProposals` service that seeds the status record, the Inngest workflow
// that writes the file and completes the record, and `getExportStatus` that
// reads it back. They were previously hardcoded at each site and drifted, which
// is what produced the dead-download-link bug these tests pin down.

describe('EXPORTS_BUCKET', () => {
  // An export CSV carries proposal submitter names, so it gets its own private
  // bucket. It used to share `assets`, which is public — next.config.mjs
  // rewrites /assets/* to that bucket's public object root — so an export was
  // readable by any anonymous caller holding the path and the signed URLs
  // downstream gated nothing. Keeping these two assertions separate is
  // deliberate: the second is the security property, and it must keep failing
  // if someone re-aliases this back to the shared bucket.
  it('is the private `exports` bucket', () => {
    expect(EXPORTS_BUCKET).toBe('exports');
  });

  it('is not the public assets bucket', () => {
    expect(EXPORTS_BUCKET).not.toBe(ASSETS_BUCKET);
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
    expect(EXPORT_URL_TTL_SECONDS).toBe(6 * 60 * 60);
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
      'process/instance-1/proposals/proposals_export_123.csv',
    );
  });

  // Exports share `assets` with profile images and resources, so the key has to
  // follow the same `<entity>/<id>/<sub-resource>/` shape those writers use or
  // the bucket's top level accumulates a prefix per feature.
  it('leads with the owning entity, not the sub-resource', () => {
    expect(exportFilePath('instance-1', 'f.csv')).toMatch(
      /^process\/instance-1\/proposals\//,
    );
  });

  // The path is relative to the bucket. Prefixing the bucket name would nest
  // the object at assets/assets/... once Supabase resolves it.
  it('does not re-prefix the bucket name into the key', () => {
    expect(exportFilePath('instance-1', 'f.csv')).not.toMatch(
      new RegExp(`^${EXPORTS_BUCKET}/`),
    );
  });
});

describe('exportFileName', () => {
  // Regression: this was built from zod's `uuidv4` — a schema factory, not a
  // generator — so `.toString().substring(0, 5)` yielded the literal `[obje`
  // for every export. Supabase rejected the `[` as an invalid key, and had it
  // not, every file would have shared one guessable name.
  it('carries a full random uuid', () => {
    expect(exportFileName('csv')).toMatch(
      /^proposals_export_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_\d+\.csv$/,
    );
  });

  it('is unique across calls', () => {
    const names = new Set(
      Array.from({ length: 100 }, () => exportFileName('csv')),
    );
    expect(names.size).toBe(100);
  });

  // Supabase storage rejects keys containing characters outside this set, and
  // the failure surfaces only at upload time, deep inside the workflow.
  it('produces a key Supabase will accept', () => {
    expect(exportFilePath('instance-1', exportFileName('csv'))).toMatch(
      /^[a-zA-Z0-9!\-_.*'()/]+$/,
    );
  });
});
