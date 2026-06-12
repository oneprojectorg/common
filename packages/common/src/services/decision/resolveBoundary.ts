import { db, sql } from '@op/db/client';
import { decisionBoundaries } from '@op/db/schema';

export interface ResolvedBoundary {
  id: string;
  name: string;
  /** The linked proposal category term, or null if the boundary is unlinked. */
  taxonomyTermId: string | null;
}

/**
 * Returns the boundary whose polygon contains the given point, or null when the
 * point falls outside every boundary. Powers the live picker badge and the
 * proposal location validation. Boundaries are deployment-global for now.
 */
export async function resolveBoundary({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<ResolvedBoundary | null> {
  const [match] = await db
    .select({
      id: decisionBoundaries.id,
      name: decisionBoundaries.name,
      taxonomyTermId: decisionBoundaries.taxonomyTermId,
    })
    .from(decisionBoundaries)
    .where(
      sql`ST_Contains(${decisionBoundaries.boundary}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))`,
    )
    .limit(1);

  return match ?? null;
}
