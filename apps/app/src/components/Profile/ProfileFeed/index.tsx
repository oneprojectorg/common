import { getPublicUrl } from '@/utils';
import { trpc } from '@op/trpc/client';
import type { Organization, PostToOrganization } from '@op/trpc/encoders';
import { Button } from '@op/ui/Button';
import { TextArea } from '@op/ui/Field';
import { Form } from '@op/ui/Form';
import { Header3 } from '@op/ui/Header';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { LuImage, LuLeaf, LuPaperclip } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

// TODO: generated this quick with AI. refactor it!
const formatRelativeTime = (timestamp: Date | string | number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // difference in seconds

  // Future dates handling
  if (diff < 0) {
    return 'in the future';
  }

  // For very recent times
  if (diff < 5) {
    return 'just now';
  }

  const intervals = [
    { unit: 'year', seconds: 31557600 },
    { unit: 'month', seconds: 2629800 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    if (diff >= interval.seconds) {
      const count = Math.floor(diff / interval.seconds);

      return `${count} ${interval.unit}${count !== 1 ? 's' : ''}`;
    }
  }

  return 'just now';
};

const FeedItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return <div className={cn('flex gap-4', className)}>{children}</div>;
};

const FeedContent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return <div className={cn('leading-6', className)}>{children}</div>;
};

const FeedHeader = ({ children }: { children: ReactNode }) => {
  return <span className="flex items-baseline gap-2">{children}</span>;
};

const FeedAvatar = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="shadown relative w-8 min-w-8 overflow-hidden">
      {children}
    </div>
  );
};

const FeedMain = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'flex min-h-16 w-full flex-col items-start justify-start gap-3',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const ProfileFeedPost = ({
  profile,
  className,
}: {
  profile: Organization;
  className?: string;
}) => {
  const [content, setContent] = useState('');
  const t = useTranslations();
  const utils = trpc.useContext();
  const createPost = trpc.organization.createPost.useMutation({
    onMutate: (newPost) => {
      // Cancel any outgoing refetches for the posts query
      // await utils.organization.listPosts.cancel();
      // Snapshot the previous list of posts
      const previousPosts = utils.organization.listPosts.getData({
        slug: profile.slug,
      });

      // Optimistically update the cache with the new post
      // @ts-expect-error - temporary
      utils.organization.listPosts.setData({ slug: profile.slug }, (old) =>
        old
          ? [...old, { ...newPost, createdAt: new Date() }]
          : [{ ...newPost, createdAt: new Date() }],
      );

      return { previousPosts };
    },
    onError: (
      _,
      __,
      context: { previousPosts?: Array<PostToOrganization> } | undefined,
    ) => {
      // Roll back to the previous posts on error
      utils.organization.listPosts.setData(
        { slug: profile.slug },
        context?.previousPosts || [],
      );
    },
    onSettled: () => {
      // Invalidate the posts query to sync with the server
      void utils.organization.listPosts.invalidate({ slug: profile.slug });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (content.trim()) {
      createPost.mutate({ id: profile.id, content });
      setContent('');
    }
  };

  const profileImageUrl = getPublicUrl(profile.avatarImage?.name);

  return (
    <div className={cn('flex flex-col gap-8 pb-8', className)}>
      <FeedItem>
        <FeedAvatar>
          {profileImageUrl ? (
            <Image
              src={profileImageUrl}
              alt=""
              fill
              className="!size-8 max-h-8 max-w-8 rounded-full"
            />
          ) : (
            <div className="size-8 rounded-full border bg-white" />
          )}
        </FeedAvatar>
        <FeedMain>
          <Form onSubmit={handleSubmit} className="flex w-full flex-row gap-4">
            <TextArea
              className="size-full min-h-12 border-none"
              placeholder={`Post an update from ${profile.name}…`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {content.length > 0 && (
              <Button color="secondary" type="submit">
                {t('Post')}
              </Button>
            )}
          </Form>
          <div className="flex gap-6">
            <div className="flex gap-1 text-charcoal">
              <LuImage className="size-4" />
              {t('Media')}
            </div>
            <div className="flex gap-1 text-charcoal">
              <LuPaperclip className="size-4" />
              {t('Resource')}
            </div>
          </div>
        </FeedMain>
      </FeedItem>
    </div>
  );
};

export const ProfileFeed = ({
  profile,
  className,
}: {
  profile: Organization;
  className?: string;
}) => {
  const t = useTranslations();
  const [posts] = trpc.organization.listPosts.useSuspenseQuery({
    slug: profile.slug,
  });

  const profileImageUrl = getPublicUrl(profile.avatarImage?.name);

  return (
    <div className={cn('flex flex-col gap-8 pb-8', className)}>
      {posts.length > 0 ? (
        posts.map(({ content, createdAt }, i) => (
          <FeedItem key={i}>
            <FeedAvatar>
              {profileImageUrl ? (
                <Image
                  src={profileImageUrl}
                  alt=""
                  fill
                  className="!size-8 max-h-8 max-w-8 rounded-full"
                />
              ) : (
                <div className="size-8 rounded-full border bg-white" />
              )}
            </FeedAvatar>
            <FeedMain>
              <FeedHeader>
                <Header3 className="font-medium leading-5">
                  {profile.name}
                </Header3>
                {createdAt ? (
                  <span className="text-xs text-darkGray">
                    {formatRelativeTime(createdAt)}
                  </span>
                ) : null}
              </FeedHeader>
              <FeedContent>{content}</FeedContent>
            </FeedMain>
          </FeedItem>
        ))
      ) : (
        <FeedItem>
          <FeedMain className="flex w-full flex-col items-center justify-center py-6">
            <FeedContent className="flex flex-col items-center justify-center text-neutral-gray4">
              <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
                <LuLeaf />
              </div>
              <span>{t('No posts yet.')}</span>
            </FeedContent>
          </FeedMain>
        </FeedItem>
      )}
    </div>
  );
};
