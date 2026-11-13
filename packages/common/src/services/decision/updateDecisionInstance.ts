import { trackAdminSetProcess, trackAdminSetRubric } from '@op/analytics';
import { OPURLConfig } from '@op/core';
import { type TransactionType, db, eq } from '@op/db/client';
import {
  type ProcessInstance,
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
  profiles,
} from '@op/db/schema';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess, assertProfileAdmin } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';
import { assertVoterCostField } from './assertVoterCostField';
import { createTransitionsForProcess } from './createTransitionsForProcess';
import {
  type InstanceDataUpdate,
  type PhaseEndDateChange,
  getNormalizedCategories,
  getUpdatedInstanceData,
  hasNonPhaseUpdate,
  hasPhaseUpdates,
} from './getUpdatedInstanceData';
import { getPhases } from './instancePhases';
import {
  type LockedProcessInstance,
  lockProcessInstanceOrThrow,
} from './lockProcessInstance';
import {
  type ProcessPhaseWithProfile,
  reconcilePhases,
  toInstanceDataPhase,
} from './phaseHelpers';
import { writePhasesInTx } from './phaseWrites';
import { ensureProposalTaxonomyTerms } from './proposalTaxonomy';
import { schemaValidator } from './schemaValidator';
import type {
  DecisionInstanceData,
  InstanceOverviewUpdate,
  PhaseOverride,
} from './schemas/instanceData';
import type { ProcessConfig } from './schemas/types';
import type { RubricTemplateSchema } from './types';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

/**
 * Updates a decision process instance.
 */
