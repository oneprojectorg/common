import { type DbClient, db as defaultDb, eq } from '@op/db/client';
import {
  EntityType,
  type ProcessPhase,
  type Profile,
  processPhases,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { z } from 'zod';

import { CommonError, NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';

/**
 * The phase's `data` blob.
 *
 * `phaseId` is the instance-scoped template slug (`submissions`, `review`)
 * that `createInstanceDataFromTemplate` copies from `PhaseDefinition.id`. It is
 * what joins this row to its entry in `instance_data.phases`, so it is required
 * rather than a column — the column set belongs to the proposals ADR.
 *
 * The phase's name is deliberately absent: it lives on the profile, the way a
 * proposal's title is `profiles.name` and not a column on `decision_proposals`.
 */
export const phaseDataSchema = z.object({
  phaseId: z.string().min(1),
});

export type PhaseData = z.infer<typeof phaseDataSchema>;

export type CreatePhaseInput = {
  user: User;
  processInstanceId: string;
  /** Stored on the profile, not on the phase row. */
  name: string;
  sortOrder: number;
  data: PhaseData;
  db?: DbClient;
};

export type CreatePhaseResult = {
  phase: ProcessPhase;
  profile: Profile;
};

/**
 * Creates a phase and the profile that carries its identity.
 *
 * Manage resolves against the *process* profile, not the phase, so the caller
 * needs decisions ADMIN on the instance's profile. It writes no grants: an
 * open phase needs none, and invite-only grants are direct permissions written
 * when an invite is accepted (ADR 0006).
 *
 * The profile and the phase row are written in one transaction. A caller that
 * passes its own transaction as `db` gets a savepoint inside it.
 */
export const createPhase = async ({
  user,
  processInstanceId,
  name,
  sortOrder,
  data,
  db = defaultDb,
}: CreatePhaseInput): Promise<CreatePhaseResult> => {
  const phaseData = phaseDataSchema.parse(data);

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Decision', processInstanceId);
  }

  await assertDecisionAdmin({ user, decisionProfileId: instance.profileId });

  return db.transaction(async (tx) => {
    const slug = await generateUniqueProfileSlug({ name, db: tx });

    const [profile] = await tx
      .insert(profiles)
      .values({ type: EntityType.PHASE, name, slug })
      .returning();

    if (!profile) {
      throw new CommonError('Failed to create phase profile');
    }

    const [phase] = await tx
      .insert(processPhases)
      .values({
        processInstanceId,
        sortOrder,
        profileId: profile.id,
        data: phaseData,
      })
      .returning();

    if (!phase) {
      throw new CommonError('Failed to create phase');
    }

    return { phase, profile };
  });
};

/**
 * Renames a phase by writing its profile, leaving the slug alone so the URL
 * stays stable — the same trade `updateProposal` makes. Needs decisions ADMIN
 * on the instance's profile, like `createPhase`.
 */
export const renamePhase = async ({
  user,
  phaseId,
  name,
  db = defaultDb,
}: {
  user: User;
  phaseId: string;
  name: string;
  db?: DbClient;
}): Promise<Profile> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId, db });

  const [profile] = await db
    .update(profiles)
    .set({ name })
    .where(eq(profiles.id, phase.profileId))
    .returning();

  if (!profile) {
    throw new CommonError('Failed to rename phase');
  }

  return profile;
};

/**
 * Replaces a phase's `data` blob. The whole blob is validated against
 * `phaseDataSchema`, so a write can never drop `phaseId`. Needs decisions
 * ADMIN on the instance's profile, like `createPhase`.
 */
export const updatePhaseData = async ({
  user,
  phaseId,
  data,
  db = defaultDb,
}: {
  user: User;
  phaseId: string;
  data: PhaseData;
  db?: DbClient;
}): Promise<ProcessPhase> => {
  const phaseData = phaseDataSchema.parse(data);

  await getPhaseAsDecisionAdmin({ user, phaseId, db });

  const [phase] = await db
    .update(processPhases)
    .set({ data: phaseData })
    .where(eq(processPhases.id, phaseId))
    .returning();

  if (!phase) {
    throw new CommonError('Failed to update phase data');
  }

  return phase;
};

/**
 * Deletes a phase by deleting its *profile* and letting the `ON DELETE
 * CASCADE` on `profile_id` take the phase row with it, the way
 * `deleteDecision` does. Deleting the phase row directly would leave the
 * profile — and anything hung off it — behind. Needs decisions ADMIN on the
 * instance's profile, like `createPhase`.
 */
export const deletePhase = async ({
  user,
  phaseId,
  db = defaultDb,
}: {
  user: User;
  phaseId: string;
  db?: DbClient;
}): Promise<void> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId, db });

  const [deleted] = await db
    .delete(profiles)
    .where(eq(profiles.id, phase.profileId))
    .returning();

  if (!deleted) {
    throw new CommonError('Failed to delete phase');
  }
};

/**
 * Loads a phase and asserts the caller is a decisions ADMIN on the instance
 * it belongs to. Manage resolves against the process, not the phase profile.
 */
const getPhaseAsDecisionAdmin = async ({
  user,
  phaseId,
  db,
}: {
  user: User;
  phaseId: string;
  db: DbClient;
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

const assertDecisionAdmin = async ({
  user,
  decisionProfileId,
}: {
  user: User;
  decisionProfileId: string | null;
}): Promise<void> => {
  if (!decisionProfileId) {
    throw new CommonError('Decision profile not found');
  }

  await assertProfileAccess({
    user,
    profileId: decisionProfileId,
    permissions: { decisions: permission.ADMIN },
  });
};
