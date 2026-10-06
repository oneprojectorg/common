import { getUser } from '@/utils/getUser';
import {
  buildOnboardingRedirect,
  shouldRedirectToOnboarding,
} from '@/utils/onboarding';
import { assertWalledGardenAccess } from '@/utils/walledGarden';
import { isUserEmailPlatformAdmin } from '@op/common';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { notFound, redirect } from '@/lib/navigation';

/** Where the visitor was headed, as the browser shows it (vanity URL included). */
const destinationSchema = z.object({
  pathname: z.string(),
  search: z.string(),
});

/**
 * The (main) group is the front door for the walled garden: closed-network
 * only. Onboarding is asked first, because /start admits a non-member and this
 * gate does not. Gating first met a not-yet-onboarded account with a 403 it
 * could never clear — the flow built for that account was on the other side of
 * the wall.
 */
export const getMainLayoutUser = createServerFn({ method: 'GET' })
  .validator(destinationSchema)
  .handler(async ({ data }) => {
    const user = await getUser();

    if (shouldRedirectToOnboarding(user)) {
      redirect(buildOnboardingRedirect(data.pathname, data.search));
    }

    assertWalledGardenAccess(user, { pathname: data.pathname });

    return user;
  });

/** The (no-header) group is public, but a half-signed-up account onboards first. */
export const getNoHeaderLayoutUser = createServerFn({ method: 'GET' })
  .validator(destinationSchema)
  .handler(async ({ data }) => {
    const user = await getUser();

    if (shouldRedirectToOnboarding(user)) {
      redirect(buildOnboardingRedirect(data.pathname, data.search));
    }

    return user;
  });

/**
 * Onboarding admits any real account: non-members belong in onboarding, and
 * gating them out only deadlocks returning users. Real protection is in the
 * service layer.
 */
export const getStartLayoutUser = createServerFn({ method: 'GET' })
  .validator(destinationSchema.pick({ pathname: true }))
  .handler(async ({ data }) => {
    const user = await getUser();

    assertWalledGardenAccess(user, {
      pathname: data.pathname,
      allowNonMembers: true,
    });

    return user;
  });

/** The admin area doesn't exist for anyone but a platform admin. */
export const assertPlatformAdmin = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getUser();

    if (!user?.email || !isUserEmailPlatformAdmin(user.email)) {
      notFound();
    }
  },
);
