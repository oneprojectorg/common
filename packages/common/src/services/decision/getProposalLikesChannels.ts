import { logger } from '@op/logging';
import { createHmac } from 'node:crypto';

import { Channels, type DecisionProposalLikesChannel } from '../../realtime';

// A missing key is a deployment gap, so say so once rather than per request.
let hasWarnedMissingKey = false;

/**
 * Realtime channels are public, so the reader's Liked-list channel is named by
 * an HMAC of the liker rather than the profile id. The key is single-purpose:
 * leaking it exposes channel names and nothing else.
 */
export const getProposalLikesChannels = ({
  processInstanceId,
  profileId,
}: {
  processInstanceId: string;
  /** The liker; none means there is no Liked list to refresh. */
  profileId?: string;
}): DecisionProposalLikesChannel[] => {
  if (!profileId) {
    return [];
  }

  const key = process.env.REALTIME_CHANNEL_SECRET;
  if (!key) {
    if (!hasWarnedMissingKey) {
      hasWarnedMissingKey = true;
      logger.warn(
        'REALTIME_CHANNEL_SECRET is unset; Liked lists will not refresh live',
      );
    }
    return [];
  }

  const likerKey = createHmac('sha256', key)
    .update(`decisionProposalLikes:${processInstanceId}:${profileId}`)
    .digest('hex')
    .slice(0, 32);

  return [Channels.decisionProposalLikes(processInstanceId, likerKey)];
};
