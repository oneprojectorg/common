import { db, eq } from '@op/db/client';
import { proposals } from '@op/db/schema';

import type { ChannelName } from '../../realtime/channels/channels';
import { Channels } from '../../realtime/channels/channels';
import { channelsForPost, loadPostContext } from '../posts/postContext';
import type { ModerationItemType } from './types';

/**
 * The realtime channels whose subscribed queries surface a moderated item —
 * the same channels the item's own mutations broadcast to. A moderation flag
 * changing state (flagged ↔ dismissed) changes the item's visibility for
 * every reader, so the caller publishes an invalidation to these channels and
 * subscribed clients refetch immediately instead of waiting for a manual
 * reload.
 *
 * Unlike mutation handlers (which already hold their channel ids in context),
 * a provider webhook carries only the item ref — resolving channels here
 * costs one indexed lookup per verdict, which is why this is a deliberate
 * exception to the "don't query the db for channels" rule.
 */
export const getModerationItemChannels = async (
  itemType: ModerationItemType,
  itemId: string,
): Promise<ChannelName[]> => {
  if (itemType === 'proposal') {
    const [proposal] = await db
      .select({ processInstanceId: proposals.processInstanceId })
      .from(proposals)
      .where(eq(proposals.id, itemId))
      .limit(1);
    if (!proposal) {
      return [];
    }
    return [
      Channels.decisionProposals(proposal.processInstanceId),
      Channels.decisionProposal(proposal.processInstanceId, itemId),
    ];
  }

  if (itemType === 'post') {
    return channelsForPost(await loadPostContext(itemId));
  }

  // Flagged users carry no feed surface to invalidate.
  return [];
};
