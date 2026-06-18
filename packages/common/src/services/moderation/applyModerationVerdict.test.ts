import type { ModerationFlag } from '@op/db/schema';
import { describe, expect, it, vi } from 'vitest';

import { applyModerationVerdict } from './applyModerationVerdict';
import type { SubmissionAggregate } from './moderationSubmissionStore';
import type { ModerationVerdict } from './types';

const flagRow = (over: Partial<ModerationFlag>): ModerationFlag =>
  ({
    id: 'flag-1',
    itemType: 'post',
    itemId: 'p1',
    status: 'flagged',
    ...over,
  }) as ModerationFlag;

// The aggregate the (mocked) submission store reports back after recording the
// task. The flag decision is driven by this, not by the single task's verdict.
const aggregate = (
  over: Partial<SubmissionAggregate>,
): SubmissionAggregate => ({
  anyFlagged: false,
  anyPending: false,
  allResolved: true,
  ...over,
});

const deps = (
  openFlag: ModerationFlag | undefined,
  agg: SubmissionAggregate | null,
) => ({
  recordTaskVerdict: vi.fn().mockResolvedValue(agg),
  findOpenFlag: vi.fn().mockResolvedValue(openFlag),
  createFlag: vi
    .fn()
    .mockResolvedValue({ flag: flagRow({ id: 'new-flag' }), created: true }),
  markFlagged: vi.fn().mockResolvedValue(flagRow({ id: 'flag-1' })),
  markDismissed: vi
    .fn()
    .mockResolvedValue(flagRow({ id: 'flag-1', status: 'dismissed' })),
  emitFlagged: vi.fn().mockResolvedValue(undefined),
});

const ROUND_ID = '99999999-9999-4999-8999-999999999999';

const flagged: ModerationVerdict = {
  itemType: 'post',
  itemId: 'p1',
  roundId: ROUND_ID,
  verdict: 'flagged',
  externalRecordId: 'ext-9',
  reason: 'hate',
};
const clear: ModerationVerdict = {
  itemType: 'post',
  itemId: 'p1',
  roundId: ROUND_ID,
  verdict: 'clear',
};

// A flagged aggregate (some task is flagged); carries the merged evidence.
const flaggedAgg = aggregate({
  anyFlagged: true,
  externalRecordId: 'ext-9',
  reason: 'hate',
});

