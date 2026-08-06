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

  it('resolves an HTML-only proposal (no collaboration doc, has description)', () => {
    const resolved = resolveAssignmentProposal(
      assignmentWith({ description: '<p>hi</p>' }),
    );

    expect(resolved.proposalData.description).toBe('<p>hi</p>');
  });

  it('resolves a legacy proposal whose collaboration doc has no version stamp, without logging', () => {
    const resolved = resolveAssignmentProposal(
      assignmentWith({ collaborationDocId: 'doc-1' }),
    );

    expect(resolved.proposalData.collaborationDocId).toBe('doc-1');
    expect(resolved.proposalData.collaborationDocVersionId).toBeUndefined();
    // Regression guard: this read fires once per proposal per review-list
    // render, so it must not emit a log line for an unrepairable legacy state.
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('reads proposalData from the assigned history snapshot, not the live proposal', () => {
    const resolved = resolveAssignmentProposal({
      assignedProposalHistory: {
        proposalData: {
          collaborationDocId: 'doc-1',
          collaborationDocVersionId: 3,
        },
      },
      proposal: {
        id: 'proposal-1',
        proposalData: {
          collaborationDocId: 'doc-1',
          collaborationDocVersionId: 9,
        },
      },
    });

    expect(resolved.id).toBe('proposal-1');
    expect(resolved.proposalData.collaborationDocVersionId).toBe(3);
  });

  it('throws when the proposal has neither a collaboration doc nor description', () => {
    expect(() => resolveAssignmentProposal(assignmentWith({}))).toThrow(
      ValidationError,
    );
  });
});
