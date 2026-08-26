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

export type ProposalReadContext = {
  /** The caller's own auth id unioned with the public one. */
  accessUserIds: string[];
  /** False for a caller with no account, who holds only the public grants. */
  hasAccountGrants: boolean;
  /** `{ profile: ADMIN }` on the *decision's* profile. */
  isInstanceAdmin: boolean;
};

/** Builds the context from the roles the caller's access assert returned. */
export const getProposalReadContext = ({
  user,
  decisionRoles,
}: {
  user: AccessUser | undefined;
  decisionRoles: NormalizedRole[];
}): ProposalReadContext => ({
  accessUserIds: resolveAccessUserIds(user),
  hasAccountGrants: user !== undefined,
  isInstanceAdmin: checkPermission(
    { profile: permission.ADMIN },
    decisionRoles,
  ),
});

/** Gone for everyone, admins included — no exception reaches these. */
const isPresent = (proposalsTable: typeof proposals): SQL =>
  and(
    isNull(proposalsTable.deletedAt),
    isNull(proposalsTable.moderationDetachedAt),
  )!;

const isUnrestricted = (proposalsTable: typeof proposals): SQL =>
  and(
    ne(proposalsTable.status, ProposalStatus.DRAFT),
    eq(proposalsTable.visibility, Visibility.VISIBLE),
    noActiveModerationFlag('proposal', proposalsTable.id),
  )!;

/**
 * Members of the proposal's *own* profile: its author plus invited
 * collaborators. INVARIANT, shared with `resolveProposalListScope`: public
 * grants (`GLOBAL_USER_PUBLIC`) belong on the decision's profile and never on
 * an individual proposal's, or this hands every caller's drafts and hidden
 * proposals to the public.
 */
const isProposalProfileMember = (
  proposalsTable: typeof proposals,
  accessUserIds: string[],
): SQL =>
  inArray(
    proposalsTable.profileId,
    db
      .select({ profileId: profileUsers.profileId })
      .from(profileUsers)
      .where(inArray(profileUsers.authUserId, accessUserIds)),
  );

/**
 * `getProposal`'s gate expressed in SQL. Apply it to *every* row a list
 * returns, including the one the caller named: matching `getProposal` is what
 * stops a proposal an admin can open from 404ing the reads its own page makes.
 *
 * Pass the *aliased* table of the query being built (e.g. the `table` from a
 * relational `RAW` callback) so the subqueries correlate correctly.
 */
export const isProposalReadable = (
  proposalsTable: typeof proposals,
  { accessUserIds, hasAccountGrants, isInstanceAdmin }: ProposalReadContext,
): SQL =>
  and(
    isPresent(proposalsTable),
    or(
      // `isUnrestricted` only ever admits non-drafts, so for an admin it costs
      // a visibility check and a moderation subquery to widen nothing.
      isInstanceAdmin
        ? ne(proposalsTable.status, ProposalStatus.DRAFT)
        : isUnrestricted(proposalsTable),
      // By the invariant above, the public grant is never on a proposal's own
      // profile — so for a caller with no account the subquery cannot match.
      hasAccountGrants
        ? isProposalProfileMember(proposalsTable, accessUserIds)
        : undefined,
    )!,
  )!;
