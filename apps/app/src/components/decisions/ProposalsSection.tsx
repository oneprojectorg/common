import { createClient } from '@op/api/serverClient';
import { match } from '@op/core';
import { Header3 } from '@op/ui/Header';
import { Suspense } from 'react';

import { TranslatedText } from '@/components/TranslatedText';
import { EmptyProposalsState } from '@/components/decisions/EmptyProposalsState';
import {
  ProposalListSkeleton,
  ProposalsList,
} from '@/components/decisions/ProposalsList';

import { DecisionResultsTabs, DecisionResultsTabPanel } from './DecisionResultsTabs';
import { MyBallot } from './MyBallot';
import { ResultsList } from './ResultsList';

async function ProposalsContent({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  const client = await createClient();

  const proposalsData = await client.decision.listProposals({
    processInstanceId: instanceId,
    limit: 100,
  });

  const proposals = proposalsData?.proposals || [];

  return (
    <div className="lg:col-span-3">
      {proposals.length === 0 ? (
        <EmptyProposalsState>
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            <TranslatedText text="No proposals yet" />
          </Header3>
          <p className="text-base text-neutral-charcoal">
            <TranslatedText text="You could be the first one to submit a proposal" />
          </p>
        </EmptyProposalsState>
      ) : (
        <Suspense fallback={<ProposalListSkeleton />}>
          <ProposalsList slug={slug} instanceId={instanceId} />
        </Suspense>
      )}
    </div>
  );
}

function ResultsContent({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  return (
    <DecisionResultsTabs>
      <DecisionResultsTabPanel id="funded">
        <div className="lg:col-span-3">
          <Suspense fallback={<ProposalListSkeleton />}>
            <ResultsList slug={slug} instanceId={instanceId} />
          </Suspense>
        </div>
      </DecisionResultsTabPanel>

      <DecisionResultsTabPanel id="ballot">
        <div className="lg:col-span-3">
          <Suspense fallback={<ProposalListSkeleton />}>
            <MyBallot slug={slug} instanceId={instanceId} />
          </Suspense>
        </div>
      </DecisionResultsTabPanel>
    </DecisionResultsTabs>
  );
}

const ProposalsSectionContent = async ({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) => {
  const client = await createClient();

  const instance = await client.decision.getInstance({
    instanceId,
  });

  return match(instance.currentStateId, {
    results: () => <ResultsContent instanceId={instanceId} slug={slug} />,
    _: () => <ProposalsContent instanceId={instanceId} slug={slug} />,
  });
};

export function ProposalsSection({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  return (
    <div className="flex w-full justify-center bg-white">
      <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
        <Suspense fallback={<ProposalListSkeleton />}>
          <ProposalsSectionContent instanceId={instanceId} slug={slug} />
        </Suspense>
      </div>
    </div>
  );
}
