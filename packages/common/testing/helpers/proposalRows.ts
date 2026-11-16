import type { Proposal } from '@op/db/schema';
import { ProposalStatus, Visibility } from '@op/db/schema';

import type { VoteAggregation } from '../../src/services/decision/selectionPipeline/types';

const FIXTURE_TIMESTAMP = '2026-01-01T00:00:00.000Z';

/** A money field value as the proposal form stores it. */
export const money = (amount: number) => ({ amount, currency: 'USD' });

/** A full proposal row for pipeline unit tests. */
export function buildProposalRow(
  overrides: Partial<Proposal> & { id: string },
): Proposal {
  return {
    processInstanceId: 'instance-1',
    proposalData: {},
    status: ProposalStatus.SUBMITTED,
    visibility: Visibility.VISIBLE,
    submittedByProfileId: 'profile-1',
    profileId: 'profile-1',
    lastEditedByProfileId: null,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    deletedAt: null,
    moderationDetachedAt: null,
    shortCode: null,
    formSchemaId: null,
    ...overrides,
  };
}

/** Vote metrics for one proposal, zeroed unless overridden. */
export function buildVoteAggregation(
  overrides: Partial<VoteAggregation> & { proposalId: string },
): VoteAggregation {
  return {
    likesCount: 0,
    followsCount: 0,
    voteCount: 0,
    approvalCount: 0,
    rejectionCount: 0,
    abstainCount: 0,
    approvalRate: 0,
    rankCounts: {},
    votes: [],
    ...overrides,
  };
}
