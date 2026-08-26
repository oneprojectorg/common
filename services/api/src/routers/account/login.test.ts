import { db } from '@op/db/client';
import { logger } from '@op/logging';
import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
} from '../../test/helpers/gating';
import {
  inviteEmail,
  signUpAllowlistedUser,
  signUpConfirmedUser,
  signUpNonAllowlistedUser,
} from '../../test/helpers/loginTestUtils';
import { createTestContextWithSession } from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

// account.login is a PUBLIC `commonProcedure` — it has no authentication
// middleware and ignores the caller's JWT entirely (it gates on the *input*
// email against the invite allow-list, not on the session). This matrix
// documents that all three caller kinds reach the handler identically.
//
// `usingOAuth: true` skips the OTP send side-effect, and an `@oneproject.org`
// email clears the allow-list via `allowedEmailDomains`, so the handler admits
// the caller regardless of who is calling.
const input = { email: 'gate@oneproject.org', usingOAuth: true };

describeAccessTierGating('account.login', {
  noJwt: accessTierGatingCell('admits no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.account.login(input)).resolves.toEqual({ ok: true });
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expect(caller.account.login(input)).resolves.toEqual({ ok: true });
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expect(caller.account.login(input)).resolves.toEqual({ ok: true });
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expect(caller.account.login(input)).resolves.toEqual({ ok: true });
    },
  ),
});

// The invite gate decides admission along two independent axes: whether the
// email already owns an account (`auth.users`) and whether it is invited (an
// allow-list entry, or a network email domain — `adminEmails` is not a third
// axis, its only entry is on a network domain already). Only the no-account +
// not-invited cell is waitlisted: an existing account may always log back in,
// and an invited newcomer may sign up.
//
//                     | allow-listed | network domain | not invited |
//   no account        |    admit     |     admit      |  waitlist   |
//   existing account  |    admit     |     admit      |    admit    |
//
// Every cell calls with `usingOAuth: true` and no session, so it asserts the
// gate decision alone — no OTP send or account-creation side effects, and the
// created-by-this-sign-in OAuth caveat (exercised in loginOAuthCleanup.test.ts)
// stays out of play.
describe.concurrent('account.login: allow-list × account-existence matrix', () => {
  const createAnonymousCaller = async () =>
    createCaller(await createTestContextWithSession(null));

  it('admits an allow-listed email with no account (first-time signup)', async ({
    onTestFinished,
  }) => {
    const email = `invited-new-${randomUUID()}@example.com`;
    await inviteEmail(email, onTestFinished);

    const caller = await createAnonymousCaller();
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).resolves.toEqual({ ok: true });
  });

  it('admits a network-domain email with no account (first-time signup)', async () => {
    const email = `member-new-${randomUUID()}@oneproject.org`;

    const caller = await createAnonymousCaller();
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).resolves.toEqual({ ok: true });
  });

  // Resolving rather than throwing is the point: `withLogger` logs a failed
  // result at `error` severity, so throwing here put every waitlisted signup —
  // an expected outcome — in the same stream as real 500s. Resolving routes it
  // through the `result.ok` branch instead, and the decision is recorded at
  // `info`.
  it('waitlists an uninvited email with no account without throwing', async () => {
    const email = `stranger-${randomUUID()}@example.com`;

    const caller = await createAnonymousCaller();
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).resolves.toEqual({
      ok: false,
      reason: 'waitlisted',
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Login waitlisted - not invited',
      expect.objectContaining({ path: 'account.login' }),
    );

    // The headline invariant: this outcome must stay out of the `error` stream.
    // Scoped to this path rather than a bare `not.toHaveBeenCalled()` so it
    // holds under `describe.concurrent` — every other `account.login` call in
    // this file is an admit, which never logs at `error`.
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ path: 'account.login' }),
    );
  });

  // The gate used to `throw`, which made the OTP block below it unreachable for
  // an uninvited email by construction. It is now an early `return`, so only
  // control flow stops the request from reaching `signInWithOtp`. That call runs
  // with `shouldCreateUser: true`, so a regression would both mail a login code
  // to an uninvited address and mint its `auth.users` row — an invite-gate
  // bypass. The absence of that row is the DB-observable proof it never ran.
  it('waitlists an uninvited email on the OTP path without sending a code', async () => {
    const email = `stranger-otp-${randomUUID()}@example.com`;

    const caller = await createAnonymousCaller();
    await expect(
      caller.account.login({ email, usingOAuth: false }),
    ).resolves.toEqual({
      ok: false,
      reason: 'waitlisted',
    });

    await expect(
      db.query.authUsers.findFirst({ columns: { id: true }, where: { email } }),
    ).resolves.toBeUndefined();
  });

  it('admits an allow-listed email with an existing account', async ({
    onTestFinished,
  }) => {
    const { email } = await signUpAllowlistedUser(onTestFinished);

    const caller = await createAnonymousCaller();
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).resolves.toEqual({ ok: true });
  });

  it('admits a network-domain email with an existing account', async ({
    onTestFinished,
  }) => {
    const { email } = await signUpConfirmedUser(
      `member-${randomUUID()}@oneproject.org`,
      onTestFinished,
    );

    const caller = await createAnonymousCaller();
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).resolves.toEqual({ ok: true });
  });

  it('admits an uninvited email with an existing account (claim-flow accounts)', async ({
    onTestFinished,
  }) => {
    const { email } = await signUpNonAllowlistedUser(onTestFinished);

    const caller = await createAnonymousCaller();
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).resolves.toEqual({ ok: true });
  });
});
