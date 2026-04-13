import { type ProcessInstance, type ProcessPhase } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import type { DecisionInstanceData } from '@op/common';
import { cn } from '@op/ui/utils';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

import { DecisionInstanceHeader } from '@/components/decisions/DecisionInstanceHeader';
import { DecisionProcessStepper } from '@/components/decisions/DecisionProcessStepper';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';

interface DecisionHeaderProps {
  children?: ReactNode;
  /** Decision profile slug for building the edit link */
  decisionSlug?: string;
  /** Whether the current user has admin access to this decision */
  isAdmin?: boolean;
  /** Profile slug for back button — required when useLegacy is true */
  slug?: string;
  /** Title from the decision profile */
  profileName?: string;
  /**
   * Pre-fetched instance data. When provided, DecisionHeader skips its own
   * getInstance call and uses this data directly — eliminating a redundant
   * server-side fetch.
   */
  instance?: ProcessInstance;
  /**
   * Instance ID — only required when `instance` is not provided (legacy route).
   * When `instance` is provided, the ID is read from `instance.id`.
   */
  instanceId?: string;
  /** Use legacy getInstance endpoint (for /profile/[slug]/decisions/[id] route) */
  useLegacy?: boolean;
}

export async function DecisionHeader({
  children,
  decisionSlug,
  isAdmin,
  useLegacy = false,
  slug,
  profileName,
  instance: instanceProp,
  instanceId: instanceIdProp,
}: DecisionHeaderProps) {
  // When instance is pre-fetched (new route), use it directly.
  // Otherwise (legacy route), fetch via tRPC server client.
  let instance;

  if (instanceProp) {
    instance = instanceProp;
  } else if (instanceIdProp) {
    const client = await createClient();
    instance = useLegacy
      ? await client.decision.getLegacyInstance({ instanceId: instanceIdProp })
      : await client.decision.getInstance({ instanceId: instanceIdProp });
  }

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
          href:
            useLegacy && slug ? `/profile/${slug}?tab=decisions` : '/decisions',
        }}
        title={
          profileName ||
          instance.name ||
          instanceData.templateName ||
          (instance as any).process?.name
        }
        decisionSlug={decisionSlug}
        isAdmin={isAdmin}
      />
      <DecisionTranslationProvider>
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
      </DecisionTranslationProvider>
    </div>
  );
}
