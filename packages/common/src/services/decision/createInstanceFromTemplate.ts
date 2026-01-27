import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';
import { createDecisionRole } from './decisionRoles';
import { getTemplate } from './getTemplate';
import {
  type PhaseOverride,
  createInstanceDataFromTemplate,
} from './schemas/instanceData';

/** Options for the core instance creation function (no auth required) */
export type CreateInstanceFromTemplateCoreOptions = {
  templateId: string;
  name: string;
  description?: string;
  phases?: PhaseOverride[];
  ownerProfileId: string;
  creatorAuthUserId: string;
  creatorEmail: string;
  stewardProfileId?: string;
  /** Defaults to DRAFT */
  status?: ProcessStatus;
};

/**
 * Core logic for creating a decision process instance from a template.
 * This function does not require a User object - it takes primitive values directly,
 * making it suitable for use in tests and internal services.
 */
export const createInstanceFromTemplateCore = async ({
  templateId,
  name,
  description,
  phases,
  ownerProfileId,
  creatorAuthUserId,
  creatorEmail,
  stewardProfileId,
  status = ProcessStatus.DRAFT,
}: CreateInstanceFromTemplateCoreOptions) => {
  const template = await getTemplate(templateId);

  const instanceData = createInstanceDataFromTemplate({
    template,
    phaseOverrides: phases,
  });

  const instance = await db.transaction(async (tx) => {
    // Create a DECISION profile for the instance
    const slug = await generateUniqueProfileSlug({
      name: `decision-${name}`,
      db: tx,
    });

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
        processId: templateId, // this naming has shifted and might need to be changed in the DB eventually
        name: '', // TODO: we will remove this constraint shortly from the DB
        description,
        instanceData,
        currentStateId: instanceData.currentPhaseId, // DB column is currentStateId but stores phaseId
        ownerProfileId,
        stewardProfileId,
        profileId: instanceProfile.id,
        status,
      })
      .returning();

    if (!newInstance) {
      throw new CommonError('Failed to create decision process instance');
    }

    // Create default roles for the decision instance
    const [adminRole] = await Promise.all([
      createDecisionRole({
        name: 'Admin',
        profileId: instanceProfile.id,
        permissions: {
          profile: {
            type: 'acrud',
            value: {
              admin: true,
              create: true,
              read: true,
              update: true,
              delete: true,
            },
          },
          decisions: {
            type: 'decision',
            value: {
              create: true,
              read: true,
              update: true,
              delete: true,
              admin: true,
              inviteMembers: true,
              review: true,
              submitProposals: true,
              vote: true,
            },
          },
        },
        tx,
      }),
      createDecisionRole({
        name: 'Participant',
        profileId: instanceProfile.id,
        permissions: {
          profile: {
            type: 'acrud',
            value: {
              admin: false,
              create: false,
              read: true,
              update: false,
              delete: false,
            },
          },
          decisions: {
            type: 'decision',
            value: {
              create: false,
              read: true,
              update: false,
              delete: false,
              admin: false,
              inviteMembers: false,
              review: false,
              submitProposals: true,
              vote: true,
            },
          },
        },
        tx,
      }),
    ]);

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
  const profile = await db._query.profiles.findFirst({
    where: eq(profiles.id, instance.profileId!),
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
  templateId: string;
  name: string;
  description?: string;
  phases?: PhaseOverride[];
  user: User;
};

/**
 * Creates a decision process instance from a template.
 * Validates the user and delegates to createInstanceFromTemplateCore.
 */
export const createInstanceFromTemplate = async ({
  templateId,
  name,
  description,
  phases,
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

  return createInstanceFromTemplateCore({
    templateId,
    name,
    description,
    phases,
    ownerProfileId,
    stewardProfileId: ownerProfileId,
    creatorAuthUserId: user.id,
    creatorEmail: user.email,
  });
};
