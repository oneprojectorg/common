'use client';

import { trpc } from '@op/api/client';
import { SplitPane } from '@op/sense/SplitPane';
import { cn } from '@op/sense/lib/utils';
import { useQueryState } from 'nuqs';

import { useTranslations } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { ProposalPreview } from '../ProposalPreview';
import { ReviewsPanel } from '../ReviewsPanel/ReviewsPanel';
import { ReviewSummaryAdvanceFooter } from './ReviewSummaryAdvanceFooter';

interface ReviewSummaryViewProps {
  decisionSlug: string;
  instanceId: string;
  proposalId: string;
  proposalProfileId: string;
  phaseId: string | undefined;
  isPhaseInProgress?: boolean;
}

export function ReviewSummaryView({
  decisionSlug,
  instanceId,
  proposalId,
  proposalProfileId,
  phaseId,
  isPhaseInProgress = false,
}: ReviewSummaryViewProps) {
  const t = useTranslations();
  const [[proposalWithReviews, proposal]] = trpc.useSuspenseQueries((t) => [
    t.decision.getProposalWithReviewAggregates({
      processInstanceId: instanceId,
      proposalId,
      phaseId,
    }),
    t.decision.getProposal({ profileId: proposalProfileId }),
  ]);

  const rubricTemplate = proposalWithReviews.rubricTemplate;

  const [selectedAssignmentId, setSelectedAssignmentId] = useQueryState(
    'assignment',
    { history: 'push' },
  );

  return (
    <div
      className={cn(
        'flex h-dvh flex-col bg-white',
        !isPhaseInProgress && 'pb-14',
      )}
    >
      <DecisionSubpageHeader
        backHref={`/decisions/${decisionSlug}/current`}
        backLabel={t('Back')}
      />

      <SplitPane className="mx-auto max-w-6xl" defaultMobileTabId="summary">
        <SplitPane.Pane
          id="proposal"
          label={<TranslatedText text="Proposal" />}
        >
          <ProposalPreview proposal={proposal} />
        </SplitPane.Pane>
        <SplitPane.Pane
          id="summary"
          label={
            isPhaseInProgress ? (
              <TranslatedText text="Review Progress" />
            ) : (
              <TranslatedText text="Review Summary" />
            )
          }
        >
          <ReviewsPanel
            proposalWithReviews={proposalWithReviews}
            rubricTemplate={rubricTemplate}
            selectedAssignmentId={selectedAssignmentId}
            onSelectAssignment={setSelectedAssignmentId}
            title={isPhaseInProgress ? t('Review Progress') : undefined}
          />
        </SplitPane.Pane>
      </SplitPane>

      {!isPhaseInProgress && (
        <ReviewSummaryAdvanceFooter
          instanceId={instanceId}
          proposalId={proposalId}
          phaseId={phaseId}
        />
      )}
    </div>
  );
}
