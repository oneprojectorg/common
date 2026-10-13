import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

export interface SmsDecision {
  profileId: string;
  processInstanceId: string;
  name: string;
  slug: string;
  url: string;
  currentPhase: PhaseInstanceData | null;
}

export const decisionUrl = (slug: string): string =>
  `${OPURLConfig('APP').ENV_URL}/decisions/${slug}`;

export async function findSmsDecision({
  authUserId,
  slug,
}: {
  authUserId: string;
  slug: string;
}): Promise<SmsDecision | null> {
  const profile = await db.query.profiles.findFirst({
    where: { slug, type: EntityType.DECISION },
    columns: { id: true, name: true, slug: true },
    with: {
      processInstance: {
        columns: { id: true, instanceData: true, currentStateId: true },
      },
    },
  });

  if (!profile?.processInstance) {
    return null;
  }

  try {
    await assertProfileAccess({
      user: { id: authUserId },
      profileId: profile.id,
      permissions: [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ],
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return null;
    }
    throw error;
  }

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
    url: decisionUrl(profile.slug),
    currentPhase,
  };
}
