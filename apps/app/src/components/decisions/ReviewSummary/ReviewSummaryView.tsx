'use client';

import { trpc } from '@op/api/client';
import type { RubricTemplateSchema } from '@op/common/client';
import { SplitPane } from '@op/ui/SplitPane';
import { useState } from 'react';

import { TranslatedText } from '@/components/TranslatedText';

import { ProposalPreview } from '../ProposalPreview';
import { ReviewSummaryNavbar } from './ReviewSummaryNavbar';
import { ReviewSummaryPanel } from './ReviewSummaryPanel';

interface ReviewSummaryViewProps {
  decisionSlug: string;
  instanceId: string;
  proposalId: string;
  profileId: string;
}

export function ReviewSummaryView({
  decisionSlug,
  instanceId,
  proposalId,
  profileId,
}: ReviewSummaryViewProps) {
  const [[instance, proposalDetail, aggregates]] = trpc.useSuspenseQueries(
    (t) => [
      t.decision.getInstance({ instanceId }),
      t.decision.getProposal({ profileId }),
      t.decision.getWithReviewAggregates({
        processInstanceId: instanceId,
        proposalId,
      }),
    ],
  );

  const rubricTemplate =
    (instance.instanceData?.rubricTemplate as RubricTemplateSchema | null) ??
    null;

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  return (
    <div className="flex h-dvh flex-col bg-white">
      <ReviewSummaryNavbar decisionSlug={decisionSlug} />

      <SplitPane className="mx-auto max-w-6xl" defaultMobileTabId="summary">
        <SplitPane.Pane
          id="proposal"
          label={<TranslatedText text="Proposal" />}
        >
          <ProposalPreview proposal={proposalDetail} />
        </SplitPane.Pane>
        <SplitPane.Pane
          id="summary"
          label={<TranslatedText text="Review Summary" />}
        >
          <ReviewSummaryPanel
            aggregates={aggregates}
            rubricTemplate={rubricTemplate}
            selectedAssignmentId={selectedAssignmentId}
            onSelectAssignment={setSelectedAssignmentId}
          />
        </SplitPane.Pane>
      </SplitPane>
    </div>
  );
}
