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
import { DevelopOriginSkeleton } from './DevelopProposalSkeleton';

type OriginTab = 'proposal' | 'reviews';

/** The entry's origins, read only, with a select when there are several. */
export function DevelopOriginColumn({
  origins,
  decisionRoot,
  originPhaseId,
  canReadReviews,
}: {
  /** At least one. */
  origins: RelatedProposal[];
  decisionRoot: string;
  /** The phase the origins come from; absent when the develop phase is first. */
  originPhaseId: string | null;
  /** Mirrors the server gate on the origin phase's reviews. */
  canReadReviews: boolean;
}) {
  const t = useTranslations('decisions');
  const [selectedId, setSelectedId] = useState(origins[0]?.id ?? '');
  const origin =
    origins.find((candidate) => candidate.id === selectedId) ?? origins[0];

  if (!origin) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {origins.length > 1 ? (
        <ResponsiveSelect<string>
          selectedKey={origin.id}
          onSelectionChange={setSelectedId}
          aria-label={t('developEditor.originSelectLabel')}
          className="w-full sm:max-w-80"
          items={origins.map((candidate) => {
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

      {/* Keyed so the open tab and a failed load reset with the origin. */}
      <APIErrorBoundary
        key={origin.id}
        fallbacks={{ default: () => <OriginUnavailable /> }}
      >
        <Suspense fallback={<DevelopOriginSkeleton />}>
          <ProposalQueryProvider
            profileId={origin.profile.id}
            decisionRoot={decisionRoot}
          >
            <OriginSections
              originPhaseId={canReadReviews ? originPhaseId : null}
            />
          </ProposalQueryProvider>
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function OriginSections({ originPhaseId }: { originPhaseId: string | null }) {
  const t = useTranslations('decisions');
  const { proposal } = useProposal();
  const [tab, setTab] = useState<OriginTab>('proposal');

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
      <ProposalTabList aria-label={t('developEditor.originSectionsLabel')}>
        <ProposalTabTrigger value="proposal">
          {t('developEditor.proposalTab')}
        </ProposalTabTrigger>
        {originPhaseId ? (
          <ProposalTabTrigger
            value="reviews"
            count={<ReviewsCount phaseId={originPhaseId} />}
          >
            {t('review.reviewsTab')}
          </ProposalTabTrigger>
        ) : null}
      </ProposalTabList>

      <TabsContent value="proposal">
        <ProposalBody engagement={false} />
      </TabsContent>
      {originPhaseId ? (
        <PhaseReviewsTabPanel value="reviews">
          <PhaseReviews
            processInstanceId={proposal.processInstanceId}
            proposalId={proposal.id}
            phaseId={originPhaseId}
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

function OriginUnavailable() {
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
