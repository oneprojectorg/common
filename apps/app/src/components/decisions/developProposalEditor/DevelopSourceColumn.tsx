'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { RelatedProposal } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { Tabs, TabsContent } from '@op/sense/Tabs';
import { Suspense, useState } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalQueryProvider } from '../Proposal/ProposalQueryProvider';
import { ProposalTabList, ProposalTabTrigger } from '../Proposal/ProposalTabs';
import { useProposal } from '../Proposal/proposalContext';
import { ResponsiveSelect } from '../ResponsiveSelect';
import type { PreviousReviewPhase } from '../Review/ReviewTabs';
import {
  PhaseReviews,
  PhaseReviewsTabPanel,
} from '../ReviewsPanel/PhaseReviews';
import { DevelopSourceSkeleton } from './DevelopProposalSkeleton';

type SourceTab = 'proposal' | 'reviews';

/** The entry's sources, read only, with a select when there are several. */
export function DevelopSourceColumn({
  sources,
  decisionRoot,
  reviewPhases,
}: {
  /** At least one. */
  sources: RelatedProposal[];
  decisionRoot: string;
  /** The earlier review phases whose reviews the caller may read. */
  reviewPhases: PreviousReviewPhase[];
}) {
  const t = useTranslations('decisions');
  const [selectedId, setSelectedId] = useState(sources[0]?.id ?? '');
  const source =
    sources.find((candidate) => candidate.id === selectedId) ?? sources[0];

  if (!source) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {sources.length > 1 ? (
        <ResponsiveSelect<string>
          selectedKey={source.id}
          onSelectionChange={setSelectedId}
          aria-label={t('developEditor.sourceSelectLabel')}
          className="w-full sm:max-w-80"
          items={sources.map((candidate) => {
            const name =
              candidate.profile.name || t('proposals.untitledProposal');

            return {
              id: candidate.id,
              label: <bdi>{name}</bdi>,
              textValue: name,
            };
          })}
        />
      ) : null}

      {/* Keyed so the open tab and a failed load reset with the source. */}
      <APIErrorBoundary
        key={source.id}
        fallbacks={{ default: () => <SourceUnavailable /> }}
      >
        <Suspense fallback={<DevelopSourceSkeleton />}>
          <ProposalQueryProvider
            profileId={source.profile.id}
            decisionRoot={decisionRoot}
          >
            <SourceSections reviewPhases={reviewPhases} />
          </ProposalQueryProvider>
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function SourceSections({
  reviewPhases,
}: {
  reviewPhases: PreviousReviewPhase[];
}) {
  const t = useTranslations('decisions');
  const { proposal } = useProposal();
  const [tab, setTab] = useState<SourceTab>('proposal');

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        // Tabs reports a plain value; only the two sections are real.
        if (next === 'proposal' || next === 'reviews') {
          setTab(next);
        }
      }}
      className="gap-6"
    >
      <ProposalTabList aria-label={t('developEditor.sourceSectionsLabel')}>
        <ProposalTabTrigger value="proposal">
          {t('developEditor.proposalTab')}
        </ProposalTabTrigger>
        {reviewPhases.length > 0 ? (
          <ProposalTabTrigger
            value="reviews"
            count={<ReviewsCount phases={reviewPhases} />}
          >
            {t('review.reviewsTab')}
          </ProposalTabTrigger>
        ) : null}
      </ProposalTabList>

      <TabsContent value="proposal">
        <ProposalBody engagement={false} />
      </TabsContent>
      {reviewPhases.length > 0 ? (
        <PhaseReviewsTabPanel value="reviews">
          <div className="flex flex-col gap-8">
            {reviewPhases.map((phase) => (
              <section key={phase.id} className="flex flex-col gap-4">
                <Header3>
                  <bdi>{phase.name}</bdi>
                </Header3>
                <PhaseReviews
                  processInstanceId={proposal.processInstanceId}
                  proposalId={proposal.id}
                  phaseId={phase.id}
                  isCurrentPhase={false}
                  emptyMessage={t('developEditor.noReviews')}
                />
              </section>
            ))}
          </div>
        </PhaseReviewsTabPanel>
      ) : null}
    </Tabs>
  );
}

/** Not suspense, so the trigger never suspends; the panels' inputs, so no extra request. */
function ReviewsCount({ phases }: { phases: PreviousReviewPhase[] }) {
  const { proposal } = useProposal();
  const results = trpc.useQueries((t) =>
    phases.map((phase) =>
      t.decision.getProposalWithReviewAggregates({
        processInstanceId: proposal.processInstanceId,
        proposalId: proposal.id,
        phaseId: phase.id,
      }),
    ),
  );

  let total = 0;
  for (const { data } of results) {
    if (!data) {
      return null;
    }
    total += data.reviews.length;
  }

  return total;
}

function SourceUnavailable() {
  const t = useTranslations('decisions.proposals');

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuTriangleAlert className="size-6" aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{t('sheetLoadErrorTitle')}</EmptyTitle>
        <EmptyDescription>{t('sheetLoadErrorHint')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
