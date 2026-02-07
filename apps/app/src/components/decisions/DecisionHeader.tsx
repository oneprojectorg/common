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

  const instanceData = instance.instanceData as any;
  const instancePhases = instanceData?.phases ?? [];

  // For new instances, phases contain name/description directly.
  // For legacy instances, fall back to process.processSchema states/phases for names.
  const processSchema = (instance as any).process?.processSchema;
  const templateStates = processSchema?.states || processSchema?.phases || [];

  const phases: ProcessPhase[] = instancePhases.map((p: any) => {
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
          instanceData?.schemaName ||
          (instance as any).process?.name ||
          instance.name
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
