'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { ProcessInstance } from '@op/api/encoders';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  DevelopSourcesCoauthorPanel,
  DevelopSourcesTableSkeleton,
} from '../DevelopProposals/DevelopSourcesPanel';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { DevelopPageShell } from './DevelopPageShell';

/**
 * The develop screen of a reviewer who may not develop proposals, while a
 * develop phase is current and its inbound selection is pending: the sources
 * assigned to them, with the entry of each to edit as a co-author. It has no
 * Prepare, Advance or Confirm.
 */
export function DevelopCoauthorPage({
  instance,
  decisionSlug,
}: {
  instance: ProcessInstance;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions.develop');
  const phases = instance.instanceData.phases ?? [];
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  // A develop phase that opens the process has nothing to develop from.
  const sourcePhase =
    currentIndex > 0 ? (phases[currentIndex - 1] ?? null) : null;

  return (
    <DevelopPageShell
      title={t('coauthorHeading')}
      description={t('coauthorDescription')}
    >
      <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
        <Suspense fallback={<DevelopSourcesTableSkeleton />}>
          <DevelopSourcesCoauthorPanel
            instance={instance}
            sourcePhase={sourcePhase}
            decisionSlug={decisionSlug}
          />
        </Suspense>
      </APIErrorBoundary>
    </DevelopPageShell>
  );
}
