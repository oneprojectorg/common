// @vitest-environment jsdom
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import en from '../../../../lib/i18n/dictionaries/en.json';
import { createValidator, validator } from './BaseUpdateProfileForm';

vi.mock('@op/api/client', () => ({ trpc: {} }));

const t = createTranslator({ locale: 'en', messages: en });

const profile = {
  fullName: 'Ada Lovelace',
  title: '',
  email: 'ada@example.org',
  website: 'https://example.org',
};

describe.concurrent('BaseUpdateProfileForm validator', () => {
  it('accepts a profile edit that removes the headline', () => {
    expect(createValidator(t).safeParse(profile)).toMatchObject({
      success: true,
    });
    expect(validator.safeParse(profile)).toMatchObject({ success: true });
  });

  it('accepts a profile edit whose headline is only spaces', () => {
    const result = createValidator(t).safeParse({ ...profile, title: '   ' });

    expect(result).toMatchObject({ success: true, data: { title: '' } });
  });

  it('accepts a profile edit that carries no headline key at all', () => {
    const { title: _title, ...withoutTitle } = profile;

    expect(validator.safeParse(withoutTitle)).toMatchObject({ success: true });
  });

  it('refuses a profile edit with no name', () => {
    const result = createValidator(t).safeParse({ ...profile, fullName: '' });

    expect(result).toMatchObject({
      success: false,
      error: { issues: [{ path: ['fullName'] }] },
    });
  });
});
