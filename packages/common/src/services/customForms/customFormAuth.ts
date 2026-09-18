import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { z } from 'zod';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  isUserEmailPlatformAdmin,
} from '../access';

/** Phase list as it sits on `instanceData`; the rest of the blob is irrelevant here. */
const instancePhasesSchema = z
  .object({
    phases: z.array(z.object({ phaseId: z.string() })).optional(),
  })
  .partial();

/**
 * The decision process a form is (or would be) attached to, resolved once by
 * {@link assertCustomFormAdmin} so callers don't re-query it.
 */
export type CustomFormProcessContext = {
  /** The process instance's own profile — `custom_forms.profile_id`. */
  profileId: string;
  /** Phase a form with no `x-phase` applies to; null when the instance has none. */
  initialPhaseId: string | null;
  /** Every phase configured on the instance, in order. */
  phaseIds: string[];
};

/**
 * Gate every custom-form write on the profile that owns the form.
 *
 * Two grants admit a caller, in this order:
 *   1. platform admin (email allow-list) — decided with no lookup at all, so
 *      the broadest grant can never be refused by a failure in the narrower
 *      one's resolution, and
 *   2. admin on the decision process the profile belongs to.
 *
 * Returns the resolved process context: the phase ids a form may bind to and
 * the initial phase legacy (`x-phase`-less) forms resolve to.
 *
 * @throws NotFoundError when the profile is not a decision process's — forms
 *   only hang off decision processes today, so there is nothing to attach to
 *   and nothing a caller could be authorized for.
 * @throws UnauthorizedError when neither grant holds.
 */
export const assertCustomFormAdmin = async ({
  user,
  profileId,
}: {
  user: User;
  profileId: string;
}): Promise<CustomFormProcessContext> => {
  // `profileId` identifies one instance: the column holds the instance's OWN
  // profile, created with it, so no two instances share one. (Same lookup
  // `createCustomFormSubmission` makes to resolve a form's process.)
  const instance = await db.query.processInstances.findFirst({
    where: { profileId },
    columns: { profileId: true, ownerProfileId: true, instanceData: true },
  });

  if (!instance) {
    throw new NotFoundError('Decision process', profileId);
  }

  const isPlatformAdmin = !!user.email && isUserEmailPlatformAdmin(user.email);

  if (!isPlatformAdmin) {
    // Process admins reach the form editor through their own grant on the
    // decision, with the usual org-level fallback for an org's own decisions.
    await assertInstanceProfileAccess({
      user: { id: user.id },
      instance,
      profilePermissions: { decisions: permission.ADMIN },
      orgFallbackPermissions: { decisions: permission.ADMIN },
    });
  }

  // `assertInstanceProfileAccess` already refuses a null `profileId`, but the
  // platform-admin path skips it, and the column is still nullable.
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const parsed = instancePhasesSchema.safeParse(instance.instanceData);
  const phaseIds = (parsed.success ? (parsed.data.phases ?? []) : []).map(
    (phase) => phase.phaseId,
  );

  return {
    profileId: instance.profileId,
    initialPhaseId: phaseIds[0] ?? null,
    phaseIds,
  };
};
