'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { ProcessInstance } from '@op/api/encoders';
import { Suspense } from 'react';

import {
  DevelopProposalsList,
  DevelopProposalsListSkeleton,
} from '../DevelopProposals/DevelopProposalsList';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { DevelopPageShell } from './DevelopPageShell';

/**
 * The develop screen: what a holder of the Develop Proposals permission
 * sees while a develop phase is current and its inbound selection
 * is still pending. A muted band names the task; below it, the previous
 * phase's proposals (the sources) to prepare entries from, and the entries
 * this phase holds so far.
 */
export function DevelopProposalsPage({
  instance,
  decisionSlug,
}: {
  instance: ProcessInstance;
  decisionSlug: string;
}) {
  const phases = instance.instanceData.phases ?? [];
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === instance.currentStateId,
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
            sourcePhase={sourcePhase}
            decisionSlug={decisionSlug}
          />
        </Suspense>
      </APIErrorBoundary>
    </DevelopPageShell>
  );
}
