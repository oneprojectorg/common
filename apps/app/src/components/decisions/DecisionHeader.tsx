import { createClient } from '@op/api/serverClient';
import type { DecisionInstanceData } from '@op/common';
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

  const instanceData = instance.instanceData as DecisionInstanceData;
  const instancePhases = instanceData.phases ?? [];

  // For legacy instances, fall back to process.processSchema states/phases for names.
  const processSchema = (instance as any).process?.processSchema;
  const templateStates = processSchema?.states || processSchema?.phases || [];

  const phases: ProcessPhase[] = instancePhases.map((p) => {
    const templateState = templateStates.find((s: any) => s.id === p.phaseId);
    return {
      id: p.phaseId,
      name: p.name || templateState?.name,
      description: p.description || templateState?.description,
      type: templateState?.type,
      config: templateState?.config,
      phase: templateState?.phase || {
        startDate: p.startDate,
        endDate: p.endDate,
      },
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
        title={
          instance.name ||
          instanceData.templateName ||
          (instance as any).process?.name
        }
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
