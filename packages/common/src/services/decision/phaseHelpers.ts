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

export const phaseDataSchema = z.object({
  // Links this row to its entry in instance_data.phases.
  phaseId: z.string().min(1).max(64),
});

export type PhaseData = z.infer<typeof phaseDataSchema>;

const SLUG_ATTEMPTS = 3;

// No access check: callers authorize first.
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
  // Only tests pass this, to force slug clashes.
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
  // Legacy instances can lack a profile.
  if (!decisionProfileId) {
    throw new CommonError('Decision profile not found');
  }

  await assertProfileAccess({
    user,
    profileId: decisionProfileId,
    permissions: { decisions: permission.ADMIN },
  });
};

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
