import { logger } from '@op/logging';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// The paging contract is the whole subject here, so `listProposals` is the one
// boundary we drive: each test scripts a page sequence and asserts what the loop
// accumulated, which cursor it sent next, and what it reported about
// completeness.
vi.mock('../listProposals', () => ({ listProposals: vi.fn() }));

import { listProposals } from '../listProposals';
import { EXPORT_MAX_ROWS, EXPORT_PAGE_SIZE } from './constants';
import { listProposalsForExport } from './listProposalsForExport';

const PROCESS_INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

/** `n` distinct rows, ids suffixed so accumulation order is checkable. */
const rows = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `proposal-${offset + i}` }));

/**
 * Script consecutive `listProposals` results. `next` is what the real service
 * returns: an opaque cursor when it read past `limit`, otherwise null.
 */
const givenPages = (
  pages: Array<{ proposals: Array<{ id: string }>; total: number }>,
) => {
  vi.mocked(listProposals).mockReset();
  pages.forEach(({ proposals, total }, index) => {
    const isLast = index === pages.length - 1;
    vi.mocked(listProposals).mockResolvedValueOnce({
      proposals,
      total,
      hasMore: !isLast,
      next: isLast ? null : `cursor-${index}`,
      canManageProposals: true,
    } as never);
  });
};

