import { AccessTierError } from '@op/common';
import { createSBServiceClient } from '@op/supabase/server';
import { afterEach, describe, expect, it } from 'vitest';

import { verifyAuthentication } from './verifyAuthentication';

/**
 * The confirmed-user gate, against accounts a real GoTrue produced.
 *
 * Fixtures come from `admin.getUserById`, not from `admin.createUser`. The
 * create response is the model GoTrue just built rather than a re-read of the
 * row, and it omits `confirmed_at` even for an account that is confirmed —
 * building on it would assert against a shape no request ever sees.
 *
 * A hand-written object would be worse still. The defect these tests pin was a
 * shape mismatch, so a fixture carrying the author's assumption about the shape
 * proves nothing.
 */
describe('verifyAuthentication', () => {
  const created: string[] = [];

  afterEach(async () => {
    const supabase = createSBServiceClient();
    for (const id of created.splice(0)) {
      await supabase.auth.admin.deleteUser(id);
    }
  });

  /** Creates an account and reads it back the way a request would see it. */
  const createAndRead = async (input: {
    email?: string;
    password?: string;
    email_confirm?: boolean;
    phone?: string;
    phone_confirm?: boolean;
  }) => {
    const supabase = createSBServiceClient();
    const { data, error } = await supabase.auth.admin.createUser(input);
    if (error || !data.user) {
      throw new Error(`Could not create the account: ${error?.message}`);
    }
    created.push(data.user.id);

    const { data: read } = await supabase.auth.admin.getUserById(data.user.id);
    if (!read.user) {
      throw new Error('Could not read the account back');
    }
    return read.user;
  };

  it('omits confirmed_at entirely when nothing is confirmed', async () => {
    const user = await createAndRead({
      email: `unconfirmed-${Date.now()}@example.com`,
      password: 'verify-authentication-probe-123',
      email_confirm: false,
    });

    // The premise of the gate. `confirmed_at` is absent rather than null, so a
    // `=== null` comparison never matches it — which is what this fix
    // corrected. If GoTrue ever sends an explicit null, the falsy check still
    // holds and this line records which shape it was written against.
    expect(user.confirmed_at).toBeUndefined();
  });

  it('refuses an account that has confirmed nothing', async () => {
    const user = await createAndRead({
      email: `unconfirmed-gate-${Date.now()}@example.com`,
      password: 'verify-authentication-probe-123',
      email_confirm: false,
    });

    expect(() => verifyAuthentication({ data: { user }, error: null })).toThrow(
      AccessTierError,
    );
  });

  it('admits an account confirmed by email', async () => {
    const user = await createAndRead({
      email: `confirmed-email-${Date.now()}@example.com`,
      email_confirm: true,
    });

    expect(verifyAuthentication({ data: { user }, error: null })).toBe(user);
  });

  it('admits an account confirmed by phone alone', async () => {
    // `confirmed_at` is generated as LEAST(email_confirmed_at,
    // phone_confirmed_at), so a phone-only account is confirmed and the gate
    // must not read the email column. Twilio reserves 500 555 for testing.
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const user = await createAndRead({
      phone: `+1500555${suffix}`,
      phone_confirm: true,
    });

    expect(user.email).toBeFalsy();
    expect(verifyAuthentication({ data: { user }, error: null })).toBe(user);
  });
});
