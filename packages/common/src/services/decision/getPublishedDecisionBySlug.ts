import { db } from '@op/db/client';
import { EntityType, ProcessStatus } from '@op/db/schema';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import {
  type CurrentPhaseSummary,
  summarizeCurrentPhase,
} from './summarizeCurrentPhase';

export interface PublishedDecision extends CurrentPhaseSummary {
  processInstanceId: string;
  name: string;
}

export async function getPublishedDecisionBySlug({
  authUserId,
  slug,
}: {
  authUserId: string;
  slug: string;
}): Promise<PublishedDecision> {
  const profile = await db.query.profiles.findFirst({
    where: { slug, type: EntityType.DECISION },
    columns: { id: true, name: true },
    with: {
      processInstance: {
        columns: {
          id: true,
          status: true,
          instanceData: true,
          currentStateId: true,
        },
      },
    },
  });

  if (
    !profile?.processInstance ||
    profile.processInstance.status !== ProcessStatus.PUBLISHED
  ) {
    throw new NotFoundError('Decision', slug);
  }

  await assertProfileAccess({
    user: { id: authUserId },
    profileId: profile.id,
    permissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
  });

  const { id, instanceData, currentStateId } = profile.processInstance;

  return {
    processInstanceId: id,
    name: profile.name,
    ...summarizeCurrentPhase({ instanceData, currentStateId }),
  };
}
