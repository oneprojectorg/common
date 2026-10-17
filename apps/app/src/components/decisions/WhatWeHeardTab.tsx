'use client';

import { formatDate } from '@/utils/formatting';
import type {
  DecisionAccess,
  ThemeAnalysisResult,
  ThemeAnalysisSnapshot,
} from '@op/api/encoders';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Card, CardContent, CardDescription, CardHeader } from '@op/sense/Card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@op/sense/Popover';
import { Progress } from '@op/sense/Progress';
import { Skeleton } from '@op/sense/Skeleton';
import { useLocale } from 'next-intl';
import { LuChartPie, LuInfo } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalLink,
  ProposalRefs,
  SuggestionsSection,
  type ThemeAnalysisRoute,
} from './ThemeAnalysisSections';
import { useLatestThemeAnalysis } from './useLatestThemeAnalysis';
import {
  resolveOutlierRows,
  resolveStatementQuotes,
  resolveThemeRows,
  statementShare,
} from './whatWeHeardRows';

export interface WhatWeHeardTabProps {
  instanceId: string;
  /** Owning profile slug, for the proposal links. */
  slug: string;
  /** Decision profile slug, for the proposal links. */
  decisionSlug?: string;
  permissions?: DecisionAccess | null;
}

/**
 * What we heard: the analysis of a process's proposals, written for the people
 * who sent them in rather than for the team running it.
 *
 * Reads the stored `process` snapshot, like the Analysis tab it replaces, and
 * runs nothing: the scheduled refresh keeps the snapshot current and the manual
 * control stays in the proposals list. What changes is the shape. A resident
 * opens this to find out whether what they asked for was heard, so the page
 * leads with the points many proposals share and the words people used for
 * them, and keeps the parts that ask the team to do something — the merge and
 * revise suggestions — for the team.
 *
 * Every number on the page is counted from the snapshot, and every quote is one
 * the analysis checked against the proposal it names.
 */
export const WhatWeHeardTab = ({
  instanceId,
  slug,
  decisionSlug,
  permissions,
}: WhatWeHeardTabProps) => {
  const t = useTranslations();
  const { snapshot, isLoading } = useLatestThemeAnalysis(instanceId, 'process');

  if (isLoading) {
    return <HeardSkeleton />;
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

  const route: ThemeAnalysisRoute = { slug, instanceId, decisionSlug };
  const { result } = snapshot;

  return (
    <div className="flex flex-col gap-6">
      <HeardToolbar snapshot={snapshot} />

      <HeardTiles snapshot={snapshot} />

      <div className="grid gap-6 lg:grid-cols-3">
        <CommonGroundCard
          commonGround={result.commonGround}
          claims={result.claims}
          analyzedCount={snapshot.analyzedCount}
          route={route}
        />
        <ThemesCard themes={result.themes} route={route} />
        <StoodApartCard outliers={result.outliers} route={route} />
      </div>

      {/* The one section that asks someone to act. A resident has nothing to
          merge, so it is the team's, and it keeps the merge action it had on
          the Analysis tab. Its heading is the accordion's own trigger. */}
      {permissions?.admin && result.suggestions.length > 0 ? (
        <Accordion multiple>
          <SuggestionsSection
            suggestions={result.suggestions}
            route={route}
            canMerge
          />
        </Accordion>
      ) : null}
    </div>
  );
};

/**
 * The count, and the note on how the page was made behind an info button.
 *
 * A popover rather than a paragraph: the method matters to a reader who
 * wonders where the summaries came from, and is in the way of everyone else.
 * It says what the model did and did not do, and when it last ran.
 */
const HeardToolbar = ({ snapshot }: { snapshot: ThemeAnalysisSnapshot }) => {
  const t = useTranslations();
  const locale = useLocale();
  const { total, analyzedCount, completedAt } = snapshot;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <p className="font-serif text-title">
        {t('{count, plural, one {# proposal} other {# proposals}}', {
          count: total,
        })}
      </p>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={t('How this was made')}
            />
          }
        >
          <LuInfo aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="start" className="sm:w-96">
          <PopoverHeader>
            <PopoverTitle className="text-title">
              {t('How we made sense of {count, number} proposals', {
                count: total,
              })}
            </PopoverTitle>
          </PopoverHeader>
          <p className="text-label">
            {t(
              'A model read every proposal, pulled out the points each one makes, and grouped those points into themes. It wrote the summaries on this page. Every quote was checked against the proposal it came from.',
            )}
          </p>
          <p className="text-label">
            {t(
              'It did not score, rank, or decide anything. The decisions in this process were made by people.',
            )}
          </p>
          <p className="text-label text-muted-foreground">
            {t(
              'Based on {analyzedCount, number} of {total, number} proposals',
              {
                analyzedCount,
                total,
              },
            )}
            {' · '}
            {t('Updated {date}', {
              date: formatDate(completedAt, locale, {
                month: 'short',
                day: 'numeric',
              }),
            })}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
};

