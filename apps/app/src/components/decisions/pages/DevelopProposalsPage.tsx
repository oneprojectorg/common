'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { ProcessInstance } from '@op/api/encoders';
import { Header1 } from '@op/sense/Header';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  DevelopProposalsList,
  DevelopProposalsListSkeleton,
} from '../DevelopProposals/DevelopProposalsList';
import { ProposalsLoadError } from '../ProposalsLoadError';

/**
 * The develop screen: what an admin or a holder of the Develop Proposals
 * permission sees while a develop phase is current and its inbound selection
 * is still pending. A muted band names the task; below it, the previous
 * phase's proposals (the origins) to prepare entries from, and the entries
 * this phase holds so far.
 */
export function DevelopProposalsPage({
  instance,
  slug,
  decisionSlug,
}: {
  instance: ProcessInstance;
  /** Owning profile slug, for proposal links on the legacy route. */
  slug: string;
  /** Decision profile slug, for proposal links. */
  decisionSlug?: string;
}) {
  const t = useTranslations('decisions');
  const phases = instance.instanceData?.phases ?? [];
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  // A develop phase that opens the process has nothing to develop from.
  const originPhase =
    currentIndex > 0 ? (phases[currentIndex - 1] ?? null) : null;

  return (
    <div className="min-h-full">
      <section className="bg-muted px-4 pt-8 pb-7 text-center">
        <div className="mx-auto flex max-w-page flex-col items-center gap-3">
          <Header1 className="text-primary">{t('develop.heroTitle')}</Header1>
          <p className="max-w-prose text-base text-balance text-foreground">
            {t('selectAdvancingHeading')}
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-page px-4 pt-12 pb-32">
        <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
          <Suspense fallback={<DevelopProposalsListSkeleton />}>
            <DevelopProposalsList
              instance={instance}
              originPhase={originPhase}
              slug={slug}
              decisionSlug={decisionSlug}
            />
          </Suspense>
        </APIErrorBoundary>
      </div>
    </div>
  );
}
