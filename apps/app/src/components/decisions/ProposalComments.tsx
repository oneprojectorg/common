'use client';

import { useOptionalUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { useCallback, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';

export function ProposalComments({
  proposal,
  readOnly = false,
}: {
  proposal: Proposal;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const { user } = useOptionalUser();
  const containerRef = useRef<HTMLDivElement>(null);

  // Public / anonymous visitors have no account to compose as — they read
  // comments only. (getMyAccount resolves to null for them, so PostUpdate,
  // which needs the current profile, can't render anyway.)
  const canCompose = !readOnly && !!user;

  const { data: commentsData, isLoading: commentsLoading } =
    trpc.posts.getPosts.useQuery({
      profileId: proposal.profileId || undefined,
      parentPostId: null,
      limit: 50,
      offset: 0,
      includeChildren: false,
    });

  const comments = commentsData || [];
  const { handleReactionClick } = usePostFeedActions();

  const scrollToComments = useCallback(() => {
    setTimeout(() => {
      containerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    }, 100);
  }, []);

  return (
    <div ref={containerRef}>
      <div className="border-t pt-8">
        <Header3 className="mb-6">
          {t('Comments')} ({comments.length})
        </Header3>

        {canCompose && (
          <div className="mb-8">
            <Surface className="border-0 p-0 sm:border sm:p-4">
              <PostUpdate
                profileId={proposal.profileId || undefined}
                placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` as ${user.currentProfile?.name}` : ''}...`}
                label={t('Comment')}
                onSuccess={scrollToComments}
                proposalId={proposal.id}
                processInstanceId={proposal.processInstanceId}
              />
            </Surface>
          </div>
        )}

        {commentsLoading ? (
          <div
            className="py-8 text-center text-gray-500"
            role="status"
            aria-label={t('Loading comments')}
          >
            {t('Loading comments...')}
          </div>
        ) : comments.length > 0 ? (
          <div role="feed" aria-label={`${comments.length} comments`}>
            <PostFeed>
              {comments.map((comment, i) => (
                <div key={comment.id}>
                  <PostItem
                    post={comment}
                    organization={null}
                    user={user ?? undefined}
                    withLinks={false}
                    onReactionClick={handleReactionClick}
                    className="sm:px-0"
                  />
                  {comments.length !== i + 1 && <hr className="my-4" />}
                </div>
              ))}
            </PostFeed>
          </div>
        ) : (
          <div
            className="py-8 text-center text-gray-500"
            role="status"
            aria-label={t('No comments')}
          >
            {canCompose
              ? t('No comments yet. Be the first to comment!')
              : t('No comments yet.')}
          </div>
        )}
      </div>
    </div>
  );
}
