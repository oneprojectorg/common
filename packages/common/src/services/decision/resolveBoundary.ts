import { db, sql } from '@op/db/client';
import { decisionBoundaries } from '@op/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

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

/**
 * Returns the set of district-category labels in use for the given decision
 * profile — every boundary whose `name` flows through to a `proposalCategories`
 * link (i.e. has a non-null `taxonomyTermId`). Used by the location-tagging
 * helpers to strip any previously-applied district label from a proposal's
 * category set before tagging the new one, so a pin moved across districts
 * doesn't leave both districts tagged.
 *
 * Reads from `db` directly — does NOT accept a `tx`. Boundary rows are not
 * mutated by proposal writes, so a tx-less read from inside a proposal-write
 * transaction is safe and intentional (matches `resolveBoundary` /
 * `hasDecisionBoundaries` in this file).
 */
export async function listBoundaryLabels({
  profileId,
}: {
  profileId: string;
}): Promise<Set<string>> {
  const rows = await db
    .select({ name: decisionBoundaries.name })
    .from(decisionBoundaries)
    .where(
      and(
        eq(decisionBoundaries.profileId, profileId),
        isNotNull(decisionBoundaries.taxonomyTermId),
      ),
    );

  return new Set(rows.map((row) => row.name));
}
