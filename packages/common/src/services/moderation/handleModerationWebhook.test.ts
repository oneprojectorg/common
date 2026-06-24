import { describe, expect, it, vi } from 'vitest';

import {
  deliveryIdFor,
  handleModerationWebhook,
} from './handleModerationWebhook';
import type { ModerationProvider } from './types';

const noopProvider: ModerationProvider = { scoreText: async () => ({}) };

const body = { rawBody: '{}', headers: {}, providedSecret: 'sekret' };

const recorder = () => vi.fn(async () => undefined);

describe('handleModerationWebhook', () => {
  it('records the delivery on a valid secret and 200s', async () => {
    const recordDelivery = recorder();
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: noopProvider,
      providerName: 'lasso',
      recordDelivery,
    });

    expect(result.status).toBe(200);
    expect(recordDelivery).toHaveBeenCalledWith({
      provider: 'lasso',
      deliveryId: deliveryIdFor(body.rawBody),
      rawBody: body.rawBody,
      headers: body.headers,
    });
  });

  it('rejects a bad secret with 401 and never records', async () => {
    const recordDelivery = recorder();
    const result = await handleModerationWebhook(
      { ...body, providedSecret: 'wrong' },
      {
        expectedSecret: 'sekret',
        provider: noopProvider,
        providerName: 'lasso',
        recordDelivery,
      },
    );

    expect(result.status).toBe(401);
    expect(recordDelivery).not.toHaveBeenCalled();
  });

  it('returns 503 when no provider is configured', async () => {
    const recordDelivery = recorder();
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: null,
      recordDelivery,
    });

    expect(result.status).toBe(503);
    expect(recordDelivery).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the vendor signature fails, before recording', async () => {
    const verifyWebhook = vi.fn().mockReturnValue(false);
    const recordDelivery = recorder();
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: { scoreText: async () => ({}), verifyWebhook },
      providerName: 'lasso',
      recordDelivery,
    });

    expect(result.status).toBe(401);
    expect(verifyWebhook).toHaveBeenCalledWith({ rawBody: '{}', headers: {} });
    expect(recordDelivery).not.toHaveBeenCalled();
  });

  it('proceeds when the vendor signature verifies', async () => {
    const recordDelivery = recorder();
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: { scoreText: async () => ({}), verifyWebhook: () => true },
      providerName: 'lasso',
      recordDelivery,
    });

    expect(result.status).toBe(200);
    expect(recordDelivery).toHaveBeenCalledTimes(1);
  });

  it('rejects with 401 when no expected secret is configured', async () => {
    const recordDelivery = recorder();
    const result = await handleModerationWebhook(body, {
      expectedSecret: undefined,
      provider: noopProvider,
      providerName: 'lasso',
      recordDelivery,
    });

    expect(result.status).toBe(401);
    expect(recordDelivery).not.toHaveBeenCalled();
  });

  it('falls back to "unknown" provider name when none is configured', async () => {
    const recordDelivery = recorder();
    await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: noopProvider,
      recordDelivery,
    });

    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'unknown' }),
    );
  });
});

describe('deliveryIdFor', () => {
  it('returns a stable sha256 digest for the same body', () => {
    expect(deliveryIdFor('{}')).toBe(deliveryIdFor('{}'));
    expect(deliveryIdFor('{}')).toHaveLength(64);
  });

  it('differs for different bodies', () => {
    expect(deliveryIdFor('{"a":1}')).not.toBe(deliveryIdFor('{"a":2}'));
  });
});
