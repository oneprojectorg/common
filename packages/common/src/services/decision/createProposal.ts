import { db, eq } from '@op/db/client';
import { proposals, processInstances, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import type { ProposalData, ProcessSchema, InstanceData } from './types';

export interface CreateProposalInput {
  processInstanceId: string;
  proposalData: ProposalData;
}

export const createProposal = async ({
  data,
  user,
}: {
  data: CreateProposalInput;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get the database user record to access currentProfileId
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authUserId, user.id),
    });

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Verify the process instance exists and get the process schema
    const instance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
      with: {
        process: true,
      },
    });

    if (!instance) {
      throw new NotFoundError('Process instance not found');
    }

    // Check if the current state allows proposals
    if (!instance.process) {
      throw new NotFoundError('Process definition not found');
    }

    const process = instance.process as any;
    const processSchema = process.processSchema as ProcessSchema;
    const instanceData = instance.instanceData as InstanceData;
    const currentStateId = instanceData.currentStateId || instance.currentStateId;
    
    const currentState = processSchema.states.find(s => s.id === currentStateId);
    if (!currentState) {
      throw new ValidationError('Invalid state in process instance');
    }

    // Check if proposals are allowed in current state
    if (currentState.config?.allowProposals === false) {
      throw new ValidationError(`Proposals are not allowed in the ${currentState.name} state`);
    }

    // TODO: Validate proposal data against processSchema.proposalTemplate
    // This would require JSON Schema validation utilities

    const [proposal] = await db
      .insert(proposals)
      .values({
        processInstanceId: data.processInstanceId,
        proposalData: data.proposalData,
        submittedByProfileId: dbUser.currentProfileId,
        status: 'submitted',
      })
      .returning();

    if (!proposal) {
      throw new CommonError('Failed to create proposal');
    }

    return proposal;
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error creating proposal:', error);
    throw new CommonError('Failed to create proposal');
  }
};