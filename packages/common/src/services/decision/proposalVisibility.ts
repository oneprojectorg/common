import { type SQL, and, eq, isNull, ne } from '@op/db/client';
import { ProposalStatus, Visibility, proposals } from '@op/db/schema';

import { noActiveModerationFlag } from '../moderation/moderationVisibility';

/**
 * The visibility floor `getProposal` applies, expressed in SQL: not deleted,
 * not moderation-detached, not a draft, not hidden, not actively flagged.
 *
 * Read access to a decision doesn't imply read access to every proposal in it,
 * so any list that surfaces a proposal it didn't reach through
 * `resolveProposalListScope` applies this to *every* row it returns — including
 * the one the caller named. That way a list neither surfaces a proposal the
 * caller couldn't open nor reveals that a restricted one exists at all.
 *
 * This is the no-exception form on purpose. `resolveProposalListScope` builds
 * the richer variant, where each of these is relaxed for the proposal's own
 * profile members and skipped entirely for instance admins; callers that want
 * those exceptions want that, not this.
 *
 * Pass the *aliased* table of the query being built (e.g. the `table` from a
 * relational `RAW` callback) so the moderation subquery correlates correctly.
 */
export const needsNoAccessException = (t: typeof proposals): SQL =>
  and(
    isNull(t.deletedAt),
    isNull(t.moderationDetachedAt),
    ne(t.status, ProposalStatus.DRAFT),
    eq(t.visibility, Visibility.VISIBLE),
    noActiveModerationFlag('proposal', t.id),
  )!;
