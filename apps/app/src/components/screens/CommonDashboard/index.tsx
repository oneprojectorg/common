'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type {
  DashboardMetric,
  DashboardMetrics,
  DashboardMoneyMetric,
  DashboardPeriod,
} from '@op/api/encoders';
import {
  DASHBOARD_PERIODS,
  MIN_SURVEY_RESPONSES,
  dashboardPeriodSchema,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Card, CardContent, CardHeader } from '@op/sense/Card';
import { Header1, Header2, Header3 } from '@op/sense/Header';
import { SegmentedProgress } from '@op/sense/SegmentedProgress';
import { Separator } from '@op/sense/Separator';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { useFormatter } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import {
  type ComponentProps,
  type ReactNode,
  Suspense,
  useSyncExternalStore,
} from 'react';

import { useTranslations } from '@/lib/i18n';

type MetricTextResolver = (
  metric: DashboardMetric,
  options?: {
    suppressedText?: string;
    numberFormat?: Intl.NumberFormatOptions;
  },
) => string;

// From `md`, each card's header and content share the row tracks of the grid,
// so the figures of neighbouring cards start at the same height.
const CARD_ROWS_CLASS_NAME = 'md:row-span-2 md:grid md:grid-rows-subgrid';

const WHOLE_USD_FORMAT: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
};

/** The read-only platform metrics page for everyone at OP. */
export const CommonDashboard = () => {
  const t = useTranslations('commonDashboard');

  return (
    <div className="flex flex-col gap-8">
      <Header1 className="text-headline">{t('pageTitle')}</Header1>
      <APIErrorBoundary fallbacks={{ default: () => <DashboardError /> }}>
        <Suspense fallback={<CommonDashboardSkeleton />}>
          <CommonDashboardSuspense />
        </Suspense>
      </APIErrorBoundary>
      <p className="text-sm text-muted-foreground">{t('countingRulesNote')}</p>
    </div>
  );
};

export const CommonDashboardSkeleton = () => (
  <div className="flex flex-col gap-8">
    <Skeleton className="h-20 w-full" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[...Array(3)].map((_, index) => (
        <Skeleton key={index} className="h-36 w-full" />
      ))}
    </div>
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-72 w-full" />
  </div>
);

const CommonDashboardSuspense = () => {
  // Each load computes the metrics live and carries every period, so a period
  // switch or a remount must not start a new computation.
  const [metrics] = trpc.platform.getDashboardMetrics.useSuspenseQuery(
    undefined,
    { staleTime: Infinity },
  );
  const [period, setPeriod] = useQueryState(
    'period',
    parseAsStringLiteral(DASHBOARD_PERIODS).withDefault('ytd'),
  );

  const handlePeriodValueChange = (value: unknown) => {
    const parsed = dashboardPeriodSchema.safeParse(value);
    if (parsed.success) {
      setPeriod(parsed.data);
    }
  };

  // Base UI mounts only the active panel, so each period renders its own sections.
  return (
    <Tabs
      className="gap-10"
      value={period}
      onValueChange={handlePeriodValueChange}
    >
      <PeriodHeader period={period} dataAsOf={metrics.dataAsOf} />
      {DASHBOARD_PERIODS.map((option) => (
        <TabsContent
          key={option}
          value={option}
          className="flex flex-col gap-10"
        >
          <GrowthSection metrics={metrics} period={option} />
          <PeopleSection metrics={metrics} period={option} />
          <MoneySection metrics={metrics} period={option} />
          <ProcessesSection metrics={metrics} period={option} />
          <FeedbackSection metrics={metrics} period={option} />
        </TabsContent>
      ))}
    </Tabs>
  );
};

