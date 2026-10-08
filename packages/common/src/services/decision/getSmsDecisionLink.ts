import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';

export interface SmsDecisionLink {
  name: string;
  url: string;
}

export const decisionUrl = (slug: string): string =>
  `${OPURLConfig('APP').ENV_URL}/decisions/${slug}`;

export async function getSmsDecisionLink({
  authUserId,
  slug,
}: {
  authUserId: string;
  slug: string;
}): Promise<SmsDecisionLink | null> {
  const profile = await db.query.profiles.findFirst({
    where: { slug, type: EntityType.DECISION },
    columns: { id: true, name: true, slug: true },
    with: { processInstance: { columns: { id: true } } },
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

  return { name: profile.name, url: decisionUrl(profile.slug) };
}
