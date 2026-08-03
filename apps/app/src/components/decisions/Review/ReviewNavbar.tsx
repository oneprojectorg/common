'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
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
        backLabel={t('Back to proposals')}
      >
        <div className="flex items-center gap-4">
          {isEditing ? (
            <Button
              color="primary"
              size="medium"
              onPress={handleUpdate}
              isDisabled={!canUpdate || isUpdating}
            >
              {isUpdating ? (
                <LoadingSpinner className="size-4" />
              ) : (
                <LuCheck className="size-4" />
              )}
              {t('Update review')}
            </Button>
          ) : isSubmitted ? (
            canEditReview && (
              <Button color="secondary" size="medium" onPress={startEditing}>
                <LuPencil className="size-4" />
                {t('Edit review')}
              </Button>
            )
          ) : (
            <>
              {canRequestRevision && (
                <Button
                  color="secondary"
                  size="small"
                  onPress={() => setIsRequestModalOpen(true)}
                >
                  {t('Request revision')}
                </Button>
              )}
              <Button
                color="primary"
                size="small"
                onPress={handleSubmit}
                isDisabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <LoadingSpinner className="size-4" />
                ) : (
                  <LuCheck className="size-4" />
                )}
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
