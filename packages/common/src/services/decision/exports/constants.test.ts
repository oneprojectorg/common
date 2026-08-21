import { describe, expect, it } from 'vitest';

import {
  EXPORTS_BUCKET,
  EXPORT_URL_TTL_SECONDS,
  exportFileName,
  exportFilePath,
  nextUrlExpiresAt,
} from './constants';

// Regression: these constants are read by three independent call sites — the
// `exportProposals` service that seeds the status record, the Inngest workflow
// that writes the file and completes the record, and `getExportStatus` that
// reads it back. They were previously hardcoded at each site and drifted, which
// is what produced the dead-download-link bug these tests pin down.

describe('EXPORTS_BUCKET', () => {
  // Exports share the public `assets` bucket by deliberate choice: no separate
  // bucket has to be provisioned per environment. The trade is that an export
  // object is readable by anyone holding its path — next.config.mjs rewrites
  // /assets/* to the bucket's public object root — so the unguessable file name
  // is the access control, and the signed URLs are only link expiry.
  it('is the shared `assets` bucket', () => {
    expect(EXPORTS_BUCKET).toBe('assets');
  });
});

describe('EXPORT_URL_TTL_SECONDS', () => {
  it('mints short-lived signed URLs', () => {
    expect(EXPORT_URL_TTL_SECONDS).toBe(6 * 60 * 60);
  });
});

describe('nextUrlExpiresAt', () => {
  // Shared by the workflow's first mint and getExportStatus's re-sign so the
  // two can't drift the way the bucket/TTL constants once did.
  it('is EXPORT_URL_TTL_SECONDS in the future', () => {
    const before = Date.now();
    const expiresAt = nextUrlExpiresAt();
    const after = Date.now();

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + EXPORT_URL_TTL_SECONDS * 1000,
    );
    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      after + EXPORT_URL_TTL_SECONDS * 1000,
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
