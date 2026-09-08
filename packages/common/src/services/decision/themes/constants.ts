import type { ThemeAnalysisScope } from '../schemas/themeAnalysis';

/**
 * Shared configuration for the proposal theme analysis pipeline.
 *
 * The `@op/common` service layer, the Inngest workflow and the app read these,
 * so they live here rather than at each call site.
 */

/**
 * The lifetime of a stored analysis.
 *
 * Analysis state lives only in the cache. Nothing stands behind it, so this is
 * also how long a finished analysis stays readable: a facilitator who runs one,
 * closes the tab and comes back the next day runs it again.
 */
export const THEME_ANALYSIS_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * The cache key for one run.
 *
 * Namespaced by the instance and the scope it covers, then by the run's own id.
 * Every request is its own analysis — pressing the button twice gives two ids
 * and two records, and neither overwrites the other — while the prefix keeps a
 * phase-scoped run and a process-scoped run of the same instance in separate
 * namespaces rather than distinguishable only by a UUID.
 *
 * Every reader and writer builds the key through this, so no call site holds its
 * own copy of the format. It also means a reader needs the instance and the
 * scope as well as the id, which is why they travel together on the status
 * query.
 */
export const themeAnalysisCacheKey = ({
  processInstanceId,
  scope,
  analysisId,
}: {
  processInstanceId: string;
  scope: ThemeAnalysisScope;
  analysisId: string;
}) => `themeAnalysis:${processInstanceId}:${scope}:${analysisId}`;

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

/**
 * How long one model pass may take before the run gives up on it.
 *
 * There has to be a bound here, and it has to be well inside the serverless
 * function's own budget. Inngest invokes the handler once per step, so a step
 * that outruns that budget is killed by the platform — a
 * `FUNCTION_INVOCATION_TIMEOUT`, not an exception. Nothing catches it: the
 * failure handler never runs, the record is left saying `processing` forever,
 * and the facilitator waits out the client's own timer for a run that is already
 * dead. Bounding the call converts that into a reported failure with a cause.
 *
 * Five minutes per pass, two passes, each in its own step and so its own
 * invocation. That fits inside `maxDuration` on the workflows route with room
 * for the corpus read, and keeps a whole successful run inside the client's
 * wait.
 *
 * A pass that hits this reports rather than throws, so it does not retry: a
 * provider that has not answered in five minutes will not answer in five more,
 * and a retry would only spend the budget twice on its way to the same place.
 */
export const THEME_ANALYSIS_PASS_TIMEOUT_MS = 5 * 60 * 1000;
