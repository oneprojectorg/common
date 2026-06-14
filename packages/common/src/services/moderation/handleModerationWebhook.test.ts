import { describe, expect, it, vi } from 'vitest';

import { handleModerationWebhook } from './handleModerationWebhook';
import type { ModerationProvider, ModerationVerdict } from './types';

const ROUND_ID = '99999999-9999-4999-8999-999999999999';

const verdict: ModerationVerdict = {
  itemType: 'post',
  itemId: 'p1',
  roundId: ROUND_ID,
  verdict: 'flagged',
};

const provider = (parse: () => ModerationVerdict[]): ModerationProvider => ({
  scoreText: async () => ({}),
  parseWebhook: parse,
});

const body = { rawBody: '{}', headers: {}, providedSecret: 'sekret' };

describe('handleModerationWebhook', () => {
  it('parses and applies the verdict on a valid secret', async () => {
    const applyVerdict = vi.fn().mockResolvedValue(undefined);
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: provider(() => [verdict]),
      applyVerdict,
    });

    expect(result.status).toBe(200);
    expect(applyVerdict).toHaveBeenCalledWith(verdict);
  });

  it('rejects a bad secret with 401 and never parses or applies', async () => {
    const parseWebhook = vi.fn();
    const applyVerdict = vi.fn();
    const result = await handleModerationWebhook(
      { ...body, providedSecret: 'wrong' },
      {
        expectedSecret: 'sekret',
        provider: { scoreText: async () => ({}), parseWebhook },
        applyVerdict,
      },
    );

    expect(result.status).toBe(401);
    expect(parseWebhook).not.toHaveBeenCalled();
    expect(applyVerdict).not.toHaveBeenCalled();
  });

  it('returns 503 when no provider is configured', async () => {
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: null,
      applyVerdict: vi.fn(),
    });

    expect(result.status).toBe(503);
  });

  it('returns 400 when the payload cannot be parsed', async () => {
    const applyVerdict = vi.fn();
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: provider(() => {
        throw new Error('bad payload');
      }),
      applyVerdict,
    });

    expect(result.status).toBe(400);
    expect(applyVerdict).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the vendor signature fails, before parsing', async () => {
    const parseWebhook = vi.fn();
    const verifyWebhook = vi.fn().mockReturnValue(false);
    const applyVerdict = vi.fn();
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: { scoreText: async () => ({}), parseWebhook, verifyWebhook },
      applyVerdict,
    });

    expect(result.status).toBe(401);
    expect(verifyWebhook).toHaveBeenCalledWith({ rawBody: '{}', headers: {} });
    expect(parseWebhook).not.toHaveBeenCalled();
    expect(applyVerdict).not.toHaveBeenCalled();
  });

  it('proceeds when the vendor signature verifies', async () => {
    const applyVerdict = vi.fn().mockResolvedValue(undefined);
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: {
        scoreText: async () => ({}),
        parseWebhook: () => [verdict],
        verifyWebhook: () => true,
      },
      applyVerdict,
    });

    expect(result.status).toBe(200);
    expect(applyVerdict).toHaveBeenCalledWith(verdict);
  });

  it('acknowledges a delivery carrying no verdicts without applying anything', async () => {
    // e.g. Lasso's dashboard webhook also delivers tag/strike/list actions —
    // a 200 stops the vendor from retrying them forever.
    const applyVerdict = vi.fn();
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: provider(() => []),
      applyVerdict,
    });

    expect(result.status).toBe(200);
    expect(applyVerdict).not.toHaveBeenCalled();
  });

  it('applies every verdict in a batched delivery', async () => {
    const second: ModerationVerdict = { ...verdict, mediaId: '0' };
    const applyVerdict = vi.fn().mockResolvedValue(undefined);
    const result = await handleModerationWebhook(body, {
      expectedSecret: 'sekret',
      provider: provider(() => [verdict, second]),
      applyVerdict,
    });

    expect(result.status).toBe(200);
    expect(applyVerdict).toHaveBeenCalledTimes(2);
    expect(applyVerdict).toHaveBeenNthCalledWith(1, verdict);
    expect(applyVerdict).toHaveBeenNthCalledWith(2, second);
  });

  it('rejects with 401 when no expected secret is configured', async () => {
    const applyVerdict = vi.fn();
    const result = await handleModerationWebhook(body, {
      expectedSecret: undefined,
      provider: provider(() => [verdict]),
      applyVerdict,
    });

    expect(result.status).toBe(401);
    expect(applyVerdict).not.toHaveBeenCalled();
  });
});
