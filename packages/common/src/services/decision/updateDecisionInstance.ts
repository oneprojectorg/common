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
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertProfileAdmin } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';
import { createTransitionsForProcess } from './createTransitionsForProcess';
import { schemaValidator } from './schemaValidator';
import type {
  DecisionInstanceData,
  PhaseOverride,
} from './schemas/instanceData';
import type { ProcessConfig } from './schemas/types';
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
  /** Optional phase overrides (dates and settings) */
  phases?: PhaseOverride[];
  /** Proposal template (JSON Schema) */
  proposalTemplate?: Record<string, unknown>;
  /** Rubric template (JSON Schema defining evaluation criteria) */
  rubricTemplate?: Record<string, unknown>;
  user: User;
}) => {
  // Fetch existing instance
  const existingInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!existingInstance) {
    throw new NotFoundError('Process instance not found');
  }

  const { profileId } = existingInstance;
  if (!profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  // Check if user has admin access on the decision instance's profile
  const profileUser = await getProfileAccessUser({
    user,
    profileId,
  });

  assertAccess({ decisions: permission.ADMIN }, profileUser?.roles ?? []);

  // Validate proposalTemplate is a structurally valid JSON Schema before persisting
  if (proposalTemplate !== undefined) {
    schemaValidator.validateJsonSchema(proposalTemplate);
  }

  // Validate rubricTemplate is a structurally valid JSON Schema before persisting
  if (rubricTemplate !== undefined) {
    schemaValidator.validateJsonSchema(rubricTemplate);
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

    await assertProfileAdmin(user, existingInstance.ownerProfileId);

    updateData.stewardProfileId = stewardProfileId;
  }

  // Apply config, phase overrides, and/or template updates to existing instanceData
  const hasConfigUpdate = config !== undefined;
  const hasPhaseUpdates = phases && phases.length > 0;
  const hasProposalTemplateUpdate = proposalTemplate !== undefined;
  const hasRubricTemplateUpdate = rubricTemplate !== undefined;

  if (
    hasConfigUpdate ||
    hasPhaseUpdates ||
    hasProposalTemplateUpdate ||
    hasRubricTemplateUpdate
  ) {
    const existingInstanceData =
      existingInstance.instanceData as DecisionInstanceData;

    let updatedInstanceData: DecisionInstanceData = { ...existingInstanceData };

    // Apply config updates (merge with existing config)
    if (hasConfigUpdate) {
      updatedInstanceData.config = {
        ...existingInstanceData.config,
        ...config,
      };
    }

    // Apply phase updates — replaces the full phases array to accommodate
    // adding, removing, and reordering phases from the phase editor.
    // Existing phase data (selectionPipeline, settingsSchema, etc.) is
    // preserved by merging with the previous phase when a match exists.
    if (hasPhaseUpdates) {
      const existingPhaseMap = new Map(
        existingInstanceData.phases.map((p) => [p.phaseId, p]),
      );

      updatedInstanceData.phases = phases.map((phase) => {
        const existing = existingPhaseMap.get(phase.phaseId);
        return {
          ...existing,
          phaseId: phase.phaseId,
          ...(phase.name !== undefined && { name: phase.name }),
          ...(phase.description !== undefined && {
            description: phase.description,
          }),
          ...(phase.headline !== undefined && { headline: phase.headline }),
          ...(phase.additionalInfo !== undefined && {
            additionalInfo: phase.additionalInfo,
          }),
          ...(phase.rules !== undefined && { rules: phase.rules }),
          ...(phase.startDate !== undefined && { startDate: phase.startDate }),
          ...(phase.endDate !== undefined && { endDate: phase.endDate }),
          ...(phase.settings !== undefined && { settings: phase.settings }),
        };
      });
    }

    // Apply proposal template update (replace entirely)
    if (hasProposalTemplateUpdate) {
      updatedInstanceData = {
        ...updatedInstanceData,
        proposalTemplate,
      } as DecisionInstanceData;
    }

    // Apply rubric template update (replace entirely)
    if (hasRubricTemplateUpdate) {
      updatedInstanceData = {
        ...updatedInstanceData,
        rubricTemplate,
      } as DecisionInstanceData;
    }

    updateData.instanceData = updatedInstanceData;
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

    return profile;
  }

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

    // Keep the profile name in sync with the instance name.
    // When the instance is still a draft, also regenerate the slug to match.
    // Once published, the slug is locked to avoid breaking shared links.
    if (name !== undefined) {
      const profileUpdate: { name: string; slug?: string } = { name };

      if (finalStatus === ProcessStatus.DRAFT) {
        profileUpdate.slug = await generateUniqueProfileSlug({
          name: `decision-${name}`,
          db: tx,
        });
      }

      await tx
        .update(profiles)
        .set(profileUpdate)
        .where(eq(profiles.id, profileId));
    }
    const isBeingPublished =
      status === ProcessStatus.PUBLISHED &&
      existingInstance.status === ProcessStatus.DRAFT;

    // If status is DRAFT, remove all transitions
    if (finalStatus === ProcessStatus.DRAFT) {
      await tx
        .delete(decisionProcessTransitions)
        .where(eq(decisionProcessTransitions.processInstanceId, instanceId));
    } else if (isBeingPublished) {
      // When publishing a draft, create transitions for all date-based phases
      await createTransitionsForProcess({
        processInstance: updatedInstance,
        tx,
      });
    } else if (phases && phases.length > 0) {
      // If phases were updated and already published, update the corresponding transitions
      await updateTransitionsForProcess({
        processInstance: updatedInstance,
        tx,
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
  const isPublishing =
    status === ProcessStatus.PUBLISHED &&
    existingInstance.status === ProcessStatus.DRAFT;

  if (isPublishing) {
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
      if (!firstInvite) {
        return;
      }
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

  return profile;
};
