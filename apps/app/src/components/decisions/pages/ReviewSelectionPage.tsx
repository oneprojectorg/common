import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { type InstancePhaseData, type ProcessInstance } from '@op/api/encoders';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { TranslatedText } from '@/components/TranslatedText';

import { DecisionHero } from '../DecisionHero';
import {
  ReviewSelectionList,
  ReviewSelectionListSkeleton,
} from '../ReviewSelection/ReviewSelectionList';

export function ReviewSelectionPage({
  instance,
  previousPhaseId,
}: {
  instance: ProcessInstance;
  /** Phase whose proposals + review aggregates we're shortlisting from. */
  previousPhaseId: string;
}) {
  const phases = instance.instanceData?.phases ?? [];
  const previousPhase = phases.find(
    (phase): phase is InstancePhaseData => phase.phaseId === previousPhaseId,
  );

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-8">
        <DecisionHero
          title={
            previousPhase?.headline ?? (
              <TranslatedText text="REVIEWS COMPLETE" />
            )
          }
          description={
            <p>
              <TranslatedText text="Select which proposals move on to the next phase" />
            </p>
          }
          variant="standard"
        />
      </div>

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <APIErrorBoundary
            fallbacks={{
              default: () => (
                <EmptyState icon={<LuLeaf className="size-6" />}>
                  <Header3 className="font-serif font-light">
                    <TranslatedText text="We couldn't load proposals" />
                  </Header3>
                  <p className="text-base text-neutral-charcoal">
                    <TranslatedText text="Please refresh the page to try again." />
                  </p>
                </EmptyState>
              ),
            }}
          >
            <Suspense fallback={<ReviewSelectionListSkeleton />}>
              <ReviewSelectionList
                instance={instance}
                previousPhaseId={previousPhaseId}
              />
            </Suspense>
          </APIErrorBoundary>
        </div>
      </div>
    </div>
  );
}
