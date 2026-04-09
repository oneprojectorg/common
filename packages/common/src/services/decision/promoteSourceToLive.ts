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

import { CommonError, NotFoundError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { generateUniqueProfileSlug } from '../profile/utils';
import { createTransitionsForProcess } from './createTransitionsForProcess';
import type { DecisionInstanceData } from './schemas/instanceData';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

interface SourceData {
  name?: string;
  description?: string;
  stewardProfileId?: string;
  phases?: Array<Record<string, unknown>>;
  proposalTemplate?: Record<string, unknown>;
  rubricTemplate?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

/**
 * Promotes sourceData to the live columns.
 *
 * This copies editor-controlled fields from `sourceData` to the live
 * columns (`instanceData`, `name`, `description`, `stewardProfileId`)
 * while preserving runtime fields in `instanceData` (currentPhaseId,
 * stateData, fieldValues, etc.).
 *
 * When `status` is set to PUBLISHED (and was previously DRAFT), runs
 * the full publish workflow: slug generation, transition creation,
 * invite dispatch.
 */
export const promoteSourceToLive = async ({
  instanceId,
  status,
  user,
}: {
  instanceId: string;
  status?: ProcessStatus;
  user: User;
}) => {
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

  const profileUser = await getProfileAccessUser({
    user,
    profileId,
  });

  assertAccess({ decisions: permission.ADMIN }, profileUser?.roles ?? []);

  const source = existingInstance.sourceData as SourceData | null;
  if (!source) {
    throw new CommonError('No source data to promote');
  }

  // Reject promotion for terminal statuses
  const currentStatus = existingInstance.status as ProcessStatus;
  if (
    currentStatus === ProcessStatus.COMPLETED ||
    currentStatus === ProcessStatus.CANCELLED
  ) {
    throw new CommonError(
      'Cannot promote source data for a completed or cancelled process',
    );
  }

  // Build the live instanceData by merging source fields into existing,
  // preserving runtime fields (currentPhaseId, stateData, fieldValues, etc.)
  const existingInstanceData =
    existingInstance.instanceData as DecisionInstanceData;
  const updatedInstanceData: DecisionInstanceData = {
    ...existingInstanceData,
  };

  if (source.config !== undefined) {
    updatedInstanceData.config = {
      ...existingInstanceData.config,
      ...source.config,
    };
  }

  if (source.phases && source.phases.length > 0) {
    const existingPhaseMap = new Map(
      (existingInstanceData.phases ?? []).map((p) => [p.phaseId, p]),
    );

    updatedInstanceData.phases = source.phases.map((phase) => {
      const phaseId = phase.phaseId as string;
      const existing = existingPhaseMap.get(phaseId);
      return {
        ...existing,
        ...phase,
        phaseId,
      };
    });
  }

  if (source.proposalTemplate !== undefined) {
    updatedInstanceData.proposalTemplate = source.proposalTemplate;
  }

  if (source.rubricTemplate !== undefined) {
    updatedInstanceData.rubricTemplate = source.rubricTemplate;
  }

  // Build the update payload
  const updateData: Record<string, unknown> = {
    instanceData: updatedInstanceData,
  };

  if (source.name !== undefined) {
    updateData.name = source.name;
  }
  if (source.description !== undefined) {
    updateData.description = source.description;
  }
  if (source.stewardProfileId !== undefined) {
    updateData.stewardProfileId = source.stewardProfileId;
  }
  if (status !== undefined) {
    updateData.status = status;
  }

  const isBeingPublished =
    status === ProcessStatus.PUBLISHED && currentStatus === ProcessStatus.DRAFT;

  const hasPhaseChanges = source.phases && source.phases.length > 0;

  await db.transaction(async (tx) => {
    const [updatedInstance] = await tx
      .update(processInstances)
      .set(updateData)
      .where(eq(processInstances.id, instanceId))
      .returning();

    if (!updatedInstance) {
      throw new CommonError('Failed to promote source to live');
    }

    const finalStatus = status ?? currentStatus;

    const profileUpdate: Record<string, string> = {};
    if (source.name !== undefined) {
      profileUpdate.name = source.name;
    }
    if (isBeingPublished) {
      const instanceName = source.name ?? existingInstance.name;
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

    if (finalStatus === ProcessStatus.DRAFT) {
      await tx
        .delete(decisionProcessTransitions)
        .where(eq(decisionProcessTransitions.processInstanceId, instanceId));
    } else if (isBeingPublished) {
      await createTransitionsForProcess({
        processInstance: updatedInstance,
        tx,
      });
    } else if (hasPhaseChanges) {
      await updateTransitionsForProcess({
        processInstance: updatedInstance,
        tx,
      });
    }
  });

  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    with: {
      processInstance: true,
    },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch updated decision profile');
  }

  // When publishing a draft, send queued invite emails
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

      const firstInvite = queuedInvites[0];
      if (firstInvite) {
        await event.send({
          name: Events.profileInviteSent.name,
          data: {
            senderProfileId: firstInvite.invitedBy,
            inviteIds: queuedInvites.map((inv) => inv.id),
            invitations,
          },
        });
      }
    }
  }

  return profile;
};