export const updateDecisionInstance = async ({
  instanceId,
  name,
  description,
  status,
  stewardProfileId,
  config,
  overview,
  phases,
  proposalTemplate,
  rubricTemplate,
  user,
}: {
  instanceId: string;
  name?: string;
  description?: string;
  status?: ProcessStatus;
  stewardProfileId?: string;
  /** Process-level configuration (e.g., hideBudget) */
  config?: ProcessConfig;
  /** Public-facing overview content (headline, short description, rich text body) */
  overview?: InstanceOverviewUpdate;
  /** The full ordered list: a phase left out is deleted. */
  phases?: PhaseOverride[];
  /** Proposal template (JSON Schema) */
  proposalTemplate?: Record<string, unknown>;
  /** Rubric template (JSON Schema defining evaluation criteria) */
  rubricTemplate?: RubricTemplateSchema;
  user: User;
}) => {
  // Fetch existing instance
  const existingInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!existingInstance) {
    throw new NotFoundError('Process instance', instanceId);
  }

  const { profileId } = existingInstance;
  if (!profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  // Check if user has admin access on the decision instance's profile
  await assertProfileAccess({
    user,
    profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertValidTemplates({ proposalTemplate, rubricTemplate, phases });

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (description !== undefined) {
    updateData.description = description;
  }

  if (status !== undefined) {
    updateData.status = status;
  }

  if (
    stewardProfileId !== undefined &&
    stewardProfileId !== existingInstance.stewardProfileId
  ) {
    await assertCanChangeSteward({
      user,
      ownerProfileId: existingInstance.ownerProfileId,
    });
    updateData.stewardProfileId = stewardProfileId;
  }

  const instanceDataFields: InstanceDataUpdate = {
    config,
    overview,
    phases,
    proposalTemplate,
    rubricTemplate,
  };

  if (config !== undefined) {
    await ensureProposalTaxonomyTerms(
      getNormalizedCategories(config).map((category) => category.label),
    );
  }

  const hasDataUpdate =
    hasNonPhaseUpdate(instanceDataFields) ||
    hasPhaseUpdates(instanceDataFields);
  if (Object.keys(updateData).length === 0 && !hasDataUpdate) {
    return {
      profile: await getDecisionProfile(profileId),
      phaseEndDateChanges: [],
      didPublish: false,
    };
  }

  // Use a transaction for updating the instance and transitions together
  const written = await db.transaction(async (tx) => {
    const locked = await lockProcessInstanceOrThrow({ db: tx, instanceId });
    const isBeingPublished =
      status === ProcessStatus.PUBLISHED &&
      locked.status === ProcessStatus.DRAFT;
    const nextStatus = status ?? locked.status;

    const saved: SavedInstanceData = hasDataUpdate
      ? await saveInstanceData({
          tx,
          instanceId,
          processId: existingInstance.processId,
          instance: { ...locked, status: nextStatus },
          update: instanceDataFields,
        })
      : { phaseEndDateChanges: [] };

    const [updatedInstance] = await tx
      .update(processInstances)
      .set({
        ...updateData,
        ...(saved.instanceData && { instanceData: saved.instanceData }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(processInstances.id, instanceId))
      .returning();

    if (!updatedInstance) {
      throw new CommonError('Failed to update decision process instance');
    }

    await updateDecisionProfile({
      tx,
      profileId,
      name,
      instanceName: name ?? existingInstance.name,
      isBeingPublished,
    });

    await syncTransitions({
      tx,
      updatedInstance,
      isDraft: nextStatus === ProcessStatus.DRAFT,
      isBeingPublished,
      phases: saved.phases,
    });

    return { ...saved, isBeingPublished };
  });

  const profile = await getDecisionProfile(profileId);

  if (written.isBeingPublished) {
    await sendQueuedInvites({ profileId, profileSlug: profile.slug });
    waitUntil(trackAdminSetProcess(user.id, instanceId));
  }

  if (rubricTemplate !== undefined) {
    waitUntil(trackAdminSetRubric(user.id, instanceId));
  }

  return {
    profile,
    // The rows this save left, so the caller can skip reading them again.
    phases: written.phases,
    phaseEndDateChanges: written.phaseEndDateChanges,
    didPublish: written.isBeingPublished,
  };
};

function assertValidTemplates({
  proposalTemplate,
  rubricTemplate,
  phases,
}: {
  proposalTemplate?: Record<string, unknown>;
  rubricTemplate?: RubricTemplateSchema;
  phases?: PhaseOverride[];
}) {
  if (proposalTemplate !== undefined) {
    schemaValidator.validateJsonSchema(proposalTemplate);
  }

  if (rubricTemplate !== undefined) {
    schemaValidator.validateJsonSchema(rubricTemplate);
  }

  // A null phase rubric clears it, so there is nothing to validate.
  for (const phase of phases ?? []) {
    if (phase.rubricTemplate != null) {
      schemaValidator.validateJsonSchema(phase.rubricTemplate);
    }
  }
}

async function updateDecisionProfile({
  tx,
  profileId,
  name,
  instanceName,
  isBeingPublished,
}: {
  tx: TransactionType;
  profileId: string;
  name?: string;
  instanceName: string;
  isBeingPublished: boolean;
}) {
  const profileUpdate: Record<string, string> = {};

  if (name !== undefined) {
    profileUpdate.name = name;
  }

  // Drafts keep their UUID slug; publishing locks in a name-based one.
  if (isBeingPublished) {
    profileUpdate.slug = await generateUniqueProfileSlug({
      name: `decision-${instanceName}`,
      db: tx,
    });
  }

  if (Object.keys(profileUpdate).length > 0) {
    await tx
      .update(profiles)
      .set(profileUpdate)
      .where(eq(profiles.id, profileId));
  }
}

async function syncTransitions({
  tx,
  updatedInstance,
  isDraft,
  isBeingPublished,
  phases,
}: {
  tx: TransactionType;
  updatedInstance: ProcessInstance;
  isDraft: boolean;
  isBeingPublished: boolean;
  // Set only when the save rewrote the phase rows.
  phases?: ProcessPhaseWithProfile[];
}) {
  if (isDraft) {
    await tx
      .delete(decisionProcessTransitions)
      .where(
        eq(decisionProcessTransitions.processInstanceId, updatedInstance.id),
      );
  } else if (isBeingPublished) {
    await createTransitionsForProcess({
      processInstance: updatedInstance,
      phases,
      db: tx,
    });
  } else if (phases) {
    await updateTransitionsForProcess({
      processInstance: updatedInstance,
      phases,
      db: tx,
    });
  }
}

interface SavedInstanceData {
  instanceData?: DecisionInstanceData;
  phases?: ProcessPhaseWithProfile[];
  phaseEndDateChanges: PhaseEndDateChange[];
}

// Phases go to rows; instanceData keeps the phases it was created with.
async function saveInstanceData({
  tx,
  instanceId,
  processId,
  instance,
  update,
}: {
  tx: TransactionType;
  instanceId: string;
  processId: string | null;
  // The locked row, carrying the status this save leaves.
  instance: LockedProcessInstance;
  update: InstanceDataUpdate;
}): Promise<SavedInstanceData> {
  const stored = instance.instanceData as DecisionInstanceData;

  if (!hasPhaseUpdates(update)) {
    const updated = getUpdatedInstanceData({
      existing: stored,
      existingPhases: [],
      update,
    });

    if (update.proposalTemplate) {
      const phases = await getPhases({
        instance: { id: instanceId, instanceData: stored },
        db: tx,
      });
      await assertVoterCostField({
        instanceData: { ...(updated.instanceData ?? stored), phases },
        processId,
      });
    }

    return {
      ...(updated.instanceData && { instanceData: updated.instanceData }),
      phaseEndDateChanges: [],
    };
  }

  const { result: updated, phases } = await writePhasesInTx({
    tx,
    processInstanceId: instanceId,
    locked: instance,
    syncTransitions: false,
    write: async (tx, { phases: rows }) => {
      const merged = getUpdatedInstanceData({
        existing: stored,
        existingPhases: rows.map(toInstanceDataPhase),
        update,
      });

      if (merged.phases) {
        await reconcilePhases({
          tx,
          processInstanceId: instanceId,
          existing: rows,
          phases: merged.phases,
        });
      }

      return merged;
    },
  });

  await assertVoterCostField({
    instanceData: {
      ...(updated.instanceData ?? stored),
      phases: phases.map(toInstanceDataPhase),
    },
    processId,
  });

  return {
    ...(updated.instanceData && { instanceData: updated.instanceData }),
    phases,
    phaseEndDateChanges: updated.phaseEndDateChanges,
  };
}

async function sendQueuedInvites({
  profileId,
  profileSlug,
}: {
  profileId: string;
  profileSlug: string | null;
}) {
  const queuedInvites = await db.query.profileInvites.findMany({
    where: {
      profileId,
      notifiedAt: { isNull: true },
    },
    with: {
      profile: true,
      inviter: true,
    },
  });

  const [firstInvite] = queuedInvites;
  if (!firstInvite) {
    return;
  }

  const baseUrl = OPURLConfig('APP').ENV_URL;
  const inviteUrl = profileSlug
    ? `${baseUrl}/decisions/${profileSlug}/invite`
    : baseUrl;

  // notifiedAt is set by the Inngest workflow after successful email delivery
  await event.send({
    name: Events.profileInviteSent.name,
    data: {
      senderProfileId: firstInvite.invitedBy,
      inviteIds: queuedInvites.map((invite) => invite.id),
      invitations: queuedInvites.map((invite) => ({
        email: invite.email,
        inviterName: invite.inviter?.name || 'A team member',
        profileName: invite.profile.name,
        inviteUrl,
        personalMessage: invite.message ?? undefined,
      })),
    },
  });
}

async function assertCanChangeSteward({
  user,
  ownerProfileId,
}: {
  user: User;
  ownerProfileId: string | null;
}) {
  if (!ownerProfileId) {
    throw new UnauthorizedError(
      'Only the process owner can change the steward',
    );
  }

  await assertProfileAdmin({ user, profileId: ownerProfileId });
}

async function getDecisionProfile(profileId: string) {
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    with: {
      processInstance: true,
    },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch decision profile');
  }

  return profile;
}
