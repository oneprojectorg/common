import type { CommonUser } from '@op/api/encoders';

/**
 * Whether a viewer must re-accept the updated policies before continuing.
 *
 * Gated on the acceptance-date columns: a user who has not accepted the current
 * Terms of Use / Privacy Policy has a null `tosAcceptedOn` / `privacyAcceptedOn`
 * and must re-accept. Accepting stamps both dates (see `completeOnboarding`),
 * which closes the gate.
 *
 * Only genuine accounts qualify. Public (no-session) visitors have no account
 * and anonymous sign-ins never accept policies — neither should see the gate.
 * Mid-onboarding users (no `onboardedAt`) are redirected to `/start` by the
 * layout before this modal mounts.
 */
export const shouldReacceptPolicies = (
  user: CommonUser | null | undefined,
): boolean =>
  Boolean(
    user &&
    !user.isAnonymous &&
    (!user.tosAcceptedOn || !user.privacyAcceptedOn),
  );
