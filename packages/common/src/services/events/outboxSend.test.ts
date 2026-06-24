import { Events, outboxSend } from '@op/events';
import { describe, expect, it, vi } from 'vitest';

const buildFakeTx = (returning: Array<{ id: string }>) => {
  const returningFn = vi.fn().mockResolvedValue(returning);
  const valuesFn = vi.fn(() => ({ returning: returningFn }));
  const insertFn = vi.fn(() => ({ values: valuesFn }));
  const tx = { insert: insertFn } as never;
  return { tx, insertFn, valuesFn, returningFn };
};

describe('outboxSend', () => {
  it('inserts an outbox row with the event name + data and returns the row id', async () => {
    const { tx, insertFn, valuesFn } = buildFakeTx([{ id: 'row-1' }]);

    const id = await outboxSend(tx, {
      name: Events.voteSubmitted.name,
      data: {
        voteSubmissionId: '00000000-0000-0000-0000-000000000001',
        processInstanceId: '00000000-0000-0000-0000-000000000002',
      },
    });

    expect(id).toBe('row-1');
    expect(insertFn).toHaveBeenCalledTimes(1);
    expect(valuesFn).toHaveBeenCalledWith({
      eventName: Events.voteSubmitted.name,
      eventData: {
        voteSubmissionId: '00000000-0000-0000-0000-000000000001',
        processInstanceId: '00000000-0000-0000-0000-000000000002',
      },
    });
  });

  it('throws when the insert returns no row (e.g. ON CONFLICT silently skipped)', async () => {
    const { tx } = buildFakeTx([]);

    await expect(
      outboxSend(tx, {
        name: Events.contentSubmitted.name,
        data: {
          itemType: 'post',
          itemId: '00000000-0000-0000-0000-000000000003',
        },
      }),
    ).rejects.toThrow(/Failed to insert event_outbox row/);
  });
});
