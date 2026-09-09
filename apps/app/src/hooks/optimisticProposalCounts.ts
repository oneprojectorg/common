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

/**
 * Narrows cache data structurally instead of asserting: `typeof x === 'object'`
 * alone leaves TypeScript with `object`, which can't be indexed.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function bumpRow(
  row: ProposalRow,
  profileId: string,
  field: ProposalCountField,
  delta: number,
): ProposalRow {
  if (row.profileId !== profileId) {
    return row;
  }

  const value = row[field];
  const current = typeof value === 'number' ? value : 0;

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
    isRecord(item) ? bumpRow(item, profileId, field, delta) : item,
  );
}

/** Rewrites the envelope's `items` array — every list procedure keys on it. */
function bumpRowArray(
  container: Record<string, unknown>,
  profileId: string,
  field: ProposalCountField,
  delta: number,
): Record<string, unknown> {
  if (!Array.isArray(container.items)) {
    return container;
  }

  return {
    ...container,
    items: bumpItems(container.items, profileId, field, delta),
  };
}

/**
 * Returns `data` with the matching proposal's count moved by `delta`. Handles
 * both the flat `{ items }` result and the infinite `{ pages: [...] }` one, and
 * returns the input untouched for anything it doesn't recognise.
 */
export function bumpProposalCount(
  data: unknown,
  profileId: string,
  field: ProposalCountField,
  delta: number,
): unknown {
  if (!isRecord(data)) {
    return data;
  }

  if (Array.isArray(data.pages)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        isRecord(page) ? bumpRowArray(page, profileId, field, delta) : page,
      ),
    };
  }

  if (Array.isArray(data.items)) {
    return bumpRowArray(data, profileId, field, delta);
  }

  // A bare proposal — what `decision.getProposal` caches for the detail view.
  if ('profileId' in data) {
    return bumpRow(data, profileId, field, delta);
  }

  return data;
}
