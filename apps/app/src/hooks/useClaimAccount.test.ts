import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '../lib/i18n/dictionaries/en.json';
import {
  getClaimEmailErrorMessage,
  getClaimPhoneErrorMessage,
} from './useClaimAccount';

const t = createTranslator({ locale: 'en', messages: en });

describe('getClaimPhoneErrorMessage', () => {
  it('given the number already has an account, then the message is the one every other failed request gets', () => {
    const taken = getClaimPhoneErrorMessage(
      { ok: false, code: 'phone_exists' },
      t,
    );
    const other = getClaimPhoneErrorMessage(
      { ok: false, code: 'sms_send_failed' },
      t,
    );

    expect(taken).toBe(other);
    expect(taken).not.toMatch(/already|exists|log in/i);
  });

  it('given the session already belongs to a full account, then the message says to reload', () => {
    expect(
      getClaimPhoneErrorMessage({ ok: false, alreadySignedIn: true }, t),
    ).toBe(t('onboarding.alreadySignedInError'));
  });
});

describe('getClaimEmailErrorMessage', () => {
  it('given the address already has an account, then the message is the one every other failed request gets', () => {
    const taken = getClaimEmailErrorMessage(
      { ok: false, code: 'email_exists' },
      t,
    );
    const other = getClaimEmailErrorMessage(
      { ok: false, code: 'over_email_send_rate_limit' },
      t,
    );

    expect(taken).toBe(other);
    expect(taken).not.toMatch(/already|exists|log in/i);
  });
});
