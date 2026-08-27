import { and, db, inArray } from '@op/db/client';

import { NotFoundError } from '../../utils';
import { type AccessUser } from '../access';
import { getMergedSourceProposalIds } from '../decision/proposalSupersession';
import { needsNoAccessException } from '../decision/proposalVisibility';
import { assertPostReadAccess } from './access';
import { getPostsPageForProfiles } from './getPostsPageForProfiles';

/** Where a carried-over comment was originally written. */
export type ProposalCommentOrigin = {
  profileId: string;
  name: string;
};

/**
 * A proposal's comment feed, including the comments on every proposal merged
 * into it. A merge records an edge and moves no content, so without this those
 * comments stay reachable only from the superseded proposal's own page.
 *
 * One ordering and one cursor cover the whole set, so carried-over comments
 * interleave with the proposal's own rather than trailing them.
 */
export const listProposalComments = async ({
  user,
  profileId,
  limit = 20,
  cursor,
}: {
  user: AccessUser | undefined;
  /** The proposal's own profile, the same id the composer posts to. */
  profileId: string;
  limit?: number;
  cursor?: string | null;
}) => {
  // The assert rejects the whole `Promise.all`, so an unauthorized caller never
  // receives the row read alongside it.
  const [, proposal] = await Promise.all([
    assertPostReadAccess({ user, profileId }),
    db.query.proposals.findFirst({
      where: { profileId },
      columns: { id: true, processInstanceId: true },
    }),
  ]);

  // The assert admits a decision profile too, which has no proposal behind it.
  if (!proposal) {
    throw new NotFoundError('Proposal', profileId);
  }

  const sourceIds = await getMergedSourceProposalIds({
    targetProposalId: proposal.id,
  });

  // The same visibility floor `listContributingProposals` applies, so comments
  // carry over from exactly the proposals the "Contributing ideas" section
  // already shows — a hidden or flagged source leaks neither.
  const sources = sourceIds.length
    ? await db.query.proposals.findMany({
        where: {
          RAW: (table) =>
            and(inArray(table.id, sourceIds), needsNoAccessException(table))!,
        },
        columns: { profileId: true },
        with: { profile: { columns: { name: true } } },
      })
    : [];

  const originByProfileId = new Map<string, ProposalCommentOrigin>(
    sources.map((source) => [
      source.profileId,
      { profileId: source.profileId, name: source.profile.name },
    ]),
  );

  const profileIds = [profileId, ...originByProfileId.keys()];

  const { items, next } = await getPostsPageForProfiles({
    user,
    profileIds,
    moderationProfileId: profileId,
    limit,
    cursor,
  });

  return {
    items: items.map((item) => ({
      post: item.post,
      originProposal: originByProfileId.get(item.profileId) ?? null,
    })),
    next,
    /** Every profile this page draws from, for the caller's channel fan-out. */
    profileIds,
    /** The queried proposal, for the channel merge and unmerge publish on. */
    queriedProposal: {
      id: proposal.id,
      processInstanceId: proposal.processInstanceId,
    },
  };
};
