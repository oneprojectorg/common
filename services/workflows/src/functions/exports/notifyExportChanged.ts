import type { ChannelName } from '@op/common/realtime';
import { realtime } from '@op/realtime/server';

/**
 * Tell whoever is waiting on an export that its status record has moved.
 *
 * Broadcast-only: the record written just before the call is the source of
 * truth, and the message carries no payload — subscribers re-read the status
 * query on receipt.
 *
 * Sent for the intermediate `processing` write as well as for the terminal one.
 * Publishing only at the end left `processing` written but unannounced, so the
 * control sat on "Preparing..." for the whole run and reached "Generating..."
 * only when a re-read happened to land inside that window.
 *
 * Nothing polls behind this, so a lost broadcast costs correctness, not latency.
 * Lose the terminal one and the client never sees a terminal state: the wait
 * reports a timeout for an export that worked.
 *
 * One way to lose it is to publish before the client finishes subscribing. An
 * export that settles in under a second can do that easily.
 *
 * Covering it is not this function's job. Every channel re-reads its queries
 * once its join is confirmed. Whatever settled before the join is in that read,
 * and whatever settles after arrives here.
 *
 * `realtime.publish` logs and swallows its own failures, so this cannot fail the
 * run or trigger a retry that would rewrite a settled status.
 *
 * @param channel - The run's own channel. Scoped per run, so one export cannot
 *   wake another's subscriber.
 */
export const notifyExportChanged = (channel: ChannelName) =>
  realtime.publish(channel, {
    // A fresh id per publish, as the codebase's other publishers mint one. The
    // client drops a broadcast carrying an id it has already handled, so any id
    // shared across a run's two reports would let `processing` suppress the
    // terminal one and cost the reader the download link outright.
    mutationId: crypto.randomUUID(),
  });
