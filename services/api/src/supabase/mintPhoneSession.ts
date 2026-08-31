import { type PhoneNumber, CommonError } from '@op/common';
import { db, eq } from '@op/db/client';
import { authUsers } from '@op/db/schema';
import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';
import { randomBytes } from 'node:crypto';

/** The session fields a client needs to adopt the session. */
export interface MintedSession {
  accessToken: string;
  refreshToken: string;
  /** The account the session belongs to, for the caller to record against. */
  authUserId: string;
}

/** What the grant itself yields, before the account id is attached. */
type GrantTokens = Omit<MintedSession, 'authUserId'>;

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
 * person ever receives one. It overwrites any password the account already
 * held, which no production flow sets — the app signs in by OTP and OAuth.
 *
 * The signup trigger creates the `public.users` row and the individual profile
 * from the `auth.users` insert. It prefers `display_name` in the user metadata,
 * and falls back to the literal `User` without it.
 *
 * @param input.phone - A number a provider already approved. The brand carries
 *   the E.164 and CR/LF guarantees `parsePhoneNumber` establishes.
 * @param input.displayName - The name for a new account. Ignored for one that
 *   already exists, whose name a person may since have edited.
 * @returns The tokens for the client to adopt, and the account they belong to.
 * @throws {CommonError} When Supabase rejects the user write or the grant.
 */
export const mintPhoneSession = async ({
  phone,
  displayName,
}: {
  phone: PhoneNumber;
  displayName?: string;
}): Promise<MintedSession> => {
  const supabase = createSBServiceClient();
  const password = randomBytes(32).toString('base64url');

  const existingId = await findAuthUserIdByPhone(phone);

  if (existingId) {
    // Rotating on every sign-in keeps the password from becoming a second,
    // weaker credential for the account.
    const { error } = await supabase.auth.admin.updateUserById(existingId, {
      password,
    });
    if (error) {
      logger.error('Could not rotate the phone account password', {
        authUserId: existingId,
        error,
      });
      throw new CommonError(`Could not prepare the session: ${error.message}`);
    }

    return {
      ...(await requestPasswordGrant({ phone, password })),
      authUserId: existingId,
    };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    // E.164 on the way in; GoTrue strips the `+` when it stores the row, which
    // is why the lookup above compares against `toGoTruePhone`.
    phone,
    password,
    // Twilio already proved the person holds this number. Without this the
    // account would carry an unconfirmed phone and no session.
    phone_confirm: true,
    ...(displayName ? { user_metadata: { display_name: displayName } } : {}),
  });
  if (error) {
    logger.error('Could not create the phone account', { error });
    throw new CommonError(`Could not create the account: ${error.message}`);
  }
  if (!data.user) {
    logger.error('Supabase created no account and reported no error');
    throw new CommonError('Could not create the account.');
  }

  return {
    ...(await requestPasswordGrant({ phone, password })),
    authUserId: data.user.id,
  };
};

/**
 * GoTrue stores a phone number without the leading `+`.
 *
 * Every comparison and write has to agree on this. A mismatch does not fail
 * loudly: the lookup finds nothing, the create branch runs, and one person
 * accumulates an account per sign-in.
 */
const toGoTruePhone = (phone: PhoneNumber): string => phone.replace('+', '');

/**
 * Finds an auth user by phone number.
 *
 * Queries `auth.users` directly. The admin API offers no lookup by phone, and
 * paging its list would break at the page size: an account past the first page
 * reads as absent, the caller creates a duplicate, GoTrue rejects the number,
 * and that person can never sign in again. `auth.users.phone` is unique and
 * indexed, so this is also one row rather than a thousand.
 *
 * @returns The user id, or `undefined` when no account holds the number.
 */
const findAuthUserIdByPhone = async (
  phone: PhoneNumber,
): Promise<string | undefined> => {
  const [found] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.phone, toGoTruePhone(phone)))
    .limit(1);

  return found?.id;
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
}): Promise<GrantTokens> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    logger.error('Supabase URL or anon key is missing');
    throw new CommonError('Supabase is not configured.');
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ phone, password }),
  });

  if (!response.ok) {
    // GoTrue names the cause in the body, and the reason is usually a
    // configuration fault an operator must read — `phone_provider_disabled` is
    // the one this flow hits first. It goes to the log rather than into the
    // error, because the error reaches the person signing in.
    logger.error('The password grant failed', {
      status: response.status,
      body: await response.text(),
    });
    throw new CommonError('Could not issue the session.');
  }

  const body: unknown = await response.json();
  const tokens = readTokens(body);
  if (!tokens) {
    logger.error('The password grant returned no usable tokens');
    throw new CommonError('The grant returned no session.');
  }
  return tokens;
};

/** Reads the two tokens off the grant response without asserting its shape. */
const readTokens = (body: unknown): GrantTokens | null => {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const accessToken = Reflect.get(body, 'access_token');
  const refreshToken = Reflect.get(body, 'refresh_token');
  return typeof accessToken === 'string' && typeof refreshToken === 'string'
    ? { accessToken, refreshToken }
    : null;
};
