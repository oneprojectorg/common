import { describe, expect, it } from 'vitest';

import { ASSETS_BUCKET } from '../../utils/storage';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
} from './constants';

describe('EXPORTS_BUCKET', () => {
  it('is a private bucket of its own, not the public assets bucket', () => {
    expect(EXPORTS_BUCKET).toBe('exports');
    expect(EXPORTS_BUCKET).not.toBe(ASSETS_BUCKET);
  });
});

describe('export TTLs', () => {
  it('expires the signed URL strictly before the cached record', () => {
    expect(EXPORT_URL_TTL_SECONDS).toBeLessThan(EXPORT_CACHE_TTL_SECONDS);
  });
});
