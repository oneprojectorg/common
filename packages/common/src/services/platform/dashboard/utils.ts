import {
  MAX_SUPPRESSED_PEOPLE_COUNT,
  MIN_SURVEY_RESPONSES,
  MONTH_PERIOD_DAYS,
  QUARTER_PERIOD_DAYS,
} from './constants';
import type {
  DashboardMetric,
  DashboardMetrics,
  DashboardMoneyMetric,
  DashboardPeriod,
  DashboardPeriodMetrics,
  DashboardSurveyResult,
} from './schemas';

/** A period runs from `start` to the snapshot's `dataAsOf`, both in UTC. */
export type PeriodWindow = { start: Date };

export type PeriodRecord<T> = Record<DashboardPeriod, T>;

/** A money total, and the amounts in it that are not in the expected currency. */
export type MoneyTotal = {
  amount: number;
  unexpectedAmountCount: number;
  unexpectedProcessCount: number;
  unexpectedCurrencies: string[];
};

export type SurveyCounts = {
  responseCount: number;
  promoterCount: number;
  detractorCount: number;
  processCount: number;
};

/** The raw counts each dashboard section query returns. */
type SectionCounts = {
  people: {
    totalUsers: number;
    newUsers: PeriodRecord<number>;
    activeUsers: PeriodRecord<number>;
    participatingUsers: PeriodRecord<number>;
  };
  growth: {
    totalOrganizations: number;
    newOrganizations: PeriodRecord<number>;
  };
  processes: {
    totalProcesses: number;
    totalCompletedProcesses: number;
    activeProcesses: number;
    newProcesses: PeriodRecord<number>;
    completedProcesses: PeriodRecord<number>;
    activeProcessesInPeriod: PeriodRecord<number>;
  };
  proposals: {
    submittedProposals: PeriodRecord<number>;
    draftProposals: number;
  };
  money: {
    moneyMoved: MoneyTotal;
    activeProcessBudgets: PeriodRecord<number>;
  };
  feedback: { netPromoterScore: PeriodRecord<SurveyCounts> };
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const UNAVAILABLE_METRIC: DashboardMetric = { status: 'unavailable' };

const UNAVAILABLE_SURVEY_RESULT: DashboardSurveyResult = {
  score: UNAVAILABLE_METRIC,
  responseCount: UNAVAILABLE_METRIC,
  processCount: UNAVAILABLE_METRIC,
};

const resolvePeriodRecord = <T>(
  resolve: (period: DashboardPeriod) => T,
): PeriodRecord<T> => ({
  month: resolve('month'),
  quarter: resolve('quarter'),
  ytd: resolve('ytd'),
  allTime: resolve('allTime'),
});

/** Each period's value from the query row for that period, or `missing`. */
export const resolvePeriodRows = <Row extends { period: string }, T>({
  rows,
  resolve,
  missing,
}: {
  rows: readonly Row[];
  resolve: (row: Row) => T;
  missing: T;
}): PeriodRecord<T> => {
  const byPeriod = new Map(rows.map((row) => [row.period, row]));

  return resolvePeriodRecord((period) => {
    const row = byPeriod.get(period);
    return row ? resolve(row) : missing;
  });
};

export const resolvePeriodWindows = (
  dataAsOf: Date,
): PeriodRecord<PeriodWindow> => {
  const daysBefore = (days: number) =>
    new Date(dataAsOf.getTime() - days * MILLISECONDS_PER_DAY);

  return {
    month: { start: daysBefore(MONTH_PERIOD_DAYS) },
    quarter: { start: daysBefore(QUARTER_PERIOD_DAYS) },
    ytd: { start: new Date(Date.UTC(dataAsOf.getUTCFullYear(), 0, 1)) },
    // No lower bound, so "new" in all time equals the to-date total.
    allTime: { start: new Date(0) },
  };
};

const resolveCountMetric = (count: number): DashboardMetric => ({
  status: 'available',
  value: count,
});

const resolvePeopleCountMetric = (count: number): DashboardMetric =>
  count <= MAX_SUPPRESSED_PEOPLE_COUNT
    ? { status: 'suppressed' }
    : { status: 'available', value: count };

const resolveMoneyMetric = ({
  amount,
  unexpectedAmountCount,
  unexpectedProcessCount,
  unexpectedCurrencies,
}: MoneyTotal): DashboardMoneyMetric =>
  unexpectedAmountCount > 0
    ? {
        status: 'unexpectedCurrency',
        amountCount: unexpectedAmountCount,
        processCount: unexpectedProcessCount,
        currencies: unexpectedCurrencies,
      }
    : { status: 'available', value: amount };

/** `part` as a whole-number percentage of `whole`. */
const resolveShareMetric = ({
  part,
  whole,
}: {
  part: DashboardMetric;
  whole: DashboardMetric;
}): DashboardMetric => {
  if (part.status === 'unavailable' || whole.status === 'unavailable') {
    return UNAVAILABLE_METRIC;
  }

  // A people count of 0 is always suppressed, so an available `whole` is not 0.
  if (part.status === 'suppressed' || whole.status === 'suppressed') {
    return { status: 'suppressed' };
  }

  return {
    status: 'available',
    value: Math.round((part.value / whole.value) * 100),
  };
};

/** % of promoters (9–10) minus % of detractors (0–6), as an integer. */
const resolveNetPromoterScore = ({
  responseCount,
  promoterCount,
  detractorCount,
}: Omit<SurveyCounts, 'processCount'>): DashboardMetric => {
  if (responseCount < MIN_SURVEY_RESPONSES) {
    return { status: 'suppressed' };
  }

  const score = ((promoterCount - detractorCount) / responseCount) * 100;

  // `|| 0` turns a rounded -0 into 0.
  return { status: 'available', value: Math.round(score) || 0 };
};

const resolveNetPromoterSurveyResult = (
  counts: SurveyCounts,
): DashboardSurveyResult => {
  const responseCount = resolvePeopleCountMetric(counts.responseCount);

  // Each counted process has at least one response, so its count would reveal
  // a suppressed response count.
  return {
    score: resolveNetPromoterScore(counts),
    responseCount,
    processCount:
      responseCount.status === 'suppressed'
        ? responseCount
        : resolveCountMetric(counts.processCount),
  };
};

/** Applies the reporting rules to the raw counts of each dashboard section. */
export const resolveDashboardMetrics = ({
  dataAsOf,
  people,
  growth,
  processes,
  proposals,
  money,
  feedback,
}: SectionCounts & { dataAsOf: Date }): DashboardMetrics => {
  const totalUsers = resolvePeopleCountMetric(people.totalUsers);

  return {
    dataAsOf: dataAsOf.toISOString(),
    totals: {
      users: totalUsers,
      organizations: resolveCountMetric(growth.totalOrganizations),
      processes: resolveCountMetric(processes.totalProcesses),
      completedProcesses: resolveCountMetric(processes.totalCompletedProcesses),
      moneyMoved: resolveMoneyMetric(money.moneyMoved),
    },
    activeProcesses: resolveCountMetric(processes.activeProcesses),
    draftProposals: resolveCountMetric(proposals.draftProposals),
    periods: resolvePeriodRecord((period) =>
      resolvePeriodMetrics({
        period,
        totalUsers,
        people,
        growth,
        processes,
        proposals,
        money,
        feedback,
      }),
    ),
  };
};

const resolvePeriodMetrics = ({
  period,
  totalUsers,
  people,
  growth,
  processes,
  proposals,
  money,
  feedback,
}: SectionCounts & {
  period: DashboardPeriod;
  totalUsers: DashboardMetric;
}): DashboardPeriodMetrics => {
  const activeUsers = resolvePeopleCountMetric(people.activeUsers[period]);
  const participatingUsers = resolvePeopleCountMetric(
    people.participatingUsers[period],
  );

  return {
    newUsers: resolvePeopleCountMetric(people.newUsers[period]),
    newOrganizations: resolveCountMetric(growth.newOrganizations[period]),
    newProcesses: resolveCountMetric(processes.newProcesses[period]),
    activeUsers,
    activeUserShare: resolveShareMetric({
      part: activeUsers,
      whole: totalUsers,
    }),
    participatingUsers,
    participatingUserShare: resolveShareMetric({
      part: participatingUsers,
      whole: activeUsers,
    }),
    activeProcessBudgets: {
      status: 'available',
      value: money.activeProcessBudgets[period],
    },
    completedProcesses: resolveCountMetric(
      processes.completedProcesses[period],
    ),
    activeProcesses: resolveCountMetric(
      processes.activeProcessesInPeriod[period],
    ),
    submittedProposals: resolveCountMetric(
      proposals.submittedProposals[period],
    ),
    participation: { status: 'unavailable' },
    netPromoterScore: resolveNetPromoterSurveyResult(
      feedback.netPromoterScore[period],
    ),
    easeOfUse: UNAVAILABLE_SURVEY_RESULT,
  };
};
