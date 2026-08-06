import { type SQL, db } from '@op/db/client';
import type { proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import {
  type ListProposalsInput,
  proposalProfileColumns,
} from './listProposals';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalListScope } from './resolveProposalListScope';

/**
 * Every located proposal visible in the phase being viewed — the pin source for
 * the phase-scoped browse map, so the map isn't capped by the list's page size.
 *
 * Scoping comes from `resolveProposalListScope` (the exact
 * access/phase/visibility/moderation filter `listProposals` applies), so a
 * proposal that dropped out at a phase transition stops being pinned the moment
 * it stops being listed. The results tab spans every phase instead — see
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

/**
 * Reads **every** proposal matching `buildWhereClause` that carries a location
 * — no pagination — narrowed to the fields a map pin needs.
 *
 * The map plots one pin per located proposal, so it can't be capped by the
 * list's page size. Callers pass the exact WHERE clause their paginated list
 * uses, so pins never leak a proposal the viewer isn't allowed to see. Shared
 * with `listAllProposalLocations`; the row set is unbounded, so this selects
 * only the pin/hovercard columns and skips the heavy per-proposal enrichment
 * (documents, relationship counts) neither of them uses.
 */
export const selectProposalLocations = async ({
  buildWhereClause,
}: {
  buildWhereClause: (proposalsTable: typeof proposals) => SQL;
}) => {
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
        columns: proposalProfileColumns,
        with: {
          avatarImage: true,
          profileUsers: {
            columns: {},
            with: { authUser: { columns: { isAnonymous: true } } },
          },
        },
      },
      // The hovercard renders the owning profile's display name only.
      profile: { columns: { name: true } },
    },
  });

  return rows.flatMap((proposal) => {
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
};
