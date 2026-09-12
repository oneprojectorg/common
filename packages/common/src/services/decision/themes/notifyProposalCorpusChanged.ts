import { Events, event } from '@op/events';
import { logger } from '@op/logging';

/**
 * Tells the scheduled theme analysis that an instance's proposals changed.
 *
 * Called from every mutation that alters the set an analysis reads — submit,
 * edit of a submitted proposal, merge, unmerge, reject, unreject, delete — with
 * only the instance id, because that is the one thing the consumer debounces
 * on. The mutations already have it in hand, which is why this is emitted from
 * them rather than derived downstream from the per-proposal events: deletion
 * has no event of its own, and the ones that exist carry a proposal id that
 * would cost the consumer a lookup per event to turn into an instance.
 *
 * Never throws. The mutation has already committed by the time this is called,
 * and a refresh that does not get scheduled is a stale analysis until the next
 * change, not a failed submission. Callers run it under `waitUntil` so the
 * response is not held for it either.
 */
export const notifyProposalCorpusChanged = async ({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<void> => {
  try {
    await event.send({
      name: Events.proposalCorpusChanged.name,
      data: { processInstanceId },
    });
  } catch (error) {
    logger.error('Failed to send proposal corpus changed event', {
      processInstanceId,
      error,
    });
  }
};
