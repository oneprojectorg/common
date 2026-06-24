import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from './locales';
import { SUPPORTED_LOCALES as MJS_LOCALES } from './locales.mjs';

describe('SUPPORTED_LOCALES', () => {
  // Catches drift between the TS source and the `.mjs` build-time mirror that
  // `next.config.mjs` consumes for the vanity-URL rewrite regex. Update both
  // files together when adding or removing a locale.
  it('matches the build-time `.mjs` mirror', () => {
    expect([...MJS_LOCALES]).toEqual([...SUPPORTED_LOCALES]);
  });
});
