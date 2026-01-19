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
import { createTransitionsForProcess } from './createTransitionsForProcess';
import { getTemplate } from './getTemplate';
import { createInstanceDataFromTemplate } from './schemas/instanceData';

/**
 * Creates a decision process instance from a DecisionSchemaDefinition template.
 */
export const createInstanceFromTemplate = async ({
  templateId,
  name,
  description,
  phases,
  user,
}: {
  /** ID of the process template in the DB */
  templateId: string;
  name: string;
  description?: string;
  /** Optional phase overrides (dates and settings) */
  phases?: Array<{
    phaseId: string;
    startDate?: string;
    endDate?: string;
    settings?: Record<string, unknown>;
  }>;
  user: User;
}) => {
  // Fetch user and template in parallel (they're independent)
  const [dbUser, template] = await Promise.all([
    assertUserByAuthId(
      user.id,
      new UnauthorizedError('User must be authenticated'),
    ),
    getTemplate(templateId),
  ]);

  const ownerProfileId = dbUser.currentProfileId ?? dbUser.profileId;
  if (!ownerProfileId) {
    // TODO: profileId should not be nullable in the schema
    throw new UnauthorizedError('User must have an active profile');
  }

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
        profileId: instanceProfile.id,
        status: ProcessStatus.DRAFT,
      })
      .returning();

    if (!newInstance) {
      throw new CommonError('Failed to create decision process instance');
    }

    // TODO: This shouldn't be a requirement in the future and we need to resolve that (SMS accounts for instance)
    if (!user.email) {
      throw new CommonError(
        'Failed to create decision process instance. User email was missing',
      );
    }

    // Add the creator as a profile user with Admin role
    const [[newProfileUser], adminRole] = await Promise.all([
      tx
        .insert(profileUsers)
        .values({
          profileId: instanceProfile.id,
          authUserId: user.id,
          email: user.email,
        })
        .returning(),
      tx._query.accessRoles.findFirst({
        where: (table, { eq }) => eq(table.name, 'Admin'),
      }),
    ]);

    if (!newProfileUser) {
      throw new CommonError('Failed to add creator as profile user');
    }

    if (adminRole) {
      await tx.insert(profileUserToAccessRoles).values({
        profileUserId: newProfileUser.id,
        accessRoleId: adminRole.id,
      });
    }

    return newInstance;
  });

  // Create scheduled transitions for phases that have date-based advancement AND actual dates set
  const hasScheduledDatePhases = instanceData.phases.some(
    (phase) => phase.rules?.advancement?.method === 'date' && phase.startDate,
  );

  if (hasScheduledDatePhases) {
    try {
      await createTransitionsForProcess({ processInstance: instance });
    } catch (error) {
      // Log but don't fail instance creation if transitions can't be created
      console.error(
        'Failed to create transitions for process instance:',
        error,
      );
    }
  }

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
