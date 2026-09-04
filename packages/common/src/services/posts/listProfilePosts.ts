import { type AccessUser } from '../access';
import { assertPostReadAccess } from './access';
import { getPostsPageForProfiles } from './getPostsPageForProfiles';

export const listProfilePosts = async ({
  user,
  profileId,
  limit = 20,
  cursor,
}: {
  user: AccessUser | undefined;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}) => {
  // Moderation standing comes back resolved on the decision, so a proposal's
  // own owner doesn't moderate their proposal's feed.
  const { moderationProfileId } = await assertPostReadAccess({
    user,
    profileId,
  });

  const { items, next } = await getPostsPageForProfiles({
    user,
    profileIds: [profileId],
    moderationProfileId,
    limit,
    cursor,
  });

  return {
    items: items.map((item) => item.post),
    next,
  };
};
