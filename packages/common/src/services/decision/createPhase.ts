import { type DbClient, db as defaultDb, eq } from '@op/db/client';
import {
  EntityType,
  type ProcessPhase,
  type Profile,
  processPhases,
  profiles,
} from '@op/db/schema';
import { z } from 'zod';

import { CommonError, NotFoundError } from '../../utils';
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
 * Creates a phase and the profile that carries its identity, in one
 * transaction, following `createProposal`.
 *
 * Authorization is the caller's: manage resolves against the *process*
 * profile, not the phase, so the caller asserts there before reaching here —
 * the same contract `createDecisionRole` and `createDefaultDecisionRoles` work
 * under. It writes no grants: an open phase needs none, and invite-only grants
 * are direct permissions written when an invite is accepted (ADR 0006).
 */
export const createPhase = async ({
  processInstanceId,
  name,
  sortOrder,
  data,
  db = defaultDb,
}: CreatePhaseInput): Promise<CreatePhaseResult> => {
  const phaseData = phaseDataSchema.parse(data);

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
 * stays stable — the same trade `updateProposal` makes.
 */
export const renamePhase = async ({
  phaseId,
  name,
  db = defaultDb,
}: {
  phaseId: string;
  name: string;
  db?: DbClient;
}): Promise<Profile> => {
  const phase = await db.query.processPhases.findFirst({
    where: { id: phaseId },
    columns: { profileId: true },
  });

  if (!phase) {
    throw new NotFoundError('Phase', phaseId);
  }

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
 * Deletes a phase by deleting its *profile* and letting the `ON DELETE
 * CASCADE` on `profile_id` take the phase row with it, the way
 * `deleteDecision` does. Deleting the phase row directly would leave the
 * profile — and anything hung off it — behind.
 */
export const deletePhase = async ({
  phaseId,
  db = defaultDb,
}: {
  phaseId: string;
  db?: DbClient;
}): Promise<void> => {
  const phase = await db.query.processPhases.findFirst({
    where: { id: phaseId },
    columns: { profileId: true },
  });

  if (!phase) {
    throw new NotFoundError('Phase', phaseId);
  }

  const [deleted] = await db
    .delete(profiles)
    .where(eq(profiles.id, phase.profileId))
    .returning();

  if (!deleted) {
    throw new CommonError('Failed to delete phase');
  }
};
