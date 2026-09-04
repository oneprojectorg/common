import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { type InstancePhaseData, type ProcessInstance } from '@op/api/encoders';
import {
  getPhaseRubricTemplate,
  getRubricScoringInfo,
  templateCollectsBudget,
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

import { useTranslations } from '@/lib/i18n';

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
  const t = useTranslations();
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

  // No budget key in the instance's proposal template means the process
  // collects no budgets, so the column would only ever show "—".
  const showBudget = templateCollectsBudget(
    instance.instanceData?.proposalTemplate,
  );

  return (
    <div className="min-h-full pt-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-8">
        <DecisionHero
          title={previousPhase?.headline ?? t('REVIEWS COMPLETE')}
          description={
            <p>{t('Select which proposals move on to the next phase')}</p>
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
                    <EmptyTitle>{t("We couldn't load proposals")}</EmptyTitle>
                    <EmptyDescription>
                      {t('Please refresh the page to try again.')}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ),
            }}
          >
            <Suspense
              fallback={
                <ReviewSelectionListSkeleton
                  showScore={showScore}
                  showBudget={showBudget}
                />
              }
            >
              <ReviewSelectionList
                instance={instance}
                previousPhaseId={previousPhaseId}
                showBudget={showBudget}
              />
            </Suspense>
          </APIErrorBoundary>
        </div>
      </div>
    </div>
  );
}
