'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
import type { ProposalTemplateSchema } from '@op/common/client';
import {
  getTemplateBudgetCurrency,
  hasVotingPhase,
  pickProposalTemplate,
} from '@op/common/client';
import { match } from '@op/core';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import {
  DecisionResultsTabPanel,
  DecisionResultsTabs,
} from '../DecisionResultsTabs';
import {
  FinalPhaseSubmissionSuccessDialog,
  QUERY_PARAM as RESULTS_LIVE_QUERY_PARAM,
} from '../FinalPhaseSubmissionSuccessDialog';
import { MyBallot, NoVoteFound } from '../MyBallot';
import {
  ProcessSurveyModal,
  hasSurveySkipCookie,
  setSurveySkipCookie,
} from '../ProcessSurveyModal';
import { ProposalListSkeleton } from '../ProposalListSkeleton';
import { ProposalsList } from '../ProposalsList';
import { ResultsList } from '../ResultsList';
import { ResultsStats } from '../ResultsStats';

// Common instance fields used by ResultsPage
interface ResultsPageInstance {
  name: string;
  description: string | null;
  process?: {
    description: string | null;
    /** Where the legacy route's template lives — `legacyInstanceDataEncoder`
     * drops `instanceData.proposalTemplate`, so this is the only copy that
     * survives the wire there. Read through `pickProposalTemplate`, the same
     * precedence the server's `resolveProposalTemplate` applies. */
    processSchema?: {
      proposalTemplate?: ProposalTemplateSchema | null;
    } | null;
  } | null;
  instanceData?: {
    // Legacy instances omit `rules` on phases; the ballot tab is gated by
    // `isLegacy` there, so `hasVotingPhase` only reads it on the new schema.
    phases?: readonly {
      phaseId?: string;
      rules?: { voting?: { submit?: boolean } };
    }[];
    /** Read only for its budget currency, which the results banner labels
     * `totalAllocated` with. Absent on legacy instances. */
    proposalTemplate?: ProposalTemplateSchema | null;
  } | null;
}

function ResultsPageLegacy({
  instanceId,
  profileSlug,
}: {
  instanceId: string;
  profileSlug: string;
}) {
  const [instance] = trpc.decision.getLegacyInstance.useSuspenseQuery({
    instanceId,
  });
  return (
    <ResultsPageContent
      instanceId={instanceId}
      profileSlug={profileSlug}
      instance={instance}
      isLegacy
    />
  );
}

export function ResultsPage({
  instanceId,
  profileSlug,
  decisionSlug,
  useLegacy = false,
  pinOffset,
}: {
  instanceId: string;
  /** Owner profile slug (e.g. "people-powered") — used for org-specific hero content and legacy URL fallbacks */
  profileSlug: string;
  /** Decision profile slug (e.g. "pp-decides-season-5") — used for building proposal links in the new route structure */
  decisionSlug?: string;
  /** Use legacy getInstance endpoint (for /profile/[slug]/decisions/[id] route) */
  useLegacy?: boolean;
  /** Sticky filter-bar pin offset, forwarded to ProposalsList. */
  pinOffset?: number;
}) {
  if (useLegacy) {
    return (
      <ResultsPageLegacy instanceId={instanceId} profileSlug={profileSlug} />
    );
  }
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  return (
    <ResultsPageContent
      instanceId={instanceId}
      profileSlug={profileSlug}
      decisionSlug={decisionSlug}
      instance={instance}
      pinOffset={pinOffset}
    />
  );
}

