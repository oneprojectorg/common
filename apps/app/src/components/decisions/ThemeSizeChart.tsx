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

import {
  proposalsInPayload,
  resolveThemeChartRows,
  truncateThemeTitle,
} from './themeChartRows';

/** Rendered height of one bar's row, and the band the value axis needs below. */
const ROW_HEIGHT = 28;
const AXIS_BAND = 28;

/** Width given to the theme titles in the category axis. */
const TITLE_WIDTH = 160;

/**
 * Room at the end of the plot for the value labels.
 *
 * They sit outside the bar end, and the default margin is a few pixels — enough
 * to clip a two-digit count on the longest bar, which is the one a reader looks
 * at first.
 */
const LABEL_GUTTER = 28;

/**
 * One series, so one colour for every bar.
 *
 * Colouring each bar darker-where-bigger would encode the bar length a second
 * time and spend the only free channel on something the chart already shows.
 * Themes have no intrinsic order either — the rows are sorted by the measure,
 * which is not the same thing as an ordinal category.
 */
const CHART_CONFIG = {
  claims: { label: 'Claims', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

/**
 * How much of the field each theme carries, as a bar per theme.
 *
 * Claims rather than proposals, because a claim is what a theme groups: two
 * themes can name the same three proposals while one of them holds eight of
 * their claims and the other holds two, and it is the claim count that says
 * which the process is mostly arguing about. The proposal count travels in the
 * tooltip, where it answers the follow-up question rather than competing with
 * the first — a second series would need a legend and double the marks to say
 * something the list below already lists.
 *
 * Horizontal bars because the category labels are phrases. Sorted by size
 * rather than kept in the model's importance order: the chart's whole job is
 * magnitude comparison, and a reader scanning for the biggest should not have to
 * hunt for it.
 *
 * Each bar carries its value as a label. That is not decoration — this palette's
 * one colour sits at 2.82:1 against the dialog's white surface, below the 3:1 a
 * fill needs to be read on its own, and a visible label is the relief. It also
 * means every number is readable without hovering anything.
 *
 * @param themes - The themes to chart, from a completed analysis.
 * @returns The chart, or null when there are too few themes to compare.
 */
export const ThemeSizeChart = ({
  themes,
}: {
  themes: ThemeAnalysisResult['themes'];
}) => {
  const t = useTranslations();
  const rows = resolveThemeChartRows(themes);

  if (!rows) {
    return null;
  }

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">
        {t('Claims per theme, largest first')}
      </figcaption>
      <ChartContainer
        config={CHART_CONFIG}
        // Computed from the row count rather than fixed, so the plot and the
        // value axis both fit: a container sized for the plot alone gives the
        // dialog a second, tiny scrollbar around the axis labels.
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
            // Half a claim is not a thing.
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
            // Cut with an ellipsis rather than left to overflow the band. The
            // untruncated title is in the tooltip, and in the list below.
            tickFormatter={truncateThemeTitle}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                // The label is the category value, which is the full title —
                // the untruncated one, which the axis tick cannot show.
                //
                // Both counts, because their ratio is the thing claims made
                // visible: many claims from few proposals is one participant
                // arguing at length, and the same count spread across many is
                // the process agreeing. A theme size alone does not separate
                // them.
                formatter={(value, _name, _item, _index, payload) => {
                  const proposals = proposalsInPayload(payload);

                  return proposals === null
                    ? t('{count} claims', { count: Number(value) })
                    : t('{claims} claims from {proposals} proposals', {
                        claims: Number(value),
                        proposals,
                      });
                }}
              />
            }
          />
          <Bar
            dataKey="claims"
            fill="var(--color-claims)"
            // Rounded at the data end, square against the baseline — a bar
            // rounded at both ends floats off its own axis.
            radius={[0, 4, 4, 0]}
            // Leaves a surface gap between adjacent bars instead of drawing a
            // border around each one to separate them.
            barSize={ROW_HEIGHT - 10}
          >
            <LabelList
              dataKey="claims"
              position="right"
              // A text token, not the series colour: the bar beside it already
              // carries the identity.
              fill="var(--color-muted-foreground)"
              className="text-label"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </figure>
  );
};
