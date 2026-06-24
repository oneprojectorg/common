import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: the orchestrator is the unit under test, so the inbox store
// and the Inngest client are stubbed to record what was called.
vi.mock('./moderationWebhookInboxStore', () => ({
  insertModerationWebhookDelivery: vi.fn(),
}));

vi.mock('@op/events', () => ({
  Events: {
    moderationWebhookReceived: { name: 'moderation/webhook-received' },
  },
  event: { send: vi.fn() },
}));

import { event } from '@op/events';

import { insertModerationWebhookDelivery } from './moderationWebhookInboxStore';
import { recordModerationWebhookDelivery } from './recordModerationWebhookDelivery';

const insert = vi.mocked(insertModerationWebhookDelivery);
const send = vi.mocked(event.send);

const DELIVERY = {
  provider: 'lasso',
  deliveryId: 'd1',
  rawBody: '{}',
  headers: {},
};

const inboxRow = (overrides: { id: string; processedAt: string | null }) =>
  ({
    id: overrides.id,
    provider: DELIVERY.provider,
    deliveryId: DELIVERY.deliveryId,
    rawBody: DELIVERY.rawBody,
    headers: DELIVERY.headers,
    receivedAt: '2026-06-24T00:00:00.000Z',
    processedAt: overrides.processedAt,
    processedStatus: overrides.processedAt ? 'success' : null,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordModerationWebhookDelivery', () => {
  it('persists the delivery and emits the dispatch event on a fresh insert', async () => {
    insert.mockResolvedValueOnce({
      delivery: inboxRow({ id: 'inbox-1', processedAt: null }),
      inserted: true,
    });

    const result = await recordModerationWebhookDelivery(DELIVERY);

    expect(result).toEqual({ inboxId: 'inbox-1', emitted: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      name: 'moderation/webhook-received',
      data: { inboxId: 'inbox-1' },
    });
  });

  it('skips the event emit on a duplicate redelivery the workflow already finished', async () => {
    insert.mockResolvedValueOnce({
      delivery: inboxRow({
        id: 'inbox-1',
        processedAt: '2026-06-24T00:00:01.000Z',
      }),
      inserted: false,
    });

    const result = await recordModerationWebhookDelivery(DELIVERY);

    expect(result).toEqual({ inboxId: 'inbox-1', emitted: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('re-emits the dispatch event when a redelivery finds the row still pending', async () => {
    // Durability gap recovery: the first attempt persisted the row but
    // crashed (or 500'd) before its event reached Inngest. The vendor retry
    // loses the insert race but `processedAt` is still null, so the workflow
    // hasn't started — re-emit instead of dropping the delivery.
    insert.mockResolvedValueOnce({
      delivery: inboxRow({ id: 'inbox-1', processedAt: null }),
      inserted: false,
    });

    const result = await recordModerationWebhookDelivery(DELIVERY);

    expect(result).toEqual({ inboxId: 'inbox-1', emitted: true });
    expect(send).toHaveBeenCalledWith({
      name: 'moderation/webhook-received',
      data: { inboxId: 'inbox-1' },
    });
  });
});
