import { CommonError } from '@op/common';
import { createSBServiceClient } from '@op/supabase/server';
import { randomBytes } from 'node:crypto';

/** The session fields a client needs to adopt the session. */
export interface MintedSession {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues a Supabase session for a phone number we already confirmed.
 *
 * Call this only after a verification provider approved the number. This
 * function performs no verification of its own, and a caller that skips that
 * step hands out a session to anyone who names a phone number.
 *
 * Twilio confirms the number, but the application reads a GoTrue session, so
 * GoTrue must still issue one. `admin.generateLink` cannot help: its types are
 * all email types, and no phone equivalent exists. The password grant is the
 * remaining route, and `tests/e2e/fixtures/auth.ts` already uses it to build a
 * real session outside the normal flow.
 *
 * The password is an internal artifact. This function writes a fresh random one
 * on every call and never stores it, so no long-lived password exists and no
 * person ever receives one.
 *
 * The signup trigger creates the `public.users` row and the individual profile
 * from the `auth.users` insert. It prefers `display_name` in the user metadata,
 * and falls back to the literal `User` without it.
 *
 * @param input.phone - An E.164 number a provider already approved.
 * @param input.displayName - The name for a new account. Ignored for one that
 *   already exists, whose name a person may since have edited.
 * @returns The tokens for the client to adopt.
 * @throws {CommonError} When Supabase rejects the user write or the grant.
 */
export const mintPhoneSession = async ({
  phone,
  displayName,
}: {
  phone: string;
  displayName?: string;
}): Promise<MintedSession> => {
  const supabase = createSBServiceClient();
  const password = randomBytes(32).toString('base64url');

  const authUserId = await findAuthUserIdByPhone({ supabase, phone });

  if (authUserId) {
    // Rotating on every sign-in keeps the password from becoming a second,
    // weaker credential for the account.
    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      password,
    });
    if (error) {
      throw new CommonError(`Could not prepare the session: ${error.message}`);
    }
  } else {
    const { error } = await supabase.auth.admin.createUser({
      phone,
      password,
      // Twilio already proved the person holds this number. Without this the
      // account would carry an unconfirmed phone and no session.
      phone_confirm: true,
      ...(displayName ? { user_metadata: { display_name: displayName } } : {}),
    });
    if (error) {
      throw new CommonError(`Could not create the account: ${error.message}`);
    }
  }

  return requestPasswordGrant({ phone, password });
};

/**
 * Finds an auth user by phone number.
 *
 * The admin API offers no lookup by phone, so this pages the user list. The
 * cost is acceptable at our size and is the reason to revisit this first if
 * sign-in slows down.
 *
 * @returns The user id, or `undefined` when no account holds the number.
 */
const findAuthUserIdByPhone = async ({
  supabase,
  phone,
}: {
  supabase: ReturnType<typeof createSBServiceClient>;
  phone: string;
}): Promise<string | undefined> => {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    throw new CommonError(`Could not read the account: ${error.message}`);
  }
  return data.users.find((user) => user.phone === phone.replace('+', ''))?.id;
};

/**
 * Exchanges the phone number and password for a session.
 *
 * Uses the REST endpoint rather than the client, because the admin client holds
 * the service role and signing in through it would replace that identity.
 *
 * @throws {CommonError} When the grant fails. The message carries no password.
 */
const requestPasswordGrant = async ({
  phone,
  password,
}: {
  phone: string;
  password: string;
}): Promise<MintedSession> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new CommonError('Supabase is not configured.');
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ phone, password }),
  });

  if (!response.ok) {
    // GoTrue names the cause in the body, and the reason is a configuration
    // fault an operator must read. `phone_provider_disabled` is the one this
    // flow hits first, and a bare status code sends the reader hunting.
    throw new CommonError(
      `Could not issue the session: the grant returned ${response.status}. ${await response.text()}`,
    );
  }

  const body: unknown = await response.json();
  const tokens = readTokens(body);
  if (!tokens) {
    throw new CommonError('The grant returned no session.');
  }
  return tokens;
};

/** Reads the two tokens off the grant response without asserting its shape. */
const readTokens = (body: unknown): MintedSession | null => {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const accessToken = Reflect.get(body, 'access_token');
  const refreshToken = Reflect.get(body, 'refresh_token');
  return typeof accessToken === 'string' && typeof refreshToken === 'string'
    ? { accessToken, refreshToken }
    : null;
};
