'use client';

import { getPublicUrl } from '@/utils';
import { OrganizationUser } from '@/utils/UserProvider';
import { detectLinks, linkifyText } from '@/utils/linkDetection';
import { trpc } from '@op/api/client';
import type { PostToOrganization } from '@op/api/encoders';
import { REACTION_OPTIONS } from '@op/types';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { ReactionsButton } from '@op/ui/ReactionsButton';
import { toast } from '@op/ui/Toast';
import Image from 'next/image';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { LuEllipsis, LuMessageCircle } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { formatRelativeTime } from '../PostFeed';
import { FeedItem, FeedMain, FeedHeader, FeedContent, FeedAvatar } from '../FeedComponents';
import { LinkPreview } from '../LinkPreview';
import { OrganizationAvatar } from '../OrganizationAvatar';
import { DeletePost } from '../PostFeed/DeletePost';

interface PostItemProps {
  organization: PostToOrganization['organization'];
  post: PostToOrganization['post'];
  user?: OrganizationUser;
  withLinks?: boolean;
  withActions?: boolean;
  onCommentClick?: () => void;
  commentCount?: number;
  className?: string;
  slug?: string;
  limit?: number;
}

export const PostItem = ({
  organization,
  post,
  user,
  withLinks = true,
  withActions = true,
  onCommentClick,
  commentCount,
  className,
  slug,
  limit = 20,
}: PostItemProps) => {
  const reactionsEnabled = useFeatureFlagEnabled('reactions');
  const utils = trpc.useUtils();

  const toggleReaction = trpc.organization.toggleReaction.useMutation({
    onMutate: async ({ postId, reactionType }) => {
      // Cancel any outgoing refetches
      if (slug) {
        await utils.organization.listPosts.cancel({ slug, limit });
      }
      await utils.organization.listAllPosts.cancel({});

      // Snapshot the previous values
      const previousListPosts = slug
        ? utils.organization.listPosts.getInfiniteData({ slug, limit })
        : undefined;
      const previousListAllPosts = utils.organization.listAllPosts.getData({});

      // Helper function to update post reactions
      const updatePostReactions = (item: any) => {
        if (item.post.id === postId) {
          const currentReaction = item.post.userReaction;
          const currentCounts = item.post.reactionCounts || {};

          // Check if user already has this reaction
          const hasReaction = currentReaction === reactionType;

          if (hasReaction) {
            // Remove reaction
            return {
              ...item,
              post: {
                ...item.post,
                userReaction: null,
                reactionCounts: {
                  ...currentCounts,
                  [reactionType]: Math.max(
                    0,
                    (currentCounts[reactionType] || 0) - 1,
                  ),
                },
              },
            };
          } else {
            // Replace or add reaction
            const newCounts = { ...currentCounts };

            // If user had a previous reaction, decrement its count
            if (currentReaction) {
              newCounts[currentReaction] = Math.max(
                0,
                (newCounts[currentReaction] || 0) - 1,
              );
            }

            // Increment count for new reaction
            newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;

            return {
              ...item,
              post: {
                ...item.post,
                userReaction: reactionType,
                reactionCounts: newCounts,
              },
            };
          }
        }
        return item;
      };

      // Optimistically update listPosts cache (if slug is provided)
      if (slug) {
        utils.organization.listPosts.setInfiniteData(
          { slug, limit },
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                items: page.items.map(updatePostReactions),
              })),
            };
          },
        );
      }

      // Optimistically update listAllPosts cache
      utils.organization.listAllPosts.setData({}, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map(updatePostReactions),
        };
      });

      return { previousListPosts, previousListAllPosts };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousListPosts && slug) {
        utils.organization.listPosts.setInfiniteData(
          { slug, limit },
          context.previousListPosts,
        );
      }
      if (context?.previousListAllPosts) {
        utils.organization.listAllPosts.setData(
          {},
          context.previousListAllPosts,
        );
      }
      toast.error({ message: err.message || 'Failed to update reaction' });
    },
    onSuccess: () => {
      // Skip invalidation to preserve optimistic updates
    },
  });

  const handleReactionClick = (postId: string, emoji: string) => {
    // Convert emoji to reaction type using REACTION_OPTIONS
    const reactionOption = REACTION_OPTIONS.find(
      (option) => option.emoji === emoji,
    );
    const reactionType = reactionOption?.key;

    if (!reactionType) {
      console.error('Unknown emoji:', emoji);
      return;
    }

    toggleReaction.mutate({ postId, reactionType });
  };

  const { urls } = detectLinks(post?.content);

  return (
    <FeedItem className={className}>
      <FeedAvatar>
        <OrganizationAvatar
          organization={organization}
          withLink={withLinks}
          className="!size-8 max-h-8 max-w-8"
        />
      </FeedAvatar>
      <FeedMain>
        <FeedHeader className="relative w-full justify-between">
          <div className="flex items-baseline gap-2">
            <Header3 className="font-medium leading-3">
              {withLinks ? (
                <Link href={`/org/${organization?.profile.slug}`}>
                  {organization?.profile.name}
                </Link>
              ) : (
                organization?.profile.name
              )}
            </Header3>
            {post?.createdAt ? (
              <span className="text-sm text-neutral-gray4">
                {formatRelativeTime(post?.createdAt)}
              </span>
            ) : null}
          </div>
          {withActions && organization?.id === user?.currentOrganization?.id &&
            post?.id && (
              <MenuTrigger>
                <Button
                  unstyled
                  color="neutral"
                  variant="icon"
                  size="small"
                  className="absolute right-0 top-0 size-6 rounded-full border-0 bg-white p-1 outline-0 aria-expanded:bg-neutral-gray1"
                >
                  <LuEllipsis className="size-4" />
                </Button>
                <Popover placement="bottom end">
                  {post?.id && organization?.id ? (
                    <DeletePost
                      postId={post.id}
                      organizationId={organization.id}
                    />
                  ) : null}
                </Popover>
              </MenuTrigger>
            )}
        </FeedHeader>
        <FeedContent>
          {post?.content ? linkifyText(post.content) : null}
          {post.attachments
            ? post.attachments.map(({ fileName, storageObject }) => {
                const { mimetype, size } = storageObject.metadata;

                return (
                  <MediaDisplay
                    key={storageObject.id}
                    title={fileName}
                    mimeType={mimetype}
                    url={
                      getPublicUrl(storageObject.name) ?? undefined
                    }
                    size={size}
                  >
                    {mimetype.startsWith('image/') ? (
                      <div className="relative flex h-fit w-full items-center justify-center rounded bg-neutral-gray1 text-white">
                        <Image
                          src={getPublicUrl(storageObject.name) ?? ''}
                          alt={fileName}
                          fill={true}
                          className="!relative size-full object-cover"
                        />
                      </div>
                    ) : null}
                  </MediaDisplay>
                );
              })
            : null}
          {urls.length > 0 && (
            <div>
              {urls.map((url) => (
                <LinkPreview key={url} url={url} />
              ))}
            </div>
          )}
          {withActions && (
            <div className="flex items-center gap-3">
              {reactionsEnabled && post?.id && (
                <ReactionsButton
                  reactions={
                    post.reactionCounts
                      ? Object.entries(post.reactionCounts).map(
                          ([reactionType, count]) => {
                            // Convert reaction type to emoji
                            const reactionOption =
                              REACTION_OPTIONS.find(
                                (option) => option.key === reactionType,
                              );
                            const emoji =
                              reactionOption?.emoji || reactionType;

                            return {
                              emoji,
                              count,
                              isActive:
                                post.userReaction === reactionType,
                            };
                          },
                        )
                      : []
                  }
                  reactionOptions={REACTION_OPTIONS}
                  onReactionClick={(emoji) => {
                    handleReactionClick(post.id!, emoji);
                  }}
                  onAddReaction={(emoji) => {
                    handleReactionClick(post.id!, emoji);
                  }}
                />
              )}
              {post?.id && onCommentClick && (
                <Button
                  variant="icon"
                  size="small"
                  onPress={onCommentClick}
                  className="bg-neutral-offwhite flex items-center gap-1 rounded px-2 py-1 text-neutral-gray4 transition-colors hover:bg-neutral-gray1 hover:text-neutral-charcoal"
                >
                  <LuMessageCircle className="size-4" />
                  <span className="text-xs font-normal">
                    {commentCount === 1 ? '1 comment' : `${commentCount || 0} comments`}
                  </span>
                </Button>
              )}
            </div>
          )}
        </FeedContent>
      </FeedMain>
    </FeedItem>
  );
};