import { describe, expect, it } from 'vitest';

import { EXPORTS_BUCKET } from '../../exports';
import {
  exportFileName,
  exportFilePath,
  exportStatusCacheKey,
} from './constants';

// Regression. Three independent call sites read these constants. The
// `exportProposals` service seeds the status record. The Inngest workflow writes
// the file. `getExportStatus` reads it back.
//
// Each site hardcoded its own copy, and they drifted. That produced the
// dead-download-link bug these tests pin down. The bucket and the two TTLs moved
// to `services/exports`, where every export pipeline shares them;
// `exports/constants.test.ts` pins those.

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

  // This keeps the `<entity>/<id>/<sub-resource>/` shape the other storage
  // writers use. The bucket's top level then gains no prefix per feature.
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
