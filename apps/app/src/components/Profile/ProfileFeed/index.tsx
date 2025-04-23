import { Header3 } from '@/components/Header';
import { getPublicUrl } from '@/utils';
import Image from 'next/image';
import { useState } from 'react';
import { LuImage, LuPaperclip } from 'react-icons/lu';

import { trpc } from '@op/trpc/client';
import { Button } from '@op/ui/Button';
import { TextArea } from '@op/ui/Field';
import { Form } from '@op/ui/Form';
import { cn } from '@op/ui/utils';

import type { Organization, Post } from '@op/trpc/encoders';
import type { ReactNode } from 'react';

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
  return <div className="relative w-16 min-w-16">{children}</div>;
};

const FeedMain = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-16 w-full flex-col items-start justify-start gap-3">
      {children}
    </div>
  );
};

export const ProfileFeed = ({ profile }: { profile: Organization }) => {
  const [posts] = trpc.organization.listPosts.useSuspenseQuery({
    slug: profile.slug,
  });

  const [content, setContent] = useState('');
  const utils = trpc.useContext();
  const createPost = trpc.organization.createPost.useMutation({
    onMutate: async (newPost) => {
      // Cancel any outgoing refetches for the posts query
      await utils.organization.listPosts.cancel();
      // Snapshot the previous list of posts
      const previousPosts = utils.organization.listPosts.getData({
        slug: profile.slug,
      });

      // Optimistically update the cache with the new post
      // @ts-expect-error - temporary
      utils.organization.listPosts.setData({ slug: profile.slug }, old =>
        old
          ? [...old, { ...newPost, createdAt: new Date() }]
          : [{ ...newPost, createdAt: new Date() }]);

      return { previousPosts };
    },
    onError: (_, __, context: { previousPosts?: Array<Post> } | undefined) => {
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
    <div className="flex flex-col gap-8">
      <FeedItem>
        <FeedAvatar>
          {profileImageUrl
            ? (
                <Image
                  src={profileImageUrl}
                  alt=""
                  fill
                  className="!size-16 max-h-16 max-w-16"
                />
              )
            : (
                <div className="size-16 rounded-full border bg-white shadow" />
              )}
        </FeedAvatar>
        <FeedMain>
          <Form onSubmit={handleSubmit} className="flex w-full flex-row gap-4">
            <TextArea
              className="size-full border-none"
              placeholder={`Post an update from ${profile.name}…`}
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            {content.length > 0 && (
              <Button color="secondary" type="submit">
                Post
              </Button>
            )}
          </Form>
          <div className="flex gap-6">
            <div className="flex gap-1 text-charcoal">
              <LuImage className="size-4" />
              Media
            </div>
            <div className="flex gap-1 text-charcoal">
              <LuPaperclip className="size-4" />
              Resource
            </div>
          </div>
        </FeedMain>
      </FeedItem>
      <span className="-ml-6 w-[calc(100%+3rem)] border-b border-offWhite p-0" />
      {posts.length > 0
        ? (
            posts.map(({ content, createdAt }, i) => (
              <FeedItem key={i}>
                <FeedAvatar>
                  {profileImageUrl
                    ? (
                        <Image
                          src={profileImageUrl}
                          alt=""
                          fill
                          className="!size-16 max-h-16 max-w-16"
                        />
                      )
                    : (
                        <div className="size-16 rounded-full border bg-white shadow" />
                      )}
                </FeedAvatar>
                <FeedMain>
                  <FeedHeader>
                    <Header3 className="font-medium leading-5">
                      {profile.name}
                    </Header3>
                    {createdAt
                      ? (
                          <span className="text-xs text-darkGray">
                            {formatRelativeTime(createdAt)}
                          </span>
                        )
                      : null}
                  </FeedHeader>
                  <FeedContent>{content}</FeedContent>
                </FeedMain>
              </FeedItem>
            ))
          )
        : (
            <FeedItem>
              <FeedAvatar />
              <FeedMain>
                <FeedContent className="text-lightGray">No posts yet</FeedContent>
              </FeedMain>
            </FeedItem>
          )}
    </div>
  );
};
