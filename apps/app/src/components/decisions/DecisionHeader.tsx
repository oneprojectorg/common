import { createClient } from '@op/api/serverClient';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DecisionInstanceContent } from '@/components/decisions/DecisionInstanceContent';
import { DecisionInstanceHeader } from '@/components/decisions/DecisionInstanceHeader';
import { DecisionProcessStepper } from '@/components/decisions/DecisionProcessStepper';
import { ProcessPhase } from '@/components/decisions/types';

interface DecisionHeaderProps {
  instanceId: string;
  slug: string;
}

export async function DecisionHeader({
  instanceId,
  slug,
}: DecisionHeaderProps) {
  const client = await createClient();

  const instance = await client.decision.getInstance({
    instanceId,
  });

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
      (phase: any) => phase.stateId === templateState.id,
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

  const isResultsPhase = instance.currentStateId === 'results';

  return (
    <div
      className={cn(
        'border-b',
        isResultsPhase ? 'bg-redPurple' : 'bg-neutral-offWhite',
      )}
    >
      <DecisionInstanceHeader
        backTo={{
          label: instance.owner?.name,
          href: `/profile/${slug}?tab=decisions`,
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
  );
}
