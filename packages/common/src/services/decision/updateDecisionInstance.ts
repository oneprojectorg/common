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
  type PhaseEndDateChange,
  getNormalizedCategories,
  getUpdatedInstanceData,
} from './getUpdatedInstanceData';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import {
  loadPhaseRows,
  projectPhaseRows,
  reconcilePhaseRows,
} from './phaseRows';
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
  /** Optional phase overrides (dates and settings) */
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

  const hasPhaseUpdates = phases !== undefined && phases.length > 0;
  const existingInstanceData =
    existingInstance.instanceData as DecisionInstanceData;

  // Phase overrides are applied inside the transaction, against the rows.
  const instanceDataUpdate = getUpdatedInstanceData({
    existing: existingInstanceData,
    update: { config, overview, proposalTemplate, rubricTemplate },
  });
  const phaseEndDateChanges: PhaseEndDateChange[] = [];

  if (instanceDataUpdate) {
    if (config !== undefined) {
      await ensureProposalTaxonomyTerms(
        getNormalizedCategories(config).map((category) => category.label),
      );
    }

    updateData.instanceData = instanceDataUpdate.instanceData;
  }

  // Only update if there's something to update
  if (Object.keys(updateData).length === 0 && !hasPhaseUpdates) {
    return {
      profile: await getDecisionProfile(profileId),
      phaseEndDateChanges,
      didPublish: false,
    };
  }

  const isBeingPublished =
    status === ProcessStatus.PUBLISHED &&
    existingInstance.status === ProcessStatus.DRAFT;

  // Use a transaction for updating the instance and transitions together
  await db.transaction(async (tx) => {
    const locked = await lockProcessInstanceOrThrow({ db: tx, instanceId });

    let phaseUpdate: ReturnType<typeof getUpdatedInstanceData>;

    if (hasPhaseUpdates) {
      const rows = await loadPhaseRows({
        db: tx,
        processInstanceId: instanceId,
      });
      // A decision not yet backfilled has no rows; its blob is the base.
      const currentPhases =
        rows.length > 0
          ? projectPhaseRows(rows)
          : ((locked.instanceData as DecisionInstanceData | null)?.phases ??
            []);

      phaseUpdate = getUpdatedInstanceData({
        existing: {
          ...(instanceDataUpdate?.instanceData ?? existingInstanceData),
          phases: currentPhases,
        },
        update: { phases },
      });
    }

    if (phaseUpdate) {
      phaseEndDateChanges.push(...phaseUpdate.phaseEndDateChanges);

      await reconcilePhaseRows({
        db: tx,
        processInstanceId: instanceId,
        phases: phaseUpdate.instanceData.phases,
      });

      // The blob mirrors the rows for the readers still on it.
      phaseUpdate.instanceData.phases = projectPhaseRows(
        await loadPhaseRows({ db: tx, processInstanceId: instanceId }),
      );
      updateData.instanceData = phaseUpdate.instanceData;
    }

    // After the merge: a budget on an incoming phase needs a priced field.
    const mergedInstanceData =
      phaseUpdate?.instanceData ?? instanceDataUpdate?.instanceData;
    if (mergedInstanceData && (hasPhaseUpdates || proposalTemplate)) {
      await assertVoterCostField({
        instanceData: mergedInstanceData,
        processId: existingInstance.processId,
      });
    }

    // Update the instance
    const [updatedInstance] = await tx
      .update(processInstances)
      .set(updateData)
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
      isDraft: (status ?? existingInstance.status) === ProcessStatus.DRAFT,
      isBeingPublished,
      phasesChanged: hasPhaseUpdates,
    });
  });

  const profile = await getDecisionProfile(profileId);

  if (isBeingPublished) {
    await sendQueuedInvites({ profileId, profileSlug: profile.slug });
    waitUntil(trackAdminSetProcess(user.id, instanceId));
  }

  if (rubricTemplate !== undefined) {
    waitUntil(trackAdminSetRubric(user.id, instanceId));
  }

  return { profile, phaseEndDateChanges, didPublish: isBeingPublished };
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
  phasesChanged,
}: {
  tx: TransactionType;
  updatedInstance: ProcessInstance;
  isDraft: boolean;
  isBeingPublished: boolean;
  phasesChanged: boolean;
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
      db: tx,
    });
  } else if (phasesChanged) {
    await updateTransitionsForProcess({
      processInstance: updatedInstance,
      db: tx,
    });
  }
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
