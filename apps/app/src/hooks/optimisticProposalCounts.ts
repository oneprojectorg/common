/**
 * Optimistic count bumps for cached `decision.listProposals` data.
 *
 * The relationship mutations already patch `profile.getRelationships`, which is
 * what flips a toggle's pressed state. The count next to it lives on the
 * proposal rows in the list cache, so without this the number sits still until
 * the post-mutation refetch lands.
 *
 * Kept as a pure function over `unknown` because the same proposal can sit in
 * several cached lists at once (different filters, sorts, or the ballot's
 * non-infinite query). The caller matches every `listProposals` entry by path
 * and lets this walk whatever shape it finds.
 */

/** Count fields a relationship can move. */
export type ProposalCountField = 'likesCount' | 'followersCount';

type ProposalRow = Record<string, unknown> & { profileId?: unknown };

function bumpRow(
  row: ProposalRow,
  profileId: string,
  field: ProposalCountField,
  delta: number,
): ProposalRow {
  if (row.profileId !== profileId) {
    return row;
  }

  const current = typeof row[field] === 'number' ? (row[field] as number) : 0;

  // Clamp at zero: a stale row can already read 0 while the viewer's
  // relationship cache still says "liked", and a negative count would render.
  return { ...row, [field]: Math.max(0, current + delta) };
}

function bumpItems(
  items: unknown,
  profileId: string,
  field: ProposalCountField,
  delta: number,
): unknown {
  if (!Array.isArray(items)) {
    return items;
  }

  return items.map((item) =>
    item && typeof item === 'object'
      ? bumpRow(item as ProposalRow, profileId, field, delta)
      : item,
  );
}

/**
 * Returns `data` with the matching proposal's count moved by `delta`. Handles
 * both the flat `{ items }` result and the infinite `{ pages: [{ items }] }`
 * one, and returns the input untouched for anything it doesn't recognise.
 */
export function bumpProposalCount(
  data: unknown,
  profileId: string,
  field: ProposalCountField,
  delta: number,
): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const record = data as Record<string, unknown>;

  if (Array.isArray(record.pages)) {
    return {
      ...record,
      pages: record.pages.map((page) =>
        page && typeof page === 'object'
          ? {
              ...(page as Record<string, unknown>),
              items: bumpItems(
                (page as Record<string, unknown>).items,
                profileId,
                field,
                delta,
              ),
            }
          : page,
      ),
    };
  }

  if (Array.isArray(record.items)) {
    return {
      ...record,
      items: bumpItems(record.items, profileId, field, delta),
    };
  }

  // A bare proposal — what `decision.getProposal` caches for the detail view.
  if ('profileId' in record) {
    return bumpRow(record as ProposalRow, profileId, field, delta);
  }

  return data;
}