const PeriodHeader = ({
  period,
  dataAsOf,
}: {
  period: DashboardPeriod;
  dataAsOf: string;
}) => {
  const t = useTranslations('commonDashboard');
  const format = useFormatter();
  const timeZone = useViewerTimeZone();
  const periodLabels = usePeriodLabels();

  return (
    <div className="flex flex-col gap-4">
      {/* On a wrapper: sense's `line` variant draws only the indicator. Below
          `sm` the four tabs share the full width and wrap their labels, so the
          list fits a phone screen. */}
      <div className="border-b">
        <TabsList
          variant="line"
          aria-label={t('periodLabel')}
          className="w-full group-data-horizontal/tabs:h-auto sm:w-fit"
        >
          {DASHBOARD_PERIODS.map((option) => (
            <TabsTrigger
              key={option}
              value={option}
              className="min-w-0 whitespace-normal max-sm:px-2 max-sm:text-sm"
            >
              {periodLabels[option]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p aria-live="polite">
          {t('scopeStatus', { period: periodLabels[period] })}
        </p>
        <p>
          {t.rich('dataAsOfStatus', {
            date: format.dateTime(new Date(dataAsOf), {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone,
            }),
            time: (chunks) => <time dateTime={dataAsOf}>{chunks}</time>,
          })}
        </p>
      </div>
    </div>
  );
};

const GrowthSection = ({
  metrics,
  period,
}: {
  metrics: DashboardMetrics;
  period: DashboardPeriod;
}) => {
  const t = useTranslations('commonDashboard');
  const resolveMetricText = useMetricText();
  const periodMetrics = metrics.periods[period];

  const tiles = [
    {
      label: t('newUsersLabel'),
      metric: periodMetrics.newUsers,
      total: metrics.totals.users,
    },
    {
      label: t('newOrganizationsLabel'),
      metric: periodMetrics.newOrganizations,
      total: metrics.totals.organizations,
    },
    {
      label: t('newProcessesLabel'),
      metric: periodMetrics.newProcesses,
      total: metrics.totals.processes,
      hint: t('launchDatesApproximateHint'),
    },
  ];

  return (
    <DashboardSection heading={t('growthHeading')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className={CARD_ROWS_CLASS_NAME}>
            <CardHeader className="justify-items-start gap-2">
              <Header3 className="font-sans text-base font-strong">
                {tile.label}
              </Header3>
              <PlaceholderBadge metric={tile.metric} />
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-1">
              <MetricFigure metric={tile.metric} />
              <p className="text-sm text-muted-foreground">
                {t('allTimeTotalHint', {
                  total: resolveMetricText(tile.total),
                })}
              </p>
              {tile.hint ? (
                <p className="text-sm text-muted-foreground">{tile.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardSection>
  );
};

const PeopleSection = ({
  metrics,
  period,
}: {
  metrics: DashboardMetrics;
  period: DashboardPeriod;
}) => {
  const t = useTranslations('commonDashboard');
  const resolveShareText = useShareText();
  const periodMetrics = metrics.periods[period];
  const activeUserShare = resolveShareText(periodMetrics.activeUserShare);
  const participatingUserShare = resolveShareText(
    periodMetrics.participatingUserShare,
  );

  return (
    <DashboardSection heading={t('peopleHeading')}>
      <Card>
        <CardContent className="grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          <StatColumn
            label={t('totalUsersLabel')}
            tag={t('toDateTag')}
            metric={metrics.totals.users}
            hint={t('registeredAccountsHint')}
          />
          <StatColumn
            label={t('activeUsersLabel')}
            tag={t('inPeriodTag')}
            metric={periodMetrics.activeUsers}
            hint={
              activeUserShare
                ? t('shareOfTotalUsersHint', { share: activeUserShare })
                : undefined
            }
          />
          <StatColumn
            label={t('participatingUsersLabel')}
            tag={t('inPeriodTag')}
            metric={periodMetrics.participatingUsers}
            hint={
              participatingUserShare
                ? t('shareOfActiveUsersHint', { share: participatingUserShare })
                : undefined
            }
          />
        </CardContent>
      </Card>
    </DashboardSection>
  );
};

const MoneySection = ({
  metrics,
  period,
}: {
  metrics: DashboardMetrics;
  period: DashboardPeriod;
}) => {
  const t = useTranslations('commonDashboard');

  return (
    <DashboardSection heading={t('moneyHeading')}>
      <Card>
        <CardContent className="grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
          <StatColumn
            label={t('totalMoneyMovedLabel')}
            tag={t('toDateTag')}
            metric={metrics.totals.moneyMoved}
            numberFormat={WHOLE_USD_FORMAT}
            hint={t('totalMoneyMovedHint')}
          />
          <StatColumn
            label={t('activeProcessBudgetsLabel')}
            tag={t('inPeriodTag')}
            metric={metrics.periods[period].activeProcessBudgets}
            numberFormat={WHOLE_USD_FORMAT}
          />
        </CardContent>
      </Card>
    </DashboardSection>
  );
};

const ProcessesSection = ({
  metrics,
  period,
}: {
  metrics: DashboardMetrics;
  period: DashboardPeriod;
}) => {
  const t = useTranslations('commonDashboard');
  const resolveMetricText = useMetricText();
  const periodMetrics = metrics.periods[period];

  const votingFunnelFigures = [
    { label: t('eligibleParticipantsLabel') },
    { label: t('acceptedLabel') },
    { label: t('votedLabel') },
    { label: t('turnoutLabel'), hint: t('turnoutHint') },
  ];
  const votingFunnelLegend = [
    { label: t('votedLegendLabel'), swatchClassName: 'bg-primary' },
    {
      label: t('acceptedVotingOpenLegendLabel'),
      swatchClassName: 'border border-primary bg-primary/30',
    },
    {
      label: t('acceptedVotingClosedLegendLabel'),
      swatchClassName: 'bg-muted-foreground/50',
    },
    {
      label: t('eligibleNotAcceptedLegendLabel'),
      swatchClassName: 'border border-border bg-background',
    },
  ];

  return (
    <DashboardSection heading={t('processesHeading')}>
      <Card>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
            <StatColumn
              label={t('completedProcessesLabel')}
              tag={t('inPeriodTag')}
              metric={periodMetrics.completedProcesses}
              hint={t('allTimeTotalHint', {
                total: resolveMetricText(metrics.totals.completedProcesses),
              })}
            />
            <StatColumn
              label={t('activeProcessesLabel')}
              tag={t('nowTag')}
              metric={metrics.activeProcesses}
              hint={
                periodMetrics.activeProcesses.status === 'available'
                  ? t('activeInPeriodHint', {
                      count: periodMetrics.activeProcesses.value,
                    })
                  : undefined
              }
            />
            <StatColumn
              label={t('submittedProposalsLabel')}
              tag={t('inPeriodTag')}
              metric={periodMetrics.submittedProposals}
              hint={
                metrics.draftProposals.status === 'available'
                  ? t('draftProposalsHint', {
                      count: metrics.draftProposals.value,
                    })
                  : undefined
              }
            />
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('votingFunnelHeading')}
            </Header3>
            <PlaceholderBadge metric={periodMetrics.participation} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:divide-x">
            {votingFunnelFigures.map(({ label, hint }) => (
              <div
                key={label}
                className="row-span-4 grid min-w-0 grid-rows-subgrid gap-y-1 md:px-6 md:first:ps-0 md:last:pe-0"
              >
                <p className="text-sm font-strong">{label}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <PlaceholderBadge metric={periodMetrics.participation} />
                </div>
                <MetricFigure metric={periodMetrics.participation} />
                {hint ? (
                  <p className="text-sm text-muted-foreground">{hint}</p>
                ) : null}
              </div>
            ))}
          </div>
          <SegmentedProgress
            segments={[]}
            aria-label={t('votingFunnelBarLabel')}
            getAriaValueText={() => t('placeholderDescription')}
          />
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {votingFunnelLegend.map(({ label, swatchClassName }) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn('size-3 shrink-0 rounded-sm', swatchClassName)}
                />
                {label}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>{t('participationCountingNote')}</p>
            <p>{t('turnoutNote')}</p>
          </div>
        </CardContent>
      </Card>
    </DashboardSection>
  );
};

const FeedbackSection = ({
  metrics,
  period,
}: {
  metrics: DashboardMetrics;
  period: DashboardPeriod;
}) => {
  const t = useTranslations('commonDashboard');
  const { netPromoterScore, easeOfUse } = metrics.periods[period];
  const notEnoughResponses = t('notEnoughResponsesStatus');

  const { responseCount, processCount } = netPromoterScore;
  const sampleHint =
    responseCount.status === 'available' && processCount.status === 'available'
      ? t('npsSampleHint', {
          responseCount: responseCount.value,
          processCount: processCount.value,
        })
      : null;

  return (
    <DashboardSection heading={t('feedbackHeading')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className={CARD_ROWS_CLASS_NAME}>
          <CardHeader className="justify-items-start gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('npsLabel')}
            </Header3>
            <PlaceholderBadge metric={netPromoterScore.score} />
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-1">
            <MetricFigure
              metric={netPromoterScore.score}
              suppressedText={notEnoughResponses}
            />
            {sampleHint ? (
              <p className="text-sm text-muted-foreground">{sampleHint}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card className={CARD_ROWS_CLASS_NAME}>
          <CardHeader className="justify-items-start gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('easeOfUseLabel')}
            </Header3>
            <PlaceholderBadge metric={easeOfUse.score} />
          </CardHeader>
          <CardContent className="min-w-0">
            <MetricFigure
              metric={easeOfUse.score}
              suppressedText={notEnoughResponses}
            />
          </CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('surveyMinimumNote', { minimum: MIN_SURVEY_RESPONSES })}
      </p>
    </DashboardSection>
  );
};

const DashboardSection = ({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-4">
    <Header2 className="font-sans text-sm font-strong tracking-wide text-muted-foreground uppercase">
      {heading}
    </Header2>
    {children}
  </section>
);

const StatColumn = ({
  label,
  tag,
  metric,
  numberFormat,
  hint,
}: {
  label: string;
  tag: string;
  metric: DashboardMetric | DashboardMoneyMetric;
  /** How to format an available value. Omit for a plain number. */
  numberFormat?: Intl.NumberFormatOptions;
  hint?: string;
}) => (
  <div className="flex min-w-0 flex-col gap-2 py-4 first:pt-0 last:pb-0 md:row-span-4 md:grid md:grid-rows-subgrid md:px-6 md:py-0 md:first:ps-0 md:last:pe-0">
    <p className="text-sm font-strong">{label}</p>
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="rounded-full font-normal">
        {tag}
      </Badge>
      <PlaceholderBadge metric={metric} />
      <CurrencyWarningBadge metric={metric} />
    </div>
    <MetricFigure metric={metric} numberFormat={numberFormat} />
    {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
  </div>
);

const MetricFigure = ({
  metric,
  suppressedText,
  numberFormat,
  className,
  ...props
}: Omit<ComponentProps<'p'>, 'children'> & {
  metric: DashboardMetric | DashboardMoneyMetric;
  /** Copy for a suppressed value. Omit for "Not enough data". */
  suppressedText?: string;
  /** How to format an available value. Omit for a plain number. */
  numberFormat?: Intl.NumberFormatOptions;
}) => {
  const t = useTranslations('commonDashboard');
  const format = useFormatter();
  const resolveMetricText = useMetricText();

  if (metric.status === 'unexpectedCurrency') {
    // The paragraph keeps a numeral's line height, so the columns stay level.
    // An inline block wraps its own lines at the body line height.
    return (
      <p
        className={cn('font-serif text-headline font-light', className)}
        {...props}
      >
        <span className="inline-block font-sans text-base font-normal">
          {t.rich('currencyWarningDescription', {
            amountCount: metric.amountCount,
            processCount: metric.processCount,
            currencies: format.list(metric.currencies),
            currency: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </span>
      </p>
    );
  }

  if (metric.status === 'unavailable') {
    // The dash keeps a real numeral's size; the placeholder badge names it.
    return (
      <p
        className={cn(
          'font-serif text-headline font-light text-muted-foreground',
          className,
        )}
        {...props}
      >
        <span aria-hidden>—</span>
      </p>
    );
  }

  const text = resolveMetricText(metric, { suppressedText, numberFormat });

  if (metric.status === 'suppressed') {
    // The paragraph keeps a numeral's line height, so the columns stay level.
    return (
      <p
        className={cn(
          'font-serif text-headline font-light text-muted-foreground',
          className,
        )}
        {...props}
      >
        <span className="font-sans text-base font-normal">{text}</span>
      </p>
    );
  }

  return (
    <p
      className={cn('font-serif text-headline font-light', className)}
      {...props}
    >
      {text}
    </p>
  );
};

/** Marks a figure that has no real data source yet. Renders nothing otherwise. */
const PlaceholderBadge = ({
  metric,
}: {
  metric: DashboardMetric | DashboardMoneyMetric;
}) => {
  const t = useTranslations('commonDashboard');

  if (metric.status !== 'unavailable') {
    return null;
  }

  return (
    <Badge variant="warning" className="font-normal">
      {t('placeholderBadgeLabel')}{' '}
      <span className="sr-only">{t('placeholderDescription')}</span>
    </Badge>
  );
};

/** Marks a money figure hidden for an unexpected currency. Renders nothing otherwise. */
const CurrencyWarningBadge = ({
  metric,
}: {
  metric: DashboardMetric | DashboardMoneyMetric;
}) => {
  const t = useTranslations('commonDashboard');

  if (metric.status !== 'unexpectedCurrency') {
    return null;
  }

  return (
    <Badge variant="warning" className="font-normal">
      {t('currencyWarningBadgeLabel')}
    </Badge>
  );
};

const DashboardError = () => {
  const t = useTranslations('commonDashboard');

  return (
    <Card>
      <CardContent>
        <p>{t('loadError')}</p>
      </CardContent>
    </Card>
  );
};

const useMetricText = (): MetricTextResolver => {
  const t = useTranslations('commonDashboard');
  const format = useFormatter();

  return (metric, options) => {
    switch (metric.status) {
      case 'available':
        return format.number(metric.value, options?.numberFormat);
      case 'suppressed':
        return options?.suppressedText ?? t('notEnoughDataStatus');
      case 'unavailable':
        return t('placeholderDescription');
    }
  };
};

/** Formats an available whole-number percentage. Returns nothing otherwise. */
const useShareText = (): ((metric: DashboardMetric) => string | undefined) => {
  const format = useFormatter();

  return (metric) =>
    metric.status === 'available'
      ? format.number(metric.value / 100, { style: 'percent' })
      : undefined;
};

const usePeriodLabels = (): Record<DashboardPeriod, string> => {
  const t = useTranslations('commonDashboard');

  return {
    month: t('monthPeriod'),
    quarter: t('quarterPeriod'),
    ytd: t('yearToDatePeriod'),
    allTime: t('allTimePeriod'),
  };
};

const subscribeToTimeZone = () => () => {};

// The server renders in UTC; the browser then switches to the viewer's zone
// without a hydration mismatch.
const useViewerTimeZone = (): string =>
  useSyncExternalStore(
    subscribeToTimeZone,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => 'UTC',
  );
