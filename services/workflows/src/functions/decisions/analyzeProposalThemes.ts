import { setWithStatus } from '@op/cache';
import {
  THEME_ANALYSIS_CACHE_TTL_SECONDS,
  type CorpusProposal,
  type PassFailure,
  type ThemeAnalysisData,
  type ThemeAnalysisResult,
  type ThemeAnalysisScope,
  readCachedThemeAnalysisResult,
  readCorpusForAnalysis,
  runCommonGroundPass,
  runThemesPass,
  storeCachedThemeAnalysisResult,
  storeLatestThemeAnalysis,
  themeAnalysisCacheKey,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { realtime } from '@op/realtime/server';

/**
 * Write the analysis record.
 *
 * A whole record every time, not a patch, and nothing is read first. `identity`
 * carries everything the request's seed carried, so `identity` plus the status
 * fields below is already every field the schema names — there is nothing a read
 * could add.
 *
 * Reading anyway was worse than useless. The cache holds the only copy, so a
 * read has to tell "held nothing" apart from "did not answer", which means a
 * read that did not answer has to fail the step — and that put a cache blip
 * between a finished two-model analysis and the record that reports it. It also
 * put one inside the failure handler, where a throw would replace the real cause
 * and skip the broadcast that ends the facilitator's wait.
 *
 * Writing blind is safe here because this workflow and the request are the only
 * writers, and their writes are ordered: the seed, then `processing`, then one
 * terminal write.
 *
 * Writing without checking was not. `set` reports nothing, so every way a write
 * can fail — no cache configured, a client still coming up on a fresh
 * per-step invocation, a command clipped by its socket timeout — left the step
 * succeeding over a record that had not moved. Nothing then retried it, because
 * from Inngest's side nothing had gone wrong, and a finished analysis sat at
 * `processing` until the facilitator's wait ran out twenty-five minutes later.
 * So this throws instead: the one thing that can still repair a dropped write is
 * a retry by the caller that is holding the value.
 */
const recordAnalysis = async (
  identity: AnalysisIdentity,
  fields: AnalysisFields,
) => {
  // `satisfies` rather than a bare object, and `AnalysisFields` rather than a
  // Partial. Between them the compiler now checks what only the reader used to:
  // that identity and fields together make a whole record.
  //
  // They did not. `createdAt` is required by the schema and lived in neither —
  // the seed had it, the `processing` write passed it by hand, and the two
  // terminal writes simply did not. Both wrote a record that failed to parse on
  // the way back out, which `getThemeAnalysisStatus` reports as `not_found`: a
  // finished analysis read to the client as an analysis that never existed.
  // A `Partial` cannot catch a missing required field, which is why this is not
  // one.
  const record = { ...identity, ...fields } satisfies ThemeAnalysisData;

  const written = await setWithStatus(
    themeAnalysisCacheKey(identity),
    record,
    THEME_ANALYSIS_CACHE_TTL_SECONDS,
  );

  if (written.status !== 'ok') {
    // Thrown, not logged and swallowed. This is the record — there is no
    // database behind it — so a write that did not land means the analysis has
    // no result no matter how well the passes went. Failing the step is what
    // buys the retry, and a retried write costs one Redis command: the passes
    // above it are memoized by Inngest and are not paid for again.
    //
    // The status is in the message because it names the fix. `unconfigured` is
    // a deployment missing REDIS_URL, `not-ready` a connection problem,
    // `timeout` a command clipped by its socket bound, and they point at three
    // different places.
    throw new Error(
      `Could not store the theme analysis record (${written.status}).`,
    );
  }
};

/**
 * Tell the facilitator waiting on this analysis that its record has moved.
 *
 * Broadcast-only: the record written just before this is the source of truth,
 * and the message carries no payload — subscribers re-read
 * `getThemeAnalysisStatus` on receipt.
 *
 * Sent for the intermediate `processing` write as well as the terminal one. The
 * client polls behind this, so a lost broadcast costs latency rather than
 * correctness — but the poll is slow by design, and the broadcast is what makes
 * a finished analysis appear at once rather than on the next tick.
 *
 * An analysis that settles before the client's socket join lands is covered the
 * same way every other channel covers it — the client re-reads its query once
 * the join is confirmed, and whatever settled before then is in that read.
 *
 * `realtime.publish` logs and swallows its own failures, so this cannot fail the
 * run or trigger a retry that would rewrite a settled record. That is also why
 * it shares a step with the write it announces: a retried step re-sends a
 * broadcast, which is harmless, rather than re-running a model pass.
 */
const notifyAnalysisChanged = (analysisId: string) =>
  realtime.publish(Channels.proposalThemeAnalysis(analysisId), {
    // A fresh id per publish. The client drops a broadcast carrying an id it has
    // already handled, so an id shared across this run's two reports would let
    // `processing` suppress the terminal one.
    mutationId: crypto.randomUUID(),
  });

/**
 * Writes the record and then announces it, as one step.
 *
 * One invocation rather than two. Every step is a round trip through Inngest —
 * the handler is re-invoked, replays to the step, runs it, and reports back —
 * and the write and its broadcast were paying for two of those to do a Redis
 * command and a publish. Together they are one, and the broadcast still follows
 * the write it describes: if the write throws, the publish is never reached, and
 * the retry does both again.
 */
const recordAndNotify = async (
  identity: AnalysisIdentity,
  fields: AnalysisFields,
) => {
  await recordAnalysis(identity, fields);
  await notifyAnalysisChanged(identity.analysisId);
};

/**
 * The fields that identify a record and never change once it is seeded — and,
 * between them, the cache key it lives under.
 */
type AnalysisIdentity = Pick<
  ThemeAnalysisData,
  'analysisId' | 'processInstanceId' | 'userId' | 'createdAt'
> & { scope: ThemeAnalysisScope };

/**
 * Everything a write supplies on top of the identity.
 *
 * `Omit` rather than `Partial`, so `status` stays required and a write that
 * forgets a field the record schema demands does not compile.
 */
type AnalysisFields = Omit<ThemeAnalysisData, keyof AnalysisIdentity>;

/** What a run has once it has an answer, from the passes or from the cache. */
interface CompletedAnalysis {
  result: ThemeAnalysisResult;
  proposals: CorpusProposal[];
  total: number;
  /** The digest the result was, or should be, stored under. */
  fingerprint: string;
  /**
   * Whether the result came from the result cache. A reused result is not
   * written back — it is already there, under the same key, with a TTL that
   * has not run out.
   */
  reused: boolean;
}

/**
 * The diagnostic to record for a fault nobody classified.
 *
 * A caught value carries no guarantee of being an `Error`, and by the time one
 * reaches the handler it has crossed a step boundary and been rebuilt anyway.
 * The message is all that survives, so it is all this takes.
 */
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

const { proposalThemeAnalysisRequested } = Events;

/**
 * Reads a scope's proposals and reports the themes running through them, the
 * common ground between them, the proposals sitting outside it, and what to
 * suggest.
 *
 * Read the corpus; ask whether exactly this corpus has been analysed already;
 * if not, run the themes pass and the common-ground pass *at the same time*;
 * record the answer. Inngest invokes the handler once per step, so each gets
 * its own budget and its own line in the run — which is what makes "the
 * analysis was slow" answerable as "the read was slow" or "the model was slow"
 * without reading a log — and two steps started together run in two
 * invocations at once, so the model part of the wait is the slower pass rather
 * than both added up.
 *
 * The cache lookup is what turns most presses into no model calls at all. A
 * facilitator reopening a dialog they closed, or a colleague analysing the same
 * phase, is asking about text that has not changed, and the answer to that is
 * the answer already stored — keyed by a digest of the corpus, so an edit to any
 * proposal the model would read is a new analysis and anything else is not.
 *
 * The corpus is read once and carried through function state to both passes.
 * Re-reading it per step would be cheaper to serialize and wrong to do: the
 * indexes each pass grounds against are positions in that list, so a re-read
 * returning a different set would silently renumber them.
 */
export const analyzeProposalThemes = inngest.createFunction(
  {
    id: 'analyzeProposalThemes',
    // One retry, against Inngest's default of four. Most of the ways this fails
    // are deterministic — a corpus with nothing in it to compare, a reply that
    // does not match its schema — and repeating those buys nothing while each
    // attempt pays for a corpus read and up to two model calls. It also has to
    // finish losing inside the client's wait, or the facilitator is told the
    // analysis timed out instead of being told why it failed. One retry still
    // absorbs a momentary provider blip.
    retries: 1,
  },
  { event: proposalThemeAnalysisRequested.name },
  async ({ event, step }) => {
    const { analysisId, processInstanceId, userId, scope, createdAt } =
      proposalThemeAnalysisRequested.schema.parse(event.data);

    // Everything the seed carried, taken from the event rather than re-read, so
    // every write below is a complete record on its own — and it is also the
    // cache key, which the id alone does not name.
    const identity = {
      analysisId,
      processInstanceId,
      userId,
      scope,
      createdAt,
    };

    // Closes over `step` rather than taking it: Inngest's `step` type is
    // generated from the whole event schema, and naming it here would be a large
    // structural type to keep in step with it for no gain.
    const reportFailure = async (failure: PassFailure) => {
      await step.run('update-status-failed', () => {
        // Logged before the write, and inside the step rather than beside it.
        // Before, because a write that does not land now fails the step, and
        // the error that reaches the run is then the storage failure rather
        // than this — so a diagnosis kept only in the record would be lost in
        // exactly the case where the record is. Inside, because the function
        // body re-runs on every step, and a log out here would repeat itself
        // once per step for the rest of the run.
        logger.error('Theme analysis failed', {
          analysisId,
          processInstanceId,
          scope,
          errorCode: failure.code,
          errorMessage: failure.message,
        });

        return recordAndNotify(identity, {
          status: 'failed',
          // The code is what the facilitator sees, mapped to copy in their own
          // locale. The message is English and diagnostic, for the log and for
          // whoever reads the record.
          errorCode: failure.code,
          errorMessage: failure.message,
          completedAt: new Date().toISOString(),
        });
      });

      return { analysisId, status: 'failed' as const };
    };

    /**
     * The steps, in order, stopping at the first that reports a failure.
     *
     * Its own closure so each guard reads as one line of a sequence rather than
     * another branch in the handler, and so the handler below is left saying the
     * only thing it decides: record what came back, or report why nothing did.
     */
    const runAnalysisSteps = async (): Promise<
      PassFailure | ({ ok: true } & CompletedAnalysis)
    > => {
      await step.run('update-status-processing', () =>
        recordAndNotify(identity, { status: 'processing' }),
      );

      // Its own step. The corpus read is not the model call, and giving it its
      // own step means Inngest names whichever one is slow — and neither has to
      // finish inside the other's share of one invocation's budget.
      const corpus = await step.run('read-corpus', () =>
        readCorpusForAnalysis({
          processInstanceId,
          reader: { userId },
          scope,
        }),
      );

      // A reported failure, not a thrown one: this is the corpus telling us
      // there is nothing here to compare, and no number of retries changes that.
      if (!corpus.ok) {
        return corpus;
      }

      const { proposals, total, fingerprint } = corpus;

      // Before the model, not instead of the read: the read is what produces
      // the digest, and it is also the run-time access check for the `process`
      // scope. A hit here is the whole reason the read is cheap to repeat.
      const cached = await step.run('read-cached-result', () =>
        readCachedThemeAnalysisResult({ processInstanceId, fingerprint }),
      );

      if (cached) {
        return {
          ok: true as const,
          result: cached,
          proposals,
          total,
          fingerprint,
          reused: true,
        };
      }

      // Both at once. Neither pass reads the other's output — the common-ground
      // pass grounds against the corpus, not against the themes — so there was
      // never a reason for the facilitator to wait for one before the other
      // started. Inngest runs steps awaited together as parallel steps, each in
      // its own invocation, so the wait here is the slower of the two rather
      // than the sum, and each keeps its own timeout and its own line in the
      // run.
      const [analysed, habermas] = await Promise.all([
        step.run('analyze-themes', () => runThemesPass({ proposals })),
        step.run('find-common-ground', () =>
          runCommonGroundPass({ proposals }),
        ),
      ]);

      // The first failure, when both report one. They are the same kind of
      // failure over the same corpus, and the record carries one code.
      if (!analysed.ok) {
        return analysed;
      }

      if (!habermas.ok) {
        return habermas;
      }

      return {
        ok: true as const,
        result: { themes: analysed.themes, ...habermas.analysis },
        proposals,
        total,
        fingerprint,
        reused: false,
      };
    };

    // Assigned inside the try, written outside it. See the comment on the
    // completed write below for why the two are separated.
    let completed: CompletedAnalysis;

    try {
      const outcome = await runAnalysisSteps();

      if (!outcome.ok) {
        return await reportFailure(outcome);
      }

      completed = outcome;
    } catch (error) {
      // Only genuine faults reach here — the passes report their own failures
      // above. `error` has crossed a step boundary, so it is a `StepError`
      // rebuilt from `name`/`message`/`stack`: the class is gone and nothing
      // but the message survives. That is why the passes classify themselves
      // rather than throwing something this could inspect.
      await step.run('update-status-failed', async () => {
        // See the log in `reportFailure`. Here it matters more: this is the one
        // record of a fault nobody classified, and `messageOf` is all that
        // survived the step boundary already.
        logger.error('Theme analysis faulted', {
          analysisId,
          processInstanceId,
          scope,
          error,
        });

        await recordAndNotify(identity, {
          status: 'failed',
          errorCode: 'unknown',
          errorMessage: messageOf(error),
          completedAt: new Date().toISOString(),
        });
      });

      throw error;
    }

    // Outside the try. A step that fails after the analysis is finished must
    // not reach the failure handler, because that handler writes a whole record
    // with no `result` — it would overwrite a completed analysis with "failed".
    await step.run('update-status-completed', async () => {
      const completedAt = new Date().toISOString();

      await recordAnalysis(identity, {
        status: 'completed',
        result: completed.result,
        // Written in the same update as the result, so a reader that sees a
        // completed analysis can always say how much of the phase it covers.
        analyzedCount: completed.proposals.length,
        total: completed.total,
        completedAt,
      });

      // After the record and before the broadcast, so the next request for
      // this corpus finds it. Best effort — see `storeCachedThemeAnalysisResult`
      // — and skipped for a result that was read from there a moment ago.
      if (!completed.reused) {
        await storeCachedThemeAnalysisResult(
          { processInstanceId, fingerprint: completed.fingerprint },
          completed.result,
        );
      }

      // A manual run is also the newest analysis of this scope, so it becomes
      // what "View themes" opens for every other admin — the same snapshot the
      // scheduled refresh writes. Best effort for the same reason as the line
      // above.
      await storeLatestThemeAnalysis({
        status: 'ready',
        processInstanceId,
        scope,
        result: completed.result,
        analyzedCount: completed.proposals.length,
        total: completed.total,
        fingerprint: completed.fingerprint,
        completedAt,
      });

      await notifyAnalysisChanged(analysisId);
      await realtime.publish(
        Channels.proposalThemeAnalysisLatest(processInstanceId, scope),
        { mutationId: crypto.randomUUID() },
      );
    });

    logger.info('Theme analysis completed', {
      analysisId,
      processInstanceId,
      scope,
      reused: completed.reused,
      analyzedCount: completed.proposals.length,
      total: completed.total,
    });

    return { analysisId, status: 'completed' as const };
  },
);
