import type { User } from '@op/supabase/lib';

import type { ListProposalsInput } from './listProposals';
import { resolveProposalListScope } from './resolveProposalListScope';
import { selectProposalLocations } from './selectProposalLocations';

/**
 * Every located proposal visible in the phase being viewed — the pin source for
 * the phase-scoped browse map, so the map isn't capped by the list's page size.
 *
 * Scoping comes from `resolveProposalListScope` (the exact
 * access/phase/visibility/moderation filter `listProposals` applies), so a
 * proposal that dropped out at a phase transition stops being pinned the moment
 * it stops being listed. The results tab spans every phase instead — it uses
 * `listAllProposalLocations`.
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

  return { proposals: await selectProposalLocations({ buildWhereClause }) };
};
