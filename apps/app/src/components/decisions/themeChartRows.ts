import type { ThemeAnalysisResult } from '@op/api/encoders';

/**
 * Below this there is nothing worth drawing as a share of a whole.
 *
 * Three rather than two, now that this is a pie: two slices are a pair of
 * numbers wearing a circle, and a reader gets more from the two counts than from
 * half a disc each. The themes list beside it says the same thing in words.
 */
export const MIN_THEMES_TO_CHART = 3;

/**
 * How many themes get a slice of their own before the rest are folded together.
 *
 * Bounded by the palette, not by taste. A pie carries identity in colour alone,
 * so every slice needs a hue a reader can tell from its neighbours — and four is
 * how many of this system's ramps pass that check together. Adding a fifth put
 * green next to orange, which two readers in a hundred cannot separate at all.
 *
 * The tail folds into one neutral slice rather than being cycled back through
 * the same four hues, which would make two unrelated themes look like the same
 * one.
 */
export const MAX_NAMED_SLICES = 4;

/** One bar's worth of data. */
export interface ThemeChartRow {
  /** The full title. The axis truncates its own copy; the tooltip shows this. */
  title: string;
  claims: number;
  proposals: number;
}

/**
 * The rows a theme chart draws, or null when there is nothing worth drawing.
 *
 * Apart from the component because `apps/app` runs Vitest under
 * `environment: 'node'` with no DOM, so a test can reach the ordering and the
 * threshold here without rendering anything — the same reason
 * `themeAnalysisState` exists.
 *
 * @param themes - The themes from a completed analysis.
 * @returns The rows, largest first, or null when there are too few themes.
 */
export const resolveThemeChartRows = (
  themes: ThemeAnalysisResult['themes'],
): ThemeChartRow[] | null => {
  if (themes.length < MIN_THEMES_TO_CHART) {
    return null;
  }

  return (
    themes
      .map((theme) => ({
        title: theme.title,
        claims: theme.claims.length,
        proposals: theme.proposals.length,
      }))
      // Sorted by the measure rather than left in the model's importance order.
      // The chart's whole job is magnitude comparison, and a reader scanning for
      // the biggest theme should not have to hunt down the column for it.
      .sort((left, right) => right.claims - left.claims)
  );
};

/**
 * The hues a named slice can take, in assignment order.
 *
 * Steps chosen from this system's ramps and checked as a set rather than picked
 * by eye: the `--chart-1..5` tokens fail as adjacent categorical fills — the
 * yellow sits outside the readable lightness band at 1.8:1 against white, and
 * the teal is below the chroma floor, so it reads as grey beside a real grey.
 * These four pass every check with the worst adjacent pair at ΔE 9.8 under
 * tritanopia.
 *
 * The order is load-bearing. Green next to orange is the classic red-green
 * confusion — ΔE 1.5 under protanopia — so purple sits between them.
 */
const SLICE_COLORS = [
  'var(--color-blue-500)',
  'var(--color-orange-600)',
  'var(--color-purple-500)',
  'var(--color-green-500)',
] as const;

/**
 * The fill for the folded tail.
 *
 * Deliberately neutral, which is what makes it read as "everything else"
 * rather than as a fifth theme. Exempt from the chroma floor the named hues
 * must clear, for the same reason a diverging scale's midpoint is.
 */
const OTHER_COLOR = 'var(--color-gray-500)';

/** One slice of the themes pie. */
export interface ThemeSlice {
  /** The theme's title, or the folded tail's label. */
  label: string;
  claims: number;
  /** Proposals behind it, or null for the tail, where the number is a sum. */
  proposals: number | null;
  color: string;
  /** How many themes this slice stands for. One, except for the tail. */
  themes: number;
}

/**
 * The slices a themes pie draws, or null when there are too few themes.
 *
 * The largest {@link MAX_NAMED_SLICES} themes keep their own slice and hue; the
 * rest are summed into one neutral slice. Folding rather than cycling hues,
 * because a pie says identity in colour and nothing else: a fifth theme wearing
 * the first theme's blue is not a new category to a reader, it is the same one.
 *
 * A note on the whole the slices are parts of. It is the sum of the slices, not
 * the number of distinct claims — a claim can be grouped under two themes, and
 * when it is, it is counted in both. That is the honest denominator for "how
 * much of the discussion is this theme", and it is why the chart reports counts
 * rather than percentages.
 *
 * @param themes - The themes from a completed analysis.
 * @returns The slices, largest first with the tail last, or null.
 */
export const resolveThemeSlices = (
  themes: ThemeAnalysisResult['themes'],
): ThemeSlice[] | null => {
  const rows = resolveThemeChartRows(themes);

  if (!rows) {
    return null;
  }

  const named = rows.slice(0, MAX_NAMED_SLICES).map((row, position) => ({
    label: row.title,
    claims: row.claims,
    proposals: row.proposals,
    // By position in the sorted list. There is no filter here that could change
    // the set and repaint the survivors — an analysis is a fixed snapshot.
    color: SLICE_COLORS[position] ?? OTHER_COLOR,
    themes: 1,
  }));

  const tail = rows.slice(MAX_NAMED_SLICES);

  if (tail.length === 0) {
    return named;
  }

  return [
    ...named,
    {
      label: '',
      claims: tail.reduce((total, row) => total + row.claims, 0),
      // Summing proposals across the tail would double-count any proposal that
      // appears in two of its themes, and there is no way to tell from here.
      // Null, and the tooltip says nothing rather than something wrong.
      proposals: null,
      color: OTHER_COLOR,
      themes: tail.length,
    },
  ];
};
