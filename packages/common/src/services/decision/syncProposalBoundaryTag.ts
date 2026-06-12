import { type DbClient, and, eq, sql } from '@op/db/client';
import { decisionBoundaries, proposalCategories } from '@op/db/schema';

import { normalizeLocation } from './proposalDataSchema';

/**
 * Auto-tags a proposal with the category of the boundary its location falls in.
 *
 * Resolves the proposal's pin against `decision_boundaries` via `ST_Contains`
 * and, when the containing boundary is linked to a category, ensures that
 * category is on the proposal's `proposalCategories`. Any prior boundary-derived
 * tag is removed first (identified as a term that some boundary links to), so a
 * moved pin re-tags cleanly; manually chosen, non-boundary categories are left
 * untouched.
 *
 * Mirrors `syncProposalProfileLocation`: must run inside the proposal write
 * transaction (`tx`), degrades to "no tag" on a bad/absent location, and never
 * throws — a tagging failure must not fail the surrounding write.
 */
export async function syncProposalBoundaryTag(
  tx: DbClient,
  proposalId: string,
  proposalData: unknown,
): Promise<void> {
  try {
    // Drop any existing boundary-derived tag (a term linked from some boundary)
    // so a moved/cleared pin doesn't leave a stale district behind.
    await tx.delete(proposalCategories).where(
      and(
        eq(proposalCategories.proposalId, proposalId),
        sql`${proposalCategories.taxonomyTermId} IN (
          SELECT ${decisionBoundaries.taxonomyTermId}
          FROM ${decisionBoundaries}
          WHERE ${decisionBoundaries.taxonomyTermId} IS NOT NULL
        )`,
      ),
    );

    const raw =
      proposalData && typeof proposalData === 'object'
        ? (proposalData as Record<string, unknown>).location
        : undefined;

    const location = normalizeLocation(raw);

    if (!location) {
      return;
    }

    const [match] = await tx
      .select({ taxonomyTermId: decisionBoundaries.taxonomyTermId })
      .from(decisionBoundaries)
      .where(
        and(
          sql`${decisionBoundaries.taxonomyTermId} IS NOT NULL`,
          sql`ST_Contains(${decisionBoundaries.boundary}, ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326))`,
        ),
      )
      .limit(1);

    if (match?.taxonomyTermId) {
      await tx
        .insert(proposalCategories)
        .values({ proposalId, taxonomyTermId: match.taxonomyTermId })
        .onConflictDoNothing();
    }
  } catch (error) {
    console.error('Error syncing proposal boundary tag:', error);
  }
}
