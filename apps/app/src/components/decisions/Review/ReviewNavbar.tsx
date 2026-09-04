'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { Button } from '@op/sense/Button';
import { useState } from 'react';
import { LuCheck, LuPencil } from 'react-icons/lu';

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
      >
        <div className="flex items-center gap-4">
          {isEditing ? (
            <Button
              onClick={handleUpdate}
              disabled={!canUpdate}
              loading={isUpdating}
            >
              <LuCheck className="size-4" />
              {t('Update review')}
            </Button>
          ) : isSubmitted ? (
            canEditReview && (
              <Button variant="outline" onClick={startEditing}>
                <LuPencil className="size-4" />
                {t('Edit review')}
              </Button>
            )
          ) : (
            <>
              {canRequestRevision && (
                <Button
                  variant="outline"
                  onClick={() => setIsRequestModalOpen(true)}
                >
                  {t('Request revision')}
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                loading={isSubmitting}
              >
                <LuCheck className="size-4" />
                {t('Submit review')}
              </Button>
            </>
          )}

          {userCanInteract(user) && (
            <UserAvatarMenu className="hidden sm:block" />
          )}
        </div>
      </DecisionSubpageHeader>

      <RequestRevisionModal
        isOpen={isRequestModalOpen}
        onOpenChange={setIsRequestModalOpen}
      />
    </>
  );
}
