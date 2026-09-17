'use client';

import { formatDate } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import type { DecisionAccess, ThemeAnalysisOutlier } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Skeleton } from '@op/sense/Skeleton';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import { LuChartPie } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { MergeProposalDialogProvider } from './MergeProposalDialogContext';
import { ProposalBrowseCard } from './ProposalBrowseCard';
import { ProposalClaimsChart } from './ProposalClaimsChart';
import { ThemeAnalysisSections } from './ThemeAnalysisSections';
import { ThemeSizeChart } from './ThemeSizeChart';
import { useLatestThemeAnalysis } from './useLatestThemeAnalysis';

/** How many proposals to fetch for the cards. Matches the list's page size. */
const PROPOSAL_PAGE_SIZE = 50;

/** How many outliers get a full card before the rest stay as references. */
const MAX_OUTLIER_CARDS = 4;

export interface ThemeAnalysisTabProps {
  instanceId: string;
  /** Owning profile slug, for the cards' links. */
  slug: string;
  /** Decision profile slug, for the cards' links. */
  decisionSlug?: string;
  permissions?: DecisionAccess | null;
}

/**
 * The analysis as a tab of the process, rather than a modal over the proposals.
 *
 * Always the whole process. The modal's scope followed the surface that opened
 * it — the phase list analysed the phase — but a tab beside "All proposals" is
 * read as a view of the decision, so it reads the `process` snapshot whatever
 * phase the instance is in.
 *
 * Nothing here runs an analysis. The scheduled refresh writes a snapshot
 * whenever the instance's proposals change, and the manual control stays in the
 * proposals list where a facilitator already goes to act on them; a tab that
 * could also start one would give two places to press for the same job and two
 * places to report it failing.
 *
 * The page has room the modal did not, which is what the extra content is for:
 * the counts as figures, two charts rather than one, and the proposals behind
 * the outliers as real cards instead of titles — an outlier is the finding most
 * likely to send a reader to the proposal itself.
 */
export const ThemeAnalysisTab = ({
  instanceId,
  slug,
  decisionSlug,
  permissions,
}: ThemeAnalysisTabProps) => {
  const t = useTranslations();
  const locale = useLocale();
  const { snapshot, isLoading } = useLatestThemeAnalysis(instanceId, 'process');

  if (isLoading) {
    return <AnalysisSkeleton />;
  }

  if (!snapshot) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuChartPie className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('No analysis yet')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'Run one from All proposals, and it will appear here once it finishes.',
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { result, analyzedCount, total, completedAt } = snapshot;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-label text-muted-foreground">
          {t('Based on {analyzedCount, number} of {total, number} proposals', {
            analyzedCount,
            total,
          })}
          {' · '}
          {t('Updated {date}', {
            date: formatDate(completedAt, locale, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
          })}
        </p>
      </div>

      <AnalysisFigures
        claims={result.claims.length}
        themes={result.themes.length}
        commonGround={result.commonGround.length}
        outliers={result.outliers.length}
        suggestions={result.suggestions.length}
      />

      {/* Side by side where there is room, stacked where there is not. The two
          answer different questions — what the process is about, and who is
          doing the arguing — so they are worth reading together. */}
      <div className="grid gap-6 sm:grid-cols-2">
        <ThemeSizeChart themes={result.themes} />
        <ProposalClaimsChart claims={result.claims} />
      </div>

      <OutlierProposals
        outliers={result.outliers}
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
        permissions={permissions}
      />

      <ThemeAnalysisSections
        result={result}
        route={{ slug, instanceId, decisionSlug }}
        canMerge={permissions?.admin ?? false}
      />
    </div>
  );
};

/**
 * The analysis in numbers.
 *
 * Figures rather than a chart, because each of these is one number: a bar chart
 * of five unrelated totals compares quantities that have nothing to do with each
 * other, and the number is the chart.
 */
