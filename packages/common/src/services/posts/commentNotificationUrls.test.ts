import { describe, expect, it } from 'vitest';

import { buildProposalCommentUrl } from './commentNotificationUrls';

describe('buildProposalCommentUrl', () => {
  it('builds the canonical /decisions/<decisionSlug>/proposal/<profileId> URL', () => {
    expect(
      buildProposalCommentUrl({
        baseUrl: 'https://common.example.org',
        decisionSlug: 'pb-2026',
        proposalProfileId: 'abc-123',
      }),
    ).toBe('https://common.example.org/decisions/pb-2026/proposal/abc-123');
  });

  it('does not produce a /profile/... prefix and does not embed the process instance id', () => {
    const url = buildProposalCommentUrl({
      baseUrl: 'https://common.example.org',
      decisionSlug: 'budget-2026',
      proposalProfileId: 'proposal-profile-uuid',
    });

    expect(url).not.toContain('/profile/');
    expect(url).not.toMatch(/\/decisions\/[0-9a-f-]{16,}\//i);
  });

  it('returns null when the decision slug is missing (no broken URL emitted)', () => {
    expect(
      buildProposalCommentUrl({
        baseUrl: 'https://common.example.org',
        decisionSlug: undefined,
        proposalProfileId: 'abc-123',
      }),
    ).toBeNull();
  });
});
