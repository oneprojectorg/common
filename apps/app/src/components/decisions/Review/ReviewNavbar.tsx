'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { Suspense, useState } from 'react';
import { LuCheck, LuPencil, LuRefreshCw } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '../../SiteHeader';
import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { ProposalModerationMenu } from '../ProposalModerationMenu';
import { RequestRevisionModal } from './RequestRevisionModal';
import { useReviewForm } from './ReviewFormContext';

interface ReviewNavbarProps {
  decisionSlug: string;
}

export function ReviewNavbar({ decisionSlug }: ReviewNavbarProps) {
  const t = useTranslations();
  const { user } = useUser();
  const {
    assignment,
    reviewSettings,
    canSubmit,
    isSubmitting,
    isSubmitted,
    canEditReview,
    isEditing,
    canUpdate,
    isUpdating,
    canRequestRevision,
    handleSubmit,
    startEditing,
    handleUpdate,
  } = useReviewForm();

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const backHref = `/decisions/${decisionSlug}/current`;

  return (
    <>
      <DecisionSubpageHeader
        backHref={backHref}
        backLabel={
          // Figma shortens the visible label to "Back"; the full destination
          // stays in the accessible name so screen readers keep the context.
          <>
            <span aria-hidden="true">{t('Back')}</span>
            <span className="sr-only">
              {t('decisions.review.backToProposalsAction')}
            </span>
          </>
        }
        accountSlot={
          userCanInteract(user) ? (
            <UserAvatarMenu className="hidden sm:block" />
          ) : null
        }
      >
        {reviewSettings.allowRevisions && !isEditing && (
          <Button
            variant="outline"
            disabled={!canRequestRevision}
            onClick={() => setIsRequestModalOpen(true)}
            className="max-sm:size-11"
            aria-label={t('decisions.review.requestRevisionAction')}
          >
            <LuRefreshCw className="size-4" />
            <span className="hidden sm:inline">
              {t('decisions.review.requestRevisionAction')}
            </span>
          </Button>
        )}

        {isEditing ? (
          <Button
            onClick={handleUpdate}
            disabled={!canUpdate}
            loading={isUpdating}
            className="max-sm:size-11"
            aria-label={t('decisions.review.updateReviewAction')}
          >
            <LuCheck className="size-4" />
            <span className="hidden sm:inline">
              {t('decisions.review.updateReviewAction')}
            </span>
          </Button>
        ) : isSubmitted ? (
          canEditReview && (
            <Button
              variant="outline"
              onClick={startEditing}
              className="max-sm:size-11"
              aria-label={t('decisions.review.editReviewAction')}
            >
              <LuPencil className="size-4" />
              <span className="hidden sm:inline">
                {t('decisions.review.editReviewAction')}
              </span>
            </Button>
          )
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            className="max-sm:size-11"
            aria-label={t('decisions.review.submitReviewAction')}
          >
            <LuCheck className="size-4" />
            <span className="hidden sm:inline">
              {t('decisions.review.submitReviewAction')}
            </span>
          </Button>
        )}

        {/* Optional region: the review actions render while this resolves. */}
        <APIErrorBoundary fallbacks={{ default: () => null }}>
          <Suspense fallback={null}>
            <ReviewAdminMenuSuspense
              proposal={assignment.proposal}
              backHref={backHref}
            />
          </Suspense>
        </APIErrorBoundary>
      </DecisionSubpageHeader>

      <RequestRevisionModal
        isOpen={isRequestModalOpen}
        onOpenChange={setIsRequestModalOpen}
      />
    </>
  );
}

function ReviewAdminMenuSuspense({
  proposal,
  backHref,
}: {
  proposal: Proposal;
  backHref: string;
}) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId: proposal.processInstanceId,
  });

  return (
    <ProposalModerationMenu
      instance={instance}
      proposal={proposal}
      backHref={backHref}
    />
  );
}
