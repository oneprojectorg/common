import { db } from '@op/db/client';
import { EntityType, ProcessStatus, processInstances, profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { createInstanceDataFromTemplate } from '../../lib/decisionSchemas/instanceData';
import { CommonError, UnauthorizedError } from '../../utils';
import { assertDecisionTemplate, assertUserByAuthId } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';

/**
 * Creates a decision process instance from a DecisionSchemaDefinition template.
 */
export async function createInstanceFromTemplate({
  data,
  user,
}: {
  data: {
    /** ID of the seeded template in decisionProcesses */
    templateId: string;
    name: string;
    description?: string;
    budget?: number;
  };
  user: User;
}) {
  const dbUser = await assertUserByAuthId(
    user.id,
    new UnauthorizedError('User must be authenticated'),
  );
  const ownerProfileId = dbUser.currentProfileId ?? dbUser.profileId;
  if (!ownerProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const template = await assertDecisionTemplate(data.templateId);

  const instanceData = createInstanceDataFromTemplate({
    template: template.schema,
    budget: data.budget,
  });

  const instance = await db.transaction(async (tx) => {
    // Create a DECISION profile for the instance
    const slug = await generateUniqueProfileSlug({
      name: `decision-${data.name}`,
      db: tx,
    });

    const [instanceProfile] = await tx
      .insert(profiles)
      .values({
        type: EntityType.DECISION,
        name: data.name,
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
        processId: data.templateId, // this naming has shifted and might need to be changed in the DB eventually
        name: '', // TODO: we will remove this constraint shortly from the DB
        description: data.description,
        instanceData,
        currentStateId: template.firstPhase.id,
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

  return instance;
}
