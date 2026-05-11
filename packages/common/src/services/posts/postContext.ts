import { db } from '@op/db/client';
import { posts as postsTable, postsToProfiles } from '@op/db/schema';
import { eq } from 'drizzle-orm';

import type { ChannelName } from '../../realtime/channels/channels';
import { Channels } from '../../realtime/channels/channels';

export type PostContext = {
  associatedProfileIds: string[];
  parentPostId: string | null;
  rootProfileId: string | null;
};

export const loadPostContext = async (postId: string): Promise<PostContext> => {
  const [associations, post] = await Promise.all([
    db
      .select({ profileId: postsToProfiles.profileId })
      .from(postsToProfiles)
      .where(eq(postsToProfiles.postId, postId)),
    db
      .select({
        parentPostId: postsTable.parentPostId,
        rootProfileId: postsTable.rootProfileId,
      })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1),
  ]);
  return {
    associatedProfileIds: associations.map((a) => a.profileId),
    parentPostId: post[0]?.parentPostId ?? null,
    rootProfileId: post[0]?.rootProfileId ?? null,
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
