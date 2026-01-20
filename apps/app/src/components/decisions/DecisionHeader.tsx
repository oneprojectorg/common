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
  /** Use legacy getInstance endpoint (for /profile/[slug]/decisions/[id] route) */
  useLegacy?: boolean;
}

export async function DecisionHeader({
  instanceId,
  slug,
  children,
  useLegacy = false,
}: DecisionHeaderProps) {
  const client = await createClient();

  const instance = useLegacy
    ? await client.decision.getLegacyInstance({ instanceId })
    : await client.decision.getInstance({ instanceId });

  if (!instance) {
    notFound();
  }

  const processSchema = instance.process?.processSchema as any;

  // Legacy format: uses 'states' with phase.startDate structure
  // V2 format: uses 'phases' with startDate/endDate merged from backend
  const templateStates = processSchema?.states || processSchema?.phases || [];

  const phases: ProcessPhase[] = templateStates.map((state: any) => ({
    id: state.id,
    name: state.name,
    description: state.description,
    type: state.type,
    config: state.config,
    // V2 has startDate/endDate directly, legacy has them in phase object
    phase: state.phase || {
      startDate: state.startDate,
      endDate: state.endDate,
    },
  }));

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