function ResultsPageContent({
  instanceId,
  profileSlug,
  decisionSlug,
  instance,
  isLegacy = false,
  pinOffset,
}: {
  instanceId: string;
  profileSlug: string;
  decisionSlug?: string;
  instance: ResultsPageInstance;
  isLegacy?: boolean;
  pinOffset?: number;
}) {
  const t = useTranslations();

  // The "My Ballot" tab only makes sense when a voting phase took place.
  // Legacy instances always had voting, so they keep showing it.
  const showBallotTab =
    isLegacy || hasVotingPhase(instance.instanceData?.phases ?? []);

  // Organization-specific content
  const heroContent = match<{
    title: string;
    description: string;
    about?: string;
  }>(profileSlug, {
    'people-powered': () => ({
      title: t('The results are in.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
    }),
    cowop: () => ({
      title: t('The results are in.'),
      description: t('COWOPRESULTSHEADER'),
      about: t('COWOPRESULTSABOUT'),
    }),
    'one-project': () => ({
      title: t('The results are in.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
      about: t('HORIZONRESULTSABOUT'),
    }),
    _: () => ({
      title: t('The results are in.'),
      description: `Thank you to everyone who participated in ${instance.name}`,
    }),
  });

  return (
    <>
      <FinalPhaseSubmissionSuccessDialog />
      <ProcessSurveyGate instanceId={instanceId} isLegacy={isLegacy} />
      {/* Hero section — owns the results gradient; the header above stays neutral */}
      <div className="bg-redPurple px-4 pt-16 pb-8 text-neutral-offWhite md:pt-8">
        <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4">
          <DecisionHero
            title={heroContent.title}
            description={heroContent.description}
            variant="results"
          />

          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <ResultsStats
              instanceId={instanceId}
              currency={getTemplateBudgetCurrency(
                pickProposalTemplate(
                  instance.instanceData?.proposalTemplate,
                  instance.process?.processSchema?.proposalTemplate,
                ),
              )}
            />
          </Suspense>

          {['cowop', 'one-project'].includes(profileSlug) ? (
            <DecisionActionBar
              instanceId={instanceId}
              markup={true}
              description={
                heroContent.about ??
                instance.description ??
                instance.process?.description ??
                undefined
              }
            />
          ) : null}
        </div>
      </div>

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full p-4 sm:max-w-6xl">
          <DecisionResultsTabs showBallotTab={showBallotTab}>
            <DecisionResultsTabPanel id="funded">
              <APIErrorBoundary
                fallbacks={{
                  404: () => (
                    <EmptyState icon={<LuLeaf className="size-6" />}>
                      <Header3 className="font-serif !text-title-base font-light text-neutral-black">
                        {t('Results are still being processed.')}
                      </Header3>
                      <p className="text-base text-neutral-charcoal">
                        {t('Check back again shortly for the results.')}
                      </p>
                    </EmptyState>
                  ),
                }}
              >
                <Suspense fallback={<ProposalListSkeleton />}>
                  <ResultsList
                    slug={profileSlug}
                    instanceId={instanceId}
                    decisionSlug={decisionSlug}
                  />
                </Suspense>
              </APIErrorBoundary>
            </DecisionResultsTabPanel>

            <DecisionResultsTabPanel id="all-proposals">
              <Suspense fallback={<ProposalListSkeleton />}>
                <ProposalsList
                  slug={profileSlug}
                  instanceId={instanceId}
                  decisionSlug={decisionSlug}
                  initialFilter={ProposalFilter.ALL}
                  phase="results"
                  pinOffset={pinOffset}
                />
              </Suspense>
            </DecisionResultsTabPanel>

            {showBallotTab ? (
              <DecisionResultsTabPanel id="ballot">
                <APIErrorBoundary
                  fallbacks={{
                    default: () => <NoVoteFound />,
                  }}
                >
                  <Suspense fallback={<ProposalListSkeleton />}>
                    <MyBallot
                      slug={profileSlug}
                      instanceId={instanceId}
                      decisionSlug={decisionSlug}
                    />
                  </Suspense>
                </APIErrorBoundary>
              </DecisionResultsTabPanel>
            ) : null}
          </DecisionResultsTabs>
        </div>
      </div>
    </>
  );
}

function ProcessSurveyGate({
  instanceId,
  isLegacy,
}: {
  instanceId: string;
  isLegacy?: boolean;
}) {
  const searchParams = useSearchParams();
  // The post-publish success modal owns the screen while `?resultsLive=1` is in
  // the URL. Holding the survey back until that param is stripped prevents the
  // survey's backdrop from intercepting clicks on the success modal.
  const isResultsLiveDialogActive =
    searchParams.get(RESULTS_LIVE_QUERY_PARAM) === '1';
  if (isLegacy || isResultsLiveDialogActive) {
    return null;
  }
  return <ProcessSurveyGateInner instanceId={instanceId} />;
}

function ProcessSurveyGateInner({ instanceId }: { instanceId: string }) {
  const [skipped, setSkipped] = useState(() => hasSurveySkipCookie(instanceId));
  const { data } = trpc.decision.getProcessSurveyResponse.useQuery(
    { processInstanceId: instanceId },
    { retry: false, staleTime: Infinity, enabled: !skipped },
  );

  if (skipped) {
    return null;
  }

  return (
    <ProcessSurveyModal
      instanceId={instanceId}
      isOpen={data?.hasResponded === false}
      onSkip={() => {
        setSurveySkipCookie(instanceId);
        setSkipped(true);
      }}
    />
  );
}
