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
 * The cache key for a finished result, by what it was computed over.
 *
 * Beside the per-run records rather than inside them. A run's record is owned
 * by the facilitator who asked and answers "how is my run going"; this answers
 * "has anyone already analysed exactly this corpus", which is a question about
 * the instance rather than about a run. The workflow reads it after the corpus
 * read and, on a hit, writes the run's record as completed from it — the run
 * still exists and is still the requester's, it just cost a corpus read instead
 * of two model passes.
 *
 * Not namespaced by scope, unlike the run record. A result is a function of the
 * proposals the model read and nothing else — the digest already names them —
 * so the same corpus read under two scopes is the same analysis, and keying it
 * twice would compute it twice. That happens in practice: an instance in its
 * first phase reads the same proposals whether asked for the phase or the whole
 * process, and the scheduled refresh asks for both.
 *
 * The `result:` segment keeps it out of the run namespace: a run's id is a UUID,
 * which a hex digest is not, but a prefix is a clearer boundary than a format.
 *
 * Shares the record TTL. A result that has outlived every record that could
 * have pointed at it is one that would be recomputed identically anyway.
 */
export const themeAnalysisResultCacheKey = ({
  processInstanceId,
  fingerprint,
}: {
  processInstanceId: string;
  fingerprint: string;
}) => `themeAnalysis:${processInstanceId}:result:${fingerprint}`;

/**
 * The lifetime of the latest snapshot of a scope.
 *
 * Longer than a run's record by design. A record is one facilitator's wait and
 * is over within the hour; the snapshot is what the button opens for everyone
 * who holds the role, and it is refreshed only when the proposals change. A
 * decision that goes quiet for a month has to run one analysis by hand before
 * the button opens instantly again, which is the trade for not storing these
 * forever in a cache that is the only copy.
 */
export const THEME_ANALYSIS_SNAPSHOT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * The cache key for the latest finished analysis of a scope.
 *
 * One per instance and scope, overwritten by whichever run finishes last. Under
 * the same namespace as the run records so the whole feature's state can be
 * found by one prefix, and with a fixed final segment — `latest` is not a UUID
 * and not a digest, so it cannot collide with either of the other two kinds of
 * key under the prefix.
 */
export const themeAnalysisSnapshotCacheKey = ({
  processInstanceId,
  scope,
}: {
  processInstanceId: string;
  scope: ThemeAnalysisScope;
}) => `themeAnalysis:${processInstanceId}:${scope}:latest`;

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
 * One constant for both passes so they cannot drift apart. The two run over
 * one corpus and are shown together as one analysis, and a synthesis assembled
 * by two different models reasoning over the same text is harder to account
 * for than a worse one assembled by the same model twice.
 *
 * Flash rather than the full model. Both passes are extraction with a fixed
 * output schema — name the themes running through a corpus, then say which of
 * them the proposals agree on — rather than open reasoning, and thinking is
 * already switched off for them (see `THEME_ANALYSIS_THINKING_OFF`). The larger
 * model's advantage is in the part we are not using, and its cost is paid in the
 * part that hurts here: two passes over a corpus of up to
 * `THEME_ANALYSIS_MAX_PROPOSALS` proposals, both inside one facilitator's wait.
 *
 * The endpoint is still `AI_BASE_URL`, so this has to name a model that endpoint
 * serves.
 */
export const THEME_ANALYSIS_MODEL_ID = 'zai-org/GLM-5.3-Flash';

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
 * invocation — and the two run at once, so the wait is the longer of them
 * rather than the sum. Raised from five, which was picked before the passes had
 * separate steps and turned out to be tighter than the work: the common-ground
 * pass reached it on a real run and was cut off mid-answer. Each step now gets a
 * whole invocation, so the ceiling that matters is `maxDuration` on the
 * workflows route (800s), and eight minutes sits inside it with margin.
 *
 * The ordering is the constraint, not the number: pass timeout < the route's
 * `maxDuration`, and the read plus the slower pass < the client's wait. Moving
 * this means checking `THEME_ANALYSIS_WAIT_TIMEOUT_MS` in the app against it.
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
 * Sized to the answers, which are now bounded by the prompts themselves: at
 * most eight themes, or at most six entries in each of the common-ground pass's
 * three lists, a sentence or two apiece. That is well under a thousand tokens
 * either way, so the rest of this is headroom for thinking.
 *
 * "The cost of setting it too high is nothing" was wrong, which is why this
 * came down from 16k. On a thinking model the cap bounds reasoning as well as
 * answer, and reasoning is time: a bigger cap does not make a pass slower by
 * itself, but it is the ceiling on how long one is allowed to take, and the
 * common-ground pass was running past five minutes against the old one. Too low
 * is still the worse direction — it truncates — but that failure now names
 * itself as `finish reason 'length'` rather than reading as a model returning
 * garbage, so this is a safe direction to move in.
 */
export const THEME_ANALYSIS_MAX_OUTPUT_TOKENS = 4_000;

/**
 * Request fields that turn the model's extended thinking off.
 *
 * The reason this exists: on a real run a pass spent its entire output budget
 * reasoning and wrote almost none of the answer — `finish reason 'length'` with
 * a couple of dozen characters before it. Reasoning is billed and waited for out
 * of the same budget as the reply, and at this endpoint's throughput the model
 * wants more of it than any timeout we can justify. The two passes summarise and
 * group bounded text against a fixed output shape; that is not work that needs
 * an extended chain of thought, and it is the one part of the cost that buys us
 * nothing here.
 *
 * Four fields for one switch, because the same weights are hosted behind stacks
 * that each named it differently, and `AI_BASE_URL` does not tell us which one
 * is answering. `thinking` is Z.ai's own spelling for GLM — `zai-org` is right
 * there in the model id. vLLM and SGLang read `chat_template_kwargs`, some
 * builds read a bare `enable_thinking`, and OpenAI-style gateways read
 * `reasoning_effort`.
 *
 * Sending all four rather than guessing one is safe here, and that is a
 * conclusion from evidence rather than a hope: this endpoint was already sent
 * `thinking` on its own, and answered normally instead of rejecting the
 * request — so it ignores fields it does not recognise. Guessing one at a time
 * costs a deploy and a run per guess, and gets the same answer.
 *
 * All four are known to survive the trip into the request body; there is a test.
 * If none of them takes effect, the reasoning-token count now recorded on a
 * truncated reply will say so plainly, and the remaining lever is the model
 * rather than the request.
 */
export const THEME_ANALYSIS_THINKING_OFF = {
  thinking: { type: 'disabled' },
  chat_template_kwargs: { enable_thinking: false },
  enable_thinking: false,
  // camelCase, alone among these. The SDK knows this one, so it maps it to
  // `reasoning_effort` on the wire — and drops the snake_case spelling that
  // would collide with it. The other three it does not know, so it forwards
  // them verbatim and they have to be written the way the endpoint reads them.
  // The wire test asserts the body rather than this object for exactly that
  // reason: what we set and what is sent are not the same shape.
  reasoningEffort: 'low',
} as const;