const AnalysisFigures = ({
  claims,
  themes,
  commonGround,
  outliers,
  suggestions,
}: {
  claims: number;
  themes: number;
  commonGround: number;
  outliers: number;
  suggestions: number;
}) => {
  const t = useTranslations();

  const figures = [
    { label: t('Claims'), value: claims },
    { label: t('Themes'), value: themes },
    { label: t('Common ground'), value: commonGround },
    { label: t('Outliers'), value: outliers },
    { label: t('Suggestions'), value: suggestions },
  ];

  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      {figures.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1 rounded-lg border p-3">
          {/* Proportional figures, not `tabular-nums`: these do not align in a
              column, and equal-width digits read loose at this size. */}
          <dd className="text-headline">{value}</dd>
          <dt className="text-label text-muted-foreground">{label}</dt>
        </div>
      ))}
    </dl>
  );
};

/**
 * The proposals behind the outliers, as the cards the rest of the app uses.
 *
 * The analysis stores only an id, a title and a profile id per proposal, which
 * is all the modal's references need. A card needs the proposal itself, so this
 * fetches the instance's proposals and joins on id — and renders only the ones
 * it found, because a card for a proposal that has since been deleted would be
 * a card with nothing in it.
 *
 * Outliers rather than every section. A high-impact outlier is the one finding
 * whose whole point is "go and read this one", so it is where a card earns its
 * space; themes and common ground are claims about many proposals at once, and a
 * card each would bury them.
 */
const OutlierProposals = ({
  outliers,
  instanceId,
  slug,
  decisionSlug,
  permissions,
}: {
  outliers: ThemeAnalysisOutlier[];
  instanceId: string;
  slug: string;
  decisionSlug?: string;
  permissions?: DecisionAccess | null;
}) => {
  const t = useTranslations();

  // The high-impact ones first: those are the outliers the section exists to
  // surface, and the cap should spend itself on them before the minor ones.
  const wanted = useMemo(
    () =>
      [...outliers]
        .sort((left, right) =>
          left.impact === right.impact
            ? 0
            : left.impact === 'high-impact'
              ? -1
              : 1,
        )
        .slice(0, MAX_OUTLIER_CARDS),
    [outliers],
  );

  const { data } = trpc.decision.listAllProposals.useQuery(
    { processInstanceId: instanceId, limit: PROPOSAL_PAGE_SIZE },
    {
      // A card is an enrichment of something already on screen. A failed read
      // should cost the cards, not the analysis, so this neither suspends nor
      // escalates.
      enabled: wanted.length > 0,
      staleTime: 30 * 1000,
      retry: 2,
    },
  );

  const byId = useMemo(() => {
    const index = new Map<string, Proposal>();

    for (const proposal of data?.items ?? []) {
      index.set(proposal.id, proposal);
    }

    return index;
  }, [data]);

  const cards = wanted.flatMap(({ proposal }) => {
    const found = byId.get(proposal.id);

    return found ? [found] : [];
  });

  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-serif text-title">{t('Proposals worth a look')}</h3>
      {/* The card's menu opens the merge dialog through a context rather than a
          prop, and its hook throws without a provider rather than quietly doing
          nothing — deliberately, because a Merge item that silently did nothing
          would look like the bug the provider exists to fix. So a card cannot be
          reused outside one, which is what this section learned the hard way.

          Around the cards rather than the whole tab: the analysis sections below
          render their own merge dialog inline, and one subtree with two ways to
          open the same dialog is a question nobody should have to answer. */}
      <MergeProposalDialogProvider>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((proposal) => (
            <ProposalBrowseCard
              key={proposal.id}
              proposal={proposal}
              instanceId={instanceId}
              slug={slug}
              decisionSlug={decisionSlug}
              permissions={permissions}
            />
          ))}
        </div>
      </MergeProposalDialogProvider>
    </section>
  );
};

/**
 * Held while the first read lands.
 *
 * Shaped like what replaces it — a line of figures, then two charts — so the
 * panel does not jump when the snapshot arrives.
 */
const AnalysisSkeleton = () => (
  <div className="flex flex-col gap-6">
    <Skeleton className="h-4 w-64" />
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      {Array.from({ length: 5 }, (_unused, position) => (
        <Skeleton key={position} className="h-20" />
      ))}
    </div>
    <div className="grid gap-6 sm:grid-cols-2">
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  </div>
);
