'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  DevelopProposalsList,
  DevelopProposalsListSkeleton,
} from '../DevelopProposals/DevelopProposalsList';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { DevelopPageShell, getEntryName } from './DevelopPageShell';

/**
 * The develop screen: what a holder of the Develop Proposals permission
 * sees while a develop phase is current and its inbound selection
 * is still pending. A muted band names the task; below it, the previous
 * phase's proposals (the sources) to prepare entries from, and the entries
 * this phase holds so far.
 */
export function DevelopProposalsPage({
  instance,
  developPhase,
  decisionSlug,
}: {
  instance: ProcessInstance;
  developPhase: InstancePhaseData;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions');
  const phases = instance.instanceData.phases ?? [];
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === developPhase.phaseId,
  );
  // A develop phase that opens the process has nothing to develop from.
  const sourcePhase =
    currentIndex > 0 ? (phases[currentIndex - 1] ?? null) : null;

  return (
    <DevelopPageShell>
      <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
        <Suspense fallback={<DevelopProposalsListSkeleton />}>
          <DevelopProposalsList
            instance={instance}
            phaseId={developPhase.phaseId}
            sourcePhase={sourcePhase}
            decisionSlug={decisionSlug}
            entryName={getEntryName({ developPhase, t })}
          />
        </Suspense>
      </APIErrorBoundary>
    </DevelopPageShell>
  );
}
