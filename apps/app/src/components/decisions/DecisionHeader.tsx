import { type ProcessPhase } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import type { DecisionInstanceData } from '@op/common';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

import { DecisionHeaderShell } from '@/components/decisions/DecisionHeaderShell';
import { DecisionInstanceHeader } from '@/components/decisions/DecisionInstanceHeader';
import { DecisionProcessStepper } from '@/components/decisions/DecisionProcessStepper';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';

interface DecisionHeaderProps {
  instanceId: string;
  children?: ReactNode;
  /** Decision profile slug for building the edit link */
  decisionSlug?: string;
  /** Whether the current user has admin access to this decision */
  isAdmin?: boolean;
  /** Use legacy getInstance endpoint (for /profile/[slug]/decisions/[id] route) */
  useLegacy?: boolean;
  /** Profile slug for back button — required when useLegacy is true */
  slug?: string;
  /** Title from the decision profile */
  profileName?: string;
}

export async function DecisionHeader({
  instanceId,
  children,
  decisionSlug,
  isAdmin,
  useLegacy = false,
  slug,
  profileName,
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
      advancementMethod:
        p.rules?.advancement?.method ??
        templateState?.rules?.advancement?.method,
    };
  });

  // The gradient depends on selectionsAreConfirmed, which flips via channel
  // invalidation. Delegate the conditional className to the client shell so
  // it derives from the live tRPC cache (deduped with DecisionStateRouter's
  // suspense query) instead of needing a router.refresh() round-trip.
  return (
    <DecisionHeaderShell instanceId={instanceId} useLegacy={useLegacy}>
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
              instanceId={instanceId}
              isAdmin={isAdmin}
              className="mx-auto"
            />
          </div>
        </div>

        {children}
      </DecisionTranslationProvider>
    </DecisionHeaderShell>
  );
}
