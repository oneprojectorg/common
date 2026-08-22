/** UUID shape (8-4-4-4-12 hex), case-insensitive, scanned anywhere in the text. */
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Pull proposal IDs out of whatever an admin pasted from a spreadsheet — one
 * column, whole rows, or the entire sheet. Sheets copies as tab-separated text,
 * so rather than parsing a shape we don't control, scan for UUID-shaped tokens
 * and drop everything else (headers, titles, quotes, prose). Lower-cased and
 * de-duplicated, in first-seen order.
 */
export function extractProposalIds(pastedText: string): Array<string> {
  const ids = new Set<string>();
  for (const match of pastedText.matchAll(UUID_PATTERN)) {
    ids.add(match[0].toLowerCase());
  }
  return [...ids];
}

/** What a paste resolves to against the proposal pool the dialog already has. */
export type ProposalIdImportSummary = {
  /** In the pool and assignable to the selected reviewer — what gets merged. */
  matchedIds: Array<string>;
  /** UUID-shaped but no such proposal in this phase. */
  notFoundCount: number;
  /** In the pool but blocked: already assigned, or the reviewer's own. */
  skippedCount: number;
};

/**
 * Forgiving by design: an ID we can't use is a count, never an error. The two
 * sets come from the dialog's already-loaded rows, so this adds no fetch.
 */
export function summarizeProposalIdImport({
  pastedText,
  poolIds,
  assignableIds,
}: {
  pastedText: string;
  /** Every proposal in the phase. */
  poolIds: ReadonlySet<string>;
  /** The subset with no blocker for the currently selected reviewer. */
  assignableIds: ReadonlySet<string>;
}): ProposalIdImportSummary {
  const matchedIds: Array<string> = [];
  let notFoundCount = 0;
  let skippedCount = 0;

  for (const id of extractProposalIds(pastedText)) {
    if (assignableIds.has(id)) {
      matchedIds.push(id);
    } else if (poolIds.has(id)) {
      skippedCount += 1;
    } else {
      notFoundCount += 1;
    }
  }

  return { matchedIds, notFoundCount, skippedCount };
}
