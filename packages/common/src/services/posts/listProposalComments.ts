import { NotFoundError } from '../../utils';
import {
  type AccessUser,
  getProfileAccessRolesWithOrgFallback,
} from '../access';
import { getVisibleMergedSourceProfiles } from '../decision/proposalSupersession';
import { getProposalReadContext } from '../decision/proposalVisibility';
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
  // The assert resolves the proposal to gate on it, so it comes back here
  // rather than being read a second time. Null means a decision profile, which
  // the assert also admits.
  const { proposal, moderationProfileId } = await assertPostReadAccess({
    user,
    profileId,
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', profileId);
  }

  // Resolved here rather than left to `getPostsPageForProfiles`, which needs
  // the same roles: `getProfileAccessUser` underneath is memoized per request,
  // so the second caller reads them for free.
  const decisionRoles = await getProfileAccessRolesWithOrgFallback({
    user,
    profileId: moderationProfileId,
  });

  // The same gate `listContributingProposals` applies to the far end of every
  // edge, so comments carry over from exactly the proposals the "Contributing
  // ideas" section lists — for admins and authors that includes hidden ones.
  const sources = await getVisibleMergedSourceProfiles({
    targetProposalId: proposal.id,
    readContext: getProposalReadContext({ user, decisionRoles }),
  });

  const originByProfileId = new Map<string, ProposalCommentOrigin>(
    sources.map((source) => [source.profileId, source]),
  );

  const profileIds = [profileId, ...originByProfileId.keys()];

  const { items, next } = await getPostsPageForProfiles({
    user,
    profileIds,
    moderationProfileId,
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
