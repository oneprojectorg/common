import { permission } from 'access-zones';

import type { AccessUser } from '../access';
import { assertProfileAccess } from '../assert';
import {
  type ResolvedBoundary,
  hasDecisionBoundaries,
  resolveBoundary,
} from './resolveBoundary';

export interface BoundaryAtPoint {
  boundary: ResolvedBoundary | null;
  /** False when the decision has no boundaries, so any point is valid. */
  boundariesConfigured: boolean;
}

/**
 * Returns the boundary of a decision that contains the given point, for a
 * caller who can read that decision.
 */
export async function getBoundaryAtPoint({
  user,
  lat,
  lng,
  profileId,
}: {
  user: AccessUser;
  lat: number;
  lng: number;
  profileId: string;
}): Promise<BoundaryAtPoint> {
  const [, boundary, boundariesConfigured] = await Promise.all([
    assertProfileAccess({
      user,
      profileId,
      permissions: { decisions: permission.READ },
    }),
    resolveBoundary({ lat, lng, profileId }),
    hasDecisionBoundaries({ profileId }),
  ]);

  return { boundary, boundariesConfigured };
}
