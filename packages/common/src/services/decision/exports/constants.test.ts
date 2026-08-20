import { describe, expect, it } from 'vitest';

import { ASSETS_BUCKET } from '../../../utils/storage';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportDownloadOptions,
  exportFileName,
  exportFilePath,
  exportStatusCacheKey,
} from './constants';

// Regression. Three independent call sites read these constants. The
// `exportProposals` service seeds the status record. The Inngest workflow writes
// the file. `getExportStatus` reads it back.
//
// Each site hardcoded its own copy, and they drifted. That produced the
// dead-download-link bug these tests pin down.

describe('EXPORTS_BUCKET', () => {
  // Exports get a bucket of their own so that reads need a signature. The
  // second assertion is the one that matters: `assets` is served publicly, so
  // re-aliasing this back to it would silently un-fix that. Note this only pins
  // the *name* — that the bucket is actually private is asserted end-to-end in
  // tests/e2e/tests/proposals-export.spec.ts, against a real one.
  it('is a private bucket of its own, not the public assets bucket', () => {
    expect(EXPORTS_BUCKET).toBe('exports');
    expect(EXPORTS_BUCKET).not.toBe(ASSETS_BUCKET);
  });
});

describe('export TTLs', () => {
  // THE invariant. The signed URL must expire before the record that holds it. A
  // lapsed URL then still sits on a live record and can be re-signed on read.
  //
  // Invert it and the record dies first. `getExportStatus` returns `not_found`
  // and the refresh branch becomes unreachable code.
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

  // Keeps the `<entity>/<id>/<sub-resource>/` shape the other storage writers
  // use, so the bucket's top level does not accumulate a prefix per feature.
  it('leads with the owning entity, not the sub-resource', () => {
    expect(exportFilePath('instance-1', 'f.csv')).toMatch(
      /^process\/instance-1\/proposals\//,
    );
  });

  // The path is relative to the bucket. Prefixing the bucket name would nest
  // the object at exports/exports/... once Supabase resolves it.
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

describe('exportDownloadOptions', () => {
  // The reported bug. Supabase serves a signed URL inline unless it is asked
  // otherwise. The anchor's `download` attribute is inert cross-origin, so
  // Safari rendered the CSV as text.
  //
  // `download: true` is equivalent today, because the storage key's last segment
  // is already `fileName`. Passing the name decouples the two, so the saved name
  // can change without moving the object.
  it('asks Supabase to serve the object as an attachment, by name', () => {
    expect(exportDownloadOptions('proposals_export_123.csv')).toEqual({
      download: 'proposals_export_123.csv',
    });
  });
});
