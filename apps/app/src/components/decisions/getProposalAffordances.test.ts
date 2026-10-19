import { ProposalStatus } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { getProposalAffordances } from './getProposalAffordances';

const author = { currentProfile: { id: 'author-profile' } };
const proposal = {
  submittedBy: { id: 'author-profile' },
  status: ProposalStatus.SUBMITTED,
};

describe('getProposalAffordances', () => {
  it('withholds moderation from the author of a proposal who is not a decision admin', () => {
    const { moderation } = getProposalAffordances({
      instance: { currentStateId: null, access: { admin: false } },
      proposal,
      user: author,
    });

    expect(moderation).toBe(false);
  });

  it('offers moderation to a decision admin', () => {
    const { moderation } = getProposalAffordances({
      instance: { currentStateId: null, access: { admin: true } },
      proposal,
      user: { currentProfile: { id: 'admin-profile' } },
    });

    expect(moderation).toBe(true);
  });

  it('withholds moderation from a decision admin while the proposal is a draft', () => {
    const { moderation } = getProposalAffordances({
      instance: { currentStateId: null, access: { admin: true } },
      proposal: { ...proposal, status: ProposalStatus.DRAFT },
      user: { currentProfile: { id: 'admin-profile' } },
    });

    expect(moderation).toBe(false);
  });
});
