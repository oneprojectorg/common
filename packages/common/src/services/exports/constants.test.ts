import { describe, expect, it } from 'vitest';

import { ASSETS_BUCKET } from '../../utils/storage';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportDownloadOptions,
} from './constants';

// Regression. Every export pipeline reads these constants from three kinds of
// call site: the service that seeds the status record, the Inngest workflow that
// writes the file, and the status read that hands the file back.
//
// Each site hardcoded its own copy, and they drifted. That produced the
// dead-download-link bug these tests pin down.

describe('EXPORTS_BUCKET', () => {
  // Exports use a bucket of their own, so a read needs a signature. The second
  // assertion carries the weight. Supabase serves `assets` publicly, so an
  // alias back to it would undo the fix without any test failing.
  //
  // This test pins the name only. `tests/e2e/tests/proposals-export.spec.ts`
  // asserts against a real bucket that the bucket is private.
  it('is a private bucket of its own, not the public assets bucket', () => {
    expect(EXPORTS_BUCKET).toBe('exports');
    expect(EXPORTS_BUCKET).not.toBe(ASSETS_BUCKET);
  });
});

describe('export TTLs', () => {
  // THE invariant. The signed URL must expire before the record that holds it. A
  // lapsed URL then still sits on a live record and can be re-signed on read.
  //
  // Invert it and the record dies first. The status read returns `not_found`
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
