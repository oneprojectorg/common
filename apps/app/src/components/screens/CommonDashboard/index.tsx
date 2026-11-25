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
  <div className="flex flex-col gap-10">
    <div className="flex flex-col gap-4">
      <Skeleton className="h-12 w-full sm:w-80" />
      <Skeleton className="h-10 w-64" />
    </div>
    <SkeletonCardGrid cardCount={3} />
    <SkeletonCardGrid cardCount={3} />
    <SkeletonCardGrid cardCount={1} />
    <SkeletonCardGrid cardCount={3} />
    <SkeletonCardGrid cardCount={1} />
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
          <MoneySection metrics={metrics} />
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

  return (
    <DashboardSection heading={t('growthHeading')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label={t('newUsersLabel')} metric={periodMetrics.newUsers}>
          <StatHint>
            {t('allTimeTotalHint', {
              total: resolveMetricText(metrics.totals.users),
            })}
          </StatHint>
        </StatCard>
        <StatCard
          label={t('newOrganizationsLabel')}
          metric={periodMetrics.newOrganizations}
        >
          <StatHint>
            {t('allTimeTotalHint', {
              total: resolveMetricText(metrics.totals.organizations),
            })}
          </StatHint>
        </StatCard>
        <StatCard
          label={t('newProcessesLabel')}
          metric={periodMetrics.newProcesses}
        >
          <StatHint>
            {t('allTimeTotalHint', {
              total: resolveMetricText(metrics.totals.processes),
            })}
          </StatHint>
          <StatHint>{t('launchDatesApproximateHint')}</StatHint>
        </StatCard>
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label={t('totalUsersLabel')}
          tag={t('toDateTag')}
          metric={metrics.totals.users}
        >
          <StatHint>{t('registeredAccountsHint')}</StatHint>
        </StatCard>
        <StatCard
          label={t('activeUsersLabel')}
          tag={t('inPeriodTag')}
          metric={periodMetrics.activeUsers}
        >
          {activeUserShare ? (
            <StatHint>
              {t('shareOfTotalUsersHint', { share: activeUserShare })}
            </StatHint>
          ) : null}
        </StatCard>
        <StatCard
          label={t('participatingUsersLabel')}
          tag={t('inPeriodTag')}
          metric={periodMetrics.participatingUsers}
        >
          {participatingUserShare ? (
            <StatHint>
              {t('shareOfActiveUsersHint', { share: participatingUserShare })}
            </StatHint>
          ) : null}
        </StatCard>
      </div>
    </DashboardSection>
  );
};

const MoneySection = ({ metrics }: { metrics: DashboardMetrics }) => {
  const t = useTranslations('commonDashboard');

  return (
    <DashboardSection heading={t('moneyHeading')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label={t('totalMoneyMovedLabel')}
          tag={t('toDateTag')}
          metric={metrics.totals.moneyMoved}
          numberFormat={WHOLE_USD_FORMAT}
        >
          <StatHint>{t('totalMoneyMovedHint')}</StatHint>
        </StatCard>
      </div>
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

  return (
    <DashboardSection heading={t('processesHeading')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label={t('completedProcessesLabel')}
          tag={t('inPeriodTag')}
          metric={periodMetrics.completedProcesses}
        >
          <StatHint>
            {t('allTimeTotalHint', {
              total: resolveMetricText(metrics.totals.completedProcesses),
            })}
          </StatHint>
        </StatCard>
        <StatCard
          label={t('activeProcessesLabel')}
          tag={t('nowTag')}
          metric={metrics.activeProcesses}
        >
          {periodMetrics.activeProcesses.status === 'available' ? (
            <StatHint>
              {t('activeInPeriodHint', {
                count: periodMetrics.activeProcesses.value,
              })}
            </StatHint>
          ) : null}
        </StatCard>
        <StatCard
          label={t('submittedProposalsLabel')}
          tag={t('inPeriodTag')}
          metric={periodMetrics.submittedProposals}
        >
          {metrics.draftProposals.status === 'available' ? (
            <StatHint>
              {t('draftProposalsHint', {
                count: metrics.draftProposals.value,
              })}
            </StatHint>
          ) : null}
        </StatCard>
      </div>
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
  const { netPromoterScore } = metrics.periods[period];

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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              suppressedText={t('notEnoughResponsesStatus')}
            />
            {sampleHint ? (
              <p className="text-sm text-muted-foreground">{sampleHint}</p>
            ) : null}
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

const StatCard = ({
  label,
  tag,
  metric,
  numberFormat,
  children,
}: {
  label: string;
  /** Names the time scope of the figure. Omit for no scope badge. */
  tag?: string;
  metric: DashboardMetric | DashboardMoneyMetric;
  /** How to format an available value. Omit for a plain number. */
  numberFormat?: Intl.NumberFormatOptions;
  /** Hint lines below the figure. */
  children?: ReactNode;
}) => (
  <Card className={CARD_ROWS_CLASS_NAME}>
    <CardHeader className="justify-items-start gap-2">
      <Header3 className="font-sans text-base font-strong">{label}</Header3>
      {/* `empty:hidden` keeps the header gap out when no badge renders. */}
      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        {tag ? (
          <Badge variant="outline" className="rounded-full font-normal">
            {tag}
          </Badge>
        ) : null}
        <PlaceholderBadge metric={metric} />
        <CurrencyWarningBadge metric={metric} />
      </div>
    </CardHeader>
    <CardContent className="flex min-w-0 flex-col gap-1">
      <MetricFigure metric={metric} numberFormat={numberFormat} />
      {children}
    </CardContent>
  </Card>
);

const StatHint = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

const SkeletonCardGrid = ({ cardCount }: { cardCount: number }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    {[...Array(cardCount)].map((_, index) => (
      <Skeleton key={index} className="h-36 w-full" />
    ))}
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
