import { db } from '@op/db/client';
import { EntityType, ProcessStatus } from '@op/db/schema';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

export interface PublishedDecision {
  profileId: string;
  processInstanceId: string;
  name: string;
  slug: string;
  currentPhase: PhaseInstanceData | null;
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
    columns: { id: true, name: true, slug: true },
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
  const currentPhase =
    getInstancePhases(instanceData).find(
      (phase) => phase.phaseId === currentStateId,
    ) ?? null;

  return {
    profileId: profile.id,
    processInstanceId: id,
    name: profile.name,
    slug: profile.slug,
    currentPhase,
  };
}
