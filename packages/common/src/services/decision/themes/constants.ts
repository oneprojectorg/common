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
 * Eight minutes per pass, two passes, each in its own step and so its own
 * invocation. Raised from five, which was picked before the passes had separate
 * steps and turned out to be tighter than the work: the common-ground pass —
 * which reasons over the corpus *and* the first pass's themes — reached it on a
 * real run and was cut off mid-answer. Each step now gets a whole invocation, so
 * the ceiling that matters is `maxDuration` on the workflows route (800s), and
 * eight minutes sits inside it with margin.
 *
 * The ordering is the constraint, not the number: pass timeout < the route's
 * `maxDuration`, and the read plus both passes < the client's wait. Moving this
 * means checking `THEME_ANALYSIS_WAIT_TIMEOUT_MS` in the app against it.
 *
 * A pass that hits this reports rather than throws, so it does not retry: a
 * provider that has not answered in eight minutes will not answer in eight more,
 * and a retry would only spend the budget twice on its way to the same place.
 */
export const THEME_ANALYSIS_PASS_TIMEOUT_MS = 8 * 60 * 1000;

/**
 * The output cap for one pass.
 *
 * Set explicitly because the default belongs to whichever OpenAI-compatible
 * endpoint `AI_BASE_URL` names, and some of them are modest. The model this
 * feature runs on reasons before it answers, and that reasoning is charged
 * against the same cap as the answer — so a default sized for a chat reply can
 * end a pass part-way through its JSON.
 *
 * Sized for the larger of the two replies: up to eight themes, or the
 * common-ground pass's three lists over a hundred-proposal corpus, plus the
 * reasoning that precedes either. Generous on purpose — the cost of setting it
 * too high is nothing, and the cost of setting it too low is a truncated object
 * that reads as a model returning garbage.
 */
export const THEME_ANALYSIS_MAX_OUTPUT_TOKENS = 16_000;
