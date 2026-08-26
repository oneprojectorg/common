import { type SQL, and, db, eq, inArray, isNull, ne, or } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  profileUsers,
  proposals,
} from '@op/db/schema';
import { type NormalizedRole, checkPermission, permission } from 'access-zones';

import { type AccessUser, resolveAccountUserId } from '../access';
import { noActiveModerationFlag } from '../moderation/moderationVisibility';

export type ProposalReadContext = {
  /** `undefined` for a caller with no account of their own. */
  accountUserId: string | undefined;
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
  accountUserId: resolveAccountUserId(user),
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
 * collaborators. Nothing for a caller with no account — public grants belong on
 * the decision's profile and never on an individual proposal's, so the public
 * sentinel could only match if that invariant were already broken.
 */
export const isProposalProfileMember = (
  proposalsTable: typeof proposals,
  accountUserId: string | undefined,
): SQL | undefined =>
  accountUserId === undefined
    ? undefined
    : inArray(
        proposalsTable.profileId,
        db
          .select({ profileId: profileUsers.profileId })
          .from(profileUsers)
          .where(eq(profileUsers.authUserId, accountUserId)),
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
  { accountUserId, isInstanceAdmin }: ProposalReadContext,
): SQL =>
  and(
    isPresent(proposalsTable),
    or(
      // `isUnrestricted` only ever admits non-drafts, so for an admin it costs
      // a visibility check and a moderation subquery to widen nothing.
      isInstanceAdmin
        ? ne(proposalsTable.status, ProposalStatus.DRAFT)
        : isUnrestricted(proposalsTable),
      isProposalProfileMember(proposalsTable, accountUserId),
    )!,
  )!;
