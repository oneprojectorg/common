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
import { draftInstanceDataSchema } from './schemas/instanceData';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

/**
 * Promotes draftInstanceData to the live columns.
 *
 * Copies `draftInstanceData` wholesale to `instanceData` and extracts
 * `name`, `description`, `stewardProfileId` to their own columns.
 *
 * When `status` is set to PUBLISHED (and was previously DRAFT), runs the
 * full publish workflow: slug generation, transition creation, invite
 * dispatch.
 */
export const publishDecisionInstance = async ({
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

  const parsed = draftInstanceDataSchema.safeParse(
    existingInstance.draftInstanceData,
  );
  if (!parsed.success) {
    throw new CommonError('No draft instance data to publish');
  }
  const source = parsed.data as Record<string, unknown>;

  const currentStatus = existingInstance.status as ProcessStatus;
  if (
    currentStatus === ProcessStatus.COMPLETED ||
    currentStatus === ProcessStatus.CANCELLED
  ) {
    throw new CommonError(
      'Cannot promote draft instance data for a completed or cancelled process',
    );
  }

  // Copy draftInstanceData to instanceData wholesale. The draft contains
  // the full instanceData shape — no merge needed. Extract instance-column
  // fields (name, description, stewardProfileId) to their own columns.
  const { name, description, stewardProfileId, ...instanceData } = source;

  const updateData: Record<string, unknown> = {
    instanceData,
  };

  if (name !== undefined) {
    updateData.name = name;
  }
  if (description !== undefined) {
    updateData.description = description;
  }
  if (stewardProfileId !== undefined) {
    updateData.stewardProfileId = stewardProfileId;
  }
  if (status !== undefined) {
    updateData.status = status;
  }

  const isBeingPublished =
    status === ProcessStatus.PUBLISHED && currentStatus === ProcessStatus.DRAFT;

  const hasPhaseChanges =
    Array.isArray(instanceData.phases) && instanceData.phases.length > 0;

  // Use a transaction for updating the instance and transitions together
  await db.transaction(async (tx) => {
    const [updatedInstance] = await tx
      .update(processInstances)
      .set(updateData)
      .where(eq(processInstances.id, instanceId))
      .returning();

    if (!updatedInstance) {
      throw new CommonError('Failed to promote draft to live');
    }

    const finalStatus = status ?? currentStatus;

    // Build a single profile update for name sync and/or slug generation.
    const profileUpdate: Record<string, string> = {};

    // Keep the profile name in sync with the instance name.
    if (typeof name === 'string') {
      profileUpdate.name = name;
    }

    // Generate a permanent, name-based slug when publishing.
    // Draft instances keep their original UUID slug so the URL stays stable
    // while editing. Once published the slug is locked.
    if (isBeingPublished) {
      const instanceName =
        typeof name === 'string' ? name : existingInstance.name;
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
        tx,
      });
    } else if (hasPhaseChanges) {
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
    with: { processInstance: true },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch updated decision profile');
  }

  // When publishing a draft, send queued invite emails for this
  // process instance's profile. Wrapped in try-catch because the core
  // publish transaction already committed — a failure here should not
  // surface as a publish error to the user.
  if (isBeingPublished) {
    try {
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
          await event.send({
            name: Events.profileInviteSent.name,
            data: {
              senderProfileId: firstInvite.invitedBy,
              inviteIds: queuedInvites.map((inv) => inv.id),
              invitations,
            },
          });
        }
        // notifiedAt is set by the Inngest workflow after successful email delivery
      }
    } catch (error) {
      console.error('Failed to dispatch invite emails after publish:', error);
    }
  }

  return profile;
};
