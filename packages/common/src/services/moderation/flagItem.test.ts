import type { ModerationFlag } from '@op/db/schema';
import { describe, expect, it, vi } from 'vitest';

import { flagItem } from './flagItem';

const pendingRow = { id: 'flag-1', status: 'pending' } as ModerationFlag;

const ROUND_ID = '99999999-9999-4999-8999-999999999999';

const input = {
  itemType: 'post' as const,
  itemId: 'p1',
  roundId: ROUND_ID,
  flaggedByProfileId: 'profile-9',
  content: 'report me',
  media: [{ url: 'https://cdn/a.png', kind: 'image' as const }],
  callbackUrl: 'https://us/webhook',
};

const plannedRefs = [`post:p1:${ROUND_ID}`, `post:p1:${ROUND_ID}:0`];

const fullDeps = () => ({
  findOpenFlag: vi.fn().mockResolvedValue(undefined),
  createPendingFlag: vi
    .fn()
    .mockResolvedValue({ flag: pendingRow, created: true }),
  submitForReview: vi.fn().mockResolvedValue({
    providerRecordId: 'r1',
    submittedRefs: plannedRefs,
  }),
  planRefs: vi.fn().mockReturnValue(plannedRefs),
  recordRound: vi.fn().mockResolvedValue(undefined),
  rollback: vi.fn().mockResolvedValue(undefined),
});

describe('flagItem', () => {
  it('creates a pending flag, records the planned round, then submits', async () => {
    const deps = fullDeps();

    const result = await flagItem(input, deps);

    expect(deps.createPendingFlag).toHaveBeenCalledWith({
      itemType: 'post',
      itemId: 'p1',
      flaggedByProfileId: 'profile-9',
      reason: undefined,
    });
    expect(deps.recordRound).toHaveBeenCalledWith(
      'post',
      'p1',
      ROUND_ID,
      plannedRefs,
    );
    expect(deps.submitForReview).toHaveBeenCalledWith({
      itemType: 'post',
      itemId: 'p1',
      roundId: ROUND_ID,
      content: 'report me',
      media: [{ url: 'https://cdn/a.png', kind: 'image' }],
      callbackUrl: 'https://us/webhook',
    });
    // The round must be on record before the provider can possibly call back.
    expect(deps.recordRound.mock.invocationCallOrder[0]).toBeLessThan(
      deps.submitForReview.mock.invocationCallOrder[0] ?? 0,
    );
    expect(result).toEqual({ flag: pendingRow });
  });

  it('is idempotent: returns the existing open flag without creating or submitting', async () => {
    const deps = fullDeps();
    deps.findOpenFlag.mockResolvedValue(pendingRow);

    const result = await flagItem(input, deps);

    expect(deps.createPendingFlag).not.toHaveBeenCalled();
    expect(deps.submitForReview).not.toHaveBeenCalled();
    expect(deps.recordRound).not.toHaveBeenCalled();
    expect(result).toEqual({ flag: pendingRow });
  });

  it('does not submit or roll back when a concurrent report won the insert race', async () => {
    const deps = fullDeps();
    deps.createPendingFlag.mockResolvedValue({
      flag: pendingRow,
      created: false,
    });

    const result = await flagItem(input, deps);

    // The winner owns the round (and any rollback); the loser just reports
    // the existing flag.
    expect(deps.recordRound).not.toHaveBeenCalled();
    expect(deps.submitForReview).not.toHaveBeenCalled();
    expect(result).toEqual({ flag: pendingRow });
  });

  it('rolls back the pending flag and rethrows when the provider submit fails', async () => {
    const deps = fullDeps();
    deps.submitForReview.mockRejectedValue(new Error('provider down'));

    await expect(flagItem(input, deps)).rejects.toThrow('provider down');

    // Without the rollback the flag would sit pending forever and the
    // open-flag idempotency check would swallow every retry.
    expect(deps.rollback).toHaveBeenCalledWith(pendingRow);
  });

  it('keeps the flag pending without submitting when nothing is reviewable', async () => {
    const deps = fullDeps();
    deps.planRefs.mockReturnValue([]);

    const result = await flagItem({ ...input, content: '', media: [] }, deps);

    expect(deps.recordRound).not.toHaveBeenCalled();
    expect(deps.submitForReview).not.toHaveBeenCalled();
    expect(result).toEqual({ flag: pendingRow });
  });

  it('skips the provider entirely when async review is not configured', async () => {
    const deps = fullDeps();
    const result = await flagItem(input, {
      findOpenFlag: deps.findOpenFlag,
      createPendingFlag: deps.createPendingFlag,
    });

    expect(result).toEqual({ flag: pendingRow });
  });
});
