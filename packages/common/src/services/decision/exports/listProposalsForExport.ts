import { logger } from '@op/logging';

import { listProposals } from '../listProposals';
import { EXPORT_MAX_ROWS, EXPORT_PAGE_SIZE } from './constants';
import type { ProposalFromList } from './generateProposalsCsv';

export interface ProposalsForExport {
  /** Rows to write, in the query's own `createdAt desc` order. */
  proposals: ProposalFromList[];
  /**
   * Rows the instance held when the read started, independent of how many were
   * fetched. Taken from the first page: `listProposals` runs its count query
   * separately from the cursor-scoped data query, so `total` is the full count
   * on every page rather than a remaining-rows figure.
   */
  total: number;
  /**
   * True when {@link EXPORT_MAX_ROWS} ended the read before `total` was
   * reached. The caller must carry this to the admin — a short CSV that reports
   * success is indistinguishable from a complete one.
   */
  truncated: boolean;
}

/**
 * Read every proposal in an instance for export, paging until exhausted.
 *
 * This replaces a single `listProposals` call with `limit: 1000`, which took
 * only the first page and reported nothing about the rest. `listProposals`
 * offers no signal that a caller has under-read — `hasMore` and `next` are
 * there to be *used*, and ignoring them made a truncated export
 * indistinguishable from a complete one, in the UI, in the file, and in the
 * logs.
 *
 * Ordering and concurrency: paging is keyset, on the default `createdAt desc`.
 * A proposal created while this runs sorts ahead of the first page and is
 * therefore not picked up — an export is a snapshot, and missing a row that did
 * not exist when the admin asked is correct. It cannot duplicate or skip an
 * existing row, which is the property keyset paging buys over offsets.
 *
 * Sort order is deliberately not a parameter. `orderBy: 'votes'` sorts on a
 * computed aggregate that cannot be keyset, so `listProposals` returns
 * `next: null` on its first page — this loop would stop after one page and
 * report it complete. Withholding the parameter is what prevents that, so
 * anyone adding one has to reject `'votes'` explicitly; a silent single-page
 * export is the exact defect this function exists to remove.
 */
export const listProposalsForExport = async ({
  processInstanceId,
  userId,
}: {
  processInstanceId: string;
  /** Auth-user id of the admin who requested the export. */
  userId: string;
}): Promise<ProposalsForExport> => {
  const proposals: ProposalFromList[] = [];
  let cursor: string | null = null;
  let total = 0;
  let truncated = false;
  let pages = 0;

  for (;;) {
    const page = await listProposals({
      input: {
        // The filters this deliberately omits are documented at the call site
        // in the export workflow — that set defines what an export covers.
        processInstanceId,
        limit: EXPORT_PAGE_SIZE,
        cursor,
        skipAccessCheck: true,
        includeDocumentContent: true,
      },
      user: { id: userId },
    });

    pages += 1;
    // Snapshot the count from the first page. Later pages re-run the count, so
    // reading it every time would let a concurrent insert move the target the
    // completeness check below measures against.
    if (pages === 1) {
      total = page.total;
    }

    proposals.push(...page.proposals);

    // Nothing further to read: this is the only complete-and-done exit, and it
    // is checked before the ceiling so an instance holding exactly
    // EXPORT_MAX_ROWS rows is reported complete rather than truncated.
    if (!page.next) {
      break;
    }

    // A cursor that advances without returning rows would spin forever.
    // `listProposals` should not produce one — `next` is only set when it read
    // past `limit` — so this is a backstop against that invariant breaking,
    // and it is loud because a silent spin is the worse outcome.
    if (page.proposals.length === 0) {
      logger.warn('Proposal export: page advanced the cursor with no rows', {
        processInstanceId,
        pages,
        rowsFetched: proposals.length,
      });
      break;
    }

    if (proposals.length >= EXPORT_MAX_ROWS) {
      truncated = true;
      logger.warn('Proposal export truncated at the row ceiling', {
        processInstanceId,
        rowsFetched: proposals.length,
        total,
        ceiling: EXPORT_MAX_ROWS,
      });
      break;
    }

    cursor = page.next;
  }

  // A mismatch here means the paging read fewer rows than the instance holds
  // without the ceiling explaining it — a paging defect, or a delete landing
  // mid-read. Warned rather than thrown: proposals removed while the export
  // runs make this legitimately short, and failing a usable export on a benign
  // race trades one bad outcome for another. The count reaches the admin
  // either way via `total`.
  if (!truncated && proposals.length !== total) {
    logger.warn('Proposal export row count does not match the instance total', {
      processInstanceId,
      rowsFetched: proposals.length,
      total,
      pages,
    });
  }

  return { proposals, total, truncated };
};
