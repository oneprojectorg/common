import {
  SQL,
  and,
  db,
  eq,
  exists,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  processInstances,
  profileUsers,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
  resolveAccessUserIds,
} from '../access';
import { noActiveModerationFlag } from '../moderation/moderationVisibility';
import type { AllProposalsFilter } from './schemas/proposal';

/**
 * The filter fields that shape which proposals the "All proposals" scope
 * matches. Pagination and ordering belong to the caller, so the paginated list
 * and the unpaginated map-pin read resolve an identical scope.
 */
export type AllProposalsScopeInput = Omit<
  AllProposalsFilter,
  'cursor' | 'limit' | 'orderBy' | 'dir'
>;

export interface AllProposalsScope {
  /** Instance row reused by callers for template resolution and enrichment. */
  instance: typeof processInstances.$inferSelect;
  currentProfileId: string | undefined;
  isAdmin: boolean;
  /**
   * Builds the full WHERE clause for the resolved scope. Parameterized on the
   * table reference so it works for both the v2 relational `findMany` (aliased
   * table) and a plain `db.select().from(proposals)` count query.
   */
  buildWhereClause: (proposalsTable: typeof proposals) => SQL;
}

/**
 * Resolves the shared access/visibility/moderation scope for the phase-agnostic
 * "All proposals" reads. Both `listAllProposals` (paginated, enriched) and
 * `listAllProposalLocations` (all rows, slim) use this so their filtering — and
 * therefore what a viewer is allowed to see — can never diverge.
 *
 * Unlike `resolveProposalListScope`, this scope is NOT phase-scoped: it matches
 * every valid submission on the instance across all phases. Drafts, rejected,
 * duplicate, and soft-deleted proposals are excluded for everyone. Non-admin
 * members additionally see only visible proposals; decision admins also see
 * hidden proposals so they can audit and report on what was submitted.
 */
export const resolveAllProposalsScope = async ({
  input,
  user,
}: {
  input: AllProposalsScopeInput;
  user: User | undefined;
}): Promise<AllProposalsScope> => {
  const { processInstanceId, status, categoryId } = input;

  // The caller's own grants unioned with public grants — used by the
  // moderation owner-exception subquery (proposal.profileId membership).
  const accessUserIds = resolveAccessUserIds(user);

  const [currentProfileId, instance] = await Promise.all([
    user ? getCurrentProfileId(user.id) : undefined,
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
    }),
  ]);

  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  const profileRoles = await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    orgFallbackPermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
  });

  const isAdmin = checkPermission(
    { decisions: permission.ADMIN },
    profileRoles,
  );

  // Ballots are private — a caller may only request their own.
  let votedProposalIds: string[] | undefined;
  if (input.votedByProfileId) {
    if (currentProfileId !== input.votedByProfileId) {
      throw new UnauthorizedError('You can only view your own ballot');
    }
    const votedRows = await db
      .select({ proposalId: decisionsVoteProposals.proposalId })
      .from(decisionsVoteSubmissions)
      .innerJoin(
        decisionsVoteProposals,
        eq(
          decisionsVoteSubmissions.id,
          decisionsVoteProposals.voteSubmissionId,
        ),
      )
      .where(
        and(
          eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
          eq(
            decisionsVoteSubmissions.submittedByProfileId,
            input.votedByProfileId,
          ),
        ),
      );
    votedProposalIds = votedRows.map((row) => row.proposalId);
  }

  // Param'd on the table ref so it works for both the relational `RAW` alias
  // and the plain schema table (data query, count query, locations query).
  const buildWhereClause = (t: typeof proposals): SQL =>
    and(
      eq(t.processInstanceId, processInstanceId),
      status ? eq(t.status, status) : undefined,
      input.submittedByProfileId
        ? eq(t.submittedByProfileId, input.submittedByProfileId)
        : undefined,
      votedProposalIds
        ? votedProposalIds.length > 0
          ? inArray(t.id, votedProposalIds)
          : sql`false`
        : undefined,
      categoryId
        ? exists(
            db
              .select({ id: proposalCategories.proposalId })
              .from(proposalCategories)
              .where(
                and(
                  eq(proposalCategories.proposalId, t.id),
                  eq(proposalCategories.taxonomyTermId, categoryId),
                ),
              ),
          )
        : undefined,
      notInArray(t.status, [
        ProposalStatus.DRAFT,
        ProposalStatus.REJECTED,
        ProposalStatus.DUPLICATE,
      ]),
      isNull(t.deletedAt),
      // Moderation-detached (CSAM) proposals are invisible to everyone —
      // admins included. No source of proposal-facing UI shows detached rows.
      isNull(t.moderationDetachedAt),
      isAdmin ? undefined : eq(t.visibility, Visibility.VISIBLE),
      // Items with an active moderation flag are hidden from everyone
      // except members of the proposal's own profile (the same audience
      // getProposal grants it to, so list and detail agree); admins skip
      // the filter.
      isAdmin
        ? undefined
        : or(
            noActiveModerationFlag('proposal', t.id),
            inArray(
              t.profileId,
              db
                .select({ profileId: profileUsers.profileId })
                .from(profileUsers)
                .where(inArray(profileUsers.authUserId, accessUserIds)),
            ),
          ),
    )!;

  return { instance, currentProfileId, isAdmin, buildWhereClause };
};
