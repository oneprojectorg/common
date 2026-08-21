import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { type InstancePhaseData, type ProcessInstance } from '@op/api/encoders';
import {
  getPhaseRubricTemplate,
  getRubricScoringInfo,
} from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
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

  // Match the loaded table's column set so the skeleton doesn't flash an
  // extra Score column that shifts away when Suspense resolves.
  const rubricTemplate = instance.instanceData
    ? getPhaseRubricTemplate(instance.instanceData, previousPhaseId)
    : null;
  const showScore = rubricTemplate
    ? getRubricScoringInfo(rubricTemplate).criteria.some((c) => c.scored)
    : false;

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
        <div className="w-full p-4 sm:p-8">
          <APIErrorBoundary
            fallbacks={{
              default: () => (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <LuLeaf className="size-6" />
                    </EmptyMedia>
                    <EmptyTitle>
                      <TranslatedText text="We couldn't load proposals" />
                    </EmptyTitle>
                    <EmptyDescription>
                      <TranslatedText text="Please refresh the page to try again." />
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ),
            }}
          >
            <Suspense
              fallback={<ReviewSelectionListSkeleton showScore={showScore} />}
            >
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
