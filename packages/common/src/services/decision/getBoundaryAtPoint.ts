import type { AccessUser } from '../access';
import { assertDecisionProfileReadAccess } from './assertDecisionProfileReadAccess';
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
    assertDecisionProfileReadAccess({
      user,
      profileId,
    }),
    resolveBoundary({ lat, lng, profileId }),
    hasDecisionBoundaries({ profileId }),
  ]);

  return { boundary, boundariesConfigured };
}
