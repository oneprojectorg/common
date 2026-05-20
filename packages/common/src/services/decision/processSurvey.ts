import { db } from '@op/db/client';
import { decisionProcessSurveyResponses } from '@op/db/schema';
import { permission } from 'access-zones';
import { sql } from 'drizzle-orm';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  getIndividualProfileId,
  getProfileAccessUser,
} from '../access';
import { fromDecisionBitField } from './permissions';

export type SurveyInternalData = Record<string, unknown>;

interface ProcessInstanceForSurvey {
  id: string;
  profileId: string | null;
  ownerProfileId: string | null;
  status: string | null;
  currentStateId: string | null;
}

export interface SubmitProcessSurveyResponseInput {
  processInstanceId: string;
  internalData: SurveyInternalData;
  locale: string;
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
}): Promise<{
  profileId: string;
  processInstance: ProcessInstanceForSurvey;
}> {
  const [profileId, processInstance] = await Promise.all([
    getIndividualProfileId(authUserId),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: {
        id: true,
        profileId: true,
        ownerProfileId: true,
        status: true,
        currentStateId: true,
      },
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

  return { profileId, processInstance };
}

async function getSurveyMeta({
  authUserId,
  processInstance,
  submittedByProfileId,
  locale,
}: {
  authUserId: string;
  processInstance: ProcessInstanceForSurvey;
  submittedByProfileId: string;
  locale: string;
}) {
  const profileUser = processInstance.profileId
    ? await getProfileAccessUser({
        user: { id: authUserId },
        profileId: processInstance.profileId,
      })
    : null;

  const roles = (profileUser?.roles ?? []).map((role) => ({
    id: role.id,
    name: role.name,
  }));

  let decisionsBitfield = 0;
  for (const role of profileUser?.roles ?? []) {
    decisionsBitfield |= role.access?.decisions ?? 0;
  }

  return {
    roles,
    capabilities: fromDecisionBitField(decisionsBitfield),
    isOwner: processInstance.ownerProfileId === submittedByProfileId,
    processStatus: processInstance.status,
    phase: processInstance.currentStateId,
    locale,
  };
}

export const submitProcessSurveyResponse = async ({
  data,
}: {
  data: SubmitProcessSurveyResponseInput;
}): Promise<ProcessSurveyResponseResult> => {
  const { authUserId, processInstanceId, internalData, locale } = data;
  if (!authUserId) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    const { profileId, processInstance } = await authorizeSurveyAccess({
      authUserId,
      processInstanceId,
    });

    const meta = await getSurveyMeta({
      authUserId,
      processInstance,
      submittedByProfileId: profileId,
      locale,
    });

    const enrichedInternalData: SurveyInternalData = {
      ...internalData,
      _meta: meta,
    };

    const [row] = await db
      .insert(decisionProcessSurveyResponses)
      .values({
        processInstanceId,
        submittedByProfileId: profileId,
        internalData: enrichedInternalData,
      })
      .onConflictDoUpdate({
        target: [
          decisionProcessSurveyResponses.processInstanceId,
          decisionProcessSurveyResponses.submittedByProfileId,
        ],
        set: {
          internalData: sql`excluded.internal_data`,
        },
      })
      .returning();

    return {
      hasResponded: true,
      internalData: row?.internalData ?? enrichedInternalData,
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
    const { profileId } = await authorizeSurveyAccess({
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
