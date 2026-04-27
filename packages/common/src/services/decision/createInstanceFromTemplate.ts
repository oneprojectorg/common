import { db, sql } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { createDefaultDecisionRoles } from './decisionRoles';
import type { DecisionInstanceData } from './schemas/instanceData';
import { createInstanceDataFromTemplate } from './schemas/instanceData';
import type { DecisionSchemaDefinition } from './schemas/types';

export type CreateDecisionInstanceOptions = {
  processId: string;
  instanceData: DecisionInstanceData;
  name: string;
  description?: string;
  ownerProfileId: string;
  /** Defaults to ownerProfileId when not provided */
  stewardProfileId?: string;
  creatorAuthUserId: string;
  creatorEmail: string;
  /** Defaults to DRAFT */
  status?: ProcessStatus;
};

export const createDecisionInstance = async ({
  processId,
  instanceData,
  name,
  description,
  ownerProfileId,
  stewardProfileId = ownerProfileId,
  creatorAuthUserId,
  creatorEmail,
  status = ProcessStatus.DRAFT,
}: CreateDecisionInstanceOptions) => {
  const instance = await db.transaction(async (tx) => {
    // Create a DECISION profile for the instance
    const slug = `decision-${randomUUID()}`;

    const [instanceProfile] = await tx
      .insert(profiles)
      .values({
        type: EntityType.DECISION,
        name,
        slug,
      })
      .returning();

    if (!instanceProfile) {
      throw new CommonError('Failed to create decision instance profile');
    }

    // Create the instance
    const [newInstance] = await tx
      .insert(processInstances)
      .values({
        processId,
        name,
        description,
        instanceData,
        currentStateId: instanceData.phases[0]?.phaseId ?? null,
        ownerProfileId,
        stewardProfileId,
        profileId: instanceProfile.id,
        status,
      })
      .returning();

    if (!newInstance) {
      throw new CommonError('Failed to create decision process instance');
    }

    const { admin: adminRole } = await createDefaultDecisionRoles({
      profileId: instanceProfile.id,
      tx,
    });

    // Add the creator as a profile user with Admin role
    const [newProfileUser] = await tx
      .insert(profileUsers)
      .values({
        profileId: instanceProfile.id,
        authUserId: creatorAuthUserId,
        email: creatorEmail,
        isOwner: true,
      })
      .returning();

    if (!newProfileUser) {
      throw new CommonError('Failed to add creator as profile user');
    }

    await tx.insert(profileUserToAccessRoles).values({
      profileUserId: newProfileUser.id,
      accessRoleId: adminRole.id,
    });

    return newInstance;
  });

  // Note: Transitions are NOT created here because the instance is created as DRAFT.
  // Transitions are created when the instance is published via updateDecisionInstance.

  // Fetch the profile with processInstance joined for the response
  // profileId is guaranteed to be set since we just created it above
  const profile = await db.query.profiles.findFirst({
    where: { id: instance.profileId! },
    with: {
      processInstance: true,
    },
  });

  if (!profile) {
    throw new CommonError('Failed to fetch created decision profile');
  }

  return profile;
};

/** Options for the public instance creation function (requires User) */
export type CreateInstanceFromTemplateOptions = {
  /** Defaults to the most recently created template when omitted */
  templateId?: string;
  /** Defaults to "New {template.name}" when omitted */
  name?: string;
  user: User;
};

const resolveTemplate = async (templateId?: string) => {
  if (templateId) {
    const record = await db._query.decisionProcesses.findFirst({
      where: (t, { eq }) => eq(t.id, templateId),
    });
    if (!record) {
      throw new NotFoundError(`Template '${templateId}' not found`);
    }
    return record;
  }

  const record = await db._query.decisionProcesses.findFirst({
    where: sql`${decisionProcesses.processSchema}->>'id' IS NOT NULL
      AND ${decisionProcesses.processSchema}->>'version' IS NOT NULL
      AND ${decisionProcesses.processSchema}->'phases' IS NOT NULL`,
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!record) {
    throw new NotFoundError('No decision process templates available');
  }
  return record;
};

/**
 * Creates a decision process instance from a template.
 * Validates the user, fetches the template, and delegates to createDecisionInstance.
 */
export const createInstanceFromTemplate = async ({
  templateId,
  name,
  user,
}: CreateInstanceFromTemplateOptions) => {
  const dbUser = await assertUserByAuthId(
    user.id,
    new UnauthorizedError('User must be authenticated'),
  );

  const ownerProfileId = dbUser.currentProfileId ?? dbUser.profileId;
  if (!ownerProfileId) {
    // TODO: profileId should not be nullable in the schema
    throw new UnauthorizedError('User must have an active profile');
  }

  // TODO: This shouldn't be a requirement in the future and we need to resolve that (SMS accounts for instance)
  if (!user.email) {
    throw new CommonError(
      'Failed to create decision process instance. User email was missing',
    );
  }

  const templateRecord = await resolveTemplate(templateId);
  const template = templateRecord.processSchema as DecisionSchemaDefinition;
  const instanceData = createInstanceDataFromTemplate({ template });

  return createDecisionInstance({
    processId: templateRecord.id,
    instanceData,
    name: name ?? `New ${templateRecord.name}`,
    ownerProfileId,
    stewardProfileId: ownerProfileId,
    creatorAuthUserId: user.id,
    creatorEmail: user.email,
  });
};
