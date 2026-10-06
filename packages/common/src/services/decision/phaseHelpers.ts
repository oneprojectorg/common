import { type TransactionType, db } from '@op/db/client';
import {
  EntityType,
  type ProcessPhase,
  type Profile,
  processPhases,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { CommonError, NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';

/**
 * The phase's `data` blob.
 *
 * `phaseId` is the instance-scoped template slug (`submissions`, `review`)
 * that `createInstanceDataFromTemplate` copies from `PhaseDefinition.id`. It is
 * what joins this row to its entry in `instance_data.phases`.
 *
 * The phase's name is deliberately absent: it lives on the profile, the way a
 * proposal's title is `profiles.name` and not a column on `decision_proposals`.
 */
export const phaseDataSchema = z.object({
  phaseId: z.string().min(1).max(64),
});

export type PhaseData = z.infer<typeof phaseDataSchema>;

const SLUG_ATTEMPTS = 3;

/**
 * Writes a phase profile and its phase row. No access check and no
 * transaction of its own: the caller has already authorized and passes the
 * transaction both writes run in.
 */
export const insertPhase = async ({
  tx,
  processInstanceId,
  name,
  sortOrder,
  data,
  generateSlug = generatePhaseSlug,
}: {
  tx: TransactionType;
  processInstanceId: string;
  name: string;
  sortOrder: number;
  data: PhaseData;
  /** Only tests pass this, to force slug clashes. */
  generateSlug?: () => string;
}): Promise<{ phase: ProcessPhase; profile: Profile }> => {
  const profile = await insertPhaseProfile({ tx, name, generateSlug });

  const [phase] = await tx
    .insert(processPhases)
    .values({ processInstanceId, sortOrder, profileId: profile.id, data })
    .returning();

  if (!phase) {
    throw new CommonError('Failed to create phase');
  }

  return { phase, profile };
};

/**
 * Loads a phase and asserts the caller is a decisions ADMIN on the instance
 * it belongs to. Phase management is authorized against the decision's
 * profile, not the phase's.
 */
export const getPhaseAsDecisionAdmin = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<{ profileId: string }> => {
  const phase = await db.query.processPhases.findFirst({
    where: { id: phaseId },
    columns: { profileId: true },
    with: { processInstance: { columns: { profileId: true } } },
  });

  if (!phase) {
    throw new NotFoundError('Phase', phaseId);
  }

  await assertDecisionAdmin({
    user,
    decisionProfileId: phase.processInstance.profileId,
  });

  return { profileId: phase.profileId };
};

export const assertDecisionAdmin = async ({
  user,
  decisionProfileId,
}: {
  user: User;
  decisionProfileId: string | null;
}): Promise<void> => {
  // A legacy instance can lack a profile; there is nothing to authorize against.
  if (!decisionProfileId) {
    throw new CommonError('Decision profile not found');
  }

  await assertProfileAccess({
    user,
    profileId: decisionProfileId,
    permissions: { decisions: permission.ADMIN },
  });
};

/**
 * A phase slug is the first segment of a v4 UUID (8 hex chars), not the name,
 * so a rename never changes it. `profiles.slug` is unique across every profile, so
 * a clash skips the insert and the next attempt draws a new slug.
 */
const insertPhaseProfile = async ({
  tx,
  name,
  generateSlug,
}: {
  tx: TransactionType;
  name: string;
  generateSlug: () => string;
}): Promise<Profile> => {
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const [profile] = await tx
      .insert(profiles)
      .values({
        type: EntityType.PHASE,
        name,
        slug: generateSlug(),
      })
      .onConflictDoNothing({ target: profiles.slug })
      .returning();

    if (profile) {
      return profile;
    }
  }

  throw new CommonError('Failed to create phase profile');
};

const generatePhaseSlug = () => randomUUID().slice(0, 8);
