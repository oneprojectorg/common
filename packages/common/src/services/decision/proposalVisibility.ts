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

/** The caller standing `isProposalReadable` resolves its exceptions against. */
export type ProposalReadContext = {
  /** The caller's own auth id unioned with the public one — `resolveAccessUserIds`. */
  accessUserIds: string[];
  /** `{ profile: ADMIN }` on the decision's profile. */
  isInstanceAdmin: boolean;
};

/**
 * Resolves that standing from what a caller already has in hand: the user, and
 * the roles their decision-profile access assert returned. Nothing is read
 * here — the exceptions are evaluated in SQL by `isProposalReadable`.
 */
export const getProposalReadContext = ({
  user,
  decisionRoles,
}: {
  user: AccessUser | undefined;
  decisionRoles: NormalizedRole[];
}): ProposalReadContext => ({
  accessUserIds: resolveAccessUserIds(user),
  isInstanceAdmin: checkPermission(
    { profile: permission.ADMIN },
    decisionRoles,
  ),
});

/** Gone for everyone, admins included: soft-deleted, or detached for moderation. */
const isPresent = (t: typeof proposals): SQL =>
  and(isNull(t.deletedAt), isNull(t.moderationDetachedAt))!;

/** Submitted, visible and unflagged — readable without any access exception. */
const isUnrestricted = (t: typeof proposals): SQL =>
  and(
    ne(t.status, ProposalStatus.DRAFT),
    eq(t.visibility, Visibility.VISIBLE),
    noActiveModerationFlag('proposal', t.id),
  )!;

/**
 * Members of the proposal's *own* profile: its author plus invited
 * collaborators.
 *
 * INVARIANT, shared with `resolveProposalListScope`: public grants
 * (`GLOBAL_USER_PUBLIC`) belong on the decision's profile and never on an
 * individual proposal's, or this would hand every caller's drafts and hidden
 * proposals to the public.
 */
const isProposalProfileMember = (
  t: typeof proposals,
  accessUserIds: string[],
): SQL =>
  inArray(
    t.profileId,
    db
      .select({ profileId: profileUsers.profileId })
      .from(profileUsers)
      .where(inArray(profileUsers.authUserId, accessUserIds)),
  );

/**
 * `getProposal`'s gate expressed in SQL: the visibility floor plus the two
 * exceptions that reach past it — proposal-level access (author + invited
 * collaborators) sees its own drafts, hidden and flagged proposals, and an
 * instance admin sees every one of those but a draft.
 *
 * Read access to a decision doesn't imply read access to every proposal in it,
 * so any list that surfaces a proposal it didn't reach through
 * `resolveProposalListScope` applies this to *every* row it returns —
 * including the one the caller named. Matching `getProposal` is what keeps a
 * page and the panels on it agreeing: a proposal an admin can open must not
 * 404 the reads its own page issues.
 *
 * Pass the *aliased* table of the query being built (e.g. the `table` from a
 * relational `RAW` callback) so the moderation and membership subqueries
 * correlate correctly.
 */
export const isProposalReadable = (
  t: typeof proposals,
  { accessUserIds, isInstanceAdmin }: ProposalReadContext,
): SQL =>
  and(
    isPresent(t),
    or(
      isUnrestricted(t),
      isProposalProfileMember(t, accessUserIds),
      // Drafts are for their own authors only — an admin reading someone's
      // unsubmitted work is the one exception `getProposal` withholds.
      isInstanceAdmin ? ne(t.status, ProposalStatus.DRAFT) : undefined,
    )!,
  )!;
