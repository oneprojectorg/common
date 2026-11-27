import { z } from 'zod';

import { DASHBOARD_PERIODS } from './constants';

export const dashboardPeriodSchema = z.enum(DASHBOARD_PERIODS);

/**
 * `suppressed`: the value exists but comes from too few people or responses to
 * report. `unavailable`: the platform does not record the data yet.
 */
const dashboardMetricStatusSchemas = [
  z.object({ status: z.literal('available'), value: z.number() }),
  z.object({ status: z.literal('suppressed') }),
  z.object({ status: z.literal('unavailable') }),
] as const;

const dashboardMetricSchema = z.discriminatedUnion(
  'status',
  dashboardMetricStatusSchemas,
);

/**
 * A money figure. `unexpectedCurrency`: some amounts are in a currency other
 * than the expected one, so the total is hidden until the data is corrected.
 */
const dashboardMoneyMetricSchema = z.discriminatedUnion('status', [
  ...dashboardMetricStatusSchemas,
  z.object({
    status: z.literal('unexpectedCurrency'),
    amountCount: z.number().int().positive(),
    processCount: z.number().int().positive(),
    currencies: z.array(z.string()),
  }),
]);

const unavailableSectionSchema = z.object({
  status: z.literal('unavailable'),
});

const surveyResultSchema = z.object({
  score: dashboardMetricSchema,
  responseCount: dashboardMetricSchema,
  processCount: dashboardMetricSchema,
});

const periodMetricsSchema = z.object({
  newUsers: dashboardMetricSchema,
  newOrganizations: dashboardMetricSchema,
  newProcesses: dashboardMetricSchema,
  activeUsers: dashboardMetricSchema,
  activeUserShare: dashboardMetricSchema,
  participatingUsers: dashboardMetricSchema,
  participatingUserShare: dashboardMetricSchema,
  activeProcessBudgets: dashboardMetricSchema,
  completedProcesses: dashboardMetricSchema,
  activeProcesses: dashboardMetricSchema,
  submittedProposals: dashboardMetricSchema,
  participation: unavailableSectionSchema,
  netPromoterScore: surveyResultSchema,
  easeOfUse: surveyResultSchema,
});

export const dashboardMetricsSchema = z.object({
  dataAsOf: z.iso.datetime(),
  totals: z.object({
    users: dashboardMetricSchema,
    organizations: dashboardMetricSchema,
    processes: dashboardMetricSchema,
    completedProcesses: dashboardMetricSchema,
    moneyMoved: dashboardMoneyMetricSchema,
  }),
  activeProcesses: dashboardMetricSchema,
  draftProposals: dashboardMetricSchema,
  periods: z.object({
    month: periodMetricsSchema,
    quarter: periodMetricsSchema,
    ytd: periodMetricsSchema,
    allTime: periodMetricsSchema,
  }),
});

export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;
export type DashboardMetric = z.infer<typeof dashboardMetricSchema>;
export type DashboardMoneyMetric = z.infer<typeof dashboardMoneyMetricSchema>;
export type DashboardSurveyResult = z.infer<typeof surveyResultSchema>;
export type DashboardPeriodMetrics = z.infer<typeof periodMetricsSchema>;
export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;
