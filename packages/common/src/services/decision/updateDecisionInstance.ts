import { trackAdminSetProcess, trackAdminSetRubric } from '@op/analytics';
import { OPURLConfig } from '@op/core';
import { db, eq } from '@op/db/client';
import {
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
  getNormalizedCategories,
  getUpdatedInstanceData,
} from './getUpdatedInstanceData';
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

  // Validate proposalTemplate is a structurally valid JSON Schema before persisting
  if (proposalTemplate !== undefined) {
    schemaValidator.validateJsonSchema(proposalTemplate);
  }

  // Validate rubricTemplate is a structurally valid JSON Schema before persisting
  if (rubricTemplate !== undefined) {
    schemaValidator.validateJsonSchema(rubricTemplate);
  }

  // Same validation for phase-level rubric templates (null = clear, skipped)
  for (const phase of phases ?? []) {
    if (phase.rubricTemplate != null) {
      schemaValidator.validateJsonSchema(phase.rubricTemplate);
    }
  }

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
    if (!existingInstance.ownerProfileId) {
      throw new UnauthorizedError(
        'Only the process owner can change the steward',
      );
    }

    await assertProfileAdmin({
      user,
      profileId: existingInstance.ownerProfileId,
    });

    updateData.stewardProfileId = stewardProfileId;
  }

  const instanceDataUpdate = getUpdatedInstanceData({
    existing: existingInstance.instanceData as DecisionInstanceData,
    update: { config, overview, phases, proposalTemplate, rubricTemplate },
  });
  const phaseEndDateChanges = instanceDataUpdate?.phaseEndDateChanges ?? [];

  if (instanceDataUpdate) {
    if (config !== undefined) {
      await ensureProposalTaxonomyTerms(
        getNormalizedCategories(config).map((category) => category.label),
      );
    }

    if ((phases !== undefined && phases.length > 0) || proposalTemplate) {
      await assertVoterCostField({
        instanceData: instanceDataUpdate.instanceData,
        processId: existingInstance.processId,
      });
    }

    updateData.instanceData = instanceDataUpdate.instanceData;
  }

  // Only update if there's something to update
  if (Object.keys(updateData).length === 0) {
    // Nothing to update, just return the existing profile
    const profile = await db.query.profiles.findFirst({
      where: { id: profileId },
      with: {
        processInstance: true,
      },
    });

    if (!profile) {
      throw new CommonError('Failed to fetch decision profile');
    }

    return { profile, phaseEndDateChanges, didPublish: false };
  }

  const isBeingPublished =
    status === ProcessStatus.PUBLISHED &&
    existingInstance.status === ProcessStatus.DRAFT;

  // Use a transaction for updating the instance and transitions together
  await db.transaction(async (tx) => {
    // Update the instance
    const [updatedInstance] = await tx
      .update(processInstances)
      .set(updateData)
      .where(eq(processInstances.id, instanceId))
      .returning();

    if (!updatedInstance) {
      throw new CommonError('Failed to update decision process instance');
    }

    // Determine the final status (updated or existing)
    const finalStatus = status ?? existingInstance.status;

    // Build a single profile update for name sync and/or slug generation.
    const profileUpdate: Record<string, string> = {};

    // Keep the profile name in sync with the instance name.
    if (name !== undefined) {
      profileUpdate.name = name;
    }

    // Generate a permanent, name-based slug when publishing.
    // Draft instances keep their original UUID slug so the URL stays stable
    // while editing. Once published the slug is locked.
    if (isBeingPublished) {
      const instanceName = name ?? existingInstance.name;
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

    // If status is DRAFT, remove all transitions
    if (finalStatus === ProcessStatus.DRAFT) {
      await tx
        .delete(decisionProcessTransitions)
        .where(eq(decisionProcessTransitions.processInstanceId, instanceId));
    } else if (isBeingPublished) {
      // When publishing a draft, create transitions for all date-based phases
      await createTransitionsForProcess({
        processInstance: updatedInstance,
        db: tx,
      });
    } else if (phases && phases.length > 0) {
      // If phases were updated and already published, update the corresponding transitions
      await updateTransitionsForProcess({
        processInstance: updatedInstance,
        db: tx,
      });
    }
  });

  // Fetch the profile with processInstance joined for the response
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    with: {
      processInstance: true,
    },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch updated decision profile');
  }

  // When publishing a draft, send queued invite emails for this process instance's profile
  if (isBeingPublished) {
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

    if (queuedInvites.length > 0) {
      const baseUrl = OPURLConfig('APP').ENV_URL;

      const invitations = queuedInvites.map((invite) => ({
        email: invite.email,
        inviterName: invite.inviter?.name || 'A team member',
        profileName: invite.profile.name,
        inviteUrl: profile.slug
          ? `${baseUrl}/decisions/${profile.slug}/invite`
          : baseUrl,
        personalMessage: invite.message ?? undefined,
      }));

      // Use the first invite's inviter as the sender
      const firstInvite = queuedInvites[0];
      if (firstInvite) {
        const senderProfileId = firstInvite.invitedBy;

        await event.send({
          name: Events.profileInviteSent.name,
          data: {
            senderProfileId,
            inviteIds: queuedInvites.map((inv) => inv.id),
            invitations,
          },
        });
        // notifiedAt is set by the Inngest workflow after successful email delivery
      }
    }
  }

  if (isBeingPublished) {
    waitUntil(trackAdminSetProcess(user.id, instanceId));
  }

  if (rubricTemplate !== undefined) {
    waitUntil(trackAdminSetRubric(user.id, instanceId));
  }

  return { profile, phaseEndDateChanges, didPublish: isBeingPublished };
};
