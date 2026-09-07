import { describe, expect, it } from 'vitest';

// Reached directly rather than through the barrel, which pulls in the
// server-only database client.
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

  // A shared prefix would let either status read parse the other pipeline's
  // record against the wrong schema.
  it('does not collide with the proposal export namespace', () => {
    expect(personalDataExportCacheKey('abc-123')).not.toBe(
      exportStatusCacheKey('abc-123'),
    );
  });

  it('distinguishes different exports', () => {
    expect(personalDataExportCacheKey('abc-123')).not.toBe(
      personalDataExportCacheKey('abc-124'),
    );
  });
});

describe('personalDataExportFilePath', () => {
  it('scopes the file to its data subject', () => {
    expect(
      personalDataExportFilePath('user-1', 'personal_data_export_123.json'),
    ).toBe('user/user-1/personal-data/personal_data_export_123.json');
  });

  it('leads with the owning entity, not the sub-resource', () => {
    expect(personalDataExportFilePath('user-1', 'f.json')).toMatch(
      /^user\/user-1\/personal-data\//,
    );
  });

  // The path is relative to the bucket; prefixing it would nest the object at
  // exports/exports/...
  it('does not re-prefix the bucket name into the key', () => {
    expect(personalDataExportFilePath('user-1', 'f.json')).not.toMatch(
      new RegExp(`^${EXPORTS_BUCKET}/`),
    );
  });

  it('keeps two subjects in separate prefixes', () => {
    expect(personalDataExportFilePath('user-1', 'f.json')).not.toBe(
      personalDataExportFilePath('user-2', 'f.json'),
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

  // Supabase rejects keys outside this set, and only at upload time.
  it('produces a key Supabase will accept', () => {
    expect(
      personalDataExportFilePath('user-1', personalDataExportFileName()),
    ).toMatch(/^[a-zA-Z0-9!\-_.*'()/]+$/);
  });
});
