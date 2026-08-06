import { type SQL, db } from '@op/db/client';
import type { proposals } from '@op/db/schema';

import { parseProposalData } from './proposalDataSchema';

/**
 * Reads **every** proposal matching `buildWhereClause` that carries a location
 * — no pagination — and narrows each row to the fields a map pin needs.
 *
 * The map plots one pin per located proposal, so it can't be capped by a list's
 * page size. Callers supply the exact WHERE clause their paginated list uses
 * (`resolveProposalListScope` for the phase-scoped map, `resolveAllProposalsScope`
 * for the results map) so pins never leak a proposal the viewer isn't allowed to
 * see, and this skips the heavy per-proposal enrichment (documents, relationship
 * counts) the pins and hovercards don't use.
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
