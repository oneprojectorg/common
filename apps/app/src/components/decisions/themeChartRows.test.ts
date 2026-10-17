import { describe, expect, it } from 'vitest';

import {
  MAX_NAMED_SLICES,
  resolveThemeChartRows,
  resolveThemeSlices,
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
      theme({ title: 'Third', claims: 1 }),
      theme({ title: 'Broad', claims: 6, proposals: 6 }),
      // Six claims from one proposal: one participant arguing at length, which
      // is a different finding from six proposals agreeing. The tooltip shows
      // both counts precisely so the two do not read the same.
      theme({ title: 'Loud', claims: 6, proposals: 1 }),
    ]);

    expect(rows?.slice(0, 2)).toEqual([
      { title: 'Broad', claims: 6, proposals: 6 },
      { title: 'Loud', claims: 6, proposals: 1 },
    ]);
  });

  // Two slices are a pair of numbers wearing a circle: a reader gets more from
  // the counts than from half a disc each, and with fewer there is nothing to
  // draw at all.
  it.each([0, 1, 2])('draws nothing for %i themes', (count) => {
    const themes = Array.from({ length: count }, (_unused, position) =>
      theme({ title: `Theme ${position + 1}`, claims: 3 }),
    );

    expect(resolveThemeChartRows(themes)).toBeNull();
  });

  // Defaulted to an empty list by the record schema, so an analysis stored
  // before claims existed still parses — and charts as a row of zeroes rather
  // than throwing.
  it('handles a theme stored before claims existed', () => {
    const older = (title: string) => ({
      title,
      summary: 'A summary.',
      claims: [],
      proposals: [],
    });

    const rows = resolveThemeChartRows([
      older('Older'),
      older('Also older'),
      older('Older still'),
    ]);

    expect(rows?.map(({ claims }) => claims)).toEqual([0, 0, 0]);
  });
});

describe('resolveThemeSlices', () => {
  const themes = (counts: number[]) =>
    counts.map((claims, position) =>
      theme({ title: `Theme ${position + 1}`, claims }),
    );

  it('gives each theme its own slice and hue while they fit', () => {
    const slices = resolveThemeSlices(themes([5, 4, 3]));

    expect(slices?.map(({ label, claims }) => [label, claims])).toEqual([
      ['Theme 1', 5],
      ['Theme 2', 4],
      ['Theme 3', 3],
    ]);
    // Identity in a pie is carried by colour alone, so two slices sharing one
    // would read as the same theme.
    expect(new Set(slices?.map(({ color }) => color)).size).toBe(3);
  });

  // The palette is what bounds this. Cycling back through the same four hues
  // would give a fifth theme the first one's blue, which a reader takes as the
  // first one rather than as something new.
  it('folds everything past the palette into one neutral slice', () => {
    const slices = resolveThemeSlices(themes([9, 8, 7, 6, 3, 2, 1]));

    expect(slices).toHaveLength(MAX_NAMED_SLICES + 1);

    const tail = slices?.at(-1);

    // Summed, and standing for three themes — which is what lets the component
    // label it without knowing how the fold was done.
    expect(tail?.claims).toBe(6);
    expect(tail?.themes).toBe(3);
    // No title of its own: the component supplies a translated one.
    expect(tail?.label).toBe('');
  });

  // Summing proposals across the folded themes would double-count any proposal
  // appearing in two of them, and nothing here can tell. Null, so the tooltip
  // says nothing rather than something wrong.
  it('reports no proposal count for the folded slice', () => {
    const slices = resolveThemeSlices(themes([9, 8, 7, 6, 3]));

    expect(slices?.at(-1)?.proposals).toBeNull();
    expect(slices?.[0]?.proposals).not.toBeNull();
  });

  // The tail slice exists only when something was folded into it. Exactly four
  // themes is four slices, not four and an empty fifth.
  it('adds no tail slice when every theme fits', () => {
    const slices = resolveThemeSlices(themes([4, 3, 2, 1]));

    expect(slices).toHaveLength(MAX_NAMED_SLICES);
    expect(slices?.every(({ themes: count }) => count === 1)).toBe(true);
  });

  it('draws nothing below the minimum', () => {
    expect(resolveThemeSlices(themes([5, 4]))).toBeNull();
  });
});
