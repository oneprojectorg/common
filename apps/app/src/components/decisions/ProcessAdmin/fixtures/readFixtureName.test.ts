import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFixtureName } from './readFixtureName';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('readFixtureName', () => {
  it('returns a known name outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(readFixtureName('live')).toBe('live');
    expect(readFixtureName('draft')).toBe('draft');
  });

  it('ignores unknown, repeated and missing values', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(readFixtureName('archived')).toBeNull();
    expect(readFixtureName(['live', 'draft'])).toBeNull();
    expect(readFixtureName(undefined)).toBeNull();
  });

  it('never resolves a fixture in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(readFixtureName('live')).toBeNull();
  });
});
