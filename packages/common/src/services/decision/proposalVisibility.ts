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

/** Resolved once per read so two reads can't apply different visibility rules. */
export type ProposalViewer = {
  /** Admin of the decision, not of the proposal. */
  isInstanceAdmin: boolean;
  accessUserIds: string[];
};

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

// `profileId`, not `submittedByProfileId`: a group-owned proposal stays
// readable by the whole group.
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
 * Returns `undefined` for an admin — `and(...)` drops undefined conditions, so
 * an admin gets no filter rather than a permissive one.
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
 * For reads that bypass `resolveProposalListScope` — the merge reads, which
 * surface superseded proposals. Read access to a decision doesn't imply read
 * access to every proposal in it, so apply this to every row returned,
 * including the one the caller named.
 *
 * Pass the *aliased* table (e.g. from a relational `RAW` callback) so the
 * subqueries correlate.
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
    // Moderation-detached (CSAM) proposals are invisible to admins too.
    isNull(table.moderationDetachedAt),
    // A draft can't be merged, and admin standing doesn't grant one.
    ne(table.status, ProposalStatus.DRAFT),
    buildHiddenVisibilityFilter({ table, viewer }),
    buildModerationFlagFilter({ table, viewer }),
  )!;
