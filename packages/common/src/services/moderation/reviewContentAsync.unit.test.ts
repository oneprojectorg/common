import { describe, expect, it, vi } from 'vitest';

import { reviewContentAsync } from './reviewContentAsync';
import type { ModerationProvider } from './types';

const ROUND_ID = '99999999-9999-4999-8999-999999999999';

const item = {
  itemType: 'post' as const,
  itemId: 'p1',
  roundId: ROUND_ID,
  content: 'x',
  callbackUrl: 'https://us/webhook',
};

describe('reviewContentAsync', () => {
  it('does nothing when no provider is configured', async () => {
    const recordRound = vi.fn();
    const result = await reviewContentAsync(item, {
      provider: null,
      recordRound,
    });
    expect(result.submitted).toBe(false);
    expect(recordRound).not.toHaveBeenCalled();
  });

  it('does nothing when the provider has no async capability', async () => {
    const recordRound = vi.fn();
    const provider: ModerationProvider = {};
    const result = await reviewContentAsync(item, { provider, recordRound });
    expect(result.submitted).toBe(false);
    expect(recordRound).not.toHaveBeenCalled();
  });

  it('does nothing when the provider cannot plan the round up front', async () => {
    // `planReviewRefs` is required: without it the round can't be recorded
    // ahead of the submit and verdicts would arrive for unrecorded tasks.
    const recordRound = vi.fn();
    const provider: ModerationProvider = {
      submitForReview: vi
        .fn()
        .mockResolvedValue({ submittedRefs: ['post:p1'] }),
    };
    const result = await reviewContentAsync(item, { provider, recordRound });
    expect(result.submitted).toBe(false);
    expect(recordRound).not.toHaveBeenCalled();
  });

  it('records the planned round, then submits to the provider', async () => {
    const refs = [`post:p1:${ROUND_ID}`, `post:p1:${ROUND_ID}:0`];
    const submitForReview = vi.fn().mockResolvedValue({
      providerRecordId: 'rec-1',
      submittedRefs: refs,
    });
    const planReviewRefs = vi.fn().mockReturnValue(refs);
    const recordRound = vi.fn();
    const reportForReview = vi.fn();
    const provider: ModerationProvider = {
      planReviewRefs,
      submitForReview,
      reportForReview,
    };

    const result = await reviewContentAsync(
      { ...item, media: [{ url: 'https://cdn/a.png', kind: 'image' }] },
      { provider, recordRound },
    );

    expect(result).toEqual({ submitted: true, providerRecordId: 'rec-1' });
    // Records the planned refs *before* the provider is called, so a verdict
    // can never arrive for an unrecorded task.
    expect(recordRound).toHaveBeenCalledWith('post', 'p1', ROUND_ID, refs);
    // Edits and submissions are classifier-only: a community report is a user
    // action, and filing one here would queue a case nobody reported.
    expect(reportForReview).not.toHaveBeenCalled();
    expect(recordRound.mock.invocationCallOrder[0]).toBeLessThan(
      submitForReview.mock.invocationCallOrder[0] ?? 0,
    );
    expect(submitForReview).toHaveBeenCalledWith({
      itemType: 'post',
      itemId: 'p1',
      roundId: ROUND_ID,
      content: 'x',
      media: [{ url: 'https://cdn/a.png', kind: 'image' }],
      callbackUrl: 'https://us/webhook',
    });
  });

  it('does not submit when the plan is empty (nothing reviewable)', async () => {
    const submitForReview = vi.fn();
    const recordRound = vi.fn();
    const provider: ModerationProvider = {
      planReviewRefs: () => [],
      submitForReview,
    };

    const result = await reviewContentAsync(
      { ...item, content: '   ' },
      { provider, recordRound },
    );

    expect(result.submitted).toBe(false);
    expect(recordRound).not.toHaveBeenCalled();
    expect(submitForReview).not.toHaveBeenCalled();
  });
});
