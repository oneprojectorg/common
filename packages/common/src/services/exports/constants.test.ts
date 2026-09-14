import { describe, expect, it } from 'vitest';

import { ASSETS_BUCKET } from '../../utils/storage';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportDownloadOptions,
} from './constants';

// Regression: each call site once held its own copy of these, and they drifted
// into the dead-download-link bug.

describe('EXPORTS_BUCKET', () => {
  // Supabase serves `assets` publicly, so an alias back to it would undo the fix
  // without any other test failing.
  it('is a private bucket of its own, not the public assets bucket', () => {
    expect(EXPORTS_BUCKET).toBe('exports');
    expect(EXPORTS_BUCKET).not.toBe(ASSETS_BUCKET);
  });
});

describe('export TTLs', () => {
  // Invert this and the record dies first, making the re-sign path unreachable.
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
  // Supabase serves a signed URL inline unless asked otherwise, and an anchor's
  // `download` attribute is inert cross-origin.
  it('asks Supabase to serve the object as an attachment, by name', () => {
    expect(exportDownloadOptions('proposals_export_123.csv')).toEqual({
      download: 'proposals_export_123.csv',
    });
  });
});
