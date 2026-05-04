'use client';

import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useState } from 'react';
import { LuCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { RequestRevisionModal } from './RequestRevisionModal';
import { useReviewForm } from './ReviewFormContext';

interface ReviewNavbarProps {
  decisionSlug: string;
}

export function ReviewNavbar({ decisionSlug }: ReviewNavbarProps) {
  const t = useTranslations();
  const {
    canSubmit,
    isSubmitting,
    isSubmitted,
    canRequestRevision,
    handleSubmit,
  } = useReviewForm();

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  return (
    <>
      <DecisionSubpageHeader
        backHref={`/decisions/${decisionSlug}`}
        backLabel={t('Back to proposals')}
      >
        <div className="flex items-center gap-4">
          {canRequestRevision && (
            <Button
              color="secondary"
              size="small"
              isDisabled={isSubmitted}
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
        </div>
      </DecisionSubpageHeader>

      <RequestRevisionModal
        isOpen={isRequestModalOpen}
        onOpenChange={setIsRequestModalOpen}
      />
    </>
  );
}
