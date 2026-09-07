/**
 * Shared configuration for the proposal theme analysis pipeline.
 *
 * The API service, the `@op/common` service layer, and the Inngest workflow
 * share one analysis record. The cache key format and the time-to-live (TTL)
 * must agree across all three, which is why they live here rather than at each
 * call site. The proposals export learned this the hard way: its signing TTL and
 * its recorded expiry drifted apart and it served dead URLs for 22 hours.
 */

/**
 * The lifetime of a cached theme analysis record.
 *
 * Analysis state lives only in the cache. No table backs it, so this is also how
 * long a finished analysis stays readable. A facilitator who runs one, closes
 * the tab, and comes back the next day runs it again.
 *
 * A day is the export's figure, kept for the same reason: it covers a working
 * session without holding a snapshot long enough to be mistaken for a record of
 * what the process said.
 */
export const THEME_ANALYSIS_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Builds the cache key for an analysis record.
 *
 * @param analysisId - The analysis the record belongs to.
 * @returns The namespaced key. Every reader and writer uses this, so no call
 *   site holds its own copy of the format.
 */
export const themeAnalysisCacheKey = (analysisId: string) =>
  `themeAnalysis:proposal:${analysisId}`;

/**
 * The most proposals one analysis reads.
 *
 * This is a prompt budget, not a memory bound. Every proposal in the corpus is
 * sent to the model in full, so the ceiling multiplied by
 * {@link THEME_ANALYSIS_PROPOSAL_CHARS} is roughly the prompt size, and the two
 * numbers only make sense together.
 *
 * Reaching it is never silent. The record carries `analyzedCount` alongside
 * `total`, and the dialog says which it is looking at — the same contract the
 * export's `truncated` flag has, and for the same reason. A synthesis that
 * quietly covers the first 100 of 400 proposals is worse than no synthesis: it
 * reads as a statement about the process.
 *
 * Raising it means chunking the corpus and merging per-chunk themes, which is a
 * different pipeline rather than a bigger constant.
 */
export const THEME_ANALYSIS_MAX_PROPOSALS = 100;

/**
 * Characters of each proposal's body the model sees.
 *
 * `listProposals` already caps `previewText` at 2000 characters, so this only
 * ever narrows it further. It is the smaller number because the corpus is read
 * whole: 100 proposals at the preview cap is a prompt nobody wants to pay for
 * twice per run, and the opening of a proposal is where its subject is.
 */
export const THEME_ANALYSIS_PROPOSAL_CHARS = 1_200;

/**
 * The fewest proposals worth analysing.
 *
 * Common ground between one proposal and nothing is that proposal, and the pass
 * costs the same as a real one. The request refuses below this rather than
 * returning an empty analysis, so the facilitator learns why instead of reading
 * a blank dialog.
 */
export const THEME_ANALYSIS_MIN_PROPOSALS = 2;
