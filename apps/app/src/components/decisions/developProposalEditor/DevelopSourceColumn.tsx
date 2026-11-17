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
import { Tabs, TabsContent } from '@op/sense/Tabs';
import { Suspense, useState } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalQueryProvider } from '../Proposal/ProposalQueryProvider';
import { ProposalTabList, ProposalTabTrigger } from '../Proposal/ProposalTabs';
import { useProposal } from '../Proposal/proposalContext';
import { ResponsiveSelect } from '../ResponsiveSelect';
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
  sourcePhaseId,
  canReadReviews,
}: {
  /** At least one. */
  sources: RelatedProposal[];
  decisionRoot: string;
  /** The phase the sources come from; absent when the develop phase is first. */
  sourcePhaseId: string | null;
  /** Mirrors the server gate on the source phase's reviews. */
  canReadReviews: boolean;
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
            <SourceSections
              sourcePhaseId={canReadReviews ? sourcePhaseId : null}
            />
          </ProposalQueryProvider>
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function SourceSections({ sourcePhaseId }: { sourcePhaseId: string | null }) {
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
        {sourcePhaseId ? (
          <ProposalTabTrigger
            value="reviews"
            count={<ReviewsCount phaseId={sourcePhaseId} />}
          >
            {t('review.reviewsTab')}
          </ProposalTabTrigger>
        ) : null}
      </ProposalTabList>

      <TabsContent value="proposal">
        <ProposalBody engagement={false} />
      </TabsContent>
      {sourcePhaseId ? (
        <PhaseReviewsTabPanel value="reviews">
          <PhaseReviews
            processInstanceId={proposal.processInstanceId}
            proposalId={proposal.id}
            phaseId={sourcePhaseId}
            isCurrentPhase={false}
            emptyMessage={t('developEditor.noReviews')}
          />
        </PhaseReviewsTabPanel>
      ) : null}
    </Tabs>
  );
}

/** Not suspense, so the trigger never suspends; the panel's input, so one request. */
function ReviewsCount({ phaseId }: { phaseId: string }) {
  const { proposal } = useProposal();
  const { data } = trpc.decision.getProposalWithReviewAggregates.useQuery({
    processInstanceId: proposal.processInstanceId,
    proposalId: proposal.id,
    phaseId,
  });

  return data ? data.reviews.length : null;
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
