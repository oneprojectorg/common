import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import type { ListProposalsInput } from './listProposals';
import {
  projectProposalLocation,
  proposalLocationColumns,
  proposalLocationWith,
} from './projectProposalLocation';
import { resolveProposalListScope } from './resolveProposalListScope';

/**
 * Filters a `listProposals`-style query down to the fields a map needs and
 * returns **every** matching proposal that carries a location — no pagination.
 *
 * The map plots one pin per located proposal, so it can't be capped by the
 * list's page size. This reuses `resolveProposalListScope` (the exact
 * access/phase/visibility/moderation filter `listProposals` applies) so pins
 * never leak a proposal the viewer isn't allowed to see, and skips the heavy
 * per-proposal enrichment (documents, relationship counts) the pins/hovercards
 * don't use.
 */
export const listProposalLocations = async ({
  input,
  user,
}: {
  // Cursor/limit are meaningless here (all rows are returned), so the caller
  // passes the same filter fields it would give `listProposals`.
  input: Omit<ListProposalsInput, 'cursor' | 'limit'>;
  user: User | undefined;
}) => {
  const { isEmpty, buildWhereClause } = await resolveProposalListScope({
    input,
    user,
  });

  if (isEmpty) {
    return { proposals: [] };
  }

  const rows = await db.query.proposals.findMany({
    where: {
      RAW: (table) => buildWhereClause(table),
    },
    columns: proposalLocationColumns,
    with: proposalLocationWith,
  });

  // Drafts and any proposal without coordinates never render a pin.
  const proposals = rows.flatMap((row) => projectProposalLocation(row));

  return { proposals };
};
