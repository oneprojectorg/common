'use client';

import { trpc } from '@op/api/client';
import { SplitPane } from '@op/ui/SplitPane';
import { useQueryState } from 'nuqs';

import { useTranslations } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { ProposalPreview } from '../ProposalPreview';
import { ReviewSummaryAdvanceFooter } from './ReviewSummaryAdvanceFooter';
import { ReviewSummaryPanel } from './ReviewSummaryPanel';

interface ReviewSummaryViewProps {
  decisionSlug: string;
  instanceId: string;
  proposalId: string;
  proposalProfileId: string;
  phaseId: string | undefined;
}

export function ReviewSummaryView({
  decisionSlug,
  instanceId,
  proposalId,
  proposalProfileId,
  phaseId,
}: ReviewSummaryViewProps) {
  const t = useTranslations();
  const [[instance, proposalWithReviews, proposal]] = trpc.useSuspenseQueries(
    (t) => [
      t.decision.getInstance({ instanceId }),
      t.decision.getProposalWithReviewAggregates({
        processInstanceId: instanceId,
        proposalId,
        phaseId,
      }),
      t.decision.getProposal({ profileId: proposalProfileId }),
    ],
  );

  const rubricTemplate = instance.instanceData?.rubricTemplate ?? null;

  const [selectedAssignmentId, setSelectedAssignmentId] = useQueryState(
    'assignment',
    { history: 'push' },
  );

  return (
    <div className="flex h-dvh flex-col bg-white pb-14">
      <DecisionSubpageHeader
        backHref={`/decisions/${decisionSlug}`}
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
          label={<TranslatedText text="Review Summary" />}
        >
          <ReviewSummaryPanel
            proposalWithReviews={proposalWithReviews}
            rubricTemplate={rubricTemplate}
            selectedAssignmentId={selectedAssignmentId}
            onSelectAssignment={setSelectedAssignmentId}
          />
        </SplitPane.Pane>
      </SplitPane>

      <ReviewSummaryAdvanceFooter
        instanceId={instanceId}
        proposalId={proposalId}
        phaseId={phaseId}
      />
    </div>
  );
}
