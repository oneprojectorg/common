// @vitest-environment jsdom
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import en from '../../lib/i18n/dictionaries/en.json';
import { createValidator, validator } from './PersonalDetailsForm';

vi.mock('@op/api/client', () => ({ trpc: {} }));

const t = createTranslator({ locale: 'en', messages: en });

const details = {
  fullName: 'Ada Lovelace',
  title: '',
  email: 'ada@example.org',
  website: 'https://example.org',
};

describe.concurrent('PersonalDetailsForm validator', () => {
  it('accepts personal details with no headline', () => {
    expect(createValidator(t).safeParse(details)).toMatchObject({
      success: true,
    });
    expect(validator.safeParse(details)).toMatchObject({ success: true });
  });

  it('accepts personal details whose headline is only spaces', () => {
    const result = createValidator(t).safeParse({ ...details, title: '   ' });

    expect(result).toMatchObject({ success: true, data: { title: '' } });
  });

  it('refuses personal details with no name', () => {
    const result = createValidator(t).safeParse({ ...details, fullName: '' });

    expect(result).toMatchObject({
      success: false,
      error: { issues: [{ path: ['fullName'] }] },
    });
  });
});
