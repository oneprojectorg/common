'use client';

import type { ThemeAnalysisResult } from '@op/api/encoders';
import type { ChartConfig } from '@op/sense/Chart';
import {
  Cell,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
} from '@op/sense/Chart';

import { useTranslations } from '@/lib/i18n';

import type { ThemeSlice } from './themeChartRows';
import { resolveThemeSlices } from './themeChartRows';

/** Outer and inner radius of the ring, in pixels. */
const OUTER_RADIUS = 84;
const INNER_RADIUS = 52;

/** Height of the plot. Twice the outer radius, plus room to breathe. */
const PLOT_HEIGHT = OUTER_RADIUS * 2 + 16;

/**
 * Empty, and deliberately so.
 *
 * `ChartContainer` requires a config, and it is how a chart with fixed series
 * declares their labels and colours. A pie's categories are the themes, which
 * are whatever the analysis found, so there is nothing static to declare — each
 * slice carries its own fill and the legend below is built from the same data.
 */
const CHART_CONFIG = {} satisfies ChartConfig;

/**
 * How much of the discussion each theme carries, as a ring.
 *
 * Claims rather than proposals, because a claim is what a theme groups: two
 * themes can name the same three proposals while one holds eight of their
 * claims and the other two, and it is the claim count that says which the
 * process is mostly arguing about.
 *
 * The largest four themes get a slice each and the rest fold into one neutral
 * slice. That bound comes from the palette rather than from taste — see
 * `themeChartRows` — and folding beats cycling hues, because a pie carries
 * identity in colour alone and a fifth theme wearing the first one's blue reads
 * as the first one.
 *
 * Counts, not percentages. The slices are shares of their own sum, and a claim
 * grouped under two themes is counted in both, so a percentage would be a share
 * of placements while reading as a share of claims.
 *
 * The legend is a list rather than the chart library's: it carries each theme's
 * count beside its swatch, which makes it the readable equivalent of the ring
 * for anyone who cannot separate the colours — and every number in the chart is
 * then legible without hovering anything.
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
  const slices = resolveThemeSlices(themes);

  if (!slices) {
    return null;
  }

  const labelled = slices.map((slice) => ({
    ...slice,
    // The folded tail has no title of its own. Named here rather than in the
    // derivation, which is pure and has no translator.
    label: slice.label || t('{count} smaller themes', { count: slice.themes }),
  }));

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">
        {t('Claims per theme, largest first')}
      </figcaption>
      <ChartContainer
        config={CHART_CONFIG}
        style={{ height: PLOT_HEIGHT }}
        className="w-full"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(_value, _name, item) => (
                  <SliceTooltip slice={sliceOf(item)} />
                )}
              />
            }
          />
          <Pie
            data={labelled}
            dataKey="claims"
            nameKey="label"
            outerRadius={OUTER_RADIUS}
            // A ring rather than a disc. The centre of a pie is where slice
            // angles are hardest to compare, so it carries no information and
            // this gives it back as whitespace.
            innerRadius={INNER_RADIUS}
          >
            {labelled.map((slice) => (
              // A surface-coloured stroke, not a border: it separates adjacent
              // fills by leaving the background visible between them, rather
              // than drawing a line around each one.
              <Cell
                key={slice.label}
                fill={slice.color}
                stroke="var(--color-background)"
                strokeWidth={2}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ThemeLegend slices={labelled} />
    </figure>
  );
};

/**
 * The legend, which is also the chart's readable twin.
 *
 * Every slice with its swatch and its count, so the ring never has to be the
 * only way to read a number — the requirement a pie creates by carrying
 * identity in colour alone.
 *
 * Text wears text tokens; only the swatch wears the series colour.
 */
const ThemeLegend = ({ slices }: { slices: ThemeSlice[] }) => (
  <ul className="flex flex-col gap-1">
    {slices.map((slice) => (
      <li
        key={slice.label}
        className="flex items-center gap-2 text-label text-muted-foreground"
      >
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: slice.color }}
        />
        <span dir="auto" className="truncate">
          {slice.label}
        </span>
        <span className="ms-auto shrink-0 tabular-nums">{slice.claims}</span>
      </li>
    ))}
  </ul>
);

/** One slice's line in the tooltip. */
const SliceTooltip = ({ slice }: { slice: ThemeSlice | null }) => {
  const t = useTranslations();

  if (!slice) {
    return null;
  }

  return (
    <span>
      <span className="font-strong">{slice.label}</span>
      {' — '}
      {slice.proposals === null
        ? t('{count} claims', { count: slice.claims })
        : t('{claims} claims from {proposals} proposals', {
            claims: slice.claims,
            proposals: slice.proposals,
          })}
    </span>
  );
};

/**
 * The slice behind a tooltip item, when it is there.
 *
 * Recharts hands the datum back untyped, so this checks rather than asserts: a
 * payload shape that stops matching should make the tooltip say nothing, not
 * render `undefined`.
 */
const sliceOf = (item: unknown): ThemeSlice | null => {
  if (typeof item !== 'object' || item === null || !('payload' in item)) {
    return null;
  }

  const { payload } = item;

  return typeof payload === 'object' &&
    payload !== null &&
    'label' in payload &&
    typeof payload.label === 'string' &&
    'claims' in payload &&
    typeof payload.claims === 'number' &&
    'color' in payload &&
    typeof payload.color === 'string' &&
    'themes' in payload &&
    typeof payload.themes === 'number'
    ? {
        label: payload.label,
        claims: payload.claims,
        proposals:
          'proposals' in payload && typeof payload.proposals === 'number'
            ? payload.proposals
            : null,
        color: payload.color,
        themes: payload.themes,
      }
    : null;
};
