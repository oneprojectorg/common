'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import type { RouterOutput } from '@op/api';
import { type InstancePhaseData } from '@op/api/encoders';
import { ButtonLink } from '@op/ui/Button';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DecisionHero } from '../DecisionHero';
import {
  ReviewAssignmentListSkeleton,
  ReviewAssignmentsList,
} from '../ReviewAssignmentsList';

type Instance = RouterOutput['decision']['getInstance'];

export function ReviewPage({
  instance,
  decisionSlug,
}: {
  instance: Instance;
  decisionSlug?: string;
}) {
  const t = useTranslations();
  const reviewFlowEnabled = useFeatureFlag('review_flow');

  const phases = instance.instanceData?.phases ?? [];
  const currentPhaseId = instance.currentStateId;
  const currentPhase = phases.find(
    (phase): phase is InstancePhaseData => phase.phaseId === currentPhaseId,
  );

  if (!reviewFlowEnabled) {
    return null;
  }

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-8">
        <DecisionHero
          title={currentPhase?.headline ?? t('SHARE YOUR IDEAS.')}
          description={
            currentPhase?.description ? (
              <p>{currentPhase.description}</p>
            ) : undefined
          }
          variant="standard"
        >
          <div className="flex justify-center pt-2">
            <ButtonLink color="secondary" size="medium" href="#">
              {t('Learn more')}
            </ButtonLink>
          </div>
        </DecisionHero>
      </div>

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <Suspense fallback={<ReviewAssignmentListSkeleton />}>
            <ReviewAssignmentsList
              processInstanceId={instance.id}
              decisionSlug={decisionSlug}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
