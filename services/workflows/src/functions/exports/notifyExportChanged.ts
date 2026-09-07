import type { ChannelName } from '@op/common/realtime';
import { realtime } from '@op/realtime/server';

/**
 * Announce that an export's status record moved. Broadcast-only — the record is
 * the source of truth and subscribers re-read it on receipt.
 *
 * Nothing polls behind this, so a lost terminal broadcast leaves the client
 * waiting out a timeout on an export that worked. `realtime.publish` swallows
 * its own failures, so this cannot fail the run.
 */
export const notifyExportChanged = (channel: ChannelName) =>
  realtime.publish(channel, {
    // Fresh per publish: the client drops a broadcast whose id it has already
    // handled, so a shared id would let `processing` suppress the terminal one.
    mutationId: crypto.randomUUID(),
  });