const fetch = () =>
  listProposalsForExport({
    processInstanceId: PROCESS_INSTANCE_ID,
    userId: AUTH_USER_ID,
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listProposalsForExport', () => {
  it('returns a single page whole and reports it complete', async () => {
    givenPages([{ proposals: rows(12), total: 12 }]);

    const result = await fetch();

    expect(result.proposals).toHaveLength(12);
    expect(result.total).toBe(12);
    expect(result.truncated).toBe(false);
    expect(listProposals).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('reads an empty instance without paging or warning', async () => {
    givenPages([{ proposals: [], total: 0 }]);

    const result = await fetch();

    expect(result).toEqual({ proposals: [], total: 0, truncated: false });
    expect(listProposals).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('accumulates every page in order and threads each cursor forward', async () => {
    givenPages([
      { proposals: rows(EXPORT_PAGE_SIZE, 0), total: EXPORT_PAGE_SIZE + 3 },
      { proposals: rows(3, EXPORT_PAGE_SIZE), total: EXPORT_PAGE_SIZE + 3 },
    ]);

    const result = await fetch();

    expect(result.proposals).toHaveLength(EXPORT_PAGE_SIZE + 3);
    expect(result.truncated).toBe(false);
    // Order preserved across the seam, which is what makes the CSV row order
    // the query's order rather than an artifact of paging.
    expect(result.proposals[EXPORT_PAGE_SIZE - 1]?.id).toBe(
      `proposal-${EXPORT_PAGE_SIZE - 1}`,
    );
    expect(result.proposals[EXPORT_PAGE_SIZE]?.id).toBe(
      `proposal-${EXPORT_PAGE_SIZE}`,
    );

    // First read starts fresh; the second carries the first page's `next`.
    expect(vi.mocked(listProposals).mock.calls[0]?.[0].input.cursor).toBeNull();
    expect(vi.mocked(listProposals).mock.calls[1]?.[0].input.cursor).toBe(
      'cursor-0',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('always requests the export page size, never an unbounded limit', async () => {
    givenPages([{ proposals: rows(1), total: 1 }]);

    await fetch();

    expect(listProposals).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          processInstanceId: PROCESS_INSTANCE_ID,
          limit: EXPORT_PAGE_SIZE,
          skipAccessCheck: true,
          includeDocumentContent: true,
        }),
        user: { id: AUTH_USER_ID },
      }),
    );
  });

  describe('page boundaries', () => {
    // Off-by-one in keyset paging drops or duplicates the boundary row, so the
    // seam is exercised from both sides.
    it('treats a result that exactly fills one page as complete', async () => {
      givenPages([
        { proposals: rows(EXPORT_PAGE_SIZE), total: EXPORT_PAGE_SIZE },
      ]);

      const result = await fetch();

      expect(result.proposals).toHaveLength(EXPORT_PAGE_SIZE);
      expect(result.truncated).toBe(false);
      expect(listProposals).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('reads the one row past a full page', async () => {
      givenPages([
        { proposals: rows(EXPORT_PAGE_SIZE, 0), total: EXPORT_PAGE_SIZE + 1 },
        { proposals: rows(1, EXPORT_PAGE_SIZE), total: EXPORT_PAGE_SIZE + 1 },
      ]);

      const result = await fetch();

      expect(result.proposals).toHaveLength(EXPORT_PAGE_SIZE + 1);
      expect(result.truncated).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('the row ceiling', () => {
    const pagesToCeiling = EXPORT_MAX_ROWS / EXPORT_PAGE_SIZE;

    it('stops at the ceiling, reports it, and logs the counts', async () => {
      const total = EXPORT_MAX_ROWS + 1;
      givenPages([
        ...Array.from({ length: pagesToCeiling }, (_, i) => ({
          proposals: rows(EXPORT_PAGE_SIZE, i * EXPORT_PAGE_SIZE),
          total,
        })),
        // Reachable but never read: the ceiling ends the loop first.
        { proposals: rows(1, EXPORT_MAX_ROWS), total },
      ]);

      const result = await fetch();

      expect(result.proposals).toHaveLength(EXPORT_MAX_ROWS);
      expect(result.total).toBe(total);
      expect(result.truncated).toBe(true);
      expect(listProposals).toHaveBeenCalledTimes(pagesToCeiling);

      // Loud by contract — a silent truncation is the defect this replaces.
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('truncated'),
        expect.objectContaining({
          processInstanceId: PROCESS_INSTANCE_ID,
          rowsFetched: EXPORT_MAX_ROWS,
          total,
        }),
      );
    });

    it('does not flag truncation when the instance holds exactly the ceiling', async () => {
      // The ceiling is reached but nothing is left behind, so the file is
      // complete. Checking the ceiling before exhaustion would call this
      // truncated and tell the admin a whole file is short.
      givenPages(
        Array.from({ length: pagesToCeiling }, (_, i) => ({
          proposals: rows(EXPORT_PAGE_SIZE, i * EXPORT_PAGE_SIZE),
          total: EXPORT_MAX_ROWS,
        })),
      );

      const result = await fetch();

      expect(result.proposals).toHaveLength(EXPORT_MAX_ROWS);
      expect(result.truncated).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('completeness reporting', () => {
    it('warns when the rows read fall short of the total without the ceiling explaining it', async () => {
      // A delete landing mid-read, or a paging defect. Either way the count
      // mismatch is recorded rather than passed off as a complete export.
      givenPages([{ proposals: rows(8), total: 10 }]);

      const result = await fetch();

      expect(result.proposals).toHaveLength(8);
      expect(result.truncated).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('does not match'),
        expect.objectContaining({ rowsFetched: 8, total: 10 }),
      );
    });

    it('reports the total from the first page, ignoring later drift', async () => {
      // Later pages re-run the count query, so a concurrent insert moves it.
      // The snapshot is what the admin asked about.
      givenPages([
        { proposals: rows(EXPORT_PAGE_SIZE, 0), total: EXPORT_PAGE_SIZE + 2 },
        { proposals: rows(2, EXPORT_PAGE_SIZE), total: EXPORT_PAGE_SIZE + 40 },
      ]);

      const result = await fetch();

      expect(result.total).toBe(EXPORT_PAGE_SIZE + 2);
      expect(result.truncated).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('breaks out of a cursor that advances without returning rows', async () => {
      // `listProposals` should never do this. If the invariant breaks the loop
      // must end loudly rather than spin forever.
      vi.mocked(listProposals).mockResolvedValue({
        proposals: [],
        total: 5,
        hasMore: true,
        next: 'cursor-stuck',
        canManageProposals: true,
      } as never);

      const result = await fetch();

      expect(result.proposals).toEqual([]);
      expect(listProposals).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('no rows'),
        expect.objectContaining({ processInstanceId: PROCESS_INSTANCE_ID }),
      );
    });
  });
});
