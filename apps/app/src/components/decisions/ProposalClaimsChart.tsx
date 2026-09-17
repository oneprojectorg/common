'use client';

import type { ThemeAnalysisResult } from '@op/api/encoders';
import type { ChartConfig } from '@op/sense/Chart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  LabelList,
  XAxis,
  YAxis,
} from '@op/sense/Chart';

import { useTranslations } from '@/lib/i18n';

import { resolveProposalClaimCounts } from './themeChartRows';

/** Rendered height of one bar's row, and the band the value axis needs below. */
const ROW_HEIGHT = 28;
const AXIS_BAND = 28;

/** Width given to the proposal titles, and the point their text is cut. */
const TITLE_WIDTH = 160;
const TITLE_MAX_CHARS = 26;

/** Room at the end of the plot for the value labels. */
const LABEL_GUTTER = 28;

/**
 * Two proposals is a pair of numbers; the comparison starts being worth drawing
 * at three.
 */
const MIN_CONTRIBUTORS_TO_CHART = 3;

/**
 * One series, so one colour for every bar.
 *
 * Length already carries the magnitude. Shading each bar darker-where-bigger
 * would encode it twice and spend the only free channel saying what the chart
 * has already said.
 */
const CHART_CONFIG = {
  claims: { label: 'Claims', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

/**
 * How many claims each proposal contributed.
 *
 * The companion to the themes ring, and a different question: the ring says
 * what the process is about, this says who is doing the arguing. A corpus where
 * one proposal supplies a third of the claims reads differently from one where
 * twenty contributed evenly, and nothing else in the analysis shows that.
 *
 * Bars rather than a second ring. This is a magnitude comparison across a dozen
 * proposals with sentence-length titles, which is what bars are for — and a
 * second pie would be a second set of hues competing with the first for the same
 * reader.
 *
 * Each bar carries its value, for the reason the ring's legend does: the chart
 * token sits below the 3:1 a fill needs to be read on its own, so a visible
 * label is the relief rather than a flourish.
 *
 * @param claims - Every claim the analysis extracted.
 * @returns The chart, or null when too few proposals contributed to compare.
 */
export const ProposalClaimsChart = ({
  claims,
}: {
  claims: ThemeAnalysisResult['claims'];
}) => {
  const t = useTranslations();
  const rows = resolveProposalClaimCounts(claims);

  if (rows.length < MIN_CONTRIBUTORS_TO_CHART) {
    return null;
  }

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-label font-strong">
        {t('Claims per proposal')}
      </figcaption>
      <ChartContainer
        config={CHART_CONFIG}
        style={{ height: rows.length * ROW_HEIGHT + AXIS_BAND }}
        className="w-full"
      >
        <BarChart
          accessibilityLayer
          data={rows}
          layout="vertical"
          margin={{ right: LABEL_GUTTER }}
        >
          {/* Along the value axis only, and solid: a dashed grid reads as a
              threshold when it is just a grid. */}
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-muted-foreground)' }}
          />
          <YAxis
            type="category"
            dataKey="title"
            width={TITLE_WIDTH}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-muted-foreground)' }}
            tickFormatter={truncateTitle}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  t('{count} claims', { count: Number(value) })
                }
              />
            }
          />
          <Bar
            dataKey="claims"
            fill="var(--color-claims)"
            radius={[0, 4, 4, 0]}
            barSize={ROW_HEIGHT - 10}
          >
            <LabelList
              dataKey="claims"
              position="right"
              fill="var(--color-muted-foreground)"
              className="text-label"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </figure>
  );
};

/**
 * A proposal title, cut to fit the category axis.
 *
 * Cut deliberately, with an ellipsis, rather than left to overflow its band or
 * be cropped mid-character by the plot's clip. The untruncated title is in the
 * tooltip.
 */
const truncateTitle = (title: string): string =>
  title.length > TITLE_MAX_CHARS
    ? `${title.slice(0, TITLE_MAX_CHARS - 1)}…`
    : title;
