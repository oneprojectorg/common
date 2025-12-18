import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  decisionProcesses,
  processInstances,
  profiles,
  users,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import {
  createInstanceDataFromTemplate,
  type PhaseSchedule,
} from '../../lib/voting-schemas/instanceData';
import type { VotingSchemaDefinition } from '../../lib/voting-schemas/types';
import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { generateUniqueProfileSlug } from '../profile/utils';

export interface CreateInstanceFromTemplateInput {
  /** ID of the seeded template in decisionProcesses */
  processId: string;
  name: string;
  description?: string;
  budget?: number;
  phases?: PhaseSchedule[];
}

/**
 * Creates a decision process instance from a VotingSchemaDefinition template.
 * This creates both a DECISION profile and the process instance.
 */
export async function createInstanceFromTemplate({
  data,
  user,
}: {
  data: CreateInstanceFromTemplateInput;
  user: User;
}) {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  // Get user's profile
  const dbUser = await db.query.users.findFirst({
    where: eq(users.authUserId, user.id),
  });
  const ownerProfileId = dbUser?.currentProfileId ?? dbUser?.profileId;
  if (!dbUser || !ownerProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  // Get the template/process
  const process = await db.query.decisionProcesses.findFirst({
    where: eq(decisionProcesses.id, data.processId),
  });
  if (!process) {
    throw new NotFoundError('Template not found');
  }

  const template = process.processSchema as VotingSchemaDefinition;

  // Validate that this is a VotingSchemaDefinition (has phases)
  if (!template.phases || !Array.isArray(template.phases)) {
    throw new CommonError(
      'Invalid template: expected VotingSchemaDefinition with phases',
    );
  }

  const firstPhase = template.phases[0];
  if (!firstPhase) {
    throw new CommonError('Template must have at least one phase');
  }

  const instanceData = createInstanceDataFromTemplate({
    template,
    budget: data.budget,
    phases: data.phases,
  });

  try {
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
          processId: data.processId,
          name: data.name,
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
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error creating instance from template:', error);
    throw new CommonError('Failed to create decision process instance');
  }
}
