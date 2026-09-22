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
import { createDecisionRole } from './decisionRoles';

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

/**
 * A capability a phase can offer. Each one it offers gets its own
 * profile-scoped role, because a phase holds reviewers and submitters at the
 * same time and `profileUser_to_access_roles` is a join table.
 */
export const PHASE_CAPABILITIES = ['submit', 'review', 'vote'] as const;

export type PhaseCapability = (typeof PHASE_CAPABILITIES)[number];

export type CreatePhaseInput = {
  processInstanceId: string;
  /** Stored on the profile, not on the phase row. */
  name: string;
  sortOrder: number;
  data: PhaseData;
  capabilities?: ReadonlyArray<PhaseCapability>;
  db?: DbClient;
};

export type CreatePhaseResult = {
  phase: ProcessPhase;
  profile: Profile;
  roles: Array<{ capability: PhaseCapability; roleId: string }>;
};

/**
 * Creates a phase and the profile that carries its identity, in one
 * transaction, following `createProposal`.
 *
 * Authorization is the caller's: manage resolves against the *process*
 * profile, not the phase, so the caller asserts there before reaching here —
 * the same contract `createDecisionRole` and `createDefaultDecisionRoles` work
 * under.
 */
export const createPhase = async ({
  processInstanceId,
  name,
  sortOrder,
  data,
  capabilities = [],
  db = defaultDb,
}: CreatePhaseInput): Promise<CreatePhaseResult> => {
  const phaseData = phaseDataSchema.parse(data);
  const wantedCapabilities = [...new Set(capabilities)];

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

    const roles: CreatePhaseResult['roles'] = [];
    // Sequential: these share one transaction's connection.
    for (const capability of wantedCapabilities) {
      const role = await createDecisionRole({
        name: CAPABILITY_ROLE_NAMES[capability],
        profileId: profile.id,
        permissions: {
          decisions: {
            type: 'decision',
            value: capabilityPermissions(capability),
          },
        },
        db: tx,
      });
      roles.push({ capability, roleId: role.id });
    }

    return { phase, profile, roles };
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

const CAPABILITY_ROLE_NAMES: Record<PhaseCapability, string> = {
  submit: 'Submitter',
  review: 'Reviewer',
  vote: 'Voter',
};

/**
 * One bit per role. `createDecisionRole` adds the READ bit and a profile READ
 * grant itself, so a capability role carries its capability and nothing else.
 */
const capabilityPermissions = (capability: PhaseCapability) => ({
  create: false,
  read: true,
  update: false,
  delete: false,
  admin: false,
  inviteMembers: false,
  review: capability === 'review',
  submitProposals: capability === 'submit',
  vote: capability === 'vote',
});
