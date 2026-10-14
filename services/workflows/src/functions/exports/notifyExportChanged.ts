import type { ChannelName } from '@op/common/realtime';
import { realtime } from '@op/realtime/server';

export const notifyExportChanged = (channel: ChannelName) =>
  realtime.publish(channel, {
    // Unique per publish: the client ignores ids it has already handled.
    mutationId: crypto.randomUUID(),
  });
