import { db, sql } from '@op/db/client';
import { decisionBoundaries } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

export interface ResolvedBoundary {
  id: string;
  name: string;
  /** The linked proposal category term, or null if the boundary is unlinked. */
  taxonomyTermId: string | null;
}

/**
 * Returns the boundary whose polygon contains the given point within the given
 * decision profile, or null when the point falls outside every boundary owned
 * by that profile. Powers the live picker badge and the proposal location
 * validation.
 */
export async function resolveBoundary({
  lat,
  lng,
  profileId,
}: {
  lat: number;
  lng: number;
  profileId: string;
}): Promise<ResolvedBoundary | null> {
  const [match] = await db
    .select({
      id: decisionBoundaries.id,
      name: decisionBoundaries.name,
      taxonomyTermId: decisionBoundaries.taxonomyTermId,
    })
    .from(decisionBoundaries)
    .where(
      and(
        eq(decisionBoundaries.profileId, profileId),
        sql`ST_Contains(${decisionBoundaries.boundary}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))`,
      ),
    )
    .limit(1);

  return match ?? null;
}

/**
 * Whether any boundaries are configured for the given decision profile. When
 * none exist the picker places no restriction on where a pin can go (any spot
 * is valid for that decision) — the out-of-area check only applies once the
 * profile has imported its boundaries.
 */
export async function hasDecisionBoundaries({
  profileId,
}: {
  profileId: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ one: sql`1` })
    .from(decisionBoundaries)
    .where(eq(decisionBoundaries.profileId, profileId))
    .limit(1);

  return row != null;
}
