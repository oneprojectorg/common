'use client';

import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useState } from 'react';
import { LuArrowLeft, LuCheck } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { RequestRevisionModal } from './RequestRevisionModal';
import { useReviewForm } from './ReviewFormContext';
import { ViewRevisionRequestModal } from './ViewRevisionRequestModal';

interface ReviewNavbarProps {
  decisionSlug: string;
}

export function ReviewNavbar({ decisionSlug }: ReviewNavbarProps) {
  const t = useTranslations();
  const {
    canSubmit,
    isSubmitting,
    isSubmitted,
    isPausedForRevision,
    handleSubmit,
  } = useReviewForm();

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-white px-6 md:px-8">
        <Link
          href={`/decisions/${decisionSlug}`}
          className="flex items-center gap-2 text-base text-primary-teal"
        >
          <LuArrowLeft className="size-4" />
          {t('Back to proposals')}
        </Link>
        <div className="flex items-center gap-4">
          <Button
            color="secondary"
            size="small"
            isDisabled={isSubmitted || isPausedForRevision}
            onPress={() => {
              if (isPausedForRevision) {
                setIsViewModalOpen(true);
              } else {
                setIsRequestModalOpen(true);
              }
            }}
          >
            {t('Request revision')}
          </Button>
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
        </div>
      </header>

      <RequestRevisionModal
        isOpen={isRequestModalOpen}
        onOpenChange={setIsRequestModalOpen}
      />
      <ViewRevisionRequestModal
        isOpen={isViewModalOpen}
        onOpenChange={setIsViewModalOpen}
      />
    </>
  );
}
