import { and, db, eq, isNull, sql } from '@op/db/client';
import { proposals } from '@op/db/schema';

/**
 * Marks a proposal as moderation-detached: pins `moderation_detached_at` so
 * every proposal query filters it out, including admin lists. Called from the
 * webhook path when Checkstep returns a CSAM verdict — the content must not
 * remain reachable to decision admins, only to the incident response process.
 *
 * Idempotent: if the row is already detached, the timestamp is not overwritten
 * (so the original detach time survives a duplicate/replayed webhook). A
 * missing row is silently tolerated — the provider callback races the item
 * deletion in either direction, and we don't want to 400 into retries.
 */
export const detachProposalForModeration = async ({
  proposalId,
}: {
  proposalId: string;
}): Promise<{ detached: boolean }> => {
  const [row] = await db
    .update(proposals)
    .set({ moderationDetachedAt: sql`(now() AT TIME ZONE 'utc'::text)` })
    .where(
      and(eq(proposals.id, proposalId), isNull(proposals.moderationDetachedAt)),
    )
    .returning({ id: proposals.id });
  return { detached: Boolean(row) };
};
