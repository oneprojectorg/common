import { describe, expect, it, vi } from 'vitest';

// `@op/db/client` pulls in `server-only`, which Vitest can't load. Only the
// query-builder helpers need to exist for the module under test to import.
vi.mock('@op/db/client', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
}));

import { detectCategoryRenames } from './reconcileCategoryRename';
import type { ProposalCategory } from './schemas/types';

const category = (id: string, label: string): ProposalCategory => ({
  id,
  label,
  description: '',
});

describe('detectCategoryRenames', () => {
  it('detects a rename when the config id is kept and the label changes', () => {
    expect(
      detectCategoryRenames(
        [category('cat-1', 'Parks')],
        [category('cat-1', 'Parks and Recreation')],
      ),
    ).toEqual([{ oldLabel: 'Parks', newLabel: 'Parks and Recreation' }]);
  });

  it('detects nothing when the label is unchanged', () => {
    expect(
      detectCategoryRenames(
        [category('cat-1', 'Parks')],
        [category('cat-1', 'Parks')],
      ),
    ).toEqual([]);
  });

  it('detects nothing for a delete plus add, which changes the id', () => {
    expect(
      detectCategoryRenames(
        [category('cat-1', 'Parks')],
        [category('cat-2', 'Parks and Recreation')],
      ),
    ).toEqual([]);
  });

  it('detects nothing when the categories are only reordered', () => {
    expect(
      detectCategoryRenames(
        [category('cat-1', 'Parks'), category('cat-2', 'Transit')],
        [category('cat-2', 'Transit'), category('cat-1', 'Parks')],
      ),
    ).toEqual([]);
  });

  it('detects nothing when there were no previous categories', () => {
    expect(detectCategoryRenames([], [category('cat-1', 'Parks')])).toEqual([]);
  });

  it('detects both renames when two categories change in one save', () => {
    expect(
      detectCategoryRenames(
        [category('cat-1', 'Parks'), category('cat-2', 'Transit')],
        [
          category('cat-1', 'Parks and Recreation'),
          category('cat-2', 'Public Transit'),
        ],
      ),
    ).toEqual([
      { oldLabel: 'Parks', newLabel: 'Parks and Recreation' },
      { oldLabel: 'Transit', newLabel: 'Public Transit' },
    ]);
  });

  it('detects nothing when another category still carries the old label', () => {
    // Two categories share a label, so they share one taxonomy term. Renaming
    // one leaves the term in use by the other: the rows can't be attributed.
    expect(
      detectCategoryRenames(
        [category('cat-1', 'Parks'), category('cat-2', 'Parks')],
        [category('cat-1', 'Parks and Recreation'), category('cat-2', 'Parks')],
      ),
    ).toEqual([]);
  });

  it('detects nothing when the retained duplicate differs only in case', () => {
    expect(
      detectCategoryRenames(
        [category('cat-1', 'Parks'), category('cat-2', 'parks')],
        [category('cat-1', 'Parks and Recreation'), category('cat-2', 'parks')],
      ),
    ).toEqual([]);
  });

  it('still detects a swap, where each old label belongs to a rename source', () => {
    expect(
      detectCategoryRenames(
        [category('cat-1', 'Parks'), category('cat-2', 'Transit')],
        [category('cat-1', 'Transit'), category('cat-2', 'Parks')],
      ),
    ).toEqual([
      { oldLabel: 'Parks', newLabel: 'Transit' },
      { oldLabel: 'Transit', newLabel: 'Parks' },
    ]);
  });
});
