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
        {/* Both unstyled on purpose. Figma ranks this heading with a proposal
            answer's question rather than the 16px Attachments / Comments
            headings, which is Header3's own `text-title` (20px from `md`), and
            binds the description to the primary foreground — so it stays
            un-muted, unlike the sibling section subtitles. */}
        <Header3 id={headingId}>{t('Contributing ideas')}</Header3>
        <p className="text-base">
          {t('These participant ideas were merged into this proposal.')}
        </p>
      </div>
      <ul className="mt-6 flex flex-col gap-4">
        {contributing.proposals.map((contributingProposal) => (
          <li key={contributingProposal.id}>
            {/* No status badge: the remaining ones ("Shortlisted", "Not
                shortlisted") describe a candidacy that ended at the merge. */}
            <ProposalCardView
              proposal={contributingProposal}
              href={`${decisionRoot}/proposal/${contributingProposal.profileId}`}
              showStatusBadge={false}
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
