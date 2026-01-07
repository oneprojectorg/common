import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
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
  budget,
  phases,
  user,
}: {
  /** ID of the process template in the DB */
  templateId: string;
  name: string;
  description?: string;
  budget?: number;
  /** Optional phase date overrides */
  phases?: Array<{
    phaseId: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
  }>;
  user: User;
}) => {
  const dbUser = await assertUserByAuthId(
    user.id,
    new UnauthorizedError('User must be authenticated'),
  );

  const ownerProfileId = dbUser.currentProfileId ?? dbUser.profileId;
  if (!ownerProfileId) {
    // TODO: profileId should not be nullable in the schema
    throw new UnauthorizedError('User must have an active profile');
  }

  // Fetch template from database (throws NotFoundError if not found)
  const template = await getTemplate(templateId);

  const instanceData = createInstanceDataFromTemplate({
    template,
    budget,
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

    return newInstance;
  });

  // Create scheduled transitions for phases that have date-based advancement AND actual dates set
  const hasScheduledDatePhases = instanceData.phases.some(
    (phase) =>
      phase.rules?.advancement?.method === 'date' && phase.plannedStartDate,
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
  const profile = await db.query.profiles.findFirst({
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
