import { createClient } from '@op/api/serverClient';
import { cn } from '@op/ui/utils';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

import { DecisionInstanceHeader } from '@/components/decisions/DecisionInstanceHeader';
import { DecisionProcessStepper } from '@/components/decisions/DecisionProcessStepper';
import { ProcessPhase } from '@/components/decisions/types';

interface DecisionHeaderProps {
  instanceId: string;
  slug: string;
  children?: ReactNode;
}

export async function DecisionHeader({
  instanceId,
  slug,
  children,
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
        isResultsPhase
          ? 'bg-redPurple text-neutral-offWhite'
          : 'bg-neutral-offWhite text-gray-700',
      )}
    >
      <DecisionInstanceHeader
        backTo={{
          label: instance.owner?.name,
          href: `/profile/${slug}?tab=decisions`,
        }}
        title={instance.process?.name || instance.name}
      />

      <div className="flex flex-col overflow-x-auto sm:items-center">
        <div className="w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
          <DecisionProcessStepper
            phases={phases}
            currentStateId={instance.currentStateId || ''}
            className="mx-auto"
          />
        </div>
      </div>

      {children}
    </div>
  );
}
