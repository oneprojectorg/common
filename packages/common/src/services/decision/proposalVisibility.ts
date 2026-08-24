import { type SQL, and, db, eq, inArray, isNull, ne, or } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  profileUsers,
  proposals,
} from '@op/db/schema';
import { type NormalizedRole, checkPermission, permission } from 'access-zones';

import { type AccessUser, resolveAccessUserIds } from '../access';
import { noActiveModerationFlag } from '../moderation/moderationVisibility';

/**
 * Who is asking. Resolved once per read and threaded through every predicate
 * below, so two reads of the same proposals can't end up applying different
 * visibility rules to them.
 */
export type ProposalViewer = {
  /**
   * Admin of the decision the proposals belong to. Sees hidden and flagged
   * proposals wherever they appear.
   */
  isInstanceAdmin: boolean;
  /**
   * The caller's effective auth-user ids (own ∪ public), for the
   * proposal-profile member exception.
   */
  accessUserIds: string[];
};

/**
 * Builds the viewer from the caller's roles on the *decision's* profile — the
 * grants `listProposals` already reads — so "admin" means the same thing in
 * every proposal read.
 */
export const resolveProposalViewer = ({
  user,
  instanceProfileRoles,
}: {
  user: AccessUser | undefined;
  instanceProfileRoles: NormalizedRole[];
}): ProposalViewer => ({
  isInstanceAdmin: checkPermission(
    { profile: permission.ADMIN },
    instanceProfileRoles,
  ),
  accessUserIds: resolveAccessUserIds(user),
});

/**
 * Members of the proposal's own profile: its creator plus any collaborator
 * invited onto it. Keying on `profileId` rather than `submittedByProfileId` is
 * what keeps a group-owned proposal readable by the whole group.
 */
const isProposalProfileMember = (
  table: typeof proposals,
  accessUserIds: string[],
): SQL =>
  inArray(
    table.profileId,
    db
      .select({ profileId: profileUsers.profileId })
      .from(profileUsers)
      .where(inArray(profileUsers.authUserId, accessUserIds)),
  );

/**
 * Both restrictions below grant the same two exceptions — instance admins skip
 * the filter outright, and members of the proposal's own profile are excepted
 * from it — so the shape lives here once. `undefined` means no filter at all:
 * `and(...)` drops undefined conditions, which is what admits an admin.
 *
 * `unrestricted` is the predicate that holds for a proposal the restriction
 * doesn't apply to in the first place.
 */
const buildViewerException = ({
  table,
  viewer,
  unrestricted,
}: {
  table: typeof proposals;
  viewer: ProposalViewer;
  unrestricted: SQL;
}): SQL | undefined =>
  viewer.isInstanceAdmin
    ? undefined
    : or(unrestricted, isProposalProfileMember(table, viewer.accessUserIds))!;

/**
 * HIDDEN proposals stay readable by instance admins and by members of the
 * proposal's own profile; everyone else sees VISIBLE rows only.
 */
export const buildHiddenVisibilityFilter = ({
  table,
  viewer,
}: {
  table: typeof proposals;
  viewer: ProposalViewer;
}): SQL | undefined =>
  buildViewerException({
    table,
    viewer,
    unrestricted: eq(table.visibility, Visibility.VISIBLE),
  });

/**
 * An active moderation flag hides a proposal from the same audience a HIDDEN
 * one is hidden from, with the same two exceptions.
 */
export const buildModerationFlagFilter = ({
  table,
  viewer,
}: {
  table: typeof proposals;
  viewer: ProposalViewer;
}): SQL | undefined =>
  buildViewerException({
    table,
    viewer,
    unrestricted: noActiveModerationFlag('proposal', table.id),
  });

/**
 * Whether `viewer` may read a proposal that a list reached directly rather than
 * through `resolveProposalListScope` — the merge reads, which deliberately
 * surface superseded proposals every other listing filters out.
 *
 * Read access to a decision doesn't imply read access to every proposal in it,
 * so such a list applies this to *every* row it returns, including the one the
 * caller named. That way it neither surfaces a proposal the caller couldn't
 * open nor reveals that a restricted one exists at all. The exceptions come
 * from the same builders `resolveProposalListScope` uses on a non-draft row, so
 * what a merge read shows and what `listProposals` shows can't drift apart.
 *
 * Pass the *aliased* table of the query being built (e.g. the `table` from a
 * relational `RAW` callback) so the subqueries correlate correctly.
 */
export const isProposalReadableBy = ({
  table,
  viewer,
}: {
  table: typeof proposals;
  viewer: ProposalViewer;
}): SQL =>
  and(
    isNull(table.deletedAt),
    // Moderation-detached (CSAM) proposals are invisible to everyone, admins
    // included — the same treatment `getProposal` gives them.
    isNull(table.moderationDetachedAt),
    // A draft can't be merged, and admin standing never grants one anyway.
    ne(table.status, ProposalStatus.DRAFT),
    buildHiddenVisibilityFilter({ table, viewer }),
    buildModerationFlagFilter({ table, viewer }),
  )!;
