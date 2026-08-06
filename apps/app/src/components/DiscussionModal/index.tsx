'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization, Post } from '@op/api/encoders';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Empty,
  EmptyHeader,
  EmptyDescription,
  EmptyMedia,
} from '@op/sense/Empty';
import { useCallback, useRef } from 'react';
import React from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { CommentSkeleton } from '../posts/Comments';

export function DiscussionModal({
  post,
  organization,
  isOpen,
  onClose,
}: {
  post: Post;
  organization: Organization | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const t = useTranslations();
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const { handleReactionClick, handleCommentClick } = usePostFeedActions();

  // Get comments for the post using getPosts without profileId (works for all post types)
  const { data: commentsData, isLoading } = trpc.posts.getPosts.useQuery(
    {
      parentPostId: post.id,
      limit: 50,
      offset: 0,
      includeChildren: false,
    },
    { enabled: isOpen },
  );

  const comments = commentsData || [];

  // Function to scroll to show the bottom of the original post after adding a comment
  const scrollToOriginalPost = useCallback(() => {
    if (commentsContainerRef.current) {
      // Small delay to ensure DOM has updated with new comment
      setTimeout(() => {
        const container = commentsContainerRef.current;
        if (container) {
          const originalPostContainer =
            container.querySelector('.originalPost');
          if (originalPostContainer) {
            // Scroll to show the bottom of the original post with some padding
            originalPostContainer.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest',
            });
          }
        }
      }, 100);
    }
  }, []);

  const sourcePostProfile = post.profile;

  // Get the post author's name for the header
  const authorName =
    sourcePostProfile?.name ?? organization?.profile.name ?? '';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="grid h-svh w-screen max-w-md grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-none p-0 text-start sm:max-h-[80svh] sm:max-w-lg sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {t.rich("<bdi>{authorName}</bdi>'s Post", {
              authorName,
              bdi: (chunks: React.ReactNode) => <bdi>{chunks}</bdi>,
            })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pt-6" ref={commentsContainerRef}>
          {/* Original Post Display */}
          <PostFeed className="originalPost border-none pb-0">
            <PostItem
              post={post}
              organization={organization ?? null}
              user={user}
              withLinks={false}
              onReactionClick={handleReactionClick}
              className="px-4"
            />
            <hr />
          </PostFeed>
          {/* Comments Display */}
          {isLoading ? (
            <PostFeed className="border-none">
              <CommentSkeleton />
            </PostFeed>
          ) : comments.length > 0 ? (
            <div
              role="feed"
              aria-label={t('{count} comments', { count: comments.length })}
            >
              <PostFeed className="border-none pt-6">
                {comments.map((comment, i) => (
                  <React.Fragment key={comment.id}>
                    <div
                      data-comment-item
                      data-comment-id={comment.id}
                      data-is-first-comment={i === 0}
                    >
                      <PostItem
                        post={comment}
                        organization={organization ?? null}
                        user={user}
                        withLinks={false}
                        onReactionClick={handleReactionClick}
                        onCommentClick={handleCommentClick}
                        className="px-4"
                      />
                    </div>
                    {comments.length !== i + 1 && <hr />}
                  </React.Fragment>
                ))}
              </PostFeed>
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LuLeaf />
                </EmptyMedia>
                <EmptyDescription>
                  {t('No comments yet. Be the first to comment!')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>

        {/* Comment Input using PostUpdate */}
        <DialogFooter className="sticky">
          <PostUpdate
            parentPostId={post.id}
            placeholder={
              user?.currentProfile?.name
                ? t('Comment as {name}...', {
                    name: user.currentProfile.name,
                  })
                : t('Comment...')
            }
            label={t('Comment')}
            onSuccess={scrollToOriginalPost}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
