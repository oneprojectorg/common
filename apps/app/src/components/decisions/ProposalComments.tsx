'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { LuTriangleAlert, LuUserRoundPlus } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

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
  decisionRoot,
  readOnly: readOnlyProp = false,
}: {
  proposal: Proposal;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const { user } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);

  // Also carries the comments of every proposal merged into this one.
  const {
    data: commentsData,
    isLoading: commentsLoading,
    error: commentsError,
    refetch: refetchComments,
  } = trpc.posts.listProposalComments.useQuery({
    profileId: proposal.profileId,
    // TODO(followup): paginate. `next` is discarded and there is no load-more,
    // so anything past the first page is unreachable — and the window now
    // spans the target plus every proposal merged into it, so the target's own
    // older comments can be pushed out by carried-over ones with no
    // indication. The header count below reads from the loaded page, so it
    // reports 50 rather than the true total once truncated.
    limit: 50,
  });

  const comments = commentsData?.items ?? [];
  const { handleLikeClick } = usePostFeedActions();

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
      <div className="space-y-4 border-t pt-6 sm:pt-10">
        <Header3 className="text-label">
          {t('Comments')} ({comments.length})
        </Header3>

        {!readOnly && (
          <div className="mb-8">
            <PostUpdate
              profileId={proposal.profileId || undefined}
              placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
              label={t('Comment')}
              onSuccess={scrollToComments}
              proposalId={proposal.id}
              processInstanceId={proposal.processInstanceId}
            />
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
          >
            {t('Loading comments...')}
          </div>
        ) : commentsError ? (
          <CommentsUnavailable
            error={commentsError}
            onRetry={() => void refetchComments()}
          />
        ) : comments.length > 0 ? (
          <div
            role="feed"
            aria-label={t('{count} comments', { count: comments.length })}
          >
            <PostFeed>
              {comments.map(({ post, originProposal }, i) => (
                <div key={post.id}>
                  <PostItem
                    post={post}
                    organization={null}
                    user={user}
                    withLinks={true}
                    onLikeClick={handleLikeClick}
                    contentFooter={
                      originProposal ? (
                        <MergedCommentOrigin
                          origin={originProposal}
                          decisionRoot={decisionRoot}
                        />
                      ) : undefined
                    }
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

/**
 * Shown when the comments read fails. Without it the failure falls through to
 * the empty state, which tells the user to be the first to comment on a
 * proposal that may already have comments.
 */
function CommentsUnavailable({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    logger.error('Could not load proposal comments', { error });
  }, [error]);

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuTriangleAlert className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('Comments could not be loaded')}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('Try again')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/**
 * Marks a comment that was written on a proposal merged into this one. Without
 * it the comment reads as a reply to a proposal its author never saw.
 */
function MergedCommentOrigin({
  origin,
  decisionRoot,
}: {
  origin: { profileId: string; name: string };
  decisionRoot: string;
}) {
  const t = useTranslations();

  return (
    <p className="text-base text-muted-foreground">
      {t.rich('Comment originally appeared in <proposal>{name}</proposal>', {
        name: origin.name,
        proposal: (chunks: ReactNode) => (
          <Link
            href={`${decisionRoot}/proposal/${origin.profileId}`}
            className="text-primary underline"
          >
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
