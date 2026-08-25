'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { Suspense, useEffect, useId } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalCardView } from './ProposalCard';

/**
 * The proposals merged into this one, listed above the comments. A merge
 * records a link rather than moving content, so nothing else on the surviving
 * proposal shows what fed into it.
 */
export function ContributingIdeas({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  /** Route prefix, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  return (
    <APIErrorBoundary
      fallbacks={{
        default: ({ error, resetErrorBoundary }: FallbackProps) => (
          <ContributingIdeasUnavailable
            error={error}
            onRetry={resetErrorBoundary}
          />
        ),
      }}
    >
      {/* No skeleton: most proposals have nothing merged in, so a placeholder
          would flash on every page that ends up rendering nothing. */}
      <Suspense fallback={null}>
        <ContributingIdeasSuspense
          proposal={proposal}
          decisionRoot={decisionRoot}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ContributingIdeasSuspense({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  decisionRoot: string;
}) {
  const t = useTranslations();
  const headingId = useId();

  const [contributing] =
    trpc.decision.listContributingProposals.useSuspenseQuery({
      proposalId: proposal.id,
    });

  if (contributing.proposals.length === 0) {
    return null;
  }

  return (
    <section className="border-t pt-8" aria-labelledby={headingId}>
      <div className="flex flex-col gap-2">
        <Header3 id={headingId} className="text-headline font-light">
          {t('Contributing ideas')}
        </Header3>
        <p className="text-base text-muted-foreground">
          {t('These participant ideas were merged into this proposal.')}
        </p>
      </div>
      <ul className="mt-6 flex flex-col gap-4">
        {contributing.proposals.map((contributingProposal) => (
          <li key={contributingProposal.id}>
            {/* Restricted visibility only: the candidacy badges ("Shortlisted",
                "Not shortlisted") describe a race that ended at the merge, but
                a hidden idea is listed here for admins and has to say so. */}
            <ProposalCardView
              proposal={contributingProposal}
              href={`${decisionRoot}/proposal/${contributingProposal.profileId}`}
              badge="restriction"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Shown when the read fails. Retrying resets the boundary, which remounts the
 * query and refetches it.
 */
function ContributingIdeasUnavailable({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    logger.error('Could not load contributing proposals', { error });
  }, [error]);

  return (
    <section className="border-t pt-8">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuTriangleAlert className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('Contributing ideas could not be loaded')}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t('Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    </section>
  );
}
