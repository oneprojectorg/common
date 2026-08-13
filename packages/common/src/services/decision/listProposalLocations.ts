import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import type { ListProposalsInput } from './listProposals';
import { parseProposalData } from './proposalDataSchema';
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
    columns: {
      id: true,
      processInstanceId: true,
      proposalData: true,
      status: true,
      visibility: true,
      profileId: true,
      submittedByProfileId: true,
    },
    with: {
      submittedBy: {
        with: {
          avatarImage: true,
          profileUsers: {
            columns: {},
            with: { authUser: { columns: { isAnonymous: true } } },
          },
        },
      },
      profile: true,
    },
  });

  const proposals = rows.flatMap((proposal) => {
    // Drafts and any proposal without coordinates never render a pin.
    const proposalData = parseProposalData(proposal.proposalData);
    if (!proposalData.location) {
      return [];
    }

    const rawSubmittedBy = Array.isArray(proposal.submittedBy)
      ? proposal.submittedBy[0]
      : proposal.submittedBy;
    const submittedBy = rawSubmittedBy
      ? (() => {
          const { profileUsers, ...author } = rawSubmittedBy;
          return {
            ...author,
            isAnonymous: Boolean(
              profileUsers?.some(
                (pu: { authUser: { isAnonymous: boolean } | null }) =>
                  pu.authUser?.isAnonymous,
              ),
            ),
          };
        })()
      : rawSubmittedBy;
    const profile = Array.isArray(proposal.profile)
      ? proposal.profile[0]
      : proposal.profile;

    // Map pins only: no `budgetCurrency` and no `proposalTemplate`, because
    // the hovercard these feed renders no money. Anything here that starts
    // rendering a budget has to ship one — `resolveProposalSystemFields`
    // falls back to USD with neither, which reads as a real currency on a
    // process denominated in something else.
    return [
      {
        id: proposal.id,
        processInstanceId: proposal.processInstanceId,
        proposalData,
        status: proposal.status,
        visibility: proposal.visibility,
        profileId: proposal.profileId,
        submittedBy,
        profile,
      },
    ];
  });

  return { proposals };
};
