/**
 * Shared configuration for the proposal theme analysis pipeline.
 *
 * The `@op/common` service layer, the Inngest workflow and the app read these,
 * so they live here rather than at each call site.
 */

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

/**
 * The model both passes run on.
 *
 * Named here in code rather than read from the environment. Services in this
 * repo run on different models, so a single deploy-wide setting would apply one
 * service's choice to every other one; each names what it wants and changing it
 * is a reviewable diff rather than a deploy-time setting nobody can see from the
 * code.
 *
 * One constant for both passes so they cannot drift apart. The common-ground
 * pass reads the themes pass's output, and a synthesis assembled by two
 * different models reasoning over one corpus is harder to account for than a
 * worse one assembled by the same model twice.
 *
 * The endpoint is still `AI_BASE_URL`, so this has to name a model that endpoint
 * serves.
 */
export const THEME_ANALYSIS_MODEL_ID = 'zai-org/GLM-5.3';
