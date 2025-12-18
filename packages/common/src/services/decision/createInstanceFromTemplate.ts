import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  decisionProcesses,
  processInstances,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { createInstanceDataFromTemplate } from '../../lib/decisionSchemas/instanceData';
import type { DecisionSchemaDefinition } from '../../lib/decisionSchemas/types';
import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
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

  // Get the template
  const template = await db.query.decisionProcesses.findFirst({
    where: eq(decisionProcesses.id, data.templateId),
  });
  if (!template) {
    throw new NotFoundError('Template not found');
  }

  const templateSchema = template.processSchema as DecisionSchemaDefinition;

  // Validate that this is a DecisionSchemaDefinition (has phases)
  if (!templateSchema.phases || !Array.isArray(templateSchema.phases)) {
    throw new CommonError(
      'Invalid template: expected DecisionSchemaDefinition with phases',
    );
  }

  const firstPhase = templateSchema.phases[0];
  if (!firstPhase) {
    throw new CommonError('Template must have at least one phase');
  }

  const instanceData = createInstanceDataFromTemplate({
    template: templateSchema,
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
        currentStateId: firstPhase.id, // Use first phase as initial state
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
