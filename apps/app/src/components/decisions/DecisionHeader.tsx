'use client';

import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';
import { isLastPhase } from '@op/common/client';
import { cn } from '@op/ui/utils';
import { type ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

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

export function DecisionHeader(props: DecisionHeaderProps) {
  if (props.useLegacy) {
    return <LegacyDecisionHeaderContent {...props} />;
  }
  return <DecisionHeaderContent {...props} />;
}

function DecisionHeaderContent({
  instanceId,
  children,
  decisionSlug,
  isAdmin,
  profileName,
}: DecisionHeaderProps) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const instancePhases = instance.instanceData?.phases ?? [];

  const phases: ProcessPhase[] = instancePhases.map((p) => ({
    id: p.phaseId,
    name: p.name || '',
    description: p.description,
    phase: {
      startDate: p.startDate,
      endDate: p.endDate,
    },
    advancementMethod: p.rules?.advancement?.method,
  }));

  const isResultsView =
    isLastPhase(instance.currentStateId, instancePhases) &&
    instance.selectionsAreConfirmed === true;

  return (
    <div
      className={cn(
        isResultsView
          ? 'bg-redPurple text-neutral-offWhite'
          : 'bg-neutral-offWhite text-gray-700',
      )}
    >
      <DecisionInstanceHeader
        backTo={{ href: '/decisions' }}
        title={
          profileName ||
          instance.name ||
          instance.instanceData?.templateName ||
          instance.process?.name ||
          t('Untitled')
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
    </div>
  );
}

function LegacyDecisionHeaderContent({
  instanceId,
  children,
  decisionSlug,
  isAdmin,
  slug,
  profileName,
}: DecisionHeaderProps) {
  const [instance] = trpc.decision.getLegacyInstance.useSuspenseQuery({
    instanceId,
  });

  const instancePhases = instance.instanceData?.phases ?? [];
  const processSchema = instance.process?.processSchema;
  const templateStates = processSchema?.states ?? [];

  const phases: ProcessPhase[] = instancePhases.map((p) => {
    const templateState = templateStates.find((s) => s.id === p.phaseId);
    return {
      id: p.phaseId,
      name: templateState?.name ?? '',
      description: templateState?.description,
      type: templateState?.type,
      phase: templateState?.phase || {
        startDate: p.startDate,
        endDate: p.endDate,
      },
    };
  });

  return (
    <div className="bg-redPurple text-neutral-offWhite">
      <DecisionInstanceHeader
        backTo={{
          href: slug ? `/profile/${slug}?tab=decisions` : '/decisions',
        }}
        title={profileName || instance.name || instance.process?.name || ''}
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
    </div>
  );
}
