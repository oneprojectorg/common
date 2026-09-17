import type { ThemeAnalysisResult } from '@op/api/encoders';

/**
 * Below this there is nothing to compare, and a one-bar bar chart is a worse way
 * of showing one number than the number itself — the themes list beside it says
 * the same thing in words.
 */
export const MIN_THEMES_TO_CHART = 2;

/** The point a theme title is cut in the category axis. */
export const TITLE_MAX_CHARS = 26;

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
 * A theme title, cut to fit the category axis.
 *
 * Cut deliberately, with an ellipsis, rather than left to overflow its band or
 * be cropped mid-character by the plot's clip. The untruncated title is in the
 * tooltip and in the list below, which is where a reader goes for the full text.
 *
 * @param title - The theme's title.
 * @returns The title, shortened if it was too long.
 */
export const truncateThemeTitle = (title: string): string =>
  title.length > TITLE_MAX_CHARS
    ? `${title.slice(0, TITLE_MAX_CHARS - 1)}…`
    : title;

/**
 * The proposal count off a tooltip payload, when it is there.
 *
 * Recharts hands the row back untyped, so this checks rather than asserts: a
 * payload shape that stops matching should make the tooltip say less, not make
 * it render `undefined proposals`.
 *
 * @param payload - The row Recharts passed to the formatter.
 * @returns The count, or null when the payload does not carry one.
 */
export const proposalsInPayload = (payload: unknown): number | null =>
  typeof payload === 'object' &&
  payload !== null &&
  'proposals' in payload &&
  typeof payload.proposals === 'number'
    ? payload.proposals
    : null;
