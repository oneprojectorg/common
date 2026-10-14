import { describe, expect, it } from 'vitest';

// Not via the barrel, which pulls in the database client.
import { exportStatusCacheKey } from '../decision/exports/constants';
import { EXPORTS_BUCKET } from '../exports';
import {
  personalDataExportCacheKey,
  personalDataExportFileName,
  personalDataExportFilePath,
} from './constants';

describe('personalDataExportCacheKey', () => {
  it('namespaces the key by export id', () => {
    expect(personalDataExportCacheKey('abc-123')).toBe(
      'export:personalData:abc-123',
    );
  });

  it('does not collide with the proposal export namespace', () => {
    expect(personalDataExportCacheKey('abc-123')).not.toBe(
      exportStatusCacheKey('abc-123'),
    );
  });
});

describe('personalDataExportFilePath', () => {
  it('scopes the file to its data subject', () => {
    expect(
      personalDataExportFilePath('user-1', 'personal_data_export_123.json'),
    ).toBe('user/user-1/personal-data/personal_data_export_123.json');
  });

  it('does not re-prefix the bucket name into the key', () => {
    expect(personalDataExportFilePath('user-1', 'f.json')).not.toMatch(
      new RegExp(`^${EXPORTS_BUCKET}/`),
    );
  });
});

describe('personalDataExportFileName', () => {
  it('carries a full random uuid', () => {
    expect(personalDataExportFileName()).toMatch(
      /^personal_data_export_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_\d+\.json$/,
    );
  });

  it('is unique across calls', () => {
    const names = new Set(
      Array.from({ length: 100 }, () => personalDataExportFileName()),
    );
    expect(names.size).toBe(100);
  });

  it('produces a key Supabase will accept', () => {
    expect(
      personalDataExportFilePath('user-1', personalDataExportFileName()),
    ).toMatch(/^[a-zA-Z0-9!\-_.*'()/]+$/);
  });
});
