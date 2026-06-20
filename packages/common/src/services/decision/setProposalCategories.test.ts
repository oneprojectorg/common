import { beforeEach, describe, expect, it, vi } from 'vitest';

// `@op/db/client` pulls in `server-only`, which Vitest can't load. The fake `tx`
// below stands in for the real DbClient; we only need the query-builder helpers
// (eq/and/inArray) to exist so the source's `where` clauses construct cleanly.
vi.mock('@op/db/client', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
}));

import type { DbClient } from '@op/db/client';

import { setProposalCategories } from './setProposalCategories';

type InsertRow = { proposalId: string; taxonomyTermId: string };

function makeTx(options: {
  taxonomy?: { id: string };
  terms?: Array<{ id: string; label: string }>;
}) {
  const taxonomy = 'taxonomy' in options ? options.taxonomy : { id: 'tax1' };
  const terms = options.terms ?? [];

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn(() => ({ where: deleteWhere }));

  const findFirst = vi.fn().mockResolvedValue(taxonomy);
  const findMany = vi.fn().mockResolvedValue(terms);

  const insertedRows: InsertRow[][] = [];
  const values = vi.fn((rows: InsertRow[]) => {
    insertedRows.push(rows);
    return Promise.resolve(undefined);
  });
  const insertFn = vi.fn(() => ({ values }));

  const tx = {
    delete: deleteFn,
    insert: insertFn,
    _query: {
      taxonomies: { findFirst },
      taxonomyTerms: { findMany },
    },
  };

  return {
    tx: tx as unknown as DbClient,
    mocks: {
      deleteFn,
      deleteWhere,
      findFirst,
      findMany,
      insertFn,
      values,
      insertedRows,
    },
  };
}

describe('setProposalCategories', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('always deletes existing proposalCategories for the proposalId first', async () => {
    const { tx, mocks } = makeTx({
      terms: [{ id: 'term-parks', label: 'Parks' }],
    });

    await setProposalCategories({
      tx,
      proposalId: 'prop1',
      labels: ['Parks'],
    });

    expect(mocks.deleteFn).toHaveBeenCalledTimes(1);
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it('returns early without querying or inserting when labels are empty or blank', async () => {
    const { tx, mocks } = makeTx({ terms: [] });

    await setProposalCategories({
      tx,
      proposalId: 'prop1',
      labels: ['', '  '],
    });

    // Still clears existing links.
    expect(mocks.deleteFn).toHaveBeenCalledTimes(1);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });

  it('inserts a taxonomyTermId per matched label (happy path)', async () => {
    const { tx, mocks } = makeTx({
      terms: [
        { id: 'term-parks', label: 'Parks' },
        { id: 'term-d7', label: 'District 7' },
      ],
    });

    await setProposalCategories({
      tx,
      proposalId: 'prop1',
      labels: ['Parks', 'District 7'],
    });

    expect(mocks.insertFn).toHaveBeenCalledTimes(1);
    expect(mocks.insertedRows).toEqual([
      [
        { proposalId: 'prop1', taxonomyTermId: 'term-parks' },
        { proposalId: 'prop1', taxonomyTermId: 'term-d7' },
      ],
    ]);
  });

  it('dedupes and trims labels before lookup and insert', async () => {
    const { tx, mocks } = makeTx({
      terms: [{ id: 'term-parks', label: 'Parks' }],
    });

    await setProposalCategories({
      tx,
      proposalId: 'prop1',
      labels: ['  Parks  ', 'Parks'],
    });

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.insertFn).toHaveBeenCalledTimes(1);
    expect(mocks.insertedRows).toEqual([
      [{ proposalId: 'prop1', taxonomyTermId: 'term-parks' }],
    ]);
  });

  it('looks up all labels with a single findMany and no per-label findFirst (no N+1)', async () => {
    const { tx, mocks } = makeTx({
      terms: [
        { id: 'term-parks', label: 'Parks' },
        { id: 'term-d7', label: 'District 7' },
        { id: 'term-roads', label: 'Roads' },
      ],
    });

    await setProposalCategories({
      tx,
      proposalId: 'prop1',
      labels: ['Parks', 'District 7', 'Roads'],
    });

    // findMany batched over all labels; findFirst only for the taxonomy itself.
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
  });

  it('skips unmatched labels and inserts only resolved ids', async () => {
    const { tx, mocks } = makeTx({
      terms: [{ id: 'term-parks', label: 'Parks' }],
    });

    await setProposalCategories({
      tx,
      proposalId: 'prop1',
      labels: ['Parks', 'Ghost'],
    });

    expect(mocks.insertFn).toHaveBeenCalledTimes(1);
    expect(mocks.insertedRows).toEqual([
      [{ proposalId: 'prop1', taxonomyTermId: 'term-parks' }],
    ]);
  });

  it('returns without inserting when the "proposal" taxonomy is missing', async () => {
    const { tx, mocks } = makeTx({
      taxonomy: undefined,
      terms: [{ id: 'term-parks', label: 'Parks' }],
    });

    await setProposalCategories({
      tx,
      proposalId: 'prop1',
      labels: ['Parks'],
    });

    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });
});
