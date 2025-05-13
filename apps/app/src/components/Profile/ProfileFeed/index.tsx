import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';

import { PostFeed } from '@/components/PostFeed';

export const ProfileFeed = ({
  profile,
  className,
}: {
  profile: Organization;
  className?: string;
}) => {
  const [posts] = trpc.organization.listPosts.useSuspenseQuery(
    {
      slug: profile.slug,
    },
    {
      staleTime: 0, // Data is always considered stale
      refetchOnMount: true, // Always refetch when component mounts
      refetchOnWindowFocus: true, // Always refetch when window gets focus
      refetchOnReconnect: true, // Always refetch when reconnecting
    },
  );

  return <PostFeed posts={posts} className={className} />;
};
