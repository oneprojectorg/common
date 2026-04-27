import { db } from '@op/db/client';
import {
  EntityType,
  posts as postsTable,
  postsToProfiles,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';

import type { ChannelName } from '../../realtime/channels/channels';
import { Channels } from '../../realtime/channels/channels';
import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { decisionPermission } from '../decision/permissions';

export type PostContext = {
  associatedProfileIds: string[];
  parentPostId: string | null;
};

export const loadPostContext = async (postId: string): Promise<PostContext> => {
  const [associations, post] = await Promise.all([
    db
      .select({ profileId: postsToProfiles.profileId })
      .from(postsToProfiles)
      .where(eq(postsToProfiles.postId, postId)),
    db
      .select({ parentPostId: postsTable.parentPostId })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1),
  ]);
  return {
    associatedProfileIds: associations.map((a) => a.profileId),
    parentPostId: post[0]?.parentPostId ?? null,
  };
};

export const channelsForPost = ({
  associatedProfileIds,
  parentPostId,
}: PostContext): ChannelName[] => {
  const channels: ChannelName[] = associatedProfileIds.map((profileId) =>
    Channels.profilePosts(profileId),
  );
  if (parentPostId) {
    channels.push(Channels.postComments(parentPostId));
  }
  return channels;
};

// Authorizes a user for a reaction action against the post's associated
// profiles. Centralized here so the tRPC router stays thin.
export const authorizeReactionForPost = async ({
  user,
  postId,
}: {
  user: { id: string };
  postId: string;
}): Promise<{ context: PostContext; profileId: string }> => {
  const context = await loadPostContext(postId);
  await assertProfileTypeAccess({
    user,
    profileIds: context.associatedProfileIds,
    policies: {
      [EntityType.DECISION]: {
        decisions: decisionPermission.SUBMIT_PROPOSALS,
      },
    },
  });
  const profileId = await getCurrentProfileId(user.id);
  return { context, profileId };
};