describe('applyModerationVerdict', () => {
  it('records the task verdict before deciding', async () => {
    const d = deps(undefined, flaggedAgg);
    await applyModerationVerdict({ ...flagged, mediaId: '0' }, d);

    expect(d.recordTaskVerdict).toHaveBeenCalledWith({
      itemType: 'post',
      itemId: 'p1',
      roundId: ROUND_ID,
      mediaId: '0',
      verdict: 'flagged',
      externalRecordId: 'ext-9',
      reason: 'hate',
      scores: undefined,
    });
  });

  it('creates an automated flag and notifies when a task is flagged and no flag exists', async () => {
    const d = deps(undefined, flaggedAgg);
    const result = await applyModerationVerdict(flagged, d);

    expect(d.createFlag).toHaveBeenCalledWith({
      itemType: 'post',
      itemId: 'p1',
      externalRecordId: 'ext-9',
      reason: 'hate',
      scores: undefined,
    });
    expect(d.emitFlagged).toHaveBeenCalledWith({
      itemType: 'post',
      itemId: 'p1',
      moderationFlagId: 'new-flag',
    });
    expect(result.action).toBe('created');
  });

  it('flags from the aggregate even when this task itself was clean (another task flagged)', async () => {
    const d = deps(undefined, flaggedAgg);
    // The arriving task is `clear`, but the aggregate says another task flagged.
    const result = await applyModerationVerdict(clear, d);

    expect(d.createFlag).toHaveBeenCalled();
    expect(result.action).toBe('created');
  });

  it('marks an existing pending (user-reported) flag as flagged and notifies', async () => {
    const d = deps(
      flagRow({ id: 'flag-1', status: 'pending', source: 'manual' }),
      flaggedAgg,
    );
    const result = await applyModerationVerdict(flagged, d);

    expect(d.markFlagged).toHaveBeenCalledWith('flag-1', {
      externalRecordId: 'ext-9',
      reason: 'hate',
      scores: undefined,
    });
    expect(d.createFlag).not.toHaveBeenCalled();
    expect(d.emitFlagged).toHaveBeenCalled();
    expect(result.action).toBe('flagged');
  });

  it('is idempotent: an already-flagged item ignores a duplicate flagged aggregate', async () => {
    const d = deps(flagRow({ id: 'flag-1', status: 'flagged' }), flaggedAgg);
    const result = await applyModerationVerdict(flagged, d);

    expect(d.createFlag).not.toHaveBeenCalled();
    expect(d.markFlagged).not.toHaveBeenCalled();
    expect(d.emitFlagged).not.toHaveBeenCalled();
    expect(result.action).toBe('noop');
  });

  it('does nothing on an all-clear aggregate with no existing flag', async () => {
    const d = deps(undefined, aggregate({ allResolved: true }));
    const result = await applyModerationVerdict(clear, d);

    expect(d.createFlag).not.toHaveBeenCalled();
    expect(d.markDismissed).not.toHaveBeenCalled();
    expect(result.action).toBe('noop');
  });

  it('dismisses a pending flag only once every task is clear', async () => {
    const d = deps(
      flagRow({ id: 'flag-1', status: 'pending', source: 'manual' }),
      aggregate({ allResolved: true }),
    );
    const result = await applyModerationVerdict(clear, d);

    expect(d.markDismissed).toHaveBeenCalledWith('flag-1');
    expect(result.action).toBe('dismissed');
  });

  it('does NOT dismiss a pending flag while another task is still pending', async () => {
    const d = deps(
      flagRow({ id: 'flag-1', status: 'pending', source: 'manual' }),
      aggregate({ anyPending: true, allResolved: false }),
    );
    const result = await applyModerationVerdict(clear, d);

    // The text task came back clean, but media tasks are still pending — the
    // user report must not be dismissed yet.
    expect(d.markDismissed).not.toHaveBeenCalled();
    expect(result.action).toBe('noop');
  });

  it('dismisses a flagged automated record when the provider clears it (all-clear)', async () => {
    // An all-clear on a flagged item means the provider re-reviewed and
    // cleared it (an overturn, or a re-reviewed edit) — its latest review wins.
    const d = deps(
      flagRow({ id: 'flag-1', status: 'flagged', source: 'automated' }),
      aggregate({ allResolved: true }),
    );
    const result = await applyModerationVerdict(clear, d);

    expect(d.markDismissed).toHaveBeenCalledWith('flag-1');
    expect(result.action).toBe('dismissed');
  });

  it('does NOT dismiss a flagged item while its overturn round still has pending tasks', async () => {
    const d = deps(
      flagRow({ id: 'flag-1', status: 'flagged', source: 'automated' }),
      aggregate({ anyPending: true, allResolved: false }),
    );
    const result = await applyModerationVerdict(clear, d);

    expect(d.markDismissed).not.toHaveBeenCalled();
    expect(result.action).toBe('noop');
  });

  it('drops a verdict for a task that was never submitted (null aggregate)', async () => {
    // Forged ref, a superseded round, or a redelivery after the flag was
    // resolved and its submissions cleared: record nothing, decide nothing.
    const d = deps(undefined, null);
    const result = await applyModerationVerdict(flagged, d);

    expect(d.findOpenFlag).not.toHaveBeenCalled();
    expect(d.createFlag).not.toHaveBeenCalled();
    expect(d.markFlagged).not.toHaveBeenCalled();
    expect(d.markDismissed).not.toHaveBeenCalled();
    expect(d.emitFlagged).not.toHaveBeenCalled();
    expect(result.action).toBe('noop');
  });

  it('does not notify when it loses the create race to a concurrent webhook', async () => {
    const d = deps(undefined, flaggedAgg);
    d.createFlag.mockResolvedValue({
      flag: flagRow({ id: 'racer-flag' }),
      created: false,
    });
    const result = await applyModerationVerdict(flagged, d);

    expect(d.emitFlagged).not.toHaveBeenCalled();
    expect(result.action).toBe('noop');
  });

  it('does not notify when the pending flag left pending before the mark (CAS lost)', async () => {
    const existing = flagRow({
      id: 'flag-1',
      status: 'pending',
      source: 'manual',
    });
    const d = deps(existing, flaggedAgg);
    // An admin resolved the flag between the read and the write.
    d.markFlagged.mockResolvedValue(undefined);
    const result = await applyModerationVerdict(flagged, d);

    expect(d.emitFlagged).not.toHaveBeenCalled();
    expect(result.action).toBe('noop');
  });

  it('treats a lost dismiss CAS as a no-op', async () => {
    const d = deps(
      flagRow({ id: 'flag-1', status: 'pending', source: 'manual' }),
      aggregate({ allResolved: true }),
    );
    d.markDismissed.mockResolvedValue(undefined);
    const result = await applyModerationVerdict(clear, d);

    expect(result.action).toBe('noop');
  });
});
