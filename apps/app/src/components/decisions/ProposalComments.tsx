'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Card } from '@op/sense/Card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { useCallback, useRef } from 'react';
import { LuUserRoundPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { JoinDecisionButton } from './JoinAccountModal';

/**
 * Fragment id on the comments section. The proposal-view action row links to it
 * (`#proposal-comments`) so the mobile "Comments" icon button jumps here without
 * any scroll scripting.
 */
export const PROPOSAL_COMMENTS_ANCHOR_ID = 'proposal-comments';

export function ProposalComments({
  proposal,
  readOnly: readOnlyProp = false,
}: {
  proposal: Proposal;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const { user } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: commentsData, isLoading: commentsLoading } =
    trpc.posts.listProfilePosts.useQuery({
      profileId: proposal.profileId,
      limit: 50,
    });

  const comments = commentsData?.items ?? [];
  const { handleReactionClick } = usePostFeedActions();

  // Mirror the server-side comment gate (`assertPostWriteAccess` →
  // SUBMIT_PROPOSALS on the decision profile). Showing the post box to users
  // who'd get rejected on submit surfaces as a "Not authorized" toast.
  const canSubmitProposal = proposal.access?.submitProposals === true;
  const canInteract = userCanInteract(user);
  const readOnly = readOnlyProp || !canInteract || !canSubmitProposal;
  // A visitor on a public process who could comment with an account gets an
  // account-claim prompt where the composer would be. ProposalViewLayout
  // mounts the JoinAccountModal this opens, keyed to the same
  // proposal.access bit; the other ProposalComments surface
  // (ReviewProposalPane) only renders for reviewers, who always pass
  // userCanInteract.
  const showJoinPrompt = !readOnlyProp && !canInteract && canSubmitProposal;

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
    <div id={PROPOSAL_COMMENTS_ANCHOR_ID} ref={containerRef}>
      <div className="border-t pt-8">
        {/* `!text-title-base` keeps the pre-migration 20px heading — sense's
            `text-title` is a step smaller on mobile (same call as ResultsList). */}
        <Header3 className="mb-6 font-sans !text-title-base">
          {t('Comments')} ({comments.length})
        </Header3>

        {!readOnly && (
          <div className="mb-8">
            <Card className="border-0 p-0 shadow-none sm:border sm:p-4">
              <PostUpdate
                profileId={proposal.profileId || undefined}
                placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
                label={t('Comment')}
                onSuccess={scrollToComments}
                proposalId={proposal.id}
                processInstanceId={proposal.processInstanceId}
              />
            </Card>
          </div>
        )}

        {showJoinPrompt && (
          <Empty className="mb-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LuUserRoundPlus />
              </EmptyMedia>
              <EmptyDescription id="join-to-comment-prompt">
                {t('Join Common to comment on this proposal.')}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <JoinDecisionButton ariaDescribedBy="join-to-comment-prompt" />
            </EmptyContent>
          </Empty>
        )}

        {commentsLoading ? (
          <div
            className="py-8 text-center text-base text-muted-foreground"
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
                    user={user}
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
            className="py-8 text-center text-base text-muted-foreground"
            role="status"
            aria-label={t('No comments')}
          >
            {readOnly
              ? t('No comments yet.')
              : t('No comments yet. Be the first to comment!')}
          </div>
        )}
      </div>
    </div>
  );
}