/**
 * The page in four numbers, each counted from the snapshot.
 *
 * Proposals, themes, common ground and outliers: what a resident would ask
 * first. Claims and suggestions are the model's working, so they are not here.
 */
const HeardTiles = ({ snapshot }: { snapshot: ThemeAnalysisSnapshot }) => {
  const t = useTranslations();
  const { result, analyzedCount, total } = snapshot;

  const tiles = [
    {
      value: analyzedCount,
      label: t('Proposals read'),
      note: t('of {total, number} in this process', { total }),
    },
    {
      value: result.themes.length,
      label: t('Themes'),
      note: t('Groups of proposals asking for similar things'),
    },
    {
      value: result.commonGround.length,
      label: t('Points of common ground'),
      note: t('Things many proposals asked for'),
    },
    {
      value: result.outliers.length,
      label: t('Stood apart'),
      note: t('Proposals unlike the rest'),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map(({ value, label, note }) => (
        <Card key={label} size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="font-serif text-headline">{value}</span>
            <span className="text-base">{label}</span>
            <span className="text-sm text-muted-foreground">{note}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/**
 * What came up again and again, in people's own words.
 *
 * Each statement opens to the quotes behind it and the proposals that share
 * it. The bar is the statement's share of the proposals the analysis read, so
 * the rows compare at a glance; the count beside it is what the bar stands for.
 */
const CommonGroundCard = ({
  commonGround,
  claims,
  analyzedCount,
  route,
}: {
  commonGround: ThemeAnalysisResult['commonGround'];
  claims: ThemeAnalysisResult['claims'];
  analyzedCount: number;
  route: ThemeAnalysisRoute;
}) => {
  const t = useTranslations();

  if (commonGround.length === 0) {
    return null;
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <Header3>{t('Common ground')}</Header3>
        <CardDescription>
          {t(
            'Things that came up again and again. Each count is the number of proposals that asked for it.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion multiple>
          {/* Keyed by position: two statements can read the same. */}
          {commonGround.map((statement, position) => {
            const share = statementShare(statement, analyzedCount);
            const count = statement.proposals.length;
            const quotes = resolveStatementQuotes(statement, claims);

            return (
              <AccordionItem key={position} value={`statement-${position}`}>
                <AccordionTrigger
                  // Inside the card's own heading, so one level down.
                  header={<h4 />}
                  className="items-center gap-4 py-3 font-sans text-base font-normal hover:no-underline"
                >
                  <span dir="auto" className="min-w-0 flex-1">
                    {statement.statement}
                  </span>
                  <span className="flex shrink-0 flex-col items-end text-end">
                    <span className="text-label font-strong">
                      {t(
                        '{count, plural, one {# proposal} other {# proposals}}',
                        {
                          count,
                        },
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t('{share}% of {total, number}', {
                        share,
                        total: analyzedCount,
                      })}
                    </span>
                  </span>
                </AccordionTrigger>
                {/* Below the trigger, not inside it: a button holds text, not
                    a progress bar. */}
                <Progress
                  value={share}
                  aria-label={t('{share}% of {total, number}', {
                    share,
                    total: analyzedCount,
                  })}
                  className="mb-3 **:data-[slot=progress-track]:h-2"
                />
                <AccordionContent className="flex flex-col gap-4 [&_p:not(:last-child)]:mb-0">
                  {quotes.length > 0 ? (
                    <ul className="grid gap-3 sm:grid-cols-3">
                      {quotes.map(({ quote, proposal }) => (
                        <li key={proposal.id} className="flex">
                          <Card size="sm" className="w-full gap-3">
                            <CardContent className="flex h-full flex-col justify-between gap-3">
                              <p dir="auto" className="text-base">
                                {quote}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                <ProposalLink
                                  proposal={proposal}
                                  route={route}
                                  className="text-sm"
                                />
                              </p>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <p className="text-label text-muted-foreground">
                      {t('Proposals behind this')}
                    </p>
                    <ProposalRefs
                      proposals={statement.proposals}
                      route={route}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};

/**
 * The themes, largest first, each opening to its summary and its proposals.
 *
 * The bar is relative to the largest theme, not to the whole: the question
 * this card answers is which themes were big, and a bar against the total
 * would make every theme look small.
 */
const ThemesCard = ({
  themes,
  route,
}: {
  themes: ThemeAnalysisResult['themes'];
  route: ThemeAnalysisRoute;
}) => {
  const t = useTranslations();
  const rows = resolveThemeRows(themes);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <Header3>{t('Themes')}</Header3>
        <CardDescription>
          {t('What the proposals were about, largest first.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion multiple>
          {rows.map(({ theme, count, share }, position) => (
            <AccordionItem key={position} value={`theme-${position}`}>
              <AccordionTrigger
                header={<h4 />}
                className="items-center gap-3 py-3 font-sans text-label font-strong hover:no-underline"
              >
                <span dir="auto" className="min-w-0 flex-1">
                  {theme.title}
                </span>
                <span className="shrink-0 text-label font-normal text-muted-foreground">
                  {t('{count, plural, one {# proposal} other {# proposals}}', {
                    count,
                  })}
                </span>
              </AccordionTrigger>
              <Progress
                value={share}
                aria-label={t(
                  '{count, plural, one {# proposal} other {# proposals}}',
                  {
                    count,
                  },
                )}
                className="mb-3"
              />
              <AccordionContent className="flex flex-col gap-2 [&_p:not(:last-child)]:mb-0">
                <p dir="auto" className="text-label text-muted-foreground">
                  {theme.summary}
                </p>
                <ProposalRefs proposals={theme.proposals} route={route} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};

/**
 * The proposals unlike the rest, with the model's reason for each.
 *
 * A high-impact outlier asks for something nothing else does, which is the
 * one finding a resident might otherwise never see: it belongs to no theme and
 * no point of agreement. Those lead and carry a badge; the rest follow.
 */
const StoodApartCard = ({
  outliers,
  route,
}: {
  outliers: ThemeAnalysisResult['outliers'];
  route: ThemeAnalysisRoute;
}) => {
  const t = useTranslations();
  const rows = resolveOutlierRows(outliers);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <Header3>{t('Stood apart')}</Header3>
        <CardDescription>
          {t(
            'Proposals unlike the rest. The ones marked worth a look ask for something nothing else does.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ proposal, impact, reason }) => (
            <li key={proposal.id} className="flex">
              <Card size="sm" className="w-full">
                <CardContent className="flex flex-col items-start gap-2">
                  <p className="text-label font-strong">
                    <ProposalLink proposal={proposal} route={route} />
                  </p>
                  {impact === 'high-impact' ? (
                    <Badge variant="accent">{t('Worth a look')}</Badge>
                  ) : null}
                  <p dir="auto" className="text-label text-muted-foreground">
                    {reason}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

/**
 * Held while the first read lands. Shaped like the page — a count, four
 * tiles, then the two-and-one card row — so nothing jumps when it arrives.
 */
const HeardSkeleton = () => (
  <div className="flex flex-col gap-6">
    <Skeleton className="h-6 w-40" />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_unused, position) => (
        <Skeleton key={position} className="h-24" />
      ))}
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="h-80 lg:col-span-2" />
      <Skeleton className="h-80" />
    </div>
  </div>
);
