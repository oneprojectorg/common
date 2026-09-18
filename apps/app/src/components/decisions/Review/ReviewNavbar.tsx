'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { Button } from '@op/sense/Button';
import { useState } from 'react';
import { LuCheck, LuPencil, LuRefreshCw } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '../../SiteHeader';
import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { RequestRevisionModal } from './RequestRevisionModal';
import { useReviewForm } from './ReviewFormContext';

interface ReviewNavbarProps {
  decisionSlug: string;
}

export function ReviewNavbar({ decisionSlug }: ReviewNavbarProps) {
  const t = useTranslations();
  const { user } = useUser();
  const {
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

  return (
    <>
      <DecisionSubpageHeader
        backHref={`/decisions/${decisionSlug}/current`}
        backLabel={
          // Figma shortens the visible label to "Back"; the full destination
          // stays in the accessible name so screen readers keep the context.
          <>
            <span aria-hidden="true">{t('Back')}</span>
            <span className="sr-only">{t('Back to proposals')}</span>
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
            aria-label={t('Request revision')}
          >
            <LuRefreshCw className="size-4" />
            <span className="hidden sm:inline">{t('Request revision')}</span>
          </Button>
        )}

        {isEditing ? (
          <Button
            onClick={handleUpdate}
            disabled={!canUpdate}
            loading={isUpdating}
            className="max-sm:size-11"
            aria-label={t('Update review')}
          >
            <LuCheck className="size-4" />
            <span className="hidden sm:inline">{t('Update review')}</span>
          </Button>
        ) : isSubmitted ? (
          canEditReview && (
            <Button
              variant="outline"
              onClick={startEditing}
              className="max-sm:size-11"
              aria-label={t('Edit review')}
            >
              <LuPencil className="size-4" />
              <span className="hidden sm:inline">{t('Edit review')}</span>
            </Button>
          )
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            className="max-sm:size-11"
            aria-label={t('Submit review')}
          >
            <LuCheck className="size-4" />
            <span className="hidden sm:inline">{t('Submit review')}</span>
          </Button>
        )}
      </DecisionSubpageHeader>

      <RequestRevisionModal
        isOpen={isRequestModalOpen}
        onOpenChange={setIsRequestModalOpen}
      />
    </>
  );
}
