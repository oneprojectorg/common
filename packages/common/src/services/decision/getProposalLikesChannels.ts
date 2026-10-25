import { createHmac } from 'node:crypto';

import { Channels, type DecisionProposalLikesChannel } from '../../realtime';

/**
 * Realtime channels are public, so the reader's Liked-list channel is named by
 * an HMAC of the liker rather than the profile id. The key is single-purpose:
 * leaking it exposes channel names and nothing else. Skipped without a key.
 */
export const getProposalLikesChannels = ({
  processInstanceId,
  profileId,
}: {
  processInstanceId: string;
  profileId: string;
}): DecisionProposalLikesChannel[] => {
  const key = process.env.REALTIME_CHANNEL_SECRET;
  if (!key) {
    return [];
  }

  const likerKey = createHmac('sha256', key)
    .update(`decisionProposalLikes:${processInstanceId}:${profileId}`)
    .digest('hex')
    .slice(0, 32);

  return [Channels.decisionProposalLikes(processInstanceId, likerKey)];
};
