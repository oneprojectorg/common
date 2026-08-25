const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Pull proposal IDs out of whatever an admin pasted from a spreadsheet.
 * Sheets copies as tab-separated text we don't control, so scan for
 * UUID-shaped tokens and drop everything else. De-duplicated, first-seen order.
 */
export function extractProposalIds(pastedText: string): Array<string> {
  const ids = new Set<string>();
  for (const match of pastedText.matchAll(UUID_PATTERN)) {
    ids.add(match[0].toLowerCase());
  }
  return [...ids];
}

export type ProposalIdImportSummary = {
  /** In the pool and assignable to the selected reviewer — what gets merged. */
  matchedIds: Array<string>;
  /** UUID-shaped but no such proposal in this phase. */
  notFoundCount: number;
  /** In the pool but blocked: already assigned, or the reviewer's own. */
  skippedCount: number;
};

/** Forgiving by design: an ID we can't use is a count, never an error. */
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
