import { db } from '@op/db/client';
import {
  decisionProcessSurveyResponses,
  decisionProcessSurveySubmitters,
} from '@op/db/schema';
import { assertAccess, collapseRoles, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getIndividualProfileId, getProfileAccessUser } from '../access';
import { fromDecisionBitField } from './permissions';

type ProfileAccessUser = Awaited<ReturnType<typeof getProfileAccessUser>>;

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
  profileUser: ProfileAccessUser;
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

  if (!processInstance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const profileUser = await getProfileAccessUser({
    user: { id: authUserId },
    profileId: processInstance.profileId,
  });

  assertAccess({ decisions: permission.READ }, profileUser?.roles ?? []);

  return { profileId, processInstance, profileUser };
}

function getSurveyMeta({
  processInstance,
  submittedByProfileId,
  profileUser,
  locale,
}: {
  processInstance: ProcessInstanceForSurvey;
  submittedByProfileId: string;
  profileUser: ProfileAccessUser;
  locale: string;
}) {
  const roles = (profileUser?.roles ?? []).map((role) => ({
    id: role.id,
    name: role.name,
  }));

  const decisionsBits =
    collapseRoles(profileUser?.roles ?? [])['decisions'] ?? 0;

  return {
    roles,
    capabilities: fromDecisionBitField(decisionsBits),
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

  const { profileId, processInstance, profileUser } =
    await authorizeSurveyAccess({
      authUserId,
      processInstanceId,
    });

  const meta = getSurveyMeta({
    processInstance,
    submittedByProfileId: profileId,
    profileUser,
    locale,
  });

  const enrichedInternalData: SurveyInternalData = {
    ...internalData,
    _meta: meta,
  };

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(decisionProcessSurveySubmitters)
      .values({
        processInstanceId,
        submittedByProfileId: profileId,
      })
      .onConflictDoNothing({
        target: [
          decisionProcessSurveySubmitters.processInstanceId,
          decisionProcessSurveySubmitters.submittedByProfileId,
        ],
      })
      .returning({ id: decisionProcessSurveySubmitters.id });

    if (inserted.length === 0) {
      return;
    }

    await tx.insert(decisionProcessSurveyResponses).values({
      processInstanceId,
      internalData: enrichedInternalData,
    });
  });

  return { hasResponded: true };
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

  const { profileId } = await authorizeSurveyAccess({
    authUserId,
    processInstanceId,
  });

  const existing = await db.query.decisionProcessSurveySubmitters.findFirst({
    where: {
      processInstanceId,
      submittedByProfileId: profileId,
    },
    columns: { id: true },
  });

  return { hasResponded: !!existing };
};
