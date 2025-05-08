import { trpc } from '@op/trpc/client';
import type { Organization } from '@op/trpc/encoders';

import { PostFeed } from '@/components/PostFeed';

export const ProfileFeed = ({
  profile,
  className,
}: {
  profile: Organization;
  className?: string;
}) => {
  const [posts] = trpc.organization.listPosts.useSuspenseQuery({
    slug: profile.slug,
  });

  return <PostFeed posts={posts} profile={profile} className={className} />;
};
