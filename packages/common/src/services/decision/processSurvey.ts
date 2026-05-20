import { db } from '@op/db/client';
import { decisionProcessSurveyResponses } from '@op/db/schema';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess, getIndividualProfileId } from '../access';

export type SurveyInternalData = Record<string, unknown>;

export interface SubmitProcessSurveyResponseInput {
  processInstanceId: string;
  internalData: SurveyInternalData;
  authUserId: string;
}

export interface GetProcessSurveyResponseInput {
  processInstanceId: string;
  authUserId: string;
}

export interface ProcessSurveyResponseResult {
  hasResponded: boolean;
  internalData: SurveyInternalData | null;
}

async function authorizeSurveyAccess({
  authUserId,
  processInstanceId,
}: {
  authUserId: string;
  processInstanceId: string;
}) {
  const [profileId, processInstance] = await Promise.all([
    getIndividualProfileId(authUserId),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: { id: true, profileId: true, ownerProfileId: true },
    }),
  ]);

  if (!processInstance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  await assertInstanceProfileAccess({
    user: { id: authUserId },
    instance: processInstance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [{ decisions: permission.READ }],
  });

  return profileId;
}

export const submitProcessSurveyResponse = async ({
  data,
}: {
  data: SubmitProcessSurveyResponseInput;
}): Promise<ProcessSurveyResponseResult> => {
  const { authUserId, processInstanceId, internalData } = data;
  if (!authUserId) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    const profileId = await authorizeSurveyAccess({
      authUserId,
      processInstanceId,
    });

    const [row] = await db
      .insert(decisionProcessSurveyResponses)
      .values({
        processInstanceId,
        submittedByProfileId: profileId,
        internalData,
      })
      .onConflictDoUpdate({
        target: [
          decisionProcessSurveyResponses.processInstanceId,
          decisionProcessSurveyResponses.submittedByProfileId,
        ],
        set: {
          internalData: decisionProcessSurveyResponses.internalData,
        },
      })
      .returning();

    return {
      hasResponded: true,
      internalData: row?.internalData ?? internalData,
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    console.error('Error submitting survey response:', error);
    throw new CommonError('Failed to submit survey response');
  }
};

export const getProcessSurveyResponse = async ({
  data,
}: {
  data: GetProcessSurveyResponseInput;
}): Promise<ProcessSurveyResponseResult> => {
  const { authUserId, processInstanceId } = data;
  if (!authUserId) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    const profileId = await authorizeSurveyAccess({
      authUserId,
      processInstanceId,
    });

    const existing = await db.query.decisionProcessSurveyResponses.findFirst({
      where: {
        processInstanceId,
        submittedByProfileId: profileId,
      },
      columns: { internalData: true },
    });

    return {
      hasResponded: !!existing,
      internalData: existing?.internalData ?? null,
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    console.error('Error getting survey response:', error);
    throw new CommonError('Failed to get survey response');
  }
};
