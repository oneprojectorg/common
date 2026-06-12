import { type DbClient, sql } from '@op/db/client';
import { decisionBoundaries } from '@op/db/schema';

/**
 * Canonical form used to match a boundary `name` against a category `label`.
 * Mirrors the `lower(name)` unique index on `decision_boundaries`.
 */
export function normalizeBoundaryName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Links any boundary whose name matches `label` (case-insensitively) to the
 * given taxonomy term, so the boundary's geometry auto-tags proposals with that
 * category. Idempotent and a no-op when no boundary matches — safe to call for
 * every proposal category, district or topical.
 */
export async function linkBoundaryToCategoryTerm(
  db: DbClient,
  taxonomyTermId: string,
  label: string,
): Promise<void> {
  const normalized = normalizeBoundaryName(label);

  if (!normalized) {
    return;
  }

  await db
    .update(decisionBoundaries)
    .set({ taxonomyTermId })
    .where(sql`lower(${decisionBoundaries.name}) = ${normalized}`);
}
