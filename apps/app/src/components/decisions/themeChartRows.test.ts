import { describe, expect, it } from 'vitest';

import {
  TITLE_MAX_CHARS,
  proposalsInPayload,
  resolveThemeChartRows,
  truncateThemeTitle,
} from './themeChartRows';

const theme = ({
  title,
  claims,
  proposals = claims,
}: {
  title: string;
  claims: number;
  proposals?: number;
}) => ({
  title,
  summary: 'A summary.',
  claims: Array.from({ length: claims }, (_unused, position) => ({
    claim: `Claim ${position + 1}`,
    quote: 'Quoted.',
    proposal: {
      id: `proposal-${position + 1}`,
      title: `Proposal ${position + 1}`,
      profileId: null,
    },
  })),
  proposals: Array.from({ length: proposals }, (_unused, position) => ({
    id: `proposal-${position + 1}`,
    title: `Proposal ${position + 1}`,
    profileId: null,
  })),
});

describe('resolveThemeChartRows', () => {
  // The chart's job is magnitude comparison. Left in the model's importance
  // order, the longest bar can sit anywhere in the column and a reader has to
  // scan for it.
  it('orders the rows largest first', () => {
    const rows = resolveThemeChartRows([
      theme({ title: 'Small', claims: 1 }),
      theme({ title: 'Large', claims: 9 }),
      theme({ title: 'Middle', claims: 4 }),
    ]);

    expect(rows?.map(({ title }) => title)).toEqual([
      'Large',
      'Middle',
      'Small',
    ]);
  });

  it('counts the claims and the proposals behind each theme', () => {
    const rows = resolveThemeChartRows([
      theme({ title: 'Broad', claims: 6, proposals: 6 }),
      // Six claims from one proposal: one participant arguing at length, which
      // is a different finding from six proposals agreeing. The tooltip shows
      // both counts precisely so the two do not read the same.
      theme({ title: 'Loud', claims: 6, proposals: 1 }),
    ]);

    expect(rows).toEqual([
      { title: 'Broad', claims: 6, proposals: 6 },
      { title: 'Loud', claims: 6, proposals: 1 },
    ]);
  });

  // A one-bar bar chart is a worse way of showing one number than the number
  // itself, and with none there is nothing to draw at all.
  it.each([0, 1])('draws nothing for %i themes', (count) => {
    const themes = Array.from({ length: count }, (_unused, position) =>
      theme({ title: `Theme ${position + 1}`, claims: 3 }),
    );

    expect(resolveThemeChartRows(themes)).toBeNull();
  });

  // Defaulted to an empty list by the record schema, so an analysis stored
  // before claims existed still parses — and charts as a row of zeroes rather
  // than throwing.
  it('handles a theme stored before claims existed', () => {
    const rows = resolveThemeChartRows([
      { title: 'Older', summary: 'A summary.', claims: [], proposals: [] },
      { title: 'Also older', summary: 'A summary.', claims: [], proposals: [] },
    ]);

    expect(rows?.map(({ claims }) => claims)).toEqual([0, 0]);
  });
});

describe('truncateThemeTitle', () => {
  it('leaves a title that fits alone', () => {
    expect(truncateThemeTitle('Safer routes to school')).toBe(
      'Safer routes to school',
    );
  });

  // Cut deliberately, with an ellipsis, rather than cropped mid-character by
  // the plot's clip — which reads as a rendering fault rather than as "there is
  // more of this".
  it('cuts a long title to the axis width with an ellipsis', () => {
    const cut = truncateThemeTitle('x'.repeat(TITLE_MAX_CHARS + 20));

    expect(cut).toHaveLength(TITLE_MAX_CHARS);
    expect(cut.endsWith('…')).toBe(true);
  });
});

describe('proposalsInPayload', () => {
  it('reads the count off a row', () => {
    expect(proposalsInPayload({ title: 'T', claims: 3, proposals: 2 })).toBe(2);
  });

  // Recharts hands the row back untyped. A shape that stops matching should
  // make the tooltip say less, not render "undefined proposals".
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'proposals'],
    ['a row without the field', { title: 'T', claims: 3 }],
    ['a row whose field is not a number', { proposals: 'two' }],
  ])('answers null for %s', (_name, payload) => {
    expect(proposalsInPayload(payload)).toBeNull();
  });
});
