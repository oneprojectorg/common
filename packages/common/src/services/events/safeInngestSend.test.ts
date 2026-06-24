import { Events, inngest, safeInngestSend } from '@op/events';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeInngestSend', () => {
  it('forwards the event to inngest.send and resolves to undefined', async () => {
    const sendSpy = vi
      .spyOn(inngest, 'send')
      .mockResolvedValueOnce({ ids: ['evt-1'] });

    const result = await safeInngestSend({
      name: Events.proposalSubmitted.name,
      data: { proposalId: '00000000-0000-0000-0000-000000000001' },
    });

    expect(result).toBeUndefined();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({
      name: Events.proposalSubmitted.name,
      data: { proposalId: '00000000-0000-0000-0000-000000000001' },
    });
  });

  it('swallows inngest.send failures and logs them with the event name', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('inngest brownout');
    vi.spyOn(inngest, 'send').mockRejectedValueOnce(failure);

    await expect(
      safeInngestSend({
        name: Events.contentSubmitted.name,
        data: {
          itemType: 'proposal',
          itemId: '00000000-0000-0000-0000-000000000002',
        },
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      'inngest_send_failed',
      expect.objectContaining({
        eventNames: [Events.contentSubmitted.name],
        error: failure,
      }),
    );
  });
});
