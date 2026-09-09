import { logger } from '@op/logging';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../utils';
import { resolveAssignmentProposal } from './reviewHelpers';

vi.mock('server-only', () => ({}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@op/db/client', () => ({ db: {} }));

vi.mock('@op/db/schema', () => ({
  ProposalReviewRequestState: { REQUESTED: 'requested' },
}));

vi.mock('./assert', () => ({ assertUserByAuthId: vi.fn() }));

vi.mock('./getInstance', () => ({ getInstance: vi.fn() }));

const assignmentWith = (proposalData: unknown) => ({
  assignedProposalHistory: null,
  proposal: { id: 'proposal-1', proposalData },
});

describe('resolveAssignmentProposal', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.warn).mockClear();
  });

  it('does not log for HTML-only proposals (no collaboration doc, has description)', () => {
    resolveAssignmentProposal(assignmentWith({ description: '<p>hi</p>' }));

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not log when both collaboration doc and version are present', () => {
    resolveAssignmentProposal(
      assignmentWith({
        collaborationDocId: 'doc-1',
        collaborationDocVersionId: 3,
      }),
    );

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not log when the collaboration doc version is 0', () => {
    resolveAssignmentProposal(
      assignmentWith({
        collaborationDocId: 'doc-1',
        collaborationDocVersionId: 0,
      }),
    );

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns (never errors) when a collaboration doc has no version stamp', () => {
    resolveAssignmentProposal(assignmentWith({ collaborationDocId: 'doc-1' }));

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Proposal is missing collaborationDocVersionId',
      { proposalId: 'proposal-1' },
    );
  });

  it('throws when the proposal has neither a collaboration doc nor description', () => {
    expect(() => resolveAssignmentProposal(assignmentWith({}))).toThrow(
      ValidationError,
    );
  });
});
