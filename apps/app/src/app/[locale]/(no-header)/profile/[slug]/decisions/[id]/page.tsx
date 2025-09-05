import { trpcNext } from '@op/api/vanilla';
import { ButtonLink } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { CurrentPhaseSurface } from '@/components/decisions/CurrentPhaseSurface';
import { DecisionInstanceContent } from '@/components/decisions/DecisionInstanceContent';
import { DecisionInstanceHeader } from '@/components/decisions/DecisionInstanceHeader';
import { DecisionProcessStepper } from '@/components/decisions/DecisionProcessStepper';
import { EmptyProposalsState } from '@/components/decisions/EmptyProposalsState';
import { ProposalsList } from '@/components/decisions/ProposalsList';

interface ProcessPhase {
  id: string;
  name: string;
  description?: string;
  phase?: {
    startDate?: string;
    endDate?: string;
    sortOrder?: number;
  };
  type?: 'initial' | 'intermediate' | 'final';
}

async function DecisionInstancePageContent({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  try {
    const client = await trpcNext();
    const t = await getTranslations();

    // Fetch instance and proposals in parallel
    const [instance, proposalsData] = await Promise.all([
      client.decision.getInstance.query({
        instanceId,
      }),
      client.decision.listProposals.query({
        processInstanceId: instanceId,
        limit: 20,
      }),
    ]);

    if (!instance) {
      notFound();
    }

    const processSchema = instance.process?.processSchema as any;
    const instanceData = instance.instanceData as any;

    // Merge template states with actual instance phase data
    const templateStates: ProcessPhase[] = processSchema?.states || [];
    const instancePhases = instanceData?.phases || [];

    const phases: ProcessPhase[] = templateStates.map((templateState) => {
      // Find corresponding instance phase data
      const instancePhase = instancePhases.find(
        (ip: any) => ip.stateId === templateState.id,
      );

      return {
        ...templateState,
        phase: instancePhase
          ? {
              startDate: instancePhase.plannedStartDate,
              endDate: instancePhase.plannedEndDate,
              sortOrder: templateState.phase?.sortOrder,
            }
          : templateState.phase,
      };
    });

    const currentPhase = phases.find(
      (phase) => phase.id === instance.currentStateId,
    );

    const budget = instanceData?.budget || processSchema?.budget;

    // TODO: special key for People powered translations as a stop-gap
    const description = instance?.description?.match('PPDESCRIPTION')
      ? t('PPDESCRIPTION')
      : (instance.description ?? instance.process?.description);

    const { name, proposalCount = 0 } = instance;
    const proposals = proposalsData?.proposals || [];

    return (
      <>
        <div className="border-b bg-neutral-offWhite">
          <DecisionInstanceHeader
            backTo={{
              label: instance.owner?.name,
              href: `/profile/${slug}`,
            }}
            title={instance.process?.name || instance.name}
          />

          <div className="flex flex-col overflow-x-scroll sm:items-center">
            <div className="w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
              <DecisionProcessStepper
                phases={phases}
                currentStateId={instance.currentStateId || ''}
                className="mx-auto"
              />
            </div>
          </div>

          <Suspense fallback={<Skeleton />}>
            <DecisionInstanceContent instanceId={instanceId} />
          </Suspense>
        </div>

        {/* Main layout with sidebar and content */}
        <div className="flex w-full justify-center bg-white">
          <div className="grid w-full grid-cols-1 gap-8 p-4 sm:max-w-6xl sm:p-8 lg:grid-cols-4">
            {/* Left sidebar - Process Info */}
            <div className="lg:col-span-1">
              <div className="flex flex-col gap-4">
                <Header3 className="font-serif !text-title-base text-neutral-black">
                  {name}
                </Header3>
                {description ? (
                  <p
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                ) : null}

                <div className="mb-6">
                  <ButtonLink
                    href={`/profile/${slug}/decisions/${instanceId}/proposal/create`}
                    color="primary"
                    className="w-full"
                  >
                    {t('Submit a proposal')}
                  </ButtonLink>
                </div>

                <CurrentPhaseSurface
                  currentPhase={currentPhase}
                  budget={budget}
                  hideBudget={instanceData?.hideBudget}
                  proposalCount={proposalCount}
                />
              </div>
            </div>

            {/* Main content area - Proposals */}
            <div className="lg:col-span-3">
              {proposals.length === 0 ? (
                <EmptyProposalsState />
              ) : (
                <Suspense fallback={<Skeleton className="h-full" />}>
                  <ProposalsList slug={slug} instanceId={instanceId} />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error('Error loading decision instance:', error);
    notFound();
  }
}

function DecisionInstancePageLoading() {
  return (
    <>
      {/* Header loading */}
      <div className="flex items-center justify-between border-b border-neutral-gray1 bg-white px-6 py-4">
        <div className="h-6 w-32 animate-pulse rounded bg-neutral-gray1" />
        <div className="h-6 w-48 animate-pulse rounded bg-neutral-gray1" />
        <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-gray1" />
      </div>

      {/* Stepper loading */}
      <div className="bg-white py-8">
        <div className="mx-auto flex items-center justify-center space-x-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-gray1" />
              <div className="mt-3 h-4 w-24 animate-pulse rounded bg-neutral-gray1" />
              <div className="mt-1 h-3 w-16 animate-pulse rounded bg-neutral-gray1" />
            </div>
          ))}
        </div>
      </div>

      {/* Content loading */}
      <div className="min-h-full bg-gray-50 px-6 py-12">
        <div className="mx-auto sm:max-w-6xl">
          <div className="text-center">
            <div className="mx-auto h-16 w-96 animate-pulse rounded bg-neutral-gray1" />
            <div className="mx-auto mt-4 h-6 w-80 animate-pulse rounded bg-neutral-gray1" />
          </div>

          <div className="rounded-lg bg-white p-8 shadow-sm">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <div className="h-8 w-64 animate-pulse rounded bg-neutral-gray1" />
                <div className="mt-4 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-neutral-gray1" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-gray1" />
                </div>
                <div className="mt-8 h-12 w-32 animate-pulse rounded bg-neutral-gray1" />
              </div>
              <div className="space-y-6">
                <div className="h-20 animate-pulse rounded bg-neutral-gray1" />
                <div className="h-24 animate-pulse rounded bg-neutral-gray1" />
                <div className="h-32 animate-pulse rounded bg-neutral-gray1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const DecisionInstancePage = async ({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) => {
  const { id, slug } = await params;

  return (
    <Suspense fallback={<DecisionInstancePageLoading />}>
      <DecisionInstancePageContent instanceId={id} slug={slug} />
    </Suspense>
  );
};

export default DecisionInstancePage;
